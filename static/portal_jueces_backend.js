// =====================================================================
// INTERFAZ DE CONTROL - PORTAL JUECES (GUERRA DE ROBOTS FIME)
// =====================================================================

// Elementos principales de la interfaz
const form = document.getElementById('loginForm');
const espera = document.getElementById('pantallaEspera');
const adminPanel = document.getElementById('pantallaAdmin'); 
const errorMsg = document.getElementById('errorMsg');

// Elementos interactivos del Panel de Administrador
const txtEstado = document.getElementById('txtEstadoAdmision');
const btnToggle = document.getElementById('btnToggleRegistro');

// Elementos del Modal / Pop-up de confirmación
const modal = document.getElementById('modalAdvertencia');
const btnEquivocado = document.getElementById('btnEquivocado');
const btnModalSi = document.getElementById('btnModalSi');
const btnModalNo = document.getElementById('btnModalNo');

// --- 1. MANEJO DE PANTALLAS (VISTAS) ---

// Activa la pantalla de espera para los Jueces válidos
function activarPantallaEspera(nombre, categoria) {
    form.classList.add('hidden');
    document.getElementById('nombreAsignado').innerText = nombre;
    document.getElementById('categoriaAsignada').innerText = categoria;
    espera.classList.remove('hidden');
}

// Activa tu panel de control maestro exclusivo
function activarPantallaAdmin(estadoActual) {
    form.classList.add('hidden');
    actualizarInterfazAdmin(estadoActual);
    adminPanel.classList.remove('hidden');
}

// Actualiza visualmente el switch de administración (Verde = Abierto, Rojo = Bloqueado)
function actualizarInterfazAdmin(estado) {
    if (estado === 1) {
        txtEstado.innerText = "Abierto / Permisivo";
        txtEstado.className = "text-sm font-extrabold text-emerald-600 uppercase";
        btnToggle.className = "bg-red-600 text-white font-bold px-4 py-2 rounded-lg text-xs uppercase tracking-wider shadow-md active:scale-95 transition-all";
    } else {
        txtEstado.innerText = "Bloqueado / Cerrado";
        txtEstado.className = "text-sm font-extrabold text-red-600 uppercase";
        btnToggle.className = "bg-emerald-600 text-white font-bold px-4 py-2 rounded-lg text-xs uppercase tracking-wider shadow-md active:scale-95 transition-all";
    }
}

// --- 2. CONTROL ANTI-RECARGA (PERSISTENCIA LOCAL) ---
window.addEventListener('DOMContentLoaded', () => {
    const juezGuardado = localStorage.getItem('juez_nombre');
    const catGuardada = localStorage.getItem('juez_categoria');

    // Si el juez ya se había registrado, lo mantenemos en su pantalla de espera
    if (juezGuardado && catGuardada) {
        activarPantallaEspera(juezGuardado, catGuardada);
    }
});

// --- 3. ENVÍO DE DATOS A LA API Y FILTRADO DE ROLES ---
form.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const nombre = document.getElementById('nombreJuez').value;
    const codigo = document.getElementById('codigoAcceso').value;

    errorMsg.classList.add('hidden');

    // Petición real al servidor local de Flask
    fetch('/api/login_juez', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ nombre: nombre, codigo: codigo })
    })
    .then(res => {
        // BLINDAJE: Validamos que el servidor responda un JSON real antes de decodificarlo
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            throw new Error("❌ El backend no respondió un JSON válido. Verifica que Flask esté corriendo.");
        }

        // Si el backend responde con un error HTTP (401, 403, etc.), extraemos su mensaje personalizado
        if (!res.ok) {
            return res.json().then(err => { throw err; });
        }
        return res.json();
    })
    .then(data => {
        if (data.role === 'admin') {
            // CASO MASTER: Eres tú, despliega el interruptor remoto
            activarPantallaAdmin(data.estado_registro);
        } else if (data.success) {
            // CASO JUEZ: Registro exitoso, guardamos sesión y bloqueamos la pantalla
            localStorage.setItem('juez_nombre', data.nombre);
            localStorage.setItem('juez_categoria', data.categoria);
            activarPantallaEspera(data.nombre, data.categoria);
        }
    })
    .catch(err => {
        console.error("Error en la petición:", err);
        // Desplegamos el error de forma limpia en el contenedor rojo sin tronar la app
        errorMsg.innerText = err.message || "❌ No se pudo establecer conexión con el servidor de Flask.";
        errorMsg.classList.remove('hidden');
    });
});

// --- 4. CONTROL DEL SWITCH MAESTRO DE ADMISIÓN ---
btnToggle.addEventListener('click', () => {
    fetch('/api/admin/toggle_registro', { method: 'POST' })
    .then(res => {
        if (!res.ok) throw new Error("No se pudo cambiar el estado.");
        return res.json();
    })
    .then(data => {
        if (data.success) {
            actualizarInterfazAdmin(data.nuevo_estado);
        }
    })
    .catch(err => console.error("Error al mover el switch:", err));
});

// Botón para salir del modo Administrador y resetear el formulario
document.getElementById('btnSalirAdmin').addEventListener('click', () => {
    adminPanel.classList.add('hidden');
    form.reset();
    form.classList.remove('hidden');
});

// --- 5. CONTROL DEL MODAL DE RETORNO (SÓLO JUECES) ---
btnEquivocado.addEventListener('click', () => {
    modal.classList.remove('hidden');
});

btnModalNo.addEventListener('click', () => {
    modal.classList.add('hidden');
});

btnModalSi.addEventListener('click', () => {
    localStorage.clear(); // Limpia la memoria local del navegador
    modal.classList.add('hidden'); 
    espera.classList.add('hidden'); 
    form.reset();
    form.classList.remove('hidden'); // Devuelve el formulario limpio
});