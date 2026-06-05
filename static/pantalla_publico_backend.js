// =====================================================================
// PANTALLA DE PROYECCIÓN PÚBLICA - GUERRA DE ROBOTS FIME
// =====================================================================

// Diccionario que vincula los nombres de la BD con los contenedores HTML
const mapeoContenedores = {
    "Mini Sumos": "lista-mini-sumos",
    "1 lb": "lista-1lb",
    "3 lb": "lista-3lb",
    "Autónomos": "lista-autonomos",
    "Humanoides": "lista-humanoides"
};

/**
 * Consulta la API de Flask para traer los jueces registrados y los distribuye en las columnas
 */
function actualizarTableroPublico() {
    fetch('/api/admin/jueces')
    .then(res => {
        if (!res.ok) throw new Error("Error al obtener datos del servidor.");
        return res.json();
    })
    .then(data => {
        if (data.success) {
            // 1. Limpiamos todas las columnas antes de volver a pintar para evitar duplicados
            Object.values(mapeoContenedores).forEach(idContenedor => {
                const contenedor = document.getElementById(idContenedor);
                if (contenedor) contenedor.innerHTML = '';
            });

            // Si no hay jueces aún, podemos dejar los contenedores limpios o poner un indicador
            if (data.jueces.length === 0) {
                console.log("Tablero limpio: Esperando registros de jueces...");
                return;
            }

            // 2. Recorremos los jueces reales devueltos por SQLite e inyectamos sus tarjetas
            data.jueces.forEach(juez => {
                // Buscamos a qué columna pertenece según su categoría
                const idContenedorTarget = mapeoContenedores[juez.categoria];
                
                if (idContenedorTarget) {
                    renderizarJuezenPantalla(juez.nombre, idContenedorTarget);
                }
            });
        }
    })
    .catch(err => console.error("❌ Fallo en la sincronización del tablero público:", err));
}

/**
 * Crea e inserta la tarjeta estilizada del juez en el contenedor correspondiente
 */
function renderizarJuezenPantalla(nombreJuez, idContenedor) {
    const contenedor = document.getElementById(idContenedor);
    if (!contenedor) return;

    // Creamos la etiqueta de diseño para el nombre del juez
    const tarjetaJuez = document.createElement('p');
    
    // DISEÑO: Estilo limpio de Tailwind con una leve animación fade-in al aparecer
    tarjetaJuez.className = "bg-emerald-50/70 p-3 rounded-xl text-center text-sm font-bold border-2 border-emerald-200/50 text-emerald-900 shadow-sm transition-all transform duration-300 animate-pulse hover:scale-105";
    tarjetaJuez.innerText = `👨‍⚖️ ${nombreJuez}`;
    
    // Metemos el elemento al contenedor de la columna
    contenedor.appendChild(tarjetaJuez);
}

// =====================================================================
// INICIALIZACIÓN Y AUTOMATIZACIÓN (POLLING)
// =====================================================================

// Ejecuta la primera carga inmediatamente al abrir la pantalla
document.addEventListener('DOMContentLoaded', () => {
    console.log("🔋 Sincronizando tablero público con el servidor de Flask...");
    actualizarTableroPublico();

    // Configura el sondeo automático: Se actualizará solo cada 3000 ms (3 segundos)
    setInterval(actualizarTableroPublico, 3000);
});