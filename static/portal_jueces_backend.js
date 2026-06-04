<<<<<<< HEAD
// Elementos de la interfaz
const form = document.getElementById('loginForm');
const espera = document.getElementById('pantallaEspera');
const adminPanel = document.getElementById('pantallaAdmin'); // Nuevo: Panel exclusivo para ti
const errorMsg = document.getElementById('errorMsg');

// Elementos nuevos para el control de Admin
const txtEstado = document.getElementById('txtEstadoAdmision');
const btnToggle = document.getElementById('btnToggleRegistro');

// Elementos del Modal/Pop-up
=======
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
>>>>>>> 79cb458431e83aee045ff671d357329546ee3ca2
const modal = document.getElementById('modalAdvertencia');
const btnEquivocado = document.getElementById('btnEquivocado');
const btnModalSi = document.getElementById('btnModalSi');
const btnModalNo = document.getElementById('btnModalNo');

<<<<<<< HEAD
// --- 1. PANTALLAS DE TRABAJO ---

// Muestra la vista de carga/espera para los Jueces legítimos
=======
// --- 1. MANEJO DE PANTALLAS (VISTAS) ---

// Activa la pantalla de espera para los Jueces válidos
>>>>>>> 79cb458431e83aee045ff671d357329546ee3ca2
function activarPantallaEspera(nombre, categoria) {
    form.classList.add('hidden');
    document.getElementById('nombreAsignado').innerText = nombre;
    document.getElementById('categoriaAsignada').innerText = categoria;
    espera.classList.remove('hidden');
}

<<<<<<< HEAD
// Muestra tu panel de administración
=======
// Activa tu panel de control maestro exclusivo
>>>>>>> 79cb458431e83aee045ff671d357329546ee3ca2
function activarPantallaAdmin(estadoActual) {
    form.classList.add('hidden');
    actualizarInterfazAdmin(estadoActual);
    adminPanel.classList.remove('hidden');
}

<<<<<<< HEAD
// Cambia visualmente el estado del switch del admin (Verde/Rojo)
=======
// Actualiza visualmente el switch de administración (Verde = Abierto, Rojo = Bloqueado)
>>>>>>> 79cb458431e83aee045ff671d357329546ee3ca2
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

<<<<<<< HEAD
// --- 2. CHEQUEO ANTI-RECARGA ---
=======
// --- 2. CONTROL ANTI-RECARGA (PERSISTENCIA LOCAL) ---
>>>>>>> 79cb458431e83aee045ff671d357329546ee3ca2
window.addEventListener('DOMContentLoaded', () => {
    const juezGuardado = localStorage.getItem('juez_nombre');
    const catGuardada = localStorage.getItem('juez_categoria');

<<<<<<< HEAD
    // Mantiene bloqueado al juez en su pantalla de Check si recarga por error
=======
    // Si el juez ya se había registrado, lo mantenemos en su pantalla de espera
>>>>>>> 79cb458431e83aee045ff671d357329546ee3ca2
    if (juezGuardado && catGuardada) {
        activarPantallaEspera(juezGuardado, catGuardada);
    }
});

<<<<<<< HEAD
// --- 3. ENVÍO REAL A LA API CON FILTRADO DE ROLES ---
=======
// --- 3. ENVÍO DE DATOS A LA API Y FILTRADO DE ROLES ---
>>>>>>> 79cb458431e83aee045ff671d357329546ee3ca2
form.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const nombre = document.getElementById('nombreJuez').value;
    const codigo = document.getElementById('codigoAcceso').value;

    errorMsg.classList.add('hidden');

<<<<<<< HEAD
    // Conectamos directo con el endpoint de app.py
=======
    // Petición real al servidor local de Flask
>>>>>>> 79cb458431e83aee045ff671d357329546ee3ca2
    fetch('/api/login_juez', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ nombre: nombre, codigo: codigo })
    })
    .then(res => {
<<<<<<< HEAD
        if (!res.ok) {
            // Si el backend responde con error (como registros bloqueados o código mal) lo manejamos aquí
=======
        // BLINDAJE: Validamos que el servidor responda un JSON real antes de decodificarlo
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            throw new Error("❌ El backend no respondió un JSON válido. Verifica que Flask esté corriendo.");
        }

        // Si el backend responde con un error HTTP (401, 403, etc.), extraemos su mensaje personalizado
        if (!res.ok) {
>>>>>>> 79cb458431e83aee045ff671d357329546ee3ca2
            return res.json().then(err => { throw err; });
        }
        return res.json();
    })
    .then(data => {
        if (data.role === 'admin') {
<<<<<<< HEAD
            // CASO MASTER: Eres tú, abre el panel de control remoto
            activarPantallaAdmin(data.estado_registro);
        } else if (data.success) {
            // CASO JUEZ: Acceso concedido, guardamos en memoria del cel y mostramos check
=======
            // CASO MASTER: Eres tú, despliega el interruptor remoto
            activarPantallaAdmin(data.estado_registro);
        } else if (data.success) {
            // CASO JUEZ: Registro exitoso, guardamos sesión y bloqueamos la pantalla
>>>>>>> 79cb458431e83aee045ff671d357329546ee3ca2
            localStorage.setItem('juez_nombre', data.nombre);
            localStorage.setItem('juez_categoria', data.categoria);
            activarPantallaEspera(data.nombre, data.categoria);
        }
    })
    .catch(err => {
<<<<<<< HEAD
        console.error(err);
        errorMsg.innerText = err.message || "❌ Error de conexión con el servidor.";
=======
        console.error("Error en la petición:", err);
        // Desplegamos el error de forma limpia en el contenedor rojo sin tronar la app
        errorMsg.innerText = err.message || "❌ No se pudo establecer conexión con el servidor de Flask.";
>>>>>>> 79cb458431e83aee045ff671d357329546ee3ca2
        errorMsg.classList.remove('hidden');
    });
});

<<<<<<< HEAD
// --- 4. ACCIÓN REMOTA DEL SWITCH DE CONTROL DE ACCESO ---
btnToggle.addEventListener('click', () => {
    fetch('/api/admin/toggle_registro', { method: 'POST' })
    .then(res => res.json())
=======
// --- 4. CONTROL DEL SWITCH MAESTRO DE ADMISIÓN ---
btnToggle.addEventListener('click', () => {
    fetch('/api/admin/toggle_registro', { method: 'POST' })
    .then(res => {
        if (!res.ok) throw new Error("No se pudo cambiar el estado.");
        return res.json();
    })
>>>>>>> 79cb458431e83aee045ff671d357329546ee3ca2
    .then(data => {
        if (data.success) {
            actualizarInterfazAdmin(data.nuevo_estado);
        }
    })
    .catch(err => console.error("Error al mover el switch:", err));
});

<<<<<<< HEAD
// Botón para salir de tu cuenta de Administrador
=======
// Botón para salir del modo Administrador y resetear el formulario
>>>>>>> 79cb458431e83aee045ff671d357329546ee3ca2
document.getElementById('btnSalirAdmin').addEventListener('click', () => {
    adminPanel.classList.add('hidden');
    form.reset();
    form.classList.remove('hidden');
});

<<<<<<< HEAD
// --- 5. CONTROL DEL POP-UP DESPLEGABLE (JUECES) ---
=======
// --- 5. CONTROL DEL MODAL DE RETORNO (SÓLO JUECES) ---
>>>>>>> 79cb458431e83aee045ff671d357329546ee3ca2
btnEquivocado.addEventListener('click', () => {
    modal.classList.remove('hidden');
});

btnModalNo.addEventListener('click', () => {
    modal.classList.add('hidden');
});

btnModalSi.addEventListener('click', () => {
<<<<<<< HEAD
    localStorage.clear(); 
=======
    localStorage.clear(); // Limpia la memoria local del navegador
>>>>>>> 79cb458431e83aee045ff671d357329546ee3ca2
    modal.classList.add('hidden'); 
    espera.classList.add('hidden'); 
    form.reset();
    form.classList.remove('hidden'); // Devuelve el formulario limpio
});