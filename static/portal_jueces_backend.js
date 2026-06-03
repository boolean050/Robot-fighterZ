const codigosSimulados = {
    "1111": "Mini Sumos",
    "2222": "1 lb",
    "3333": "3 lb",
    "4444": "Autónomos",
    "5555": "Humanoides"
};

// Elementos de la interfaz
const form = document.getElementById('loginForm');
const espera = document.getElementById('pantallaEspera');
const errorMsg = document.getElementById('errorMsg');

// Elementos del Modal/Pop-up
const modal = document.getElementById('modalAdvertencia');
const btnEquivocado = document.getElementById('btnEquivocado');
const btnModalSi = document.getElementById('btnModalSi');
const btnModalNo = document.getElementById('btnModalNo');

// --- 1. FUNCIÓN PARA MOSTRAR LA PANTALLA DE ESPERA ---
function activarPantallaEspera(nombre, categoria) {
    form.classList.add('hidden');
    document.getElementById('nombreAsignado').innerText = nombre;
    document.getElementById('categoriaAsignada').innerText = categoria;
    espera.classList.remove('hidden');
}

// --- 2. CHEQUEO ANTI-RECARGA (Al abrir la página) ---
window.addEventListener('DOMContentLoaded', () => {
    const juezGuardado = localStorage.getItem('juez_nombre');
    const catGuardada = localStorage.getItem('juez_categoria');

    // Si existen datos guardados en el celular, lo bloqueamos directo en el Check
    if (juezGuardado && catGuardada) {
        activarPantallaEspera(juezGuardado, catGuardada);
    }
});

// --- 3. LOGIC AL ENVIAR EL FORMULARIO ---
form.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const nombre = document.getElementById('nombreJuez').value;
    const codigo = document.getElementById('codigoAcceso').value;

    errorMsg.classList.add('hidden');

    if (codigosSimulados[codigo]) {
        const categoria = codigosSimulados[codigo];

        // Guardamos los datos en la memoria del dispositivo antes de mover la pantalla
        localStorage.setItem('juez_nombre', nombre);
        localStorage.setItem('juez_categoria', categoria);
        
        activarPantallaEspera(nombre, categoria);
    } else {
        errorMsg.innerText = "❌ Código inválido. Verifica con el administrador.";
        errorMsg.classList.remove('hidden');
    }
});

// --- 4. CONTROL DEL POP-UP DESPLEGABLE ---

// Al dar clic al link "¿Te equivocaste...?" abrimos el modal flotante
btnEquivocado.addEventListener('click', () => {
    modal.classList.remove('hidden');
});

// Si le pica a "No, quedarme", solo cerramos el Pop-up
btnModalNo.addEventListener('click', () => {
    modal.classList.add('hidden');
});

// Si le pica a "Sí, salir", borramos memoria y reiniciamos todo el formulario
btnModalSi.addEventListener('click', () => {
    localStorage.clear(); // Borra la memoria del cel
    modal.classList.add('hidden'); // Oculta el pop-up
    espera.classList.add('hidden'); // Oculta pantalla de espera
    
    // Limpia y muestra el formulario vacío de nuevo
    form.reset();
    form.classList.remove('hidden');
});