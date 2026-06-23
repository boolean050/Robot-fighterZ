// --- VARIABLES GLOBALES Y MEMORIA ---
let currentUser = localStorage.getItem('juez_nombre');
let currentCategory = localStorage.getItem('juez_categoria');
let isAdmin = localStorage.getItem('juez_role') === 'admin';

let arenaInterval = null;
let timerInterval = null;
let adminCombatTimeout = null;

let puntos = { r1Golpes: 0, r1Saques: 0, r2Golpes: 0, r2Saques: 0 };
let combateTerminado = false;
let todosLosRobots = [];

// --- VERIFICAR SESIÓN AL CARGAR LA PÁGINA ---
document.addEventListener('DOMContentLoaded', () => {
    if (isAdmin) {
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('pantallaAdmin').classList.remove('hidden');
        cargarDatosAdmin();
    } else if (currentUser && currentCategory) {
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('pantallaEspera').classList.remove('hidden');
        document.getElementById('nombreAsignado').textContent = currentUser;
        document.getElementById('categoriaAsignada').textContent = currentCategory;
        iniciarRadarArena();
    }
});

// --- LOGIN ---
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('nombreJuez').value.trim();
    const codigo = document.getElementById('codigoAcceso').value.trim();
    const categoria = document.getElementById('selectCategoria').value;
    const msg = document.getElementById('errorMsg');

    try {
        const res = await fetch('/api/login_juez', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, codigo, categoria })
        });
        const data = await res.json();

        if (data.role === 'admin') {
            isAdmin = true;
            localStorage.setItem('juez_role', 'admin'); // GUARDAR MEMORIA
            
            document.getElementById('loginForm').classList.add('hidden');
            document.getElementById('pantallaAdmin').classList.remove('hidden');
            document.getElementById('txtEstadoAdmision').textContent = data.estado_registro ? 'ABIERTO' : 'CERRADO';
            document.getElementById('txtEstadoAdmision').className = data.estado_registro ? 'text-[10px] font-extrabold uppercase text-emerald-600' : 'text-[10px] font-extrabold uppercase text-red-600';
            cargarDatosAdmin();
            msg.classList.add('hidden');
        } else if (data.success) {
            currentUser = data.nombre;
            currentCategory = data.categoria;
            localStorage.setItem('juez_role', 'juez'); // GUARDAR MEMORIA
            localStorage.setItem('juez_nombre', currentUser);
            localStorage.setItem('juez_categoria', currentCategory);

            document.getElementById('loginForm').classList.add('hidden');
            document.getElementById('pantallaEspera').classList.remove('hidden');
            document.getElementById('nombreAsignado').textContent = currentUser;
            document.getElementById('categoriaAsignada').textContent = currentCategory;
            msg.classList.add('hidden');
            
            iniciarRadarArena();
        } else {
            msg.textContent = data.message;
            msg.classList.remove('hidden');
        }
    } catch (error) {
        msg.textContent = "Error de conexión con el servidor.";
        msg.classList.remove('hidden');
    }
});

// --- RADAR DE ARENA (JUECES) ---
function iniciarRadarArena() {
    if(arenaInterval) clearInterval(arenaInterval);
    
    const catMap = { "Pequeños": "pequenos", "Mediano": "mediano", "Grandes": "grandes" };
    const catTag = catMap[currentCategory];
    if(!catTag) return; 

    arenaInterval = setInterval(async () => {
        try {
            const res = await fetch(`/api/arena/estado/${catTag}`);
            const data = await res.json();
            
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
                // NUEVO: SI EL ADMIN TERMINA EL EVENTO
                clearInterval(arenaInterval);
                if(timerInterval) clearInterval(timerInterval);
                document.getElementById('loginForm').classList.add('hidden');
                document.getElementById('pantallaEspera').classList.add('hidden');
                document.getElementById('pantallaAdmin').classList.add('hidden');
                document.getElementById('juez-modo-combate').classList.add('hidden');
                
                // Muestra la pantalla final de agradecimiento
                const finalScreen = document.getElementById('pantallaFinal');
                if (finalScreen) {
                    finalScreen.classList.remove('hidden');
                } else {
                     alert("¡Torneo Concluido! Gracias por participar.");
                     location.reload();
                }
                localStorage.clear(); // Borra la sesión para que no regresen
            }
        } catch(e) {}
    }, 2000);
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
    btn.disabled = false;
    btn.className = "w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl text-xs uppercase tracking-widest shadow-lg transform active:scale-95 transition-all animate-pulse";
    btn.innerHTML = `✅ ${texto}`;
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

document.getElementById('btnEnviarVeredicto').addEventListener('click', async () => {
    if(!confirm("¿Estás seguro de enviar tu evaluación oficial?")) return;
    
    const catMap = { "Pequeños": "pequenos", "Mediano": "mediano", "Grandes": "grandes" };
    
    const payload = {
        juez: currentUser,
        categoria: catMap[currentCategory],
        robot1: document.getElementById('juez-robot1').textContent,
        robot2: document.getElementById('juez-robot2').textContent,
        puntos: puntos
    };

    try {
        const res = await fetch('/api/juez/enviar_veredicto', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if(data.success) {
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
        }
    } catch(e) { alert("Error enviando veredicto"); }
});

// --- ADMIN: CONTROL DE ARENA ---
const btnIniciarArena = document.getElementById('btnAdminIniciarArena');
if(btnIniciarArena) {
    btnIniciarArena.addEventListener('click', async () => {
        // Borramos posible error pegado
        const errorMsg = document.getElementById('errorMsg');
        if (errorMsg) errorMsg.classList.add('hidden');

        const cat = document.getElementById('admin-arena-select').value;
        const r1 = document.getElementById('admin-r1-input').value;
        const r2 = document.getElementById('admin-r2-input').value;
        
        if(!r1 || !r2) return alert("Debes seleccionar los nombres de ambos robots.");
        if(r1 === r2) return alert("¡No puedes poner a pelear al mismo robot contra sí mismo!");

        try {
            await fetch('/api/admin/arena/iniciar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ categoria: cat, robot1: r1, robot2: r2 })
            });
            
            btnIniciarArena.className = "flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 rounded-lg text-[10px] uppercase tracking-widest shadow-md transition-all cursor-not-allowed";
            btnIniciarArena.innerHTML = "⏳ Combate en Curso...";
            btnIniciarArena.disabled = true;

            if (adminCombatTimeout) clearTimeout(adminCombatTimeout);
            adminCombatTimeout = setTimeout(resetearBotonAdmin, 300000);

        } catch(e) { alert("Error iniciando arena."); }
    });
}

const btnAdminKO = document.getElementById('btnAdminKO');
if(btnAdminKO) {
    btnAdminKO.addEventListener('click', async () => {
        const cat = document.getElementById('admin-arena-select').value;
        if(!confirm("⚠️ ¿Detener el combate por K.O. y forzar a los jueces a calificar AHORA?")) return;

        try {
            await fetch('/api/admin/arena/ko', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ categoria: cat })
            });
            alert("K.O. DECLARADO. Jueces habilitados para enviar resultados.");
            resetearBotonAdmin();
        } catch(e) { alert("Error declarando KO."); }
    });
}

// NUEVO: BOTÓN LIMPIAR ARENA
const btnAdminLimpiar = document.getElementById('btnAdminLimpiar');
if(btnAdminLimpiar) {
    btnAdminLimpiar.addEventListener('click', async () => {
        const cat = document.getElementById('admin-arena-select').value;
        if(!confirm("¿Limpiar la arena? Los jueces de esta categoría regresarán a la pantalla de espera.")) return;

        try {
            await fetch('/api/admin/arena/limpiar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ categoria: cat })
            });
            resetearBotonAdmin();
        } catch(e) { alert("Error al limpiar arena."); }
    });
}

// NUEVO: BOTÓN TERMINAR EVENTO
const btnAdminTerminarEvento = document.getElementById('btnAdminTerminarEvento');
if(btnAdminTerminarEvento) {
    btnAdminTerminarEvento.addEventListener('click', async () => {
        if(!confirm("⚠️ ¿ESTÁS TOTALMENTE SEGURO?\nEsto dará por terminado el torneo globalmente y sacará a TODOS los jueces de las pantallas de evaluación de inmediato.")) return;

        try {
            const res = await fetch('/api/admin/evento/terminar', { method: 'POST' });
            const data = await res.json();
            if(data.success) {
                alert("¡Torneo finalizado con éxito! Cerrando sesión maestro...");
                localStorage.clear();
                location.reload();
            }
        } catch(e) { alert("Error al dar por terminado el evento."); }
    });
}

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

    selectR1.innerHTML = '<option value="">-- Selecciona Robot --</option>';
    selectR2.innerHTML = '<option value="">-- Selecciona Robot --</option>';
    
    const robotsFiltrados = todosLosRobots
        .filter(r => r.categoria_tag === catSelect)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, undefined, { numeric: true, sensitivity: 'base' }));

    robotsFiltrados.forEach(r => {
        const opt1 = document.createElement('option'); opt1.value = r.nombre; opt1.textContent = r.nombre;
        selectR1.appendChild(opt1);
        const opt2 = document.createElement('option'); opt2.value = r.nombre; opt2.textContent = r.nombre;
        selectR2.appendChild(opt2);
    });
}

document.getElementById('admin-arena-select')?.addEventListener('change', actualizarDropdownsRobots);

// --- FUNCIONES DEL ADMIN ---
async function cargarDatosAdmin() {
    try {
        const resComps = await fetch('/api/competidores/obtener_todos');
        const dataComps = await resComps.json();
        if (dataComps.success) {
            todosLosRobots = dataComps.competidores;
            actualizarDropdownsRobots();
        }

        const resJueces = await fetch('/api/admin/jueces');
        const dataJueces = await resJueces.json();
        const tbody = document.getElementById('tablaJuecesBody');
        if(tbody) {
            tbody.innerHTML = '';
            dataJueces.jueces.forEach(j => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="px-2 py-2 whitespace-nowrap text-[10px] font-bold text-gray-900">${j.nombre}</td>
                    <td class="px-2 py-2 whitespace-nowrap text-[10px] text-gray-500 uppercase">${j.categoria}</td>
                    <td class="px-2 py-2 whitespace-nowrap text-center text-[10px]">
                        <button onclick="eliminarJuez(${j.id})" class="text-red-500 hover:text-red-700 font-bold active:scale-90 transition-transform">X</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        const resArch = await fetch('/api/admin/archivos');
        const dataArch = await resArch.json();
        const ul = document.getElementById('listaArchivos');
        if(ul) {
            ul.innerHTML = '';
            if (dataArch.archivos.length === 0) {
                ul.innerHTML = '<li class="text-[9px] text-gray-400 italic">No hay padrones cargados.</li>';
            } else {
                dataArch.archivos.forEach(a => {
                    const li = document.createElement('li');
                    li.className = "flex justify-between items-center bg-white border border-gray-100 p-2 rounded-lg shadow-sm";
                    li.innerHTML = `
                        <div class="flex items-center gap-2 overflow-hidden">
                            <span class="text-emerald-600 text-lg">📊</span>
                            <div class="truncate">
                                <p class="text-[10px] font-bold text-gray-800 truncate">${a.nombre_archivo}</p>
                                <p class="text-[8px] text-gray-400">${a.fecha_carga}</p>
                            </div>
                        </div>
                        <button onclick="eliminarArchivo(${a.id})" class="text-red-500 hover:text-red-700 ml-2 active:scale-90 transition-transform">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    `;
                    ul.appendChild(li);
                });
            }
        }
    } catch (e) {}
}

document.getElementById('btnToggleRegistro')?.addEventListener('click', async () => {
    const res = await fetch('/api/admin/toggle_registro', { method: 'POST' });
    const data = await res.json();
    document.getElementById('txtEstadoAdmision').textContent = data.nuevo_estado === 1 ? 'ABIERTO' : 'CERRADO';
    document.getElementById('txtEstadoAdmision').className = data.nuevo_estado === 1 ? 'text-[10px] font-extrabold uppercase text-emerald-600' : 'text-[10px] font-extrabold uppercase text-red-600';
});

window.eliminarJuez = async (id) => {
    if (!confirm("¿Eliminar juez?")) return;
    await fetch(`/api/admin/eliminar_juez/${id}`, { method: 'POST' });
    cargarDatosAdmin();
};

window.eliminarArchivo = async (id) => {
    if (!confirm("⚠️ ATENCIÓN: Eliminar este archivo borrará a todos los competidores y tiempos. ¿Estás seguro?")) return;
    const res = await fetch(`/api/admin/eliminar_archivo/${id}`, { method: 'POST' });
    const data = await res.json();
    if (data.success) cargarDatosAdmin(); else alert(data.message);
};

// --- EXCEL MASIVO ---
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
    reader.onload = function(e) {
        try {
            const data = e.target.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

            let equiposParseados = [];
            for (let i = 1; i < rows.length; i++) {
                let cat = rows[i][0], nom = rows[i][1], doc = rows[i][2];
                if (!nom || !cat) continue;
                cat = cat.toString().trim(); nom = nom.toString().trim(); doc = doc ? doc.toString().trim() : '';
                let tag = cat.toLowerCase() === "pequeños" ? "pequenos" :
                          cat.toLowerCase() === "mediano" ? "mediano" :
                          cat.toLowerCase() === "grandes" ? "grandes" :
                          cat.toLowerCase().includes("seguimiento") ? "seguimiento" :
                          cat.toLowerCase().includes("evasor") ? "evasor" : null;
                if (tag) equiposParseados.push({ categoria: tag, nombre: nom, docente: doc });
            }

            fetch('/api/competidores/guardar_masivo', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre_archivo: file.name, equipos: equiposParseados })
            }).then(res => res.json()).then(dataRes => {
                if (dataRes.success) {
                    fb.className = "mt-2 text-[10px] font-bold p-2 rounded-lg text-center bg-emerald-100 text-emerald-800";
                    fb.innerHTML = `✅ ¡ÉXITO! ${equiposParseados.length} equipos agregados.`;
                    cargarDatosAdmin(); 
                }
            });
            fb.classList.remove('hidden');
        } catch (err) {}
    };
    reader.readAsBinaryString(file);
}

document.getElementById('btnDescargarPlantilla')?.addEventListener('click', () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([["Categoria", "Nombre del equipo", "Docentes"], ["Pequeños", "Destructor FIME", "Ing. Arturo Garza"]]);
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
    XLSX.writeFile(wb, "plantilla_guerra_robots.xlsx");
});

// --- SALIR Y LIMPIAR MEMORIA ---
const modal = document.getElementById('modalAdvertencia');
document.getElementById('btnEquivocado')?.addEventListener('click', () => modal.classList.remove('hidden'));
document.getElementById('btnSalirAdmin')?.addEventListener('click', () => modal.classList.remove('hidden'));
document.getElementById('btnModalNo')?.addEventListener('click', () => modal.classList.add('hidden'));

// AQUI ESTÁ EL TRUCO PARA ELIMINAR LA MEMORIA
document.getElementById('btnModalSi')?.addEventListener('click', () => {
    localStorage.clear();
    location.reload();
});