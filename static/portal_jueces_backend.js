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
    cargarJuecesAdmin(); // MODIFICADO: Carga la lista de jueces reales inmediatamente al entrar
    adminPanel.classList.remove('hidden');
}

// Actualiza visualmente el switch de administration (Verde = Abierto, Rojo = Bloqueado)
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
    // Captura el valor de la categoría desde tu formulario HTML
    const categoria = document.getElementById('selectCategoria').value; 

    errorMsg.classList.add('hidden');

    // Petición real al servidor local de Flask
    fetch('/api/login_juez', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        // ¡Súper importante enviar la categoría aquí!
        body: JSON.stringify({ nombre: nombre, codigo: codigo, categoria: categoria }) 
    })
    .then(res => {
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            throw new Error("❌ El backend no respondió un JSON válido.");
        }

        // Si el backend responde con error, atrapamos el mensaje personalizado de app.py
        if (!res.ok) {
            return res.json().then(err => { throw err; });
        }
        return res.json();
    })
    .then(data => {
        if (data.role === 'admin') {
            activarPantallaAdmin(data.estado_registro);
        } else if (data.success) {
            // Guardamos en el navegador para que persista la sesión en esa categoría
            localStorage.setItem('juez_nombre', data.nombre);
            localStorage.setItem('juez_categoria', data.categoria);
            activarPantallaEspera(data.nombre, data.categoria);
        }
    })
    .catch(err => {
        console.error("Error en la petición:", err);
        // Aquí se pintará el mensaje exacto que mandó Python
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


// --- 6. GESTIÓN DINÁMICA DE LA TABLA DE JUECES (NUEVO) ---

// Función para consultar al backend y estructurar las filas de la tabla
function cargarJuecesAdmin() {
    const tbody = document.getElementById('tablaJuecesBody');
    if (!tbody) return; // Salvaguarda por si aún no montas el HTML de la tabla

    tbody.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-gray-400">Cargando jueces registrados...</td></tr>`;

    fetch('/api/admin/jueces')
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            tbody.innerHTML = ''; // Limpiar mensaje de espera
            
            if (data.jueces.length === 0) {
                tbody.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-gray-400 italic">No hay ningún juez registrado en este momento.</td></tr>`;
                return;
            }

            // Mapeo e inserción de filas individuales
            data.jueces.forEach(juez => {
                const fila = document.createElement('tr');
                fila.innerHTML = `
                    <td class="px-4 py-3 font-semibold text-slate-700">${juez.nombre}</td>
                    <td class="px-4 py-3"><span class="px-2 py-1 rounded bg-blue-50 text-blue-700 font-medium">${juez.categoria}</span></td>
                    <td class="px-4 py-3 text-center">
                        <button onclick="eliminarJuezId(${juez.id}, '${juez.nombre}')" class="bg-red-100 hover:bg-red-600 text-red-600 hover:text-white font-bold px-3 py-1 rounded-lg text-[10px] uppercase tracking-wider transition-all active:scale-95">
                            Eliminar
                        </button>
                    </td>
                `;
                tbody.appendChild(fila);
            });
        }
    })
    .catch(err => {
        console.error("Error al renderizar los jueces:", err);
        tbody.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-red-500 font-bold">❌ Error al conectar con el servidor de Flask.</td></tr>`;
    });
}

// Inyección de la función en el objeto Window para asegurar su ejecución inline
window.eliminarJuezId = function(id, nombre) {
    if (confirm(`⚠️ ¿Estás seguro de que deseas eliminar al juez "${nombre}"? Al hacerlo, se borrará su candado de categoría.`)) {
        fetch(`/api/admin/eliminar_juez/${id}`, { method: 'POST' })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                cargarJuecesAdmin(); // Recarga la tabla de inmediato tras borrar el registro
            }
        })
        .catch(err => console.error("Error al procesar la baja del juez:", err));
    }
};