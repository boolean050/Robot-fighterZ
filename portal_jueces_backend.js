// --- IMPORTACIONES DE FIREBASE (V9 Modular) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, addDoc, onSnapshot, writeBatch, deleteDoc, query, orderBy, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// TUS CREDENCIALES REALES
const firebaseConfig = {
    apiKey: "AIzaSyDO5C61Kx2E1p4zJ8YdRGaPCD7UYro0dwc",
    authDomain: "robot-fighterz.firebaseapp.com",
    projectId: "robot-fighterz",
    storageBucket: "robot-fighterz.firebasestorage.app",
    messagingSenderId: "474556243025",
    appId: "1:474556243025:web:3aae6cbf276aa984a3ac70"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- VARIABLES GLOBALES Y MEMORIA ---
let currentUser = sessionStorage.getItem('juez_nombre');
let currentCategory = sessionStorage.getItem('juez_categoria');
let isAdmin = sessionStorage.getItem('juez_role') === 'admin';

let unsubscribeArena = null; 
let unsubscribeSesion = null;
let timerInterval = null;
let adminCombatTimeout = null;

let puntos = { r1Golpes: 0, r1Saques: 0, r2Golpes: 0, r2Saques: 0 };
let combateTerminado = false;
let todosLosRobots = [];


// Diccionario actualizado para evitar errores de plurales o minúsculas
const catMap = { "Pequeños": "pequenos", "Mediano": "mediano", "Medianos": "mediano", "Grandes": "grandes", "Seguimiento de línea": "seguimiento", "Evasor de obstáculos": "evasor" };

// --- 1. EL CADENERO (LECTURA DE URL Y ARRANQUE) ---
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const isRegistroMode = urlParams.get('modo') === 'registro';

    // REGLA DE ORO: Si trae el QR de registro, destruimos cualquier sesión 
    // previa en este dispositivo para forzar un registro limpio.
    if (isRegistroMode) {
        sessionStorage.clear();
        isAdmin = false;
        currentUser = null;
        currentCategory = null;
        
        mostrarPantalla('registroForm');
        document.getElementById('subtituloPrincipal').textContent = "Registro Oficial de Docentes";
    } 
    // Si ya es admin guardado
    else if (isAdmin) {
        mostrarPantalla('pantallaAdmin');
        window.cargarDatosAdmin();
        iniciarRadarSesion(); // <-- NUEVO: Para que siga escuchando si le quitan los poderes
    }
    // Si ya es juez guardado
    else if (currentUser && currentCategory) {
        mostrarPantalla('pantallaEspera');
        document.getElementById('nombreAsignado').textContent = currentUser;
        document.getElementById('categoriaAsignada').textContent = currentCategory;
        iniciarRadarArena();
        iniciarRadarSesion(); 
    } 
    // Si no hay sesión y no hay QR, pedimos login normal
    else {
        mostrarPantalla('loginForm');
        document.getElementById('subtituloPrincipal').textContent = "Iniciar Sesión - Docentes";
    }
});

function mostrarPantalla(id) {
    ['loginForm', 'registroForm', 'pantallaEspera', 'pantallaAdmin', 'pantallaRegistroExitoso'].forEach(p => {
        const el = document.getElementById(p);
        if(el) el.classList.add('hidden');
    });
    document.getElementById(id).classList.remove('hidden');
}

// --- 2. LOGIN NORMAL ---
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('loginNombre').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    const msg = document.getElementById('errorMsgLogin'); 

    try {
        const docRef = doc(db, "maestros_autorizados", nombre);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            msg.textContent = "❌ Usuario no encontrado. Regístrate con el código QR.";
            msg.classList.remove('hidden');
            return;
        }

        const data = docSnap.data();
        if (data.password !== password) {
            msg.textContent = "❌ Contraseña incorrecta.";
            msg.classList.remove('hidden');
            return;
        }

        await updateDoc(docRef, { sesion_activa: true });
        
        // Revisar qué rol tiene guardado en Firebase
        const rolUsuario = data.rol || 'juez';

        if (rolUsuario === 'admin' || rolUsuario === 'superadmin') {
            const adminToken = Date.now().toString() + Math.random().toString(36).substr(2);
            sessionStorage.setItem('juez_role', 'admin');
            
            // 🐛 AQUI ESTABA EL BICHO: Faltaba actualizar la variable global
            currentCategory = data.categoria || 'Sin Asignar';
            sessionStorage.setItem('juez_categoria', currentCategory);
            
            if (rolUsuario === 'superadmin') {
                sessionStorage.setItem('juez_superadmin', 'true');
                document.getElementById('subtituloPrincipal').textContent = `Panel Maestro (Root)`;
            } else {
                sessionStorage.setItem('juez_superadmin', 'false');
                // Pinta su nombre y categoría bajo "Pelea de robots"
                document.getElementById('subtituloPrincipal').textContent = `${nombre} - ${currentCategory}`;
            }
            
            sessionStorage.setItem('admin_token', adminToken);
            sessionStorage.setItem('juez_nombre', nombre);
            currentUser = nombre;
            
            // Ya con la memoria alineada, encendemos el radar con seguridad
            iniciarRadarSesion();

            isAdmin = true;
            mostrarPantalla('pantallaAdmin');
            window.cargarDatosAdmin();
        } else {
            activarSesionDocente(nombre, data.categoria);
        }

    } catch (error) {
        msg.textContent = "Error de conexión.";
        msg.classList.remove('hidden');
    }
});

// --- 3. REGISTRO POR QR ---
document.getElementById('registroForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('regNombre').value.trim();
    const categoria = document.getElementById('regCategoria').value;
    const pass1 = document.getElementById('regPassword1').value;
    const pass2 = document.getElementById('regPassword2').value;
    const msg = document.getElementById('errorMsgRegistro');

    if (pass1 !== pass2) {
        msg.textContent = "❌ Las contraseñas no coinciden.";
        msg.classList.remove('hidden');
        return;
    }
    if (pass1.length < 4) {
        msg.textContent = "❌ Usa una contraseña más segura.";
        msg.classList.remove('hidden');
        return;
    }

    // Bloquear botón para evitar doble clic
    const btnSubmit = document.querySelector('#registroForm button[type="submit"]');
    const originalText = btnSubmit.innerHTML;
    btnSubmit.innerHTML = "⏳ Registrando...";
    btnSubmit.disabled = true;

    try {
        await setDoc(doc(db, "maestros_autorizados", nombre), {
            nombre: nombre, categoria: categoria, password: pass1,
            sesion_activa: false, 
            fecha_registro: Date.now()
        });

        window.history.replaceState({}, document.title, window.location.pathname);
        
        // 🚀 ADIÓS ALERT FEO, HOLA MODAL PREMIUM
        document.getElementById('success-nombre').textContent = nombre;
        document.getElementById('success-categoria').textContent = categoria;
        
        const modal = document.getElementById('modalRegistroExitoso');
        modal.classList.remove('hidden');
        // Pequeño delay para que la animación de entrada fluya bien
        setTimeout(() => modal.setAttribute('data-show', 'true'), 50);

    } catch (error) {
        console.error("🔥 Error real de Firebase al registrar:", error);
        msg.textContent = "❌ Error de conexión. Intenta de nuevo.";
        msg.classList.remove('hidden');
    } finally {
        btnSubmit.innerHTML = originalText;
        btnSubmit.disabled = false;
    }
});

// Función global que ejecuta el botón verde del Pop-Up
window.cerrarModalRegistroYLogear = function() {
    const modal = document.getElementById('modalRegistroExitoso');
    modal.removeAttribute('data-show');
    
    // Esperamos a que acabe la animación para esconderlo
    setTimeout(() => {
        modal.classList.add('hidden');
        sessionStorage.clear();
        document.getElementById('registroForm').reset();
        
        mostrarPantalla('loginForm');
        document.getElementById('subtituloPrincipal').textContent = "Iniciar Sesión - Docentes";
        document.getElementById('errorMsgRegistro').classList.add('hidden');
    }, 300);
};

function activarSesionDocente(nombre, categoria) {
    currentUser = nombre;
    currentCategory = categoria;
    sessionStorage.setItem('juez_role', 'juez');
    sessionStorage.setItem('juez_nombre', currentUser);
    sessionStorage.setItem('juez_categoria', currentCategory);

    mostrarPantalla('pantallaEspera');
    document.getElementById('nombreAsignado').textContent = currentUser;
    document.getElementById('categoriaAsignada').textContent = currentCategory;
    
    iniciarRadarArena();
    iniciarRadarSesion();
}




// --- FUNCION VISUAL PARA MENSAJES CRÍTICOS (Ignora el bloqueo de Chrome) ---
function mostrarMensajeYSalir(mensaje, icono) {
    if(unsubscribeSesion) unsubscribeSesion();
    if(unsubscribeArena) unsubscribeArena();
    
    sessionStorage.clear();
    
    // Inyectamos un modal gigante a la fuerza en toda la pantalla
    document.body.innerHTML = `
        <div class="fixed inset-0 bg-gray-900/95 flex items-center justify-center p-4 z-[9999] transition-all">
            <div class="bg-white p-8 rounded-2xl text-center max-w-sm shadow-2xl">
                <div class="text-6xl mb-4 animate-bounce">${icono}</div>
                <h2 class="text-lg font-black text-gray-800 mb-6">${mensaje}</h2>
                <button onclick="window.location.reload()" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl w-full uppercase tracking-widest transition-all">Entendido</button>
            </div>
        </div>
    `;
}

// --- 4. RADAR DE SESIÓN (ANTI-EXPULSIONES EN TIEMPO REAL) ---
function iniciarRadarSesion() {
    if(!currentUser) return;
    const ref = doc(db, "maestros_autorizados", currentUser);
    
    unsubscribeSesion = onSnapshot(ref, (docSnap) => {
        if (!docSnap.exists()) return;
        
        const data = docSnap.data();
        const rolActualEnPantalla = sessionStorage.getItem('juez_role');

        // 1. ASCENSO: Era juez y lo hicieron admin
        if (data.rol === 'admin' && rolActualEnPantalla === 'juez') {
            mostrarMensajeYSalir("Te has convertido en ADMINISTRADOR de tu evento. Favor de volver a iniciar sesión.", "👑");
            return;
        }

        // 2. DESCENSO: Era admin y lo regresaron a juez
        if ((data.rol === 'juez' || !data.rol) && rolActualEnPantalla === 'admin') {
            mostrarMensajeYSalir("Ya no eres administrador. Ahora eres JUEZ, favor de iniciar sesión y esperar la ronda.", "🥲");
            return;
        }

        // 3. EXPULSIÓN / CIERRE DE SESIÓN NORMAL
        if (data.sesion_activa === false) {
            mostrarMensajeYSalir("Tu sesión ha sido cerrada por el sistema.", "🚪");
            return;
        } 
        
        // 4. CAMBIO DE CATEGORÍA
        if (data.categoria && data.categoria !== currentCategory) {
            if (rolActualEnPantalla === 'admin') {
                // Si es Admin, lo sacamos con un mensaje para que recargue sus permisos
                mostrarMensajeYSalir("El Súper Admin ha modificado tu categoría asignada. Favor de volver a iniciar sesión para aplicar los cambios.", "🔄");
                return;
            } else {
                // Si es Juez, se cambia silenciosamente sin sacarlo
                currentCategory = data.categoria;
                sessionStorage.setItem('juez_categoria', currentCategory);
                const tagCat = document.getElementById('categoriaAsignada');
                if(tagCat) tagCat.textContent = currentCategory;
                
                if(unsubscribeArena) unsubscribeArena();
                iniciarRadarArena(); 
            }
        }
    });
}



// --- 5. PANEL ADMIN: TABLA DE MAESTROS, HISTORIAL Y PADRÓN DE EQUIPOS ---
window.cargarDatosAdmin = function() {
    const yoSoySuper = sessionStorage.getItem('juez_superadmin') === 'true';
    const miCategoriaAdmin = sessionStorage.getItem('juez_categoria');

    // 1. LIMPIEZA VISUAL Y BLOQUEO DE ARENA
    const contAdmins = document.getElementById('tablaAdminsBody')?.closest('.bg-indigo-50');
    const contGestor = document.getElementById('dropzoneExcel')?.closest('.bg-gray-50');
    const contQR = document.getElementById('btnGenerarQR')?.closest('.bg-indigo-50');
    const btnAgregarEq = document.getElementById('btnMostrarModalAgregar');
    const selectCatArena = document.getElementById('admin-arena-select');

    if (!yoSoySuper) {
        if(contAdmins) contAdmins.classList.add('hidden');
        if(contGestor) contGestor.classList.add('hidden');
        if(contQR) contQR.classList.add('hidden');
        if(btnAgregarEq) btnAgregarEq.classList.add('hidden');
        
        if(selectCatArena) {
            // ¡TU IDEA!: Reemplazamos las opciones por 1 sola para convertirlo en un "label" visual.
            // Esto evita que salga vacío y mantiene la estética del cuadro redondeado.
            selectCatArena.innerHTML = `<option value="${miCategoriaAdmin}">${miCategoriaAdmin || 'SIN CATEGORÍA'}</option>`;
            selectCatArena.disabled = true;
            selectCatArena.className = "w-full mb-3 p-2 rounded-lg bg-emerald-700 text-white text-[11px] uppercase tracking-widest font-black text-center shadow-inner cursor-not-allowed appearance-none";
        }
    } else {
        if(contAdmins) contAdmins.classList.remove('hidden');
        if(contGestor) contGestor.classList.remove('hidden');
        if(contQR) contQR.classList.remove('hidden');
        if(btnAgregarEq) btnAgregarEq.classList.remove('hidden');
        
        if(selectCatArena) {
            // Restauramos todas las opciones para que el Súper Admin sí pueda elegir
            selectCatArena.innerHTML = `
                <option value="Pequeños">Pequeños</option>
                <option value="Mediano">Mediano</option>
                <option value="Grandes">Grandes</option>
                <option value="Seguimiento de línea">Seguimiento de línea</option>
                <option value="Evasor de obstáculos">Evasor de obstáculos</option>
            `;
            selectCatArena.disabled = false;
            selectCatArena.className = "w-full mb-3 p-2 rounded-lg bg-gray-50 border border-gray-200 text-sm font-bold text-gray-700 focus:outline-none transition-all";
        }
    }

    // 2. CARGAR MAESTROS Y ADMINS (Filtrados para Admin Normal)
    onSnapshot(collection(db, "maestros_autorizados"), (snapshot) => {
        const tbodyJueces = document.getElementById('tablaJuecesBody');
        const tbodyAdmins = document.getElementById('tablaAdminsBody');
        if(!tbodyJueces || !tbodyAdmins) return;
        
        tbodyJueces.innerHTML = '';
        tbodyAdmins.innerHTML = '';
        
        let listaMaestros = [];
        snapshot.forEach(docSnap => listaMaestros.push({ id: docSnap.id, ...docSnap.data() }));
        listaMaestros.sort((a, b) => (a.categoria || 'Z').localeCompare(b.categoria || 'Z'));

        listaMaestros.forEach((m) => {
            const esEsteAdmin = m.rol === 'admin';
            const statusHtml = m.sesion_activa 
                ? `<span class="text-emerald-500 font-bold">🟢 On</span>` 
                : `<span class="text-red-500 font-bold">🔴 Off</span>`;

            if (esEsteAdmin) {
                if(yoSoySuper) {
                    tbodyAdmins.innerHTML += `
                        <tr class="hover:bg-indigo-50 border-b border-indigo-100">
                            <td class="px-1 py-2 text-[9px] font-black text-indigo-900">${m.nombre}</td>
                            <td class="px-1 py-2 text-center text-[9px] font-bold text-indigo-600">${m.categoria || 'N/A'}</td>
                            <td class="px-1 py-2 text-center text-[10px]">${statusHtml}</td>
                            <td class="px-1 py-2 text-center flex justify-center gap-1 mt-1">
                                <button onclick="editarCategoria('${m.id}', '${m.categoria}')" title="Editar" class="bg-blue-100 text-blue-700 hover:bg-blue-600 hover:text-white px-2 rounded font-bold text-[9px] transition-all">✏️</button>
                                <button onclick="descenderAdmin('${m.id}')" title="Descender a Juez" class="bg-blue-100 text-blue-700 hover:bg-blue-600 hover:text-white px-2 rounded font-bold text-[9px] transition-all">🔵</button>
                                <button onclick="cerrarSesionDocente('${m.id}')" title="Cerrar Sesión" class="bg-amber-100 text-amber-600 hover:bg-amber-500 hover:text-white px-2 rounded font-bold text-[9px] transition-all">🟡</button>
                                <button onclick="eliminarDocente('${m.id}')" title="Expulsar" class="bg-red-100 text-red-600 hover:bg-red-600 hover:text-white px-2 rounded font-bold text-[9px] transition-all">🔴</button>
                            </td>
                        </tr>
                    `;
                }
            } else {
                // FILTRO: Si es Admin Normal, solo dibuja jueces que sean de su misma categoría
                if (!yoSoySuper && (m.categoria || '').toLowerCase() !== (miCategoriaAdmin || '').toLowerCase()) {
                    return; // Saltamos a este maestro
                }

                let botonesJuez = yoSoySuper 
                    ? `
                        <button onclick="editarCategoria('${m.id}', '${m.categoria}')" title="Editar" class="bg-blue-100 text-blue-700 hover:bg-blue-600 hover:text-white px-2 rounded font-bold text-[9px] transition-all">✏️</button>
                        <button onclick="ascenderAJuez('${m.id}')" title="Ascender a Admin" class="bg-purple-100 text-purple-700 hover:bg-purple-600 hover:text-white px-2 rounded font-bold text-[9px] transition-all">🟣</button>
                        <button onclick="cerrarSesionDocente('${m.id}')" title="Cerrar Sesión" class="bg-amber-100 text-amber-600 hover:bg-amber-500 hover:text-white px-2 rounded font-bold text-[9px] transition-all">🟡</button>
                        <button onclick="eliminarDocente('${m.id}')" title="Expulsar" class="bg-red-100 text-red-600 hover:bg-red-600 hover:text-white px-2 rounded font-bold text-[9px] transition-all">🔴</button>
                    `
                    : `<button onclick="cerrarSesionDocente('${m.id}')" title="Cerrar Sesión" class="bg-amber-100 text-amber-600 hover:bg-amber-500 hover:text-white px-2 rounded font-bold text-[9px] transition-all">🟡</button>`; 

                tbodyJueces.innerHTML += `
                    <tr class="hover:bg-gray-50 border-b border-gray-100">
                        <td class="px-1 py-2 text-[9px] font-black text-gray-700">${m.nombre}</td>
                        <td class="px-1 py-2 text-[9px] text-gray-500 font-bold">${m.categoria || 'N/A'}</td>
                        <td class="px-1 py-2 text-center text-[10px]">${statusHtml}</td>
                        <td class="px-1 py-2 text-center flex justify-center gap-1 mt-1">
                            ${botonesJuez}
                        </td>
                    </tr>
                `;
            }
        });
    });

    // 3. RECUPERAR EL HISTORIAL DE EXCEL (Solo SuperAdmin)
    if (yoSoySuper) {
        getDocs(query(collection(db, "historial_archivos"), orderBy("fecha", "desc"))).then(snap => {
            const lista = document.getElementById('listaArchivos');
            if(lista) {
                lista.innerHTML = '';
                snap.forEach(doc => {
                    const d = new Date(doc.data().fecha);
                    const day = String(d.getDate()).padStart(2, '0');
                    const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
                    const month = months[d.getMonth()];
                    const year = d.getFullYear();
                    const time = d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    const fechaExacta = `${day}/${month}/${year} ${time}`;

                    lista.innerHTML += `<li class="text-[10px] text-gray-600 flex justify-between items-center bg-white p-1.5 rounded border border-gray-100 shadow-sm mb-1">
                        <div class="flex flex-col">
                            <span class="font-bold text-emerald-700">📄 ${doc.data().nombre}</span>
                            <span class="text-gray-400 font-mono">${fechaExacta}</span>
                        </div>
                        <button onclick="eliminarArchivoExcel('${doc.id}', '${doc.data().nombre}')" title="Borrar equipos de este Excel" class="bg-red-50 text-red-500 hover:bg-red-500 hover:text-white p-1.5 rounded transition-colors active:scale-90">🗑️</button>
                    </li>`;
                });
            }
        });
    }

    // 4. CARGAR PADRÓN DE EQUIPOS EN TIEMPO REAL (Filtro Robusto)
    onSnapshot(collection(db, "competidores"), (querySnapshot) => {
        todosLosRobots = [];
        const tablaEquipos = document.getElementById('tablaEquiposBody');
        if (tablaEquipos) tablaEquipos.innerHTML = '';

        querySnapshot.forEach((docSnap) => { 
            todosLosRobots.push({ id: docSnap.id, ...docSnap.data() }); 
        });

        // FILTRO DE PODER: Comparamos en minúsculas para que no falle por acentos o mayúsculas
        let equiposFiltrados = todosLosRobots;
        if (!yoSoySuper && miCategoriaAdmin) {
            equiposFiltrados = todosLosRobots.filter(r => (r.categoria_original || '').toLowerCase() === miCategoriaAdmin.toLowerCase());
        }

        equiposFiltrados.sort((a, b) => (a.categoria_original || 'Z').localeCompare(b.categoria_original || 'Z'));

        if (tablaEquipos) {
            equiposFiltrados.forEach((data) => {
                tablaEquipos.innerHTML += `
                <tr class="hover:bg-emerald-50 border-b border-gray-100">
                    <td class="px-2 py-2 text-[10px] font-black text-gray-800 uppercase">${data.nombre}</td>
                    <td class="px-2 py-2 text-[10px] text-gray-600 font-bold uppercase">${data.categoria_original || 'N/A'}</td>
                    <td class="px-2 py-2 text-[10px] text-gray-500 uppercase">${data.facultad || 'N/A'}</td>
                    <td class="px-2 py-2 text-center text-[10px]">
                        <button onclick="eliminarEquipo('${data.id}', '${data.nombre}')" title="Eliminar este equipo" class="bg-red-100 text-red-600 hover:bg-red-600 hover:text-white px-2 py-0.5 rounded font-bold transition-all">X</button>
                    </td>
                </tr>`;
            });
        }
        actualizarDropdownsRobots();
    });
};


// --- ACCIONES DE ADMIN (AMARILLA Y ROJA) ---
window.cerrarSesionDocente = async (id) => {
    if(!confirm("🟡 ¿Cerrar sesión a este docente? Tendrá que volver a ingresar su contraseña.")) return;
    await updateDoc(doc(db, "maestros_autorizados", id), { sesion_activa: false });
};

window.eliminarDocente = async (id) => {
    if(!confirm("🔴 ¡ADVERTENCIA! ¿Borrar este docente PERMANENTEMENTE?")) return;
    await deleteDoc(doc(db, "maestros_autorizados", id));
};

// --- NUEVO SISTEMA PARA EDITAR DOCENTE (CATEGORÍA Y CONTRASEÑA) ---
let idDocenteEditando = null;

window.editarCategoria = (id, categoriaActual) => {
    idDocenteEditando = id;
    const modal = document.getElementById('modalEditarCat');
    const select = document.getElementById('selectNuevaCat');
    const inputPass = document.getElementById('inputNuevaPassword');
    const labelNombre = document.getElementById('nombreDocenteEditando');
    
    // Limpiamos la contraseña y ponemos el nombre del profe
    if(inputPass) inputPass.value = '';
    if(labelNombre) labelNombre.textContent = `⚙️ Modificando a: ${id}`;
    
    // Pre-seleccionar la categoría que ya tiene el maestro
    for(let i = 0; i < select.options.length; i++) {
        if(select.options[i].value === categoriaActual) {
            select.selectedIndex = i;
            break;
        }
    }
    
    modal.classList.remove('hidden');
};

document.getElementById('btnCancelarEdicion')?.addEventListener('click', () => {
    document.getElementById('modalEditarCat').classList.add('hidden');
    idDocenteEditando = null;
});

document.getElementById('btnGuardarEdicion')?.addEventListener('click', async () => {
    if(!idDocenteEditando) return;
    
    const nuevaCat = document.getElementById('selectNuevaCat').value;
    const nuevaPass = document.getElementById('inputNuevaPassword').value.trim();
    const btn = document.getElementById('btnGuardarEdicion');
    
    btn.innerHTML = "⏳...";
    btn.disabled = true;
    
    try {
        // Preparamos los datos a enviar
        let actualizaciones = { categoria: nuevaCat };
        
        // Si el admin escribió algo en la contraseña, también la actualizamos
        if (nuevaPass !== '') {
            actualizaciones.password = nuevaPass;
        }
        
        await updateDoc(doc(db, "maestros_autorizados", idDocenteEditando), actualizaciones);
        
        if (nuevaPass !== '') {
            alert(`✅ Se actualizó la categoría y la contraseña.\n\nLa nueva clave de acceso para "${idDocenteEditando}" es: ${nuevaPass}`);
        }
        
        document.getElementById('modalEditarCat').classList.add('hidden');
    } catch(e) {
        alert("Error al actualizar la información del docente.");
    } finally {
        btn.innerHTML = "GUARDAR";
        btn.disabled = false;
        idDocenteEditando = null;
    }
});

// --- GENERADOR DE CÓDIGO QR ---
document.getElementById('btnGenerarQR')?.addEventListener('click', () => {
    const urlRegistro = window.location.origin + window.location.pathname + "?modo=registro";
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(urlRegistro)}`;
    
    document.getElementById('imgQR').src = qrUrl;
    
    // Nuevo: Asignar la URL al texto que pusimos abajo del QR
    const link = document.getElementById('linkQR');
    link.href = urlRegistro;
    link.textContent = urlRegistro;

    document.getElementById('boxQR').classList.remove('hidden');
    document.getElementById('boxQR').classList.add('flex'); // Asegura que use Flexbox para centrar
    document.getElementById('btnGenerarQR').textContent = "Actualizar QR";
});

// --- EL VERDADERO TIEMPO REAL: onSnapshot (ARENAS Y COMBATES) ---
function iniciarRadarArena() {
    if (!currentCategory) return;

    // Usamos el traductor indestructible para que empate con el Admin
    const catTag = obtenerTagExacto(currentCategory);
    if(!catTag) return; 

    const arenaRef = doc(db, "arenas", catTag);

    unsubscribeArena = onSnapshot(arenaRef, (docSnap) => {
        if (!docSnap.exists()) return;
        const data = docSnap.data();
        
        // ¡Usamos TUS estados originales para no romper tu lógica!
        if (data.estado === 'peleando') {
            // Forzamos que se pinten los nombres en las capsulitas azul y amarilla
            const lblR1 = document.getElementById('nombreR1') || document.getElementById('eval-r1-nombre');
            const lblR2 = document.getElementById('nombreR2') || document.getElementById('eval-r2-nombre');
            if (lblR1) lblR1.textContent = data.r1;
            if (lblR2) lblR2.textContent = data.r2;

            activarModoCombate(data);
        } else if (data.estado === 'ko' && !combateTerminado) {
            finalizarCombatePorKO();
        } else if (data.estado === 'inactivo') {
            document.getElementById('juez-modo-espera').classList.remove('hidden');
            document.getElementById('juez-modo-combate').classList.add('hidden');
            document.getElementById('juez-modo-carrera')?.classList.add('hidden');
            if(timerInterval) clearInterval(timerInterval);
            combateTerminado = false;
        } else if (data.estado === 'finalizado') {
            if(unsubscribeArena) unsubscribeArena();
            if(timerInterval) clearInterval(timerInterval);
            
            // Agregamos el '?' (Optional Chaining) para que no crashee si un elemento no existe
            document.getElementById('loginForm')?.classList.add('hidden');
            document.getElementById('pantallaEspera')?.classList.add('hidden');
            document.getElementById('pantallaAdmin')?.classList.add('hidden');
            document.getElementById('juez-modo-carrera')?.classList.add('hidden');
            document.getElementById('juez-modo-combate')?.classList.add('hidden');
            document.getElementById('encabezadoPrincipal')?.classList.add('hidden');
            
            const finalScreen = document.getElementById('pantallaFinal');
            if (finalScreen) finalScreen.classList.replace('hidden', 'flex');
            
            sessionStorage.clear();
        }
    });
}

function activarModoCombate(data) {
    document.getElementById('juez-modo-espera').classList.add('hidden');
    
    const categoriaJuez = sessionStorage.getItem('juez_categoria') || ''; 
    const isCarrera = categoriaJuez === 'Evasor' || categoriaJuez === 'Seg. de línea' || categoriaJuez.includes('Línea');

    if (isCarrera) {
        document.getElementById('juez-modo-combate').classList.add('hidden');
        document.getElementById('juez-modo-carrera').classList.remove('hidden');
    } else {
        document.getElementById('juez-modo-combate').classList.remove('hidden');
        document.getElementById('juez-modo-carrera').classList.add('hidden');
    }
    
    document.getElementById('juez-robot1').textContent = data.robot1;
    document.getElementById('juez-robot2').textContent = data.robot2;
    
    // 🔥 NOMBRES EN LOS BOTONES GIGANTES
    const lblR1 = document.getElementById('btn-lbl-r1');
    const lblR2 = document.getElementById('btn-lbl-r2');
    if(lblR1) lblR1.textContent = data.robot1;
    if(lblR2) lblR2.textContent = data.robot2;

    combateTerminado = false;
    if(timerInterval) clearInterval(timerInterval);
    
    iniciarCronometro(data.tiempo_inicio);
}


// 🔥 MEMORIA A LARGO PLAZO PARA EL RELOJ
let idPeleaActual = sessionStorage.getItem('pelea_id_actual') || null;
let tiempoInicioLocal = parseFloat(sessionStorage.getItem('pelea_inicio_local')) || 0;

function iniciarCronometro(tiempoInicioServidor) {
    combateTerminado = false; 
    
    // 1. FORZAMOS LOS BOTONES A GRIS / APAGADO
    ['r1', 'r2'].forEach(r => {
        const bg = document.getElementById(`btn-dec-${r}-golpes`);
        const bk = document.getElementById(`btn-dec-${r}-ko`);
        const claseGris = "w-full bg-gray-200 text-gray-500 font-black py-4 rounded-xl text-[13px] uppercase tracking-widest cursor-not-allowed border-b-4 border-gray-300 transition-all text-center shadow-sm select-none";
        if(bg) bg.className = claseGris;
        if(bk) bk.className = claseGris;
    });
    
    const statusText = document.getElementById('status-dictamen');
    if (statusText) {
        statusText.className = "text-[12px] font-black text-gray-400 text-center uppercase tracking-widest mb-4";
        statusText.innerHTML = "⏳ ESPERANDO FIN DE PELEA...";
    }

    // 2. MAGIA ANTI-AMNESIA (Sobrevive al F5)
    if (idPeleaActual !== tiempoInicioServidor.toString()) {
        idPeleaActual = tiempoInicioServidor.toString();
        tiempoInicioLocal = Date.now() / 1000;
        sessionStorage.setItem('pelea_id_actual', idPeleaActual);
        sessionStorage.setItem('pelea_inicio_local', tiempoInicioLocal);
    }

    let duracionTotal = 300; 

    if(timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        let ahora = Date.now() / 1000; 
        let transcurrido = ahora - tiempoInicioLocal;
        let restante = Math.ceil(duracionTotal - transcurrido);

        if (restante <= 0) {
            clearInterval(timerInterval);
            document.getElementById('cronometro-juez').textContent = "00:00";
            finalizarCombateNatural();
        } else {
            let m = Math.floor(restante / 60);
            let s = Math.floor(restante % 60);
            document.getElementById('cronometro-juez').textContent = 
                `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
    }, 1000);
}

function finalizarCombateNatural() {
    combateTerminado = true;
    habilitarEnvioVeredicto("TIEMPO AGOTADO");
}

function finalizarCombatePorKO() {
    combateTerminado = true;
    if(timerInterval) clearInterval(timerInterval);
    document.getElementById('cronometro-juez').textContent = "K.O.";
    habilitarEnvioVeredicto("K.O. DECLARADO");
}

function habilitarEnvioVeredicto(texto) {
    // Encendemos los botones con ALTO CONTRASTE para los Ingenieros
    ['r1', 'r2'].forEach(r => {
        const btnGolpes = document.getElementById(`btn-dec-${r}-golpes`);
        const btnKo = document.getElementById(`btn-dec-${r}-ko`);
        
        if(btnGolpes) {
            btnGolpes.className = "w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-xl text-[14px] uppercase tracking-widest shadow-xl border-b-4 border-emerald-800 transition-all text-center cursor-pointer active:scale-95 active:translate-y-1 animate-pulse select-none";
        }
        if(btnKo) {
            btnKo.className = "w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-xl text-[14px] uppercase tracking-widest shadow-xl border-b-4 border-red-800 transition-all text-center cursor-pointer active:scale-95 active:translate-y-1 animate-pulse select-none";
        }
    });
    
    const statusText = document.getElementById('status-dictamen');
    if(statusText) {
        statusText.className = "text-[12px] font-black text-emerald-600 text-center uppercase tracking-widest mb-4";
        statusText.innerHTML = `✅ ${texto} - SELECCIONA AL GANADOR`;
    }
}

window.enviarVeredictoFinal = async function(ladoGanador, metodo) {
    if (!combateTerminado) return; 
    
    // Leemos los nombres directamente de los nuevos labels del HTML
    const r1Name = document.getElementById('btn-lbl-r1').innerText;
    const r2Name = document.getElementById('btn-lbl-r2').innerText;
    
    const ganadorNombre = ladoGanador === 'r1' ? r1Name : r2Name;
    const puntosGanados = metodo === 'ko' ? 5 : 3;
    
    if(!confirm(`¿Declarar a ${ganadorNombre} como ganador oficial por ${metodo.toUpperCase()} (+${puntosGanados} pts)?`)) return;

    // Mantener estructura original de puntos para no romper otras funciones
    let puntosEstructura = { r1Golpes: 0, r1Saques: 0, r2Golpes: 0, r2Saques: 0 };
    if (ladoGanador === 'r1') {
        puntosEstructura.r1Golpes = puntosGanados; 
    } else {
        puntosEstructura.r2Golpes = puntosGanados; 
    }

    const payload = {
        juez: currentUser,
        categoria: catMap[currentCategory],
        robot1: r1Name,
        robot2: r2Name,
        puntos: puntosEstructura, 
        timestamp: Date.now(),
        ganador_declarado: ganadorNombre,
        metodo_victoria: metodo
    };

    try {
        // 1. Guardamos el recibo
        await addDoc(collection(db, "veredictos"), payload);

        // 2. Sumamos los puntos al ganador
        const snapGanador = await getDocs(query(collection(db, "competidores"), where("nombre", "==", ganadorNombre)));
        snapGanador.forEach(d => {
            let actual = Number(d.data().score || d.data().puntos || d.data().puntaje || 0);
            updateDoc(d.ref, { score: actual + puntosGanados }); 
        });

        alert(`✅ Veredicto enviado con éxito. El equipo ${ganadorNombre} recibe ${puntosGanados} puntos.`);
        
        // 3. Limpiamos y regresamos al juez a la sala de espera
        document.getElementById('juez-modo-espera').classList.remove('hidden');
        document.getElementById('juez-modo-combate').classList.add('hidden');
        combateTerminado = false;

    } catch (error) {
        console.error("🔥 ERROR REAL DE FIREBASE:", error);
        alert("Error enviando veredicto. Revisa la consola F12.");
    }
};



// ====================================================================
// --- 6. LÓGICA DE COMBATE Y BLOQUEO CRUZADO DE ROBOTS ---
// ====================================================================

// Traductor universal a prueba de fallos (Sincroniza Admin y Jueces perfectamente)
function obtenerTagExacto(categoria) {
    if(!categoria) return 'sin_categoria';
    let base = categoria.toLowerCase().trim();
    if(catMap[categoria]) return catMap[categoria];
    for(let key in catMap) {
        if(base.includes(key.toLowerCase()) || key.toLowerCase().includes(base)) return catMap[key];
    }
    return base;
}

// Bloquea visualmente (en gris) al robot rival para no repetirlo
function sincronizarSelects() {
    const selectR1 = document.getElementById('admin-r1-input');
    const selectR2 = document.getElementById('admin-r2-input');
    if(!selectR1 || !selectR2) return;

    const val1 = selectR1.value;
    const val2 = selectR2.value;

    // Limpiar y checar Robot 1
    Array.from(selectR1.options).forEach(opt => {
        if(opt.value !== "" && opt.value === val2) {
            opt.disabled = true;
            opt.style.color = '#cbd5e1'; // Gris clarito
        } else {
            opt.disabled = false;
            opt.style.color = ''; // Color normal
        }
    });

    // Limpiar y checar Robot 2
    Array.from(selectR2.options).forEach(opt => {
        if(opt.value !== "" && opt.value === val1) {
            opt.disabled = true;
            opt.style.color = '#cbd5e1'; // Gris clarito
        } else {
            opt.disabled = false;
            opt.style.color = ''; // Color normal
        }
    });
}

// Activar la sincronización cuando el admin cambie la selección
document.getElementById('admin-r1-input')?.addEventListener('change', sincronizarSelects);
document.getElementById('admin-r2-input')?.addEventListener('change', sincronizarSelects);

// Cargar los robots en las listas azules y rojas
window.actualizarDropdownsRobots = function() {
    const catSelect = document.getElementById('admin-arena-select')?.value;
    const selectR1 = document.getElementById('admin-r1-input');
    const selectR2 = document.getElementById('admin-r2-input');
    if(!selectR1 || !selectR2 || !catSelect) return;

    selectR1.innerHTML = '<option value="">-- ROBOT 1 --</option>';
    selectR2.innerHTML = '<option value="">-- ROBOT 2 --</option>';
    
    let tagBuscado = obtenerTagExacto(catSelect);
    
    todosLosRobots.filter(r => (r.categoria_tag === tagBuscado) || ((r.categoria_original || '').toLowerCase() === catSelect.toLowerCase().trim()))
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
        .forEach(r => {
            selectR1.insertAdjacentHTML('beforeend', `<option value="${r.nombre}">${r.nombre}</option>`);
            selectR2.insertAdjacentHTML('beforeend', `<option value="${r.nombre}">${r.nombre}</option>`);
        });
        
    sincronizarSelects(); // Limpiamos por si había basura visual guardada
};

// ====================================================================
// --- BOTONES DE CONTROL DE ARENA (Hablando el idioma del Juez) ---
// ====================================================================

document.getElementById('btnAdminIniciarArena')?.addEventListener('click', async () => {
    const catSelect = document.getElementById('admin-arena-select')?.value;
    const r1 = document.getElementById('admin-r1-input')?.value;
    const r2 = document.getElementById('admin-r2-input')?.value;

    if (!catSelect || !r1 || !r2) return alert("⚠️ Selecciona la categoría y ambos robots.");
    if (r1 === r2) return alert("❌ Un robot no puede pelear contra sí mismo.");

    let tag = obtenerTagExacto(catSelect);

    try {
        // AHORA SÍ: Mandamos las variables EXACTAS y el tiempo en segundos (/ 1000)
        await setDoc(doc(db, "arenas", tag), { 
            robot1: r1, 
            robot2: r2, 
            estado: 'peleando',
            tiempo_inicio: Date.now() / 1000 
        });

        // Efecto visual para el Admin
        const btn = document.getElementById('btnAdminIniciarArena');
        btn.className = "flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 rounded-lg text-[10px] uppercase tracking-widest shadow-md transition-all cursor-not-allowed";
        btn.innerHTML = "⏳ Combate en Curso...";
        btn.disabled = true;

        if (adminCombatTimeout) clearTimeout(adminCombatTimeout);
        adminCombatTimeout = setTimeout(resetearBotonAdmin, 300000);

    } catch(e) { alert("Error de conexión con la arena."); }
});

document.getElementById('btnAdminKO')?.addEventListener('click', async () => {
    const catSelect = document.getElementById('admin-arena-select')?.value;
    if (!catSelect) return;
    if(!confirm("🥊 ¿Declarar K.O.? (Esto detendrá las evaluaciones de los jueces en sus pantallas)")) return;
    
    let tag = obtenerTagExacto(catSelect);
    try { 
        await updateDoc(doc(db, "arenas", tag), { estado: 'ko' }); 
        resetearBotonAdmin();
    } catch(e) {}
});

document.getElementById('btnAdminLimpiar')?.addEventListener('click', async () => {
    const catSelect = document.getElementById('admin-arena-select')?.value;
    if (!catSelect) return;
    
    let tag = obtenerTagExacto(catSelect);
    try {
        // Sobrescribimos el documento con datos vacíos para matar al "fantasma" de Firebase
        await setDoc(doc(db, "arenas", tag), { robot1: '', robot2: '', estado: 'inactivo' });
        
        document.getElementById('admin-r1-input').value = '';
        document.getElementById('admin-r2-input').value = '';
        sincronizarSelects(); 
        resetearBotonAdmin();
    } catch(e) {}
});

function resetearBotonAdmin() {
    if(adminCombatTimeout) clearTimeout(adminCombatTimeout);
    const btn = document.getElementById('btnAdminIniciarArena');
    if(btn) {
        btn.disabled = false;
        btn.className = "flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-lg text-[10px] uppercase tracking-widest shadow-md transition-all active:scale-95";
        btn.innerHTML = "▶️ Iniciar";
    }
}

document.getElementById('admin-arena-select')?.addEventListener('change', actualizarDropdownsRobots);


// --- 6. EXCEL MASIVO PARA EQUIPOS (IGNORANDO MARCA TEMPORAL) ---
const dropzone = document.getElementById('dropzoneExcel');
const inputExcel = document.getElementById('inputExcel');

if(dropzone && inputExcel) {
    dropzone.addEventListener('click', () => inputExcel.click());
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('border-emerald-500', 'bg-emerald-50'); });
    dropzone.addEventListener('dragleave', () => { dropzone.classList.remove('border-emerald-500', 'bg-emerald-50'); });
    dropzone.addEventListener('drop', (e) => { e.preventDefault(); dropzone.classList.remove('border-emerald-500', 'bg-emerald-50'); if (e.dataTransfer.files.length) procesarExcel(e.dataTransfer.files[0]); });
    inputExcel.addEventListener('change', (e) => { if (e.target.files.length) procesarExcel(e.target.files[0]); });
}

function procesarExcel(file) {
    const fb = document.getElementById('excelFeedback');
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = e.target.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

            const batch = writeBatch(db);
            let conteo = 0;

            for (let i = 1; i < rows.length; i++) {
                let nom = rows[i][1]; // Alias del Equipo
                let cat = rows[i][2]; // Categoría
                let fac = rows[i][3]; // Facultad

                if (!nom || !cat) continue;
                
                cat = cat.toString().trim(); 
                nom = nom.toString().trim(); 
                fac = fac ? fac.toString().trim() : 'FIME'; 

                let tag = catMap[cat] || catMap[Object.keys(catMap).find(k => cat.toLowerCase().includes(k.toLowerCase()))];
                
                if (tag) {
                    const docRef = doc(collection(db, "competidores"));
                    batch.set(docRef, { categoria_tag: tag, categoria_original: cat, nombre: nom, facultad: fac, origen: file.name });
                    conteo++;
                }
            }

            const historialRef = doc(collection(db, "historial_archivos"));
            batch.set(historialRef, {
                nombre: file.name,
                fecha: Date.now()
            });

            await batch.commit();
            fb.className = "mt-2 text-[10px] font-bold p-2 rounded-lg text-center bg-emerald-100 text-emerald-800";
            fb.innerHTML = `✅ ¡ÉXITO! ${conteo} equipos agregados al padrón.`;
            window.cargarDatosAdmin(); 
            fb.classList.remove('hidden');
        } catch (err) { 
            console.error("Error detallado:", err);
            alert("Ocurrió un error leyendo el Excel."); 
        }
    };
    reader.readAsBinaryString(file);
}

document.getElementById('btnDescargarPlantilla')?.addEventListener('click', () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
        ["Marca temporal", "Alias del Equipo", "Categoría", "Facultad (Abreviatura)"], 
        ["", "Los pequeñines danix", "Medianos", "FIME"]
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
    XLSX.writeFile(wb, "plantilla_padron_equipos.xlsx");
});

// --- BOTÓN DE SALIR DEL PANEL DE ADMIN ---
document.getElementById('btnSalirAdmin')?.addEventListener('click', async () => {
    const btn = document.getElementById('btnSalirAdmin');
    const usuarioActivo = sessionStorage.getItem('juez_nombre');
    
    if(!confirm("🚪 ¿Estás seguro de cerrar sesión?")) return;
    
    if (usuarioActivo) {
        btn.innerHTML = "⏳ Saliendo...";
        try {
            // Le avisamos a Firebase que este admin se desconectó
            await updateDoc(doc(db, "maestros_autorizados", usuarioActivo), { sesion_activa: false });
        } catch(e) { 
            console.error("Error al actualizar Firebase:", e); 
        }
    }
    
    sessionStorage.clear();
    window.location.reload();
});

// --- ELIMINAR EXCEL Y SUS EQUIPOS EN CASCADA ---
window.eliminarArchivoExcel = async (historialId, fileName) => {
    if(!confirm(`🗑️ ¿Estás seguro de borrar el archivo "${fileName}"?\n\nEsto eliminará a TODOS los equipos que se cargaron con este archivo, dejando intactos a los demás.`)) return;
    
    try {
        // 1. Buscar a todos los equipos que tengan el tatuaje de este archivo
        const q = query(collection(db, "competidores"), where("origen", "==", fileName));
        const snapshot = await getDocs(q);
        const batch = writeBatch(db);
        
        // 2. Apuntar la pistola a cada uno de esos equipos
        snapshot.forEach((docSnap) => {
            batch.delete(docSnap.ref); 
        });
        
        // 3. Apuntar la pistola al registro del historial
        batch.delete(doc(db, "historial_archivos", historialId)); 
        
        // 4. Jalar el gatillo (borrar todo de golpe)
        await batch.commit();
        alert(`✅ Archivo eliminado. Se borraron ${snapshot.size} equipos del padrón.`);
        window.cargarDatosAdmin(); // Refrescar las tablas
    } catch(e) {
        console.error(e);
        alert("Error al intentar eliminar el archivo.");
    }
};

// --- ELIMINAR UN EQUIPO INDIVIDUAL DEL PADRÓN ---
    window.eliminarEquipo = async (id, nombre) => {
        if(!confirm(`⚠️ ¿Estás seguro de eliminar al equipo "${nombre}" del torneo?`)) return;
        try {
            await deleteDoc(doc(db, "competidores", id));
        } catch (error) {
            console.error(error);
            alert("Error al eliminar el equipo.");
        }
    }

    // --- FUNCION PARA REVELAR CONTRASEÑA (EL OJITO) CON GLOBO DE TEXTO ---
// --- FUNCION PARA REVELAR CONTRASEÑA (EL OJITO) CON GLOBO ARRIBA ---
window.togglePassword = function(inputId, btn) {
    const input = document.getElementById(inputId);
    
    if (input.value.trim() === "") {
        if (btn.querySelector('.globo-tooltip')) return;

        const globo = document.createElement('div');
        // Anclamos el globo a la derecha (right-0) para que se expanda hacia adentro
        globo.className = "globo-tooltip absolute bottom-full right-0 mb-2 bg-gray-800 text-white text-[10px] font-bold px-2 py-1.5 rounded shadow-lg whitespace-nowrap z-50 transition-opacity duration-300 opacity-0 pointer-events-none";
        
        // Colocamos el piquito del triángulo pegado a la derecha (right-2) para que siga apuntando al ojito
        globo.innerHTML = `Primero introduce una palabra <div class="absolute top-full right-2 border-4 border-transparent border-t-gray-800"></div>`;
        
        btn.appendChild(globo);

        requestAnimationFrame(() => globo.classList.remove('opacity-0'));

        setTimeout(() => {
            globo.classList.add('opacity-0');
            setTimeout(() => globo.remove(), 300);
        }, 2000);
        return; 
    }

    if (input.type === "password") {
        input.type = "text";
        btn.textContent = "🙈"; 
    } else {
        input.type = "password";
        btn.textContent = "👁️"; 
    }
};

// --- MODAL DE CERRAR SESIÓN EN SALA DE ESPERA ---
window.mostrarModalLogoutEspera = () => {
    document.getElementById('modalLogoutEspera').classList.remove('hidden');
};

window.cerrarModalLogoutEspera = () => {
    document.getElementById('modalLogoutEspera').classList.add('hidden');
};

// Escuchador para confirmar el cierre de sesión
document.getElementById('btnConfirmarLogoutEspera')?.addEventListener('click', async () => {
    const btn = document.getElementById('btnConfirmarLogoutEspera');
    btn.innerHTML = "⏳ Saliendo...";
    
    // TRUCO: Tomamos el nombre del docente que aparece en la pantalla de espera
    const nombreDocente = document.getElementById('nombreAsignado').innerText;
    
    if (nombreDocente) {
        try { 
            // Le avisamos a Firebase que este maestro se desconectó
            await updateDoc(doc(db, "maestros_autorizados", nombreDocente), { sesion_activa: false }); 
        } catch(e) { console.error("Error al actualizar Firebase:", e); }
    }
    
    sessionStorage.clear();
    window.location.reload(); 
});

// --- FUNCIONES DE ROLES (SOLO SUPER ADMIN) ---
window.ascenderAJuez = async (id) => {
    if(!confirm("🟣 ¿Ascender a este docente a ADMINISTRADOR? Tendrá control sobre las arenas.")) return;
    
    // Al ascenderlo, también le apagamos la sesión en Firebase para forzar su salida
    await updateDoc(doc(db, "maestros_autorizados", id), { rol: 'admin', sesion_activa: false });
};

window.descenderAdmin = async (id) => {
    if(!confirm("🔵 ¿Quitar permisos de administrador y regresarlo a Juez?")) return;
    // Le quitamos el rol y le apagamos la sesión para que su radar lo detecte y lo saque
    await updateDoc(doc(db, "maestros_autorizados", id), { rol: 'juez', sesion_activa: false });
};

// --- GESTIÓN MANUAL DE EQUIPOS (AGREGAR INDIVIDUALMENTE) ---
window.abrirModalAgregarEquipo = () => {
    document.getElementById('modalAgregarEquipo').classList.remove('hidden');
};

window.cerrarModalAgregarEquipo = () => {
    document.getElementById('modalAgregarEquipo').classList.add('hidden');
    // Limpiamos los campos dejándolos totalmente vacíos
    document.getElementById('nuevoEqNombre').value = '';
    document.getElementById('nuevoEqFacultad').value = '';
};

document.getElementById('btnGuardarNuevoEquipo')?.addEventListener('click', async () => {
    const nombre = document.getElementById('nuevoEqNombre').value.trim();
    const categoria = document.getElementById('nuevoEqCategoria').value;
    const facultad = document.getElementById('nuevoEqFacultad').value.trim();
    
    // VALIDACIÓN ESTRICTA: Ningún campo puede estar vacío
    if(!nombre || !categoria || !facultad) {
        return alert("❌ Alto ahí. Por favor, llena todos los campos (Nombre, Categoría y Facultad) para poder guardar el equipo.");
    }

    const btn = document.getElementById('btnGuardarNuevoEquipo');
    btn.innerHTML = "⏳...";
    btn.disabled = true;

    try {
        let tag = catMap[categoria] || catMap[Object.keys(catMap).find(k => categoria.toLowerCase().includes(k.toLowerCase()))];
        
        await addDoc(collection(db, "competidores"), { 
            categoria_tag: tag || categoria.toLowerCase(), 
            categoria_original: categoria, 
            nombre: nombre, 
            facultad: facultad, 
            origen: 'Manual' 
        });
        
        cerrarModalAgregarEquipo();
    } catch(e) {
        alert("Error al guardar el equipo en la base de datos.");
    } finally {
        btn.innerHTML = "Guardar";
        btn.disabled = false;
    }
});

// --- PUENTE HACIA LOS BRACKETS ---
document.getElementById('btnIrABrackets')?.addEventListener('click', () => {
    const miCat = sessionStorage.getItem('juez_categoria');
    if (!miCat) return alert("Error: No tienes categoría asignada.");
    const tag = obtenerTagExacto(miCat);
    window.location.href = `brackets.html?cat=${tag}`;
});

// =====================================================================
// RECEPTOR DE RADIO DESDE LOS BRACKETS (AISLADO POR ROLES)
// =====================================================================
const canalPanel = new BroadcastChannel('fime_torneo_canal');

canalPanel.onmessage = function(evento) {
    if (evento.data.accion === 'cargar_pelea') {
        const { cat, r1, r2 } = evento.data;

        // 🛡️ ESCUDOS DE AISLAMIENTO 🛡️
        const isSuperAdmin = sessionStorage.getItem('juez_superadmin') === 'true';
        const miCat = sessionStorage.getItem('juez_categoria');
        
        // 1. Si eres Súper Admin, ignoras la señal (tú controlas todo manual)
        if (isSuperAdmin) return;
        
        // 2. Si eres Admin normal, solo aceptas la señal si es de tu propia categoría
        if (obtenerTagExacto(miCat) !== obtenerTagExacto(cat)) return;

        console.log(`📡 Señal recibida y aceptada: ${cat} -> ${r1} VS ${r2}`);

        const selectR1 = document.getElementById('admin-r1-input'); 
        const selectR2 = document.getElementById('admin-r2-input'); 
        const selectCat = document.getElementById('admin-categoria'); 

        if (!selectR1 || !selectR2) return;

        if (selectCat) {
            Array.from(selectCat.options).forEach(opt => {
                if(opt.value.toLowerCase() === cat.toLowerCase() || opt.text.toLowerCase() === cat.toLowerCase()) {
                    selectCat.value = opt.value;
                }
            });
            selectCat.dispatchEvent(new Event('change')); 
        }
        
        setTimeout(() => {
            selectR1.value = r1;
            selectR2.value = r2;
            console.log(`✅ ¡Pelea auto-cargada para el Admin de ${cat}!`);
        }, 500);
    }
};