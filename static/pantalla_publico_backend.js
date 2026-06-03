// Función para agregar visualmente a un juez en la columna correcta
function renderizarJuezenPantalla(nombreJuez, idContenedor) {
    const contenedor = document.getElementById(idContenedor);
    
    // Creamos la etiqueta de diseño para el nombre del juez
    const tarjetaJuez = document.createElement('p');
    // Reemplaza esta línea en tu pantalla_publico_backend.js:
    tarjetaJuez.className = "bg-emerald-50 p-3 rounded-xl text-center text-sm font-bold border border-emerald-200 text-emerald-900 shadow-sm animate-bounce";
    tarjetaJuez.innerText = `👨‍⚖️ ${nombreJuez}`;
    
    // Metemos el elemento al contenedor
    contenedor.appendChild(tarjetaJuez);
}

// SIMULACIÓN (Esto emula lo que pasará cuando la BD real le mande datos)
console.log("Esperando conexiones de jueces...");

// A los 3 segundos aparece el primer juez en Mini Sumos
setTimeout(() => {
    renderizarJuezenPantalla("Ing. Daniel Mendoza", "lista-mini-sumos");
}, 3000);

// A los 6 segundos aparece otro juez en la categoría de 3 lb
setTimeout(() => {
    renderizarJuezenPantalla("Dra. Indira", "lista-3lb");
}, 6000);