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

const CODIGO_ADMIN = "9999";
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
    ['loginForm', 'registroForm', 'pantallaEspera', 'pantallaAdmin'].forEach(p => {
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

    if (password === CODIGO_ADMIN) {
        // Generar y guardar el token único
        const adminToken = Date.now().toString() + Math.random().toString(36).substr(2);
        sessionStorage.setItem('juez_role', 'admin');
        sessionStorage.setItem('admin_token', adminToken);
        try { setDoc(doc(db, "sistema", "sesion_admin"), { token: adminToken }); } catch(err) {}

        isAdmin = true;
        mostrarPantalla('pantallaAdmin');
        window.cargarDatosAdmin();
        return;
    }

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
        activarSesionDocente(nombre, data.categoria);

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

    try {
        await setDoc(doc(db, "maestros_autorizados", nombre), {
            nombre: nombre,
            categoria: categoria,
            password: pass1,
            sesion_activa: true,
            fecha_registro: Date.now()
        });

        window.history.replaceState({}, document.title, window.location.pathname);
        activarSesionDocente(nombre, categoria);

    } catch (error) {
        msg.textContent = "Error creando cuenta.";
        msg.classList.remove('hidden');
    }
});

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

// --- 4. RADAR DE SESIÓN (ANTI-EXPULSIONES EN TIEMPO REAL) ---
function iniciarRadarSesion() {
    if(!currentUser) return;
    const ref = doc(db, "maestros_autorizados", currentUser);
    
    unsubscribeSesion = onSnapshot(ref, (docSnap) => {
        if (!docSnap.exists() || docSnap.data().sesion_activa === false) {
            alert("⚠️ Sesión terminada por el Administrador.");
            sessionStorage.clear();
            window.location.href = window.location.origin + window.location.pathname; 
        } else {
            if(docSnap.data().categoria !== currentCategory) {
                currentCategory = docSnap.data().categoria;
                sessionStorage.setItem('juez_categoria', currentCategory);
                document.getElementById('categoriaAsignada').textContent = currentCategory;
                alert("🔄 El administrador ha cambiado tu categoría de evaluación.");
                if(unsubscribeArena) unsubscribeArena();
                iniciarRadarArena(); 
            }
        }
    });
}

// --- 5. PANEL ADMIN: TABLA DE MAESTROS, HISTORIAL Y PADRÓN DE EQUIPOS ---
window.cargarDatosAdmin = function() {
    
    // RADAR DE SEGURIDAD ADMIN: Tumbar si alguien más entra
    onSnapshot(doc(db, "sistema", "sesion_admin"), (docSnap) => {
        if (docSnap.exists()) {
            const tokenEnBd = docSnap.data().token;
            const miToken = sessionStorage.getItem('admin_token');
            if (miToken && tokenEnBd !== miToken) {
                alert("⚠️ Se ha iniciado sesión de Administrador en otro lugar. Esta ventana se cerrará por seguridad.");
                sessionStorage.clear();
                window.location.reload();
            }
        }
    });
    
    // Escuchar maestros en tiempo real
    onSnapshot(collection(db, "maestros_autorizados"), (snapshot) => {
        const tbody = document.getElementById('tablaJuecesBody');
        if(!tbody) return;
        tbody.innerHTML = '';
        
        snapshot.forEach((docSnap) => {
            const m = docSnap.data();
            const statusHtml = m.sesion_activa 
                ? `<span class="text-emerald-500 font-bold">🟢 On</span>` 
                : `<span class="text-red-500 font-bold">🔴 Off</span>`;

            tbody.innerHTML += `
                <tr class="hover:bg-gray-50 border-b border-gray-100">
                    <td class="px-1 py-2 text-[9px] font-black text-gray-700">
                        ${m.nombre} <br><span class="text-gray-400 font-normal">${m.categoria}</span>
                    </td>
                    <td class="px-1 py-2 text-center text-[10px]">${statusHtml}</td>
                    <td class="px-1 py-2 text-center flex justify-center gap-1 mt-1">
                        <button onclick="editarCategoria('${docSnap.id}', '${m.categoria}')" title="Editar Categoría" class="bg-blue-100 text-blue-700 hover:bg-blue-600 hover:text-white px-2 rounded font-bold text-[9px] transition-all">✏️</button>
                        <button onclick="cerrarSesionDocente('${docSnap.id}')" title="Cerrar Sesión (Amarilla)" class="bg-amber-100 text-amber-600 hover:bg-amber-500 hover:text-white px-2 rounded font-bold text-[9px] transition-all">🟡</button>
                        <button onclick="eliminarDocente('${docSnap.id}')" title="Expulsar (Roja)" class="bg-red-100 text-red-600 hover:bg-red-600 hover:text-white px-2 rounded font-bold text-[9px] transition-all">🔴</button>
                    </td>
                </tr>
            `;
        });
    });

    // Cargar historial de Excel con formato de fecha bonito (ej. 14/Sep/2026 16:39)
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

    // Cargar los robots y llenar la tabla de equipos participantes
    getDocs(collection(db, "competidores")).then(querySnapshot => {
        todosLosRobots = [];
        const tablaEquipos = document.getElementById('tablaEquiposBody');
        if (tablaEquipos) tablaEquipos.innerHTML = '';

        querySnapshot.forEach((docSnap) => { 
            const data = docSnap.data();
            todosLosRobots.push(data); 
            
            if (tablaEquipos) {
                tablaEquipos.innerHTML += `
                <tr class="hover:bg-emerald-50 border-b border-gray-100">
                    <td class="px-2 py-2 text-[10px] font-black text-gray-800 uppercase">${data.nombre}</td>
                    <td class="px-2 py-2 text-[10px] text-gray-600 font-bold uppercase">${data.categoria_original || 'N/A'}</td>
                    <td class="px-2 py-2 text-[10px] text-gray-500 uppercase flex justify-between items-center">
                        <span>${data.facultad || 'N/A'}</span>
                        <button onclick="eliminarEquipo('${docSnap.id}', '${data.nombre}')" title="Eliminar este equipo" class="bg-red-100 text-red-600 hover:bg-red-600 hover:text-white px-2 py-0.5 rounded font-bold transition-all ml-2">X</button>
                    </td>
                </tr>`;
            }
        });
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

// --- NUEVO SISTEMA PARA EDITAR CATEGORÍA (POP-UP ELEGANTE) ---
let idDocenteEditando = null;

window.editarCategoria = (id, categoriaActual) => {
    idDocenteEditando = id;
    const modal = document.getElementById('modalEditarCat');
    const select = document.getElementById('selectNuevaCat');
    
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
    const btn = document.getElementById('btnGuardarEdicion');
    btn.innerHTML = "⏳...";
    
    try {
        await updateDoc(doc(db, "maestros_autorizados", idDocenteEditando), { categoria: nuevaCat });
        document.getElementById('modalEditarCat').classList.add('hidden');
    } catch(e) {
        alert("Error al actualizar la categoría");
    } finally {
        btn.innerHTML = "GUARDAR";
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
    const catTag = catMap[currentCategory];
    if(!catTag) return; 

    const arenaRef = doc(db, "arenas", catTag);

    unsubscribeArena = onSnapshot(arenaRef, (docSnap) => {
        if (!docSnap.exists()) return;
        const data = docSnap.data();
        
        if (data.estado === 'peleando') {
            activarModoCombate(data);
        } else if (data.estado === 'ko' && !combateTerminado) {
            finalizarCombatePorKO();
        } else if (data.estado === 'inactivo') {
            document.getElementById('juez-modo-espera').classList.remove('hidden');
            document.getElementById('juez-modo-combate').classList.add('hidden');
            if(timerInterval) clearInterval(timerInterval);
            combateTerminado = false;
        } else if (data.estado === 'finalizado') {
            if(unsubscribeArena) unsubscribeArena();
            if(timerInterval) clearInterval(timerInterval);
            document.getElementById('loginForm').classList.add('hidden');
            document.getElementById('pantallaEspera').classList.add('hidden');
            document.getElementById('pantallaAdmin').classList.add('hidden');
            document.getElementById('juez-modo-combate').classList.add('hidden');
            
            const headerGeneral = document.getElementById('encabezadoPrincipal');
            if(headerGeneral) headerGeneral.classList.add('hidden');
            
            const finalScreen = document.getElementById('pantallaFinal');
            if (finalScreen) finalScreen.classList.replace('hidden', 'flex');
            
            sessionStorage.clear();
        }
    });
}

function activarModoCombate(data) {
    document.getElementById('juez-modo-espera').classList.add('hidden');
    document.getElementById('juez-modo-combate').classList.remove('hidden');
    
    document.getElementById('juez-robot1').textContent = data.robot1;
    document.getElementById('eval-robot1-name').textContent = data.robot1;
    document.getElementById('juez-robot2').textContent = data.robot2;
    document.getElementById('eval-robot2-name').textContent = data.robot2;

    if(!combateTerminado && !timerInterval) {
        iniciarCronometro(data.tiempo_inicio);
    }
}

function iniciarCronometro(tiempoInicioServidor) {
    const crono = document.getElementById('cronometro-juez');
    const duracionTotal = 5 * 60; 

    timerInterval = setInterval(() => {
        const ahora = Date.now() / 1000; 
        const transcurrido = ahora - tiempoInicioServidor;
        const restante = duracionTotal - transcurrido;

        if (restante <= 0) {
            clearInterval(timerInterval);
            crono.textContent = "00:00";
            finalizarCombateNatural();
        } else {
            let m = Math.floor(restante / 60);
            let s = Math.floor(restante % 60);
            crono.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
    }, 1000);
}

function finalizarCombateNatural() {
    combateTerminado = true;
    habilitarEnvioVeredicto("TIEMPO AGOTADO - ENVIAR VEREDICTO");
}

function finalizarCombatePorKO() {
    combateTerminado = true;
    if(timerInterval) clearInterval(timerInterval);
    document.getElementById('cronometro-juez').textContent = "K.O.";
    habilitarEnvioVeredicto("K.O. DECLARADO - ENVIAR VEREDICTO");
}

function habilitarEnvioVeredicto(texto) {
    const btn = document.getElementById('btnEnviarVeredicto');
    if(btn) {
        btn.disabled = false;
        btn.className = "w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl text-xs uppercase tracking-widest shadow-lg transform active:scale-95 transition-all animate-pulse";
        btn.innerHTML = `✅ ${texto}`;
    }
}

window.modificarPuntos = function(id, cantidad) {
    if (combateTerminado) return; 
    let mapClaves = {
        'r1-golpes': 'r1Golpes', 'r1-saques': 'r1Saques',
        'r2-golpes': 'r2Golpes', 'r2-saques': 'r2Saques'
    };
    let clave = mapClaves[id];
    puntos[clave] += cantidad;
    if (puntos[clave] < 0) puntos[clave] = 0; 
    document.getElementById(id).textContent = puntos[clave];
};

document.getElementById('btnEnviarVeredicto')?.addEventListener('click', async () => {
    if(!confirm("¿Estás seguro de enviar tu evaluación oficial?")) return;
    
    const payload = {
        juez: currentUser,
        categoria: catMap[currentCategory],
        robot1: document.getElementById('juez-robot1').textContent,
        robot2: document.getElementById('juez-robot2').textContent,
        puntos: puntos,
        timestamp: Date.now()
    };

    try {
        await addDoc(collection(db, "veredictos"), payload);
        alert("Veredicto enviado exitosamente. Gracias por tu evaluación.");
        document.getElementById('juez-modo-espera').classList.remove('hidden');
        document.getElementById('juez-modo-combate').classList.add('hidden');
        combateTerminado = false;
        puntos = { r1Golpes: 0, r1Saques: 0, r2Golpes: 0, r2Saques: 0 };
        ['r1-golpes','r1-saques','r2-golpes','r2-saques'].forEach(id => document.getElementById(id).textContent = "0");
        
        const btn = document.getElementById('btnEnviarVeredicto');
        btn.disabled = true;
        btn.className = "w-full bg-gray-300 text-gray-500 font-bold py-4 rounded-xl text-xs uppercase tracking-widest cursor-not-allowed transition-colors";
        btn.innerHTML = "⏳ Esperando fin de combate...";
    } catch(e) { alert("Error enviando veredicto"); }
});

// --- ADMIN: CONTROL DE ARENA ---
const btnIniciarArena = document.getElementById('btnAdminIniciarArena');
if(btnIniciarArena) {
    btnIniciarArena.addEventListener('click', async () => {
        const cat = document.getElementById('admin-arena-select').value;
        const r1 = document.getElementById('admin-r1-input').value;
        const r2 = document.getElementById('admin-r2-input').value;
        
        if(!r1 || !r2) return alert("Debes seleccionar los nombres de ambos robots.");
        if(r1 === r2) return alert("¡No puedes poner a pelear al mismo robot contra sí mismo!");

        try {
            await setDoc(doc(db, "arenas", cat), {
                categoria_tag: cat,
                robot1: r1,
                robot2: r2,
                tiempo_inicio: Date.now() / 1000,
                estado: 'peleando'
            });
            
            btnIniciarArena.className = "flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 rounded-lg text-[10px] uppercase tracking-widest shadow-md transition-all cursor-not-allowed";
            btnIniciarArena.innerHTML = "⏳ Combate en Curso...";
            btnIniciarArena.disabled = true;

            if (adminCombatTimeout) clearTimeout(adminCombatTimeout);
            adminCombatTimeout = setTimeout(resetearBotonAdmin, 300000);

        } catch(e) { alert("Error iniciando arena."); }
    });
}

document.getElementById('btnAdminKO')?.addEventListener('click', async () => {
    const cat = document.getElementById('admin-arena-select').value;
    if(!confirm("⚠️ ¿Detener el combate por K.O.?")) return;
    try {
        await updateDoc(doc(db, "arenas", cat), { estado: 'ko' });
        alert("K.O. DECLARADO.");
        resetearBotonAdmin();
    } catch(e) {}
});

document.getElementById('btnAdminLimpiar')?.addEventListener('click', async () => {
    const cat = document.getElementById('admin-arena-select').value;
    if(!confirm("¿Limpiar la arena?")) return;
    try {
        await updateDoc(doc(db, "arenas", cat), { estado: 'inactivo' });
        resetearBotonAdmin();
    } catch(e) {}
});

function resetearBotonAdmin() {
    if(adminCombatTimeout) clearTimeout(adminCombatTimeout);
    if(btnIniciarArena) {
        btnIniciarArena.disabled = false;
        btnIniciarArena.className = "flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-lg text-[10px] uppercase tracking-widest shadow-md transition-all active:scale-95";
        btnIniciarArena.innerHTML = "▶️ Iniciar";
    }
}

function actualizarDropdownsRobots() {
    const catSelect = document.getElementById('admin-arena-select').value;
    const selectR1 = document.getElementById('admin-r1-input');
    const selectR2 = document.getElementById('admin-r2-input');
    if(!selectR1 || !selectR2) return;

    selectR1.innerHTML = '<option value="">-- Selecciona --</option>';
    selectR2.innerHTML = '<option value="">-- Selecciona --</option>';
    
    todosLosRobots.filter(r => r.categoria_tag === catSelect)
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
        .forEach(r => {
            selectR1.insertAdjacentHTML('beforeend', `<option value="${r.nombre}">${r.nombre}</option>`);
            selectR2.insertAdjacentHTML('beforeend', `<option value="${r.nombre}">${r.nombre}</option>`);
        });
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
    XLSX.writeFile(wb, "padron_equipos.xlsx");
});

document.getElementById('btnSalirAdmin')?.addEventListener('click', () => {
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
            window.cargarDatosAdmin(); // Refrescar la tabla al instante
        } catch (error) {
            console.error(error);
            alert("Error al eliminar el equipo.");
        }
    }