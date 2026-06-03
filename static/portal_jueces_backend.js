// Elementos de la interfaz
const form = document.getElementById('loginForm');
const espera = document.getElementById('pantallaEspera');
const adminPanel = document.getElementById('pantallaAdmin'); // Nuevo: Panel exclusivo para ti
const errorMsg = document.getElementById('errorMsg');

// Elementos nuevos para el control de Admin
const txtEstado = document.getElementById('txtEstadoAdmision');
const btnToggle = document.getElementById('btnToggleRegistro');

// Elementos del Modal/Pop-up
const modal = document.getElementById('modalAdvertencia');
const btnEquivocado = document.getElementById('btnEquivocado');
const btnModalSi = document.getElementById('btnModalSi');
const btnModalNo = document.getElementById('btnModalNo');

// --- 1. PANTALLAS DE TRABAJO ---

// Muestra la vista de carga/espera para los Jueces legítimos
function activarPantallaEspera(nombre, categoria) {
    form.classList.add('hidden');
    document.getElementById('nombreAsignado').innerText = nombre;
    document.getElementById('categoriaAsignada').innerText = categoria;
    espera.classList.remove('hidden');
}

// Muestra tu panel de administración
function activarPantallaAdmin(estadoActual) {
    form.classList.add('hidden');
    actualizarInterfazAdmin(estadoActual);
    adminPanel.classList.remove('hidden');
}

// Cambia visualmente el estado del switch del admin (Verde/Rojo)
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

// --- 2. CHEQUEO ANTI-RECARGA ---
window.addEventListener('DOMContentLoaded', () => {
    const juezGuardado = localStorage.getItem('juez_nombre');
    const catGuardada = localStorage.getItem('juez_categoria');

    // Mantiene bloqueado al juez en su pantalla de Check si recarga por error
    if (juezGuardado && catGuardada) {
        activarPantallaEspera(juezGuardado, catGuardada);
    }
});

// --- 3. ENVÍO REAL A LA API CON FILTRADO DE ROLES ---
form.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const nombre = document.getElementById('nombreJuez').value;
    const codigo = document.getElementById('codigoAcceso').value;

    errorMsg.classList.add('hidden');

    // Conectamos directo con el endpoint de app.py
    fetch('/api/login_juez', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ nombre: nombre, codigo: codigo })
    })
    .then(res => {
        if (!res.ok) {
            // Si el backend responde con error (como registros bloqueados o código mal) lo manejamos aquí
            return res.json().then(err => { throw err; });
        }
        return res.json();
    })
    .then(data => {
        if (data.role === 'admin') {
            // CASO MASTER: Eres tú, abre el panel de control remoto
            activarPantallaAdmin(data.estado_registro);
        } else if (data.success) {
            // CASO JUEZ: Acceso concedido, guardamos en memoria del cel y mostramos check
            localStorage.setItem('juez_nombre', data.nombre);
            localStorage.setItem('juez_categoria', data.categoria);
            activarPantallaEspera(data.nombre, data.categoria);
        }
    })
    .catch(err => {
        console.error(err);
        errorMsg.innerText = err.message || "❌ Error de conexión con el servidor.";
        errorMsg.classList.remove('hidden');
    });
});

// --- 4. ACCIÓN REMOTA DEL SWITCH DE CONTROL DE ACCESO ---
btnToggle.addEventListener('click', () => {
    fetch('/api/admin/toggle_registro', { method: 'POST' })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            actualizarInterfazAdmin(data.nuevo_estado);
        }
    })
    .catch(err => console.error("Error al mover el switch:", err));
});

// Botón para salir de tu cuenta de Administrador
document.getElementById('btnSalirAdmin').addEventListener('click', () => {
    adminPanel.classList.add('hidden');
    form.reset();
    form.classList.remove('hidden');
});

// --- 5. CONTROL DEL POP-UP DESPLEGABLE (JUECES) ---
btnEquivocado.addEventListener('click', () => {
    modal.classList.remove('hidden');
});

btnModalNo.addEventListener('click', () => {
    modal.classList.add('hidden');
});

btnModalSi.addEventListener('click', () => {
    localStorage.clear(); 
    modal.classList.add('hidden'); 
    espera.classList.add('hidden'); 
    form.reset();
    form.classList.remove('hidden');
});