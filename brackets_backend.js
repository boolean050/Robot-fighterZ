import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, doc, setDoc, getDocs, query, where, writeBatch, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// =====================================================================
// 🛑 CADENERO DE SEGURIDAD ABSOLUTA (BLINDAJE DE URL)
// =====================================================================
if (!sessionStorage.getItem('juez_nombre') || !sessionStorage.getItem('juez_role')) {
    // Si no tiene gafete de sesión, lo pateamos a la pantalla de Login inmediatamente
    window.location.replace('index.html'); 
    // Usamos replace() en vez de href para que no puedan usar la flecha de "Atrás" para volver a entrar
    
    // Detenemos por completo la lectura del resto del código para que no cargue datos sensibles
    throw new Error("🔒 Acceso no autorizado. Redirigiendo al login...");
}

// =====================================================================
// MOTOR CORE OPTIMIZADO - BRACKETS CLÁSICOS
// =====================================================================

if (!document.getElementById('classic-bracket-styles')) {
    const style = document.createElement('style');
    style.id = 'classic-bracket-styles';
    style.innerHTML = `
        /* ALINEACIÓN SUPERIOR: Evita que se estiren feo con el zoom */
        .bracket-wrapper { display: flex; flex-direction: row; align-items: flex-start; justify-content: safe center; padding: 4rem; min-height: 100%; min-width: max-content; background: transparent; }
        
        /* ANCLAJE ARRIBA Y GAP FIJO: Las tarjetas siempre estarán al mismo nivel horizontal */
        .bracket-col { display: flex; flex-direction: column; justify-content: flex-start; position: relative; min-width: 280px; gap: 1.5rem; margin: 0 1.75rem; flex-shrink: 0; }
        
        .match-container { display: flex; flex-direction: column; justify-content: center; position: relative; width: 100%; }

        /* LÍNEAS MODO ESPEJO (Solo Fase 2) */
        .phase-2-tree .col-left .match-container::after { content: ''; position: absolute; right: -3.5rem; top: 50%; width: 3.5rem; height: 3px; background-color: #cbd5e1; z-index: 0; }
        .phase-2-tree .col-right .match-container::before { content: ''; position: absolute; left: -3.5rem; top: 50%; width: 3.5rem; height: 3px; background-color: #cbd5e1; z-index: 0; }

        .match-card { background: white; border: 2px solid #e2e8f0; border-radius: 10px; display: flex; flex-direction: column; z-index: 10; position: relative; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); overflow: hidden; width: 100%; transition: all 0.2s ease; }
        .match-card:hover { box-shadow: 0 10px 20px -5px rgba(0,0,0,0.1); border-color: #cbd5e1; transform: translateY(-2px); }
        .player-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 2px solid #f1f5f9; cursor: pointer; transition: all 0.2s ease; min-height: 52px; }
        .player-row:last-child { border-bottom: none; }
        .player-row:hover { background: #f8fafc; }
        .player-row.winner { background: #10b981; border-color: #059669; }
        .player-row.winner .player-name { color: white; }
        .player-row.winner .docente-text { color: #d1fae5; }
        
        /* DISEÑO AMARILLO PLÁTANO - REPECHAJE */
        .player-row.winner-rep { background: #fef08a !important; border-color: #f59e0b !important; }
        .player-row.winner-rep .player-name { color: #78350f !important; }
        .player-row.winner-rep .docente-text { color: #92400e !important; }

        .player-info { display: flex; flex-direction: column; overflow: hidden; }
        .player-name { font-weight: 900; font-size: 0.85rem; color: #1e293b; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 170px; }
        .docente-text { font-size: 0.6rem; color: #94a3b8; font-weight: 800; text-transform: uppercase; margin-top: 3px; }
        .score-box { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; font-size: 0.9rem; border-radius: 6px; background: transparent; }
    `;
    document.head.appendChild(style);
}


const tournamentData = {
    pequenos: { participants: [], phase: 'round1', round1Matches: [], byePlayer: null, repechageMatches: [], laterRounds: [], champion: null },
    mediano: { participants: [], phase: 'round1', round1Matches: [], byePlayer: null, repechageMatches: [], laterRounds: [], champion: null },
    grandes: { participants: [], phase: 'round1', round1Matches: [], byePlayer: null, repechageMatches: [], laterRounds: [], champion: null },
};
const timeData = { seguimiento: [], evasor: [] };
const timeParticipants = { seguimiento: [], evasor: [] };
let docentesMap = {}; 
let currentSubView = 'menu'; // 🔥 NUEVA VARIABLE PARA RECORDAR DÓNDE ESTAMOS

// 🔥 NUEVA VARIABLE: Rastrea si Firebase ya nos mandó los brackets iniciales
window.bracketsCargados = { pequenos: false, mediano: false, grandes: false };

// 🔥 NUEVA FUNCIÓN: Verifica si hay nuevos equipos y auto-regenera si no ha empezado
window.autoRegenerarBrackets = function(cat) {
    if (!window.bracketsCargados[cat]) return; // Aún no carga de la base de datos
    
    const data = tournamentData[cat];
    if (!data.participants || data.participants.length === 0) return;
    
    const r1Matches = data.round1Matches || [];
    // Verificamos si ya hay un ganador (el torneo ya empezó)
    const yaEmpezo = r1Matches.some(m => m.winner !== null) || (data.phase && data.phase !== 'phase1' && data.phase !== 'round1');
    
    // Calculamos cuántos robots están actualmente en los brackets
    const enBracket = (r1Matches.length * 2) + (data.byePlayer ? 1 : 0);
    
    // Si NO ha empezado y la cantidad de equipos en el padrón no coincide con los del bracket
    if (!yaEmpezo && data.participants.length !== enBracket) {
        console.log(`🔄 Auto-regenerando brackets de ${cat} por cambio en equipos...`);
        localStorage.removeItem('fime_bracket_' + cat);
        generateInitialMatches(cat); // Barajea y arma los brackets nuevos
        
        // Actualiza visualmente si la pantalla está abierta
        const activeView = document.querySelector('.view.active')?.id.replace('view-', '');
        if (activeView === cat) {
            renderTournament(cat, currentSubView);
        }
    }
};

window.memoriaScrollX = 0;
window.memoriaScrollY = 0;
window.guardarScroll = function(elemento) {
    window.memoriaScrollX = elemento.scrollLeft;
    window.memoriaScrollY = elemento.scrollTop;
};

document.addEventListener('DOMContentLoaded', () => {
    // 🛡️ TRUCO: Bloquear el botón físico de "Atrás" del celular o navegador
    history.pushState(null, null, window.location.href);
    window.onpopstate = function () {
        history.go(1);
    };

    cargarDatosDesdeServidor();
    iniciarRadarSesionBrackets(); // 🔥 ENCENDEMOS EL RADAR PARA ESTA PESTAÑA
});

// =====================================================================
// 📡 RADAR DE SESIÓN PARA BRACKETS (Sincronización multi-pestaña)
// =====================================================================
function iniciarRadarSesionBrackets() {
    const nombreUsuario = sessionStorage.getItem('juez_nombre');
    if (!nombreUsuario) return; // Si no hay usuario, no hay nada que vigilar

    const ref = doc(db, "maestros_autorizados", nombreUsuario);
    onSnapshot(ref, (docSnap) => {
        if (!docSnap.exists()) return;
        const data = docSnap.data();
        const rolActualEnPantalla = sessionStorage.getItem('juez_role');
        const catActualEnPantalla = sessionStorage.getItem('juez_categoria');
        const isSuperAdmin = sessionStorage.getItem('juez_superadmin') === 'true';

        // 1. EXPULSIÓN O CAMBIO DE CONTRASEÑA (Cierre de sesión forzado)
        if (data.sesion_activa === false) {
            sessionStorage.clear();
            if (data.fuerza_relogin === "password") {
                alert("🔑 Tu contraseña ha sido actualizada por el Súper Admin. Inicia sesión de nuevo.");
            } else {
                alert("🚪 Tu sesión ha sido cerrada por el sistema.");
            }
            window.location.href = 'index.html';
            return;
        }

        // 2. DESCENSO: Le quitaron el rango de Admin
        if (rolActualEnPantalla === 'admin' && data.rol !== 'admin' && data.rol !== 'superadmin') {
            sessionStorage.clear();
            alert("🥲 Ya no eres administrador. Regresando al portal de jueces...");
            window.location.href = 'index.html';
            return;
        }

        // 3. CAMBIO DE CATEGORÍA (Admin normal)
        if (!isSuperAdmin && data.categoria && data.categoria !== catActualEnPantalla) {
            sessionStorage.setItem('juez_categoria', data.categoria);
            alert("🔄 Tu categoría asignada ha sido actualizada por el Súper Admin.");
            window.location.href = 'brackets.html'; // Recargamos limpio para que lea su nueva categoría
            return;
        }
    });
}



function cargarDatosDesdeServidor() {
    onSnapshot(collection(db, "competidores"), (snapshot) => {
        // 🔥 LIMPIEZA SEGURA: Vaciamos los nombres y puntos de TODAS las categorías
        ['pequenos', 'mediano', 'grandes', 'seguimiento', 'evasor'].forEach(cat => {
            if (!tournamentData[cat]) {
                tournamentData[cat] = { participants: [], round1Matches: [], repechageMatches: [], laterRounds: [], phase: 'round1', puntosTotales: {} };
            } else {
                tournamentData[cat].participants = [];
                tournamentData[cat].puntosTotales = {}; 
                // NO tocamos round1Matches ni laterRounds aquí
            }
        });

        // 2. Extraemos los robots de Firebase con TRADUCTOR BLINDADO
        snapshot.forEach(docSnap => {
            const c = docSnap.data();
            docentesMap[c.nombre] = c.docente || c.facultad || 'Sin Asesor'; 
            
            // Atrapamos cualquier variación
            let textoFiltro = (c.categoria_tag || c.categoria_original || c.categoria || '').toLowerCase();
            let tagReal = '';
            
            if (textoFiltro.includes('peque')) tagReal = 'pequenos';
            else if (textoFiltro.includes('median')) tagReal = 'mediano';
            else if (textoFiltro.includes('grand')) tagReal = 'grandes';
            else if (textoFiltro.includes('segui') || textoFiltro.includes('línea') || textoFiltro.includes('linea')) tagReal = 'seguimiento';
            else if (textoFiltro.includes('evasor') || textoFiltro.includes('obst')) tagReal = 'evasor';

            if (['pequenos','mediano','grandes','seguimiento','evasor'].includes(tagReal)) {
                if (!tournamentData[tagReal]) tournamentData[tagReal] = { participants: [], puntosTotales: {} };
                tournamentData[tagReal].participants.push(c.nombre);
                tournamentData[tagReal].puntosTotales[c.nombre] = Number(c.puntos || c.puntaje || c.score || 0);
            }
        });

        
        
        // 4. LÓGICA DE PERMISOS: SÚPER ADMIN vs ADMIN NORMAL
        const isSuperAdmin = sessionStorage.getItem('juez_superadmin') === 'true';
        const miCat = sessionStorage.getItem('juez_categoria');
        
        const catMap = { "Pequeños": "pequenos", "Mediano": "mediano", "Medianos": "mediano", "Grandes": "grandes", "Seguimiento de línea": "seguimiento", "Evasor de obstáculos": "evasor" };
        const myViewId = catMap[miCat] || "pequenos"; 
        const todasLasTarjetas = ['pequenos', 'mediano', 'grandes', 'seguimiento', 'evasor'];
        const contenedorTarjetas = document.querySelector('#view-menu > div:nth-of-type(2)');

        if (!isSuperAdmin) {
            // ADMIN NORMAL: Vista enfocada en su categoría (Lobby centrado)
            // Si ya hay una pantalla abierta (ej. Las llaves), no fuerces el menú de nuevo
            if (!document.querySelector('.view.active')) {
                document.getElementById('view-menu').classList.add('active');
            }
            
            // 🔥 ARREGLO VISUAL: Convertir el Grid en Flexbox Centrado
            if (contenedorTarjetas) contenedorTarjetas.className = "flex flex-col items-center justify-center w-full max-w-lg mx-auto";
            
            todasLasTarjetas.forEach(cat => {
                // Seleccionamos el div "padre" que envuelve a la tarjeta y a los controles
                const tarjetaPadre = document.querySelector(`[onclick="openCategory('${cat}')"]`)?.parentElement;
                
                if (tarjetaPadre) {
                    if (cat === myViewId) {
                        tarjetaPadre.style.display = 'flex'; 
                        tarjetaPadre.classList.add('w-full', 'items-center', 'justify-center');
                    } else {
                        tarjetaPadre.style.display = 'none'; 
                    }
                }
            });
            
            const btnInternalBack = document.getElementById('btnBack');
            if (btnInternalBack) {
                btnInternalBack.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg> Regresar al Lobby`;
            }
            // 🔥 El botón de "Volver al Panel" se llama "Panel Admin" para el ADMIN
            const btnPanel = document.getElementById('btnReturnAdmin');
            if (btnPanel) btnPanel.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" /></svg> Panel Admin`;
        } else {
            // SÚPER ADMIN: Vista completa con todas las tarjetas
            // Si ya hay una pantalla abierta (ej. Las llaves), no fuerces el menú de nuevo
            if (!document.querySelector('.view.active')) {
                document.getElementById('view-menu').classList.add('active');
            }
            if (contenedorTarjetas) contenedorTarjetas.className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6";
            
            // 🔥 Mostrar botón de Admin Solitario
            const btnSolitario = document.getElementById('btnModoSolitario');
            if (btnSolitario) {
                btnSolitario.classList.remove('hidden');
                btnSolitario.classList.add('flex');
            }
            
            todasLasTarjetas.forEach(cat => {
                const tarjeta = document.querySelector(`[onclick="openCategory('${cat}')"]`);
                if (tarjeta) {
                    tarjeta.style.display = 'block';
                    tarjeta.classList.remove('w-full', 'max-w-sm'); 
                }
            });
            
            const btnInternalBack = document.getElementById('btnBack');
            if (btnInternalBack) {
                btnInternalBack.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg> Menú Principal`;
            }
            
            // Si el súper admin entra por link directo, lo mandamos a esa categoría
            const urlParams = new URLSearchParams(window.location.search);
            const autoCat = urlParams.get('cat');
            if(autoCat && todasLasTarjetas.includes(autoCat)) {
                openCategory(autoCat); 
            }
        }
        
        // 5. Refrescar el árbol visual en tiempo real
        const activeView = document.querySelector('.view.active')?.id.replace('view-', '');
        if(['pequenos', 'mediano', 'grandes'].includes(activeView)) {
            renderTournament(activeView, currentSubView);
        }
        
        // 🔥 AUTO-REGENERAR BRACKETS SI HAY CAMBIOS DE EQUIPOS Y NO HA EMPEZADO
        ['pequenos', 'mediano', 'grandes'].forEach(cat => window.autoRegenerarBrackets(cat));
        
    }); // <--- 🔥 AQUÍ CERRAMOS EL RADAR DE COMPETIDORES

    // 🔥 SEGUNDO RADAR: BRACKETS EN TIEMPO REAL (Totalmente independiente)
    onSnapshot(collection(db, "brackets_estado"), (snap) => {
        // 1. EL EFECTO LOBBY: Si el Súper Admin borra la BD, expulsa a todos
        snap.docChanges().forEach(change => {
            if (change.type === "removed") {
                const catBorrada = change.doc.id;
                const activeView = document.querySelector('.view.active')?.id.replace('view-', '');
                
                if (activeView === catBorrada) {
                    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
                    document.getElementById('view-menu').classList.add('active');
                    alert("⚠️ El Súper Admin ha reiniciado este torneo. Regresando al Lobby.");
                }
            }
        });

        // 2. ACTUALIZACIÓN NORMAL DE LLAVES
        snap.forEach(docSnap => {
            const cat = docSnap.id;
            const data = docSnap.data();
            if (tournamentData[cat]) {
                window.bracketsCargados[cat] = true; // 🔥 Marcamos que ya recibimos info de Firebase
                
                tournamentData[cat].round1Matches = data.round1Matches || [];
                tournamentData[cat].repechageMatches = data.repechageMatches || [];
                tournamentData[cat].laterRounds = data.laterRounds || [];
                tournamentData[cat].champion = data.champion || null;
                tournamentData[cat].byePlayer = data.byePlayer || null;
                tournamentData[cat].phase = data.phase || 'round1';

                // 🔥 AUTO-REGENERAR POR SI EL PADRÓN CARGÓ PRIMERO
                window.autoRegenerarBrackets(cat);

                const activeView = document.querySelector('.view.active')?.id.replace('view-', '');
                if (activeView === cat && typeof currentSubView !== 'undefined') {
                    renderTournament(cat, currentSubView);
                }
            }
        });
    });
} // <--- 🔥 AQUÍ TERMINA LA FUNCIÓN cargarDatosDesdeServidor()


function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-' + viewId).classList.add('active');
    document.getElementById('btnBack').classList.toggle('hidden', viewId === 'menu');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.goToMenu = () => {
    showView('menu');
    document.getElementById('btnReturnAdmin').classList.remove('hidden');
    document.getElementById('btnTopMenuElim')?.classList.add('hidden'); // 🔥 Esta línea aniquila el bug
};

window.openCategory = (cat) => {
    showView(cat);
    document.getElementById('btnReturnAdmin').classList.add('hidden');
    document.getElementById('btnTopMenuElim')?.classList.add('hidden'); // 🔥 Lo mantenemos oculto al entrar a la tarjeta inicial
    
    if (['pequenos', 'mediano', 'grandes'].includes(cat)) {
        renderTournament(cat, 'menu');
    } else {
        renderTimeTable(cat);
    }
};

// =====================================================================
// --- ALGORITMO CORE: GRUPOS Y REPECHAJE INSTANTÁNEO ---
// =====================================================================

function generateInitialMatches(cat) {
    const data = tournamentData[cat];
    if (data.participants.length < 2) return;
    
    // 🔥 MAGIA ANTI-F5: Intentar recuperar el torneo guardado
    const guardado = localStorage.getItem('fime_bracket_' + cat);
    if (guardado) {
        const parseado = JSON.parse(guardado);
        // Si nadie ha agregado o borrado robots del padrón, restauramos las peleas exactas
        if (parseado.participants && parseado.participants.length === data.participants.length) {
            data.round1Matches = parseado.round1Matches;
            data.repechageMatches = parseado.repechageMatches;
            data.laterRounds = parseado.laterRounds;
            data.champion = parseado.champion;
            data.byePlayer = parseado.byePlayer;
            data.phase = parseado.phase;
            return; // Detenemos la función aquí para no volver a barajarlos
        }
    }

    const shuffled = [...data.participants].sort(() => Math.random() - 0.5);
    data.byePlayer = shuffled.length % 2 !== 0 ? shuffled.pop() : null;
    
    data.round1Matches = [];
    data.repechageMatches = [];
    data.laterRounds = [];
    data.champion = null;
    data.phase = 'phase1';
    
    // Armar Ronda 1 pura (Solo pares)
    for (let i = 0; i < shuffled.length; i += 2) {
        data.round1Matches.push({ player1: shuffled[i], player2: shuffled[i + 1], winner: null });
    }

    // 🔥 NUEVA LÓGICA DE REPECHAJE: Solo 1 bracket central si es impar. 0 si es par.
    if (data.byePlayer) {
        data.repechageMatches.push({ player1: data.byePlayer, player2: null, winner: null });
    }

    guardarBracketFirebase(cat);
}



function checkPhase1Completion(data) {
    const r1Done = data.round1Matches.every(m => m.winner !== null);
    
    // 🔥 MAGIA: Asignar un perdedor aleatorio al repechaje cuando termina Ronda 1
    if (r1Done && data.repechageMatches && data.repechageMatches.length === 1) {
        let repMatch = data.repechageMatches[0];
        if (!repMatch.player2) {
            let losers = [];
            data.round1Matches.forEach(m => {
                if (m.winner === m.player1 && m.player2) losers.push(m.player2);
                if (m.winner === m.player2 && m.player1) losers.push(m.player1);
            });
            if (losers.length > 0) {
                // Escoger aleatorio de los que perdieron
                repMatch.player2 = losers[Math.floor(Math.random() * losers.length)];
            }
        }
    }

    if (!r1Done) return; 

    const repDone = data.repechageMatches.every(m => m.winner !== null);

    if (r1Done && repDone && (!data.laterRounds || data.laterRounds.length === 0)) {
        buildPhase2Bracket(data);
        if (typeof window.lanzarPopUpFase1 === 'function') window.lanzarPopUpFase1();
    }
}


function buildPhase2Bracket(data) {
    if (data.laterRounds && data.laterRounds.length > 0) return;
    
    let allWinners = [];
    data.round1Matches.forEach(m => { if(m.winner && m.winner !== 'EMPTY') allWinners.push(m.winner); });
    data.repechageMatches.forEach(m => { if(m.winner && m.winner !== 'EMPTY') allWinners.push(m.winner); });

    const totalExpectedRounds = Math.ceil(Math.log2(allWinners.length));
    const bracketSize = Math.pow(2, totalExpectedRounds);

    while (allWinners.length < bracketSize) {
        allWinners.push(null); 
    }
    allWinners.sort(() => Math.random() - 0.5); 

    let currentRound = [];
    for (let i = 0; i < bracketSize; i += 2) {
        currentRound.push({ player1: allWinners[i], player2: allWinners[i+1], winner: null, isBye: (!allWinners[i] || !allWinners[i+1]) });
    }
    // 🔥 CAMBIO CLAVE: Lo metemos en un objeto "matches"
    data.laterRounds.push({ matches: currentRound });

    let prevMatchCount = currentRound.length;
    while(prevMatchCount > 1) {
        prevMatchCount = prevMatchCount / 2;
        let emptyRound = [];
        for(let i=0; i<prevMatchCount; i++) emptyRound.push({ player1: null, player2: null, winner: null });
        data.laterRounds.push({ matches: emptyRound });
    }

    data.laterRounds[0].matches.forEach(m => {
        // 🔥 DESACTIVADO: Ya no ganan solos ni se auto-marcan al llegar a Eliminatorias.
        // Se quedan esperando a ser llamados por el Rayito (⚡) y evaluados manualmente.
        if (m.player1 && !m.player2) { m.isBye = false; }
        if (m.player2 && !m.player1) { m.isBye = false; }
    });

    updateLaterRoundsCascading(data);
}

function updateLaterRoundsCascading(data) {
    for (let r = 0; r < data.laterRounds.length; r++) {
        const currentRound = data.laterRounds[r].matches;
        if (r < data.laterRounds.length - 1) {
            const nextRound = data.laterRounds[r+1].matches;
            for (let i = 0; i < currentRound.length; i++) {
                const match = currentRound[i];
                const nextMatchIdx = Math.floor(i / 2);
                const isPlayer1 = i % 2 === 0;

                if (isPlayer1) nextRound[nextMatchIdx].player1 = match.winner;
                else nextRound[nextMatchIdx].player2 = match.winner;

                if (!match.winner) {
                    if (nextRound[nextMatchIdx].winner === (isPlayer1 ? nextRound[nextMatchIdx].player1 : nextRound[nextMatchIdx].player2)) {
                        nextRound[nextMatchIdx].winner = null;
                    }
                }
            }
        }
    }
    const lastRound = data.laterRounds[data.laterRounds.length - 1].matches;
    data.champion = lastRound[0].winner;
}


window.selectWinner = function(cat, phase, matchIdx, playerName, subView) {
    // 🔥 MODO LECTURA CONDICIONAL: El Súper Admin normal no puede tocar, PERO el Solitario SÍ.
    const isSuperAdmin = sessionStorage.getItem('juez_superadmin') === 'true';
    if (isSuperAdmin && !window.isModoSolitarioActivo) return;

    const data = tournamentData[cat];
    let match;

    if (phase === 'round1') match = data.round1Matches[matchIdx];
    else if (phase === 'repechage') match = data.repechageMatches[matchIdx];
    else if (phase === 'laterRounds') match = data.laterRounds[matchIdx[0]].matches[matchIdx[1]];

    if (!match || (!match.player1 && phase !== 'repechage') || match.isBye) return;

    match.winner = match.winner === playerName ? null : playerName;

    // 🔥 LÓGICA DE PERDEDORES LIMPIADA
    // Si el admin desmarca un ganador de Ronda 1 por error, borramos al oponente aleatorio del repechaje para que se vuelva a sortear
    if (phase === 'round1' && match.winner === null && data.repechageMatches && data.repechageMatches.length === 1) {
        data.repechageMatches[0].player2 = null;
        data.repechageMatches[0].winner = null;
    }

    // 🔥 BLINDAJE ANTI-AMNESIA: Verificamos estados precisos de las fases
    if (phase === 'round1' || phase === 'repechage') {
        // Si el admin se arrepiente y "desmarca" a alguien, volvemos a bloquear Fase 2
        if (match.winner === null) {
            data.laterRounds = []; 
            data.champion = null;
            
            // 🔥 MATAMOS A LOS ZOMBIES (Liberamos CPU y RAM)
            window.confetiLanzado = false; 
            if (window.intervaloConfeti) clearInterval(window.intervaloConfeti); // Apaga el ciclo
            if (typeof confetti !== 'undefined') confetti.reset(); // Destruye el motor en segundo plano

            const viejoPop = document.getElementById('modal-celebracion-fime');
            if (viejoPop) viejoPop.remove();
            
        } else {
            checkPhase1Completion(data);
        }
    } else {
        updateLaterRoundsCascading(data);
    }

    // Actualizamos los datos visuales
    renderTournament(cat, subView);

    // Guardamos en la nube
    guardarBracketFirebase(cat);
};

// =====================================================================
// RENDERIZADO VISUAL CON SUB-MENÚ DE FASES
// =====================================================================

window.renderTournament = function renderTournament(cat, subView = null) {
    // 🔥 MAGIA ANTI-AMNESIA: Si no me mandan un subView, reviso si había guardado uno antes.
    if (!subView) {
        subView = sessionStorage.getItem(`fime_vista_${cat}`) || 'menu';
    }
    
    // Si me pasaron uno nuevo, lo guardo para que no se me olvide
    sessionStorage.setItem(`fime_vista_${cat}`, subView);
    currentSubView = subView; 

    const container = document.getElementById('tournament-' + cat);
    const data = tournamentData[cat];
    if (!container) return;
    
    // 🔥 BLINDAJE: Saber si el usuario está viendo esta categoría en este exacto momento
    const activeView = document.querySelector('.view.active')?.id.replace('view-', '');
    const isVistaActiva = (activeView === cat);

    if (data.participants.length === 0) {
        container.innerHTML = `<div class="text-center p-12 bg-white rounded-3xl border border-gray-200 shadow-sm w-full max-w-4xl mx-auto"><span class="text-6xl block mb-4">📭</span><h3 class="text-2xl font-black text-gray-400 uppercase tracking-widest">Categoría Vacía</h3><p class="text-gray-400 font-bold mt-2">Sube tu padrón desde el Panel Admin.</p></div>`;
        return;
    }

    const adminName = sessionStorage.getItem('juez_nombre') || 'Administrador';
    const isPhase2Unlocked = data.laterRounds && data.laterRounds.length > 0;
    const isSuperAdmin = sessionStorage.getItem('juez_superadmin') === 'true';

    if (subView === 'menu') {
        if (isVistaActiva) document.getElementById('btnTopMenuElim')?.classList.add('hidden'); // 🔥 Solo afecta si lo estás viendo
        let html = `
        <div class="w-full max-w-4xl mx-auto mt-4 mb-8">
            <div class="text-center mb-10 bg-white p-6 rounded-2xl shadow-sm border border-gray-200 relative overflow-hidden">
                <div class="absolute top-0 left-0 w-full h-2 bg-emerald-600"></div>
                <h2 class="text-2xl md:text-3xl font-black text-gray-800 uppercase tracking-tight">${adminName}</h2>
                <h3 class="text-sm md:text-base font-bold text-emerald-600 uppercase tracking-widest mt-1">Gestión - Categoría ${cat}</h3>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div onclick="renderTournament('${cat}', 'phase1')" class="bg-white border-2 border-transparent hover:border-emerald-400 rounded-2xl p-8 text-center cursor-pointer shadow-md hover:shadow-xl transition-all transform hover:-translate-y-2 relative group">
                    <span class="text-5xl block mb-4 group-hover:scale-110 transition-transform">⚔️</span>
                    <h3 class="text-xl font-extrabold text-gray-800 tracking-tight uppercase">Fase Inicial</h3>
                    <p class="text-xs font-bold text-gray-400 uppercase tracking-widest mt-2">Grupos y Repechaje</p>
                    <span class="inline-block mt-4 px-4 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full uppercase tracking-wider">Desbloqueado</span>
                </div>

                <div onclick="${isPhase2Unlocked ? `renderTournament('${cat}', 'phase2')` : ''}" class="bg-white border-2 border-transparent ${isPhase2Unlocked ? 'hover:border-amber-400 cursor-pointer hover:shadow-xl hover:-translate-y-2' : 'opacity-60 cursor-not-allowed grayscale'} rounded-2xl p-8 text-center shadow-md transition-all transform relative group">
                    <span class="text-5xl block mb-4 ${isPhase2Unlocked ? 'group-hover:scale-110 transition-transform' : ''}">🏆</span>
                    <h3 class="text-xl font-extrabold text-gray-800 tracking-tight uppercase">Eliminatorias</h3>
                    <p class="text-xs font-bold text-gray-400 uppercase tracking-widest mt-2">Ronda 2 hasta la Final</p>
                    ${isPhase2Unlocked 
                        ? `<span class="inline-block mt-4 px-4 py-1 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold rounded-full uppercase tracking-wider">¡Listo para iniciar!</span>`
                        : `<span class="inline-block mt-4 px-4 py-1 bg-red-50 border border-red-200 text-red-700 text-[10px] font-bold rounded-full uppercase tracking-wider flex items-center justify-center gap-1 mx-auto w-max"><svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" /></svg> Termina la Fase Inicial</span>`
                    }
                </div>
            </div>
            
            ${isSuperAdmin ? `
            <div class="mt-8 text-center">
                <button class="text-red-500 hover:text-red-700 font-bold text-xs uppercase tracking-widest underline transition-colors" onclick="resetTournament('${cat}')">
                    🔄 Reiniciar Todo el Torneo
                </button>
            </div>` : ''}
        </div>`;
        container.innerHTML = html;
        return;
    }

    const isArena = !!document.fullscreenElement;
    let html = `
    <div id="arena-header" class="mb-6 w-full bg-white p-3 md:p-4 rounded-2xl shadow-sm border border-gray-200" style="${isArena ? 'display: none;' : ''}">
        
        <!-- 🖥️ MODO PC: 2 botones centrados -->
        <div class="hidden md:flex items-center justify-center gap-6">
            <button onclick="abrirModalPuntajes('${cat}')" class="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-xl font-extrabold shadow-md hover:shadow-lg transition-all text-sm uppercase tracking-widest flex items-center gap-3 active:scale-95">
                📊 Tabla de Puntajes
            </button>
            <button onclick="activarModoArena()" class="bg-sky-100 hover:bg-sky-200 text-sky-900 border-2 border-sky-300 px-8 py-3.5 rounded-xl font-extrabold shadow-md hover:shadow-lg transition-all text-sm uppercase tracking-widest flex items-center gap-3 active:scale-95">
                🖥️ Modo Arena
            </button>
        </div>

        <!-- 📱 MODO CELULAR: Hamburguesa Naranja -->
        <div class="flex flex-col md:hidden w-full">
            <button onclick="document.getElementById('mobile-menu-${cat.replace(/\s+/g,'')}').classList.toggle('hidden')" class="w-full bg-amber-500 hover:bg-amber-600 text-white px-5 py-3.5 rounded-xl font-extrabold text-sm uppercase tracking-widest flex justify-center items-center gap-2 shadow-md hover:shadow-lg active:scale-95 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7" /></svg>
                Opciones del Torneo
            </button>
            
            <div id="mobile-menu-${cat.replace(/\s+/g,'')}" class="hidden flex-col mt-4 w-full border-t border-gray-100 pt-5 animate-fade-in space-y-4">
                <button onclick="abrirModalPuntajes('${cat}')" class="w-full bg-blue-600 hover:bg-blue-700 text-white px-5 py-3.5 rounded-xl font-extrabold shadow-sm text-xs uppercase tracking-widest flex justify-center items-center gap-2 active:scale-95 transition-transform">
                    📊 Tabla de Puntajes
                </button>
                <button onclick="activarModoArena()" class="w-full bg-sky-100 hover:bg-sky-200 text-sky-900 border-2 border-sky-300 px-5 py-3.5 rounded-xl font-extrabold shadow-sm text-xs uppercase tracking-widest flex justify-center items-center gap-2 active:scale-95 transition-transform">
                    🖥️ Modo Arena
                </button>
            </div>
        </div>
    </div>

    <!-- CONTENEDOR MODO ARENA -->
    <div id="arena-workspace" class="flex w-full h-[85vh] gap-6 transition-all duration-300 ${isArena ? 'p-6 bg-gray-50' : ''}">
        <div onscroll="window.guardarScroll(this)" class="relative w-full bg-white rounded-3xl shadow-lg border border-gray-200 overflow-auto flex-grow" id="bracket-area">`;

    const isCarrera = cat === 'Seg. de línea' || cat === 'Evasor';

    if (isCarrera) {
        html += `<div class="w-full max-w-4xl mx-auto mt-8 flex flex-col gap-3 pb-20">
                    <div class="grid grid-cols-12 gap-4 px-6 py-3 bg-emerald-800 text-white font-black text-xs uppercase tracking-widest rounded-t-2xl shadow-md">
                        <div class="col-span-1 text-center">POS</div>
                        <div class="col-span-5">ROBOT / EQUIPO</div>
                        <div class="col-span-2 text-center">TIEMPO BASE</div>
                        <div class="col-span-2 text-center text-amber-300">PENALIZACIÓN</div>
                        <div class="col-span-2 text-right">TIEMPO FINAL</div>
                    </div>`;
        
        const dummyData = data.participants.map((p, i) => ({ 
            name: p, base: (30 + i*2), penaltis: (i%2===0?1:0) 
        }));
        
        dummyData.sort((a,b) => (a.base + a.penaltis*5) - (b.base + b.penaltis*5));

        dummyData.forEach((robot, index) => {
            let finalTime = robot.base + (robot.penaltis * 5);
            let medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`;
            let color = index === 0 ? 'bg-amber-100 border-amber-300' : 'bg-white border-gray-200';
            let delay = index * 0.1; 

            html += `
            <div class="grid grid-cols-12 gap-4 px-6 py-4 items-center ${color} border rounded-xl shadow-sm modal-content" style="animation-delay: ${delay}s">
                <div class="col-span-1 text-center text-xl font-black text-gray-500">${medal}</div>
                <div class="col-span-5 flex flex-col">
                    <span class="font-extrabold text-gray-800 uppercase text-lg">${esc(robot.name)}</span>
                    <span class="text-[10px] text-gray-400 font-bold uppercase">${esc(docentesMap[robot.name] || 'Sin Asesor')}</span>
                </div>
                <div class="col-span-2 text-center font-bold text-gray-500">${robot.base}s</div>
                <div class="col-span-2 text-center font-black text-red-500">+${robot.penaltis * 5}s <span class="text-[10px] text-gray-400">(${robot.penaltis} obs)</span></div>
                <div class="col-span-2 text-right font-black text-emerald-600 text-2xl">${finalTime}s</div>
            </div>`;
        });
        html += `</div>`;

    } else if (subView === 'phase1') {

        if (isVistaActiva && !isArena) document.getElementById('btnTopMenuElim')?.classList.remove('hidden'); // 🔥 Solo afecta si lo estás viendo

        html += `<div class="bracket-wrapper min-w-max justify-center">`;
        
        const r1Total = data.round1Matches.length;
        const halfR1 = Math.ceil(r1Total / 2);
        const leftR1 = data.round1Matches.slice(0, halfR1);
        const rightR1 = data.round1Matches.slice(halfR1);

        html += `<div class="bracket-col">
                    <h4 class="absolute -top-10 left-0 w-full text-center text-[11px] font-black text-emerald-800 uppercase tracking-widest border-b-2 border-emerald-100 pb-2">Ronda 1 Previa</h4>`;
        leftR1.forEach((m, idx) => { html += renderMatchBox(cat, 'round1', idx, m, subView); });
        html += `</div>`;

        if (data.repechageMatches && data.repechageMatches.length > 0) {
            html += `<div class="bracket-col justify-center px-8 mx-4 border-x-2 border-dashed border-gray-200 bg-gray-50/50 rounded-3xl pb-8 min-h-full">
                        <h4 class="absolute -top-10 left-0 w-full text-center text-[11px] font-black text-emerald-800 uppercase tracking-widest border-b-2 border-emerald-100 pb-2">Repechaje</h4>`;
            data.repechageMatches.forEach((m, idx) => { html += renderMatchBox(cat, 'repechage', idx, m, subView); });
            html += `</div>`;
        }

        if (rightR1.length > 0) {
            html += `<div class="bracket-col">
                        <h4 class="absolute -top-10 left-0 w-full text-center text-[11px] font-black text-emerald-800 uppercase tracking-widest border-b-2 border-emerald-100 pb-2">Ronda 1 Previa</h4>`;
            rightR1.forEach((m, idx) => {
                let actualIdx = halfR1 + idx;
                html += renderMatchBox(cat, 'round1', actualIdx, m, subView);
            });
            html += `</div>`;
        }
        
        html += `</div>`;
    
    } else if (subView === 'phase2') {

        if (isVistaActiva && !isArena) document.getElementById('btnTopMenuElim')?.classList.remove('hidden'); // 🔥 Solo afecta si lo estás viendo
        
        html += `<div class="bracket-wrapper min-w-max justify-center">`;
        const roundTitles = ["Ronda 1", "Octavos", "Cuartos", "Semifinal"];
        const totalRounds = data.laterRounds.length;
        
        for (let rIdx = 0; rIdx < totalRounds - 1; rIdx++) {
            let matches = data.laterRounds[rIdx].matches;
            let leftMatches = matches.slice(0, matches.length / 2);
            let titleIndex = roundTitles.length - (totalRounds - 1 - rIdx);
            let phaseTitle = titleIndex >= 0 ? roundTitles[titleIndex] : `Ronda ${rIdx + 2}`;
            
            html += `<div class="bracket-col col-left">
                        <h4 class="absolute -top-10 left-0 w-full text-center text-[11px] font-black text-emerald-800 uppercase tracking-widest border-b-2 border-emerald-100 pb-2">${phaseTitle}</h4>`;
            leftMatches.forEach((m, idx) => { html += renderMatchBox(cat, 'laterRounds', [rIdx, idx], m, subView); });
            html += `</div>`;
        }

        html += `<div class="bracket-col justify-center px-8 mx-4 border-x-2 border-dashed border-gray-200 bg-gray-50/30 rounded-3xl pb-8">
                    <h4 class="absolute -top-10 left-0 w-full text-center text-[11px] font-black text-amber-600 uppercase tracking-widest border-b-2 border-amber-200 pb-2">Gran Final</h4>`;
        let finalMatch = data.laterRounds[totalRounds - 1].matches[0];
        html += renderMatchBox(cat, 'laterRounds', [totalRounds - 1, 0], finalMatch, subView);
        
        if (data.champion) {
            html += `<div class="match-container mt-8">
                        <div class="bg-gradient-to-br from-emerald-500 to-emerald-700 border-4 border-emerald-300 rounded-xl p-8 shadow-2xl text-center transform scale-110 w-[260px] animate-pulse mx-auto">
                            <h4 class="text-[10px] font-black text-emerald-100 uppercase tracking-widest mb-3">🏆 Campeón</h4>
                            <div class="text-2xl font-black text-white drop-shadow-md mb-2">${esc(data.champion)}</div>
                            <div class="text-[9px] font-bold text-emerald-200 pt-3 border-t border-emerald-400 uppercase tracking-wider">${esc(docentesMap[data.champion])}</div>
                        </div>
                     </div>`;
        }
        html += `</div>`;

        for (let rIdx = totalRounds - 2; rIdx >= 0; rIdx--) {
            let matches = data.laterRounds[rIdx].matches;
            let rightMatches = matches.slice(matches.length / 2);
            let titleIndex = roundTitles.length - (totalRounds - 1 - rIdx);
            let phaseTitle = titleIndex >= 0 ? roundTitles[titleIndex] : `Ronda ${rIdx + 2}`;
            
            html += `<div class="bracket-col col-right">
                        <h4 class="absolute -top-10 left-0 w-full text-center text-[11px] font-black text-emerald-800 uppercase tracking-widest border-b-2 border-emerald-100 pb-2">${phaseTitle}</h4>`;
            rightMatches.forEach((m, idx) => { 
                let actualIdx = (matches.length / 2) + idx;
                html += renderMatchBox(cat, 'laterRounds', [rIdx, actualIdx], m, subView); 
            });
            html += `</div>`;
        }
        html += `</div>`;
    }

    html += `</div>
        <!-- LADO B: PUNTAJES -->
        <div id="arena-scoreboard" class="${isArena ? 'flex' : 'hidden'} w-[400px] flex-shrink-0 bg-white rounded-3xl shadow-lg border border-gray-200 p-6 flex-col relative overflow-hidden">
            <h2 class="text-2xl font-black text-center text-gray-800 mb-4 uppercase tracking-tighter pb-2 border-b-2 border-gray-100">🏆 Tabla General</h2>
            <div class="flex-grow overflow-y-auto flex flex-col gap-3 pr-2">`;
            
    let scores = {};
    data.participants.forEach(p => {
        scores[p] = (data.puntosTotales && data.puntosTotales[p]) ? data.puntosTotales[p] : 0;
    });
    
    // 🔥 Corrección del signo de resta
    let ranking = Object.keys(scores).map(name => ({ name, score: scores[name] })).sort((a,b) => b.score - a.score);

    ranking.forEach((robot, index) => {
        let medal = index + 1;
        if (index === 0 && robot.score > 0) medal = '🥇';
        if (index === 1 && robot.score > 0) medal = '🥈';
        if (index === 2 && robot.score > 0) medal = '🥉';
        
        let rankColor = index < 3 ? 'text-amber-500' : 'text-gray-300';
        
        html += `
        <div class="w-full bg-white border border-gray-100 rounded-xl p-3 flex justify-between items-center shadow-sm hover:shadow-md transition-all transform hover:-translate-y-1">
            <div class="flex items-center gap-3">
                <span class="text-lg font-black w-6 text-center ${rankColor}">${medal}</span>
                <div class="flex flex-col">
                    <span class="font-bold text-sm text-gray-800 uppercase tracking-tight">${esc(robot.name)}</span>
                    <span class="text-[9px] text-gray-400 font-bold uppercase">${esc(docentesMap[robot.name] || 'Sin Asesor')}</span>
                </div>
            </div>
            <div class="font-black text-emerald-600 text-xl">${robot.score} <span class="text-[10px] text-gray-400">pts</span></div>
        </div>`;
    });

    html += `</div>
            <button onclick="salirModoArena()" class="mt-6 bg-red-500 hover:bg-red-600 text-white w-full py-4 rounded-xl font-extrabold text-sm uppercase tracking-widest shadow-md flex items-center justify-center gap-2 active:scale-95 z-10">
                ❌ Salir de Pantalla Completa
            </button>
        </div>
    </div>`; 
    
    container.innerHTML = html;

    // 🛑 MAGIA ANTI-SALTOS DEFINITIVA: Recuperamos la memoria global
    const newBracketArea = document.getElementById('bracket-area');
    if (newBracketArea) {
        newBracketArea.scrollLeft = window.memoriaScrollX;
        newBracketArea.scrollTop = window.memoriaScrollY;
        
        setTimeout(() => {
            if(newBracketArea) {
                newBracketArea.scrollLeft = window.memoriaScrollX;
                newBracketArea.scrollTop = window.memoriaScrollY;
            }
        }, 15);
    }
};

function renderMatchBox(cat, phase, matchIdx, match, subView) {
    // 🔥 NUEVO: Extraemos la info de la arena en vivo para esta categoría
    const arenaEnVivo = window.arenasLiveCache ? window.arenasLiveCache[cat] : null;

    const renderRow = (player, isOpponentNull, isThisRowTheNullOne) => {
        
        if (!player) return `
            <div class="player-row text-gray-400 bg-gray-50/50 cursor-not-allowed">
                <div class="player-info">
                    <span class="player-name text-gray-300">TBD</span>
                    <span class="docente-text text-gray-300">-</span>
                </div>
                <span class="score-box bg-gray-100 text-gray-300">?</span>
            </div>`;
        
        const isWinner = match.winner === player;
        const isLoser = match.winner !== null && match.winner !== player;
        const isImpar = (phase === 'repechage' && player === tournamentData[cat].byePlayer);
        
        // 🔥 NUEVO: Pintar el marcador en tiempo real (incluso si es 0) SOLO en la llave activa
        let victoriasHtml = '';
        if (arenaEnVivo && !isWinner && !isLoser) {
            // Verificamos que ESTA sea exactamente la pelea activa en el panel
            const esLaPeleaActiva = (arenaEnVivo.robot1 === match.player1 && arenaEnVivo.robot2 === match.player2) || 
                                    (arenaEnVivo.robot1 === match.player2 && arenaEnVivo.robot2 === match.player1);
            
            if (esLaPeleaActiva) {
                if (arenaEnVivo.robot1 === player) {
                    victoriasHtml = `<span class="text-emerald-600 font-black ml-1.5 text-sm drop-shadow-sm bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">${arenaEnVivo.victorias_r1 || 0}</span>`;
                } else if (arenaEnVivo.robot2 === player) {
                    victoriasHtml = `<span class="text-emerald-600 font-black ml-1.5 text-sm drop-shadow-sm bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">${arenaEnVivo.victorias_r2 || 0}</span>`;
                }
            }
        }

        let rowClass = '';
        let nameColorClass = '';
        let docColorClass = '';
        let tagHtml = '';
        
        if (isWinner) {
            if (phase === 'repechage') {
                // Asigna la nueva clase CSS blindada
                rowClass = 'winner-rep';
            } else {
                rowClass = 'winner';
            }
        } else if (isLoser) {
            rowClass = 'opacity-40 grayscale bg-red-50/30';
        } else if (isImpar) {
            // Diseño Naranja Claro para el Impar en Repechaje
            rowClass = 'bg-orange-50 border-l-4 border-l-orange-400';
            nameColorClass = 'text-orange-700';
            docColorClass = 'text-orange-500';
            tagHtml = `<span class="text-[9px] font-black text-orange-400 ml-1">(IMPAR)</span>`;
        }
        
        const strikethrough = isLoser ? 'line-through decoration-red-500 decoration-2 text-gray-400' : '';
        const icon = isWinner ? '✓' : (isLoser ? '<span class="text-red-600 font-black text-sm drop-shadow-md">❌</span>' : '');
        
        return `
            <div class="player-row ${rowClass} relative" onclick="selectWinner('${cat}','${phase}',${JSON.stringify(matchIdx)},'${escAttr(player)}', '${subView}')">
                <div class="player-info">
                    <!-- 🔥 AQUÍ SE INYECTA victoriasHtml AL LADO DEL NOMBRE -->
                    <span class="player-name ${strikethrough} ${nameColorClass}">${esc(player)} ${victoriasHtml} ${tagHtml}</span>
                    <span class="docente-text ${docColorClass}">${esc(docentesMap[player] || 'Sin Asesor')}</span>
                </div>
                <span class="score-box bg-transparent border border-gray-200/50 flex items-center justify-center w-6 h-6">${icon}</span>
            </div>
        `;
    };

    // Detectamos si estamos en Modo Arena O si es Súper Admin (pero respetando el Modo Solitario)
    const isArena = !!document.fullscreenElement;
    const isSuperAdmin = sessionStorage.getItem('juez_superadmin') === 'true';
    
    // 🔥 EL ARREGLO: Ocultar el rayito SOLO si es Súper Admin normal (no solitario) o si está en Arena
    const ocultarRayito = isArena || (isSuperAdmin && !window.isModoSolitarioActivo);

    return `
        <div class="match-container">
            <div class="match-card hover:shadow-lg transition-shadow overflow-hidden flex flex-col">
                ${renderRow(match.player1, match.player2 === null, match.player1 === null)}
                ${renderRow(match.player2, match.player1 === null, match.player2 === null)}
                
                <!-- BOTÓN PARA MANDAR AL PANEL (Oculto en Modo Arena y para Súper Admin) -->
                <div onclick="prepararPanel('${cat}', '${match.player1}', '${match.player2}')" class="${ocultarRayito ? 'hidden' : 'w-full bg-gray-50 hover:bg-emerald-100 text-center cursor-pointer border-t border-gray-100 transition-colors'}">
                    <span class="text-[10px] font-bold text-gray-400 hover:text-emerald-700 uppercase tracking-widest block py-2 flex items-center justify-center gap-1">
                        ⚡ Cargar en Panel
                    </span>
                </div>
            </div>
        </div>
    `;
}
// =====================================================================
// 🔥 NÚCLEO DE SINCRONIZACIÓN UNIVERSAL (TODOS VEN LO MISMO)
// =====================================================================
async function guardarBracketFirebase(cat) {
    const data = tournamentData[cat];
    if(!data.round1Matches || data.round1Matches.length === 0) return;
    
    // Limpiamos los "undefined" para que Firebase no llore
    const payload = JSON.parse(JSON.stringify({
        round1Matches: data.round1Matches,
        repechageMatches: data.repechageMatches,
        laterRounds: data.laterRounds,
        champion: data.champion,
        byePlayer: data.byePlayer,
        phase: data.phase
    }));
    
    await setDoc(doc(db, "brackets_estado", cat), payload);
}

// BOTÓN NUCLEAR: Borra llaves y regresa puntos de TODOS a 0
// BOTÓN NUCLEAR: Borra llaves, regresa puntos a 0 y purga historial de veredictos
window.resetTournament = async function(cat) {
    if (confirm(`⚠️ ¡PELIGRO! ¿Deseas reiniciar TODO el torneo de ${cat}?\n\nSe borrarán las llaves.\nSe regresarán a 0 TODOS los puntos de los robots en la base de datos y se borrará el historial de veredictos.\n\nEsta acción no se puede deshacer.`)) {
        
        // 1. Matar el estado del bracket en Firebase
        try { await deleteDoc(doc(db, "brackets_estado", cat)); } catch(e){}

        const batch = writeBatch(db);

        // 2. Regresar todos los puntajes a 0 en la BD Real (Competidores)
        const qCompetidores = query(collection(db, "competidores"));
        const snapCompetidores = await getDocs(qCompetidores);
        
        snapCompetidores.forEach(docSnap => {
            const robot = docSnap.data();
            let tagBuscado = (robot.categoria_tag || '').toLowerCase();
            let oriBuscado = (robot.categoria_original || '').toLowerCase();
            // Si el robot es de esta categoría, le volamos los puntos
            if(tagBuscado === cat || oriBuscado.includes(cat.substring(0,3))) {
                batch.update(docSnap.ref, { score: 0, puntos: 0, puntaje: 0, puntosTotales: 0 });
            }
        });

        // 🔥 3. NUEVO: Purgar el historial de Veredictos de esta categoría específica
        const qVeredictos = query(collection(db, "veredictos"), where("categoria", "==", cat));
        const snapVeredictos = await getDocs(qVeredictos);
        
        snapVeredictos.forEach(docV => {
            batch.delete(docV.ref);
        });

        // Ejecutamos todo el paquete de borrado/actualización al mismo tiempo
        await batch.commit();

        // 4. Limpiar memoria local y regenerar el sorteo
        localStorage.removeItem('fime_bracket_' + cat); 
        tournamentData[cat].round1Matches = [];
        generateInitialMatches(cat);
        renderTournament(cat, 'menu');
        
        alert(`✅ Torneo de ${cat} reiniciado.\nPuntos devueltos a 0 e historial de veredictos limpiado.`);
    }
};

window.tiempoCarreras = { seguimiento: {}, evasor: {} };
// Escuchador en vivo de los tiempos guardados
onSnapshot(collection(db, "tiempos_carreras"), (snapCarreras) => {
    
    // 🔥 MAGIA ANTI-FANTASMAS: Vaciamos la memoria antes de leer la base de datos
    window.tiempoCarreras = { seguimiento: {}, evasor: {} };

    snapCarreras.forEach(docT => {
        const t = docT.data();
        let catT = (t.categoria || '').toLowerCase().includes('seg') ? 'seguimiento' : 'evasor';
        if (!window.tiempoCarreras[catT][t.robot] || t.tiempo_segundos < window.tiempoCarreras[catT][t.robot]) {
            window.tiempoCarreras[catT][t.robot] = t.tiempo_segundos;
        }
    });
    const activeView = document.querySelector('.view.active')?.id.replace('view-', '');
    if (['seguimiento', 'evasor'].includes(activeView)) {
        renderTimeTable(activeView);
    }
});

window.renderTimeTable = function(cat) {
    const container = document.getElementById('time-' + cat);
    const equipos = tournamentData[cat] && tournamentData[cat].participants ? tournamentData[cat].participants : [];
    
    if (equipos.length === 0) {
        container.innerHTML = `<div class="text-center p-12 bg-white rounded-3xl border border-gray-200 shadow-sm w-full max-w-4xl mx-auto"><span class="text-6xl block mb-4">🏁</span><h3 class="text-2xl font-black text-gray-400 uppercase tracking-widest">Pista Vacía</h3><p class="text-gray-400 font-bold mt-2">Sube tu padrón desde el Panel Admin.</p></div>`;
        return;
    }

    let resultados = equipos.map(eq => {
        return { name: eq, time: window.tiempoCarreras[cat] && window.tiempoCarreras[cat][eq] ? window.tiempoCarreras[cat][eq] : null };
    });

    // Ordenar de Menor tiempo a Mayor
    resultados.sort((a, b) => {
        if (a.time === null && b.time === null) return 0;
        if (a.time === null) return 1;
        if (b.time === null) return -1;
        return a.time - b.time;
    });

    let titulo = cat === 'seguimiento' ? '🏎️ SEGUIMIENTO DE LÍNEA' : '🧭 EVASOR DE OBSTÁCULOS';
    const isArena = !!document.fullscreenElement;
    
    // 🔥 CORRECCIÓN: Movimos isSuperAdmin aquí arriba para que la tabla la pueda leer sin crashear.
    const isSuperAdmin = sessionStorage.getItem('juez_superadmin') === 'true';

    let html = `
    <!-- BOTÓN MODO ARENA NORMAL -->
    <div id="arena-header" class="mb-6 w-full flex justify-center bg-white p-3 rounded-2xl shadow-sm border border-gray-200" style="${isArena ? 'display: none;' : ''}">
        <button onclick="activarModoArena()" class="bg-sky-100 hover:bg-sky-200 text-sky-900 border-2 border-sky-300 px-6 py-3.5 rounded-xl font-extrabold shadow-md transition-all text-sm uppercase tracking-widest flex items-center gap-3 active:scale-95">
            🖥️ Modo Arena
        </button>
    </div>

    <!-- CONTENEDOR DE LA TABLA (CENTRO ABSOLUTO Y SCROLL) -->
    <div id="arena-workspace" class="w-full mx-auto animate-fade-in ${isArena ? 'fixed top-0 left-0 w-screen h-screen bg-gray-50 z-[9999] p-8 overflow-y-auto flex flex-col items-center justify-start' : 'max-w-4xl mt-4 mb-8'}">
        
        <div class="w-full max-w-4xl flex-shrink-0 relative">
            <div class="text-center mb-8 pt-4">
                <h2 class="text-3xl md:text-4xl font-black text-emerald-800 uppercase tracking-tighter">${titulo}</h2>
            </div>

            <div class="bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden mb-6">
                <table class="w-full text-left">
                    <thead class="bg-emerald-800 text-white">
                        <tr>
                            <th class="py-5 px-8 font-black uppercase tracking-widest text-[13px] w-2/3">Equipos</th>
                            <th class="py-5 px-8 font-black uppercase tracking-widest text-[13px] text-right w-1/3">Tiempos</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">`;

    resultados.forEach((r, idx) => {
        let timeText = '--:--:--';
        if (r.time) {
            let m = Math.floor(r.time / 60).toString().padStart(2, '0');
            let s = Math.floor(r.time % 60).toString().padStart(2, '0');
            let ms = Math.floor((r.time % 1) * 100).toString().padStart(2, '0');
            timeText = `${m}:${s}:${ms}`;
        }
        
        let medal = r.time ? (idx === 0 ? '🥇 ' : idx === 1 ? '🥈 ' : idx === 2 ? '🥉 ' : `<span class="text-gray-400 font-black mr-2">${idx+1}.</span> `) : '';

        html += `
                    <tr class="hover:bg-emerald-50 transition-colors">
                        <td class="py-5 px-8 flex items-center justify-between">
                            <div class="font-extrabold text-gray-800 uppercase text-lg">${medal}${esc(r.name)}</div>
                            <!-- EL RAYITO (SE OCULTA EN MODO ARENA Y PARA SÚPER ADMIN) -->
                            <button onclick="prepararPanel('${cat}', '${escAttr(r.name)}', '')" class="${(isArena || isSuperAdmin) ? 'hidden' : 'inline-flex'} items-center justify-center bg-gray-100 hover:bg-emerald-100 text-gray-500 hover:text-emerald-700 p-2 rounded-lg transition-colors shadow-sm ml-4" title="Cargar en Panel">⚡</button>
                        </td>
                        <td class="py-5 px-8 text-right">
                            <span class="font-mono font-black text-2xl ${r.time ? 'text-emerald-600' : 'text-gray-300'}">${timeText}</span>
                        </td>
                    </tr>`;
    });

    html += `
                </tbody>
            </table>
        </div>`;

    // 🔥 BOTÓN NUCLEAR: Solo para Súper Admin y oculto en Modo Arena
    if (isSuperAdmin && !isArena) {
        html += `
        <div class="mt-8 border-t-2 border-red-200 pt-6 text-center">
            <button onclick="nuclearResetCarreras('${cat}')" class="bg-red-600 hover:bg-red-800 text-white font-black py-3 px-6 rounded-xl shadow-lg transition-transform active:scale-95 text-xs uppercase tracking-widest flex items-center justify-center gap-2 mx-auto">
                ☢️ Reiniciar Tiempos de Categoría
            </button>
            <p class="text-[10px] text-red-500 font-bold mt-2 uppercase tracking-widest">Peligro: Borra todos los tiempos y devuelve puntos a 0</p>
        </div>`;
    }

    html += `
        <!-- BOTÓN SALIR MODO ARENA (FIJO ABAJO SI ES ARENA) -->
        <button onclick="salirModoArena()" class="${isArena ? 'flex' : 'hidden'} mt-2 mb-10 bg-red-500 hover:bg-red-600 text-white w-full py-4 rounded-xl font-extrabold text-sm uppercase tracking-widest shadow-md items-center justify-center gap-2 active:scale-95 transition-transform">
            ❌ Salir de Pantalla Completa
        </button>
        
    </div>
</div>`;

    container.innerHTML = html;
};

window.addTime = (cat) => {
    const name = document.getElementById('time-select-' + cat).value; if (!name) return;
    const min = parseInt(document.getElementById('time-min-' + cat).value)||0;
    const seg = parseInt(document.getElementById('time-seg-' + cat).value)||0;
    const ms = parseInt(document.getElementById('time-ms-' + cat).value)||0;
    const total = min*60 + seg + ms/1000; if (total <= 0) return;

    fetch('/api/tiempos/registrar', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ name, categoria: cat, timeSeconds: total })
    }).then(() => { cargarDatosDesdeServidor(); setTimeout(() => renderTimeTable(cat), 350); });
};

window.deleteTime = (cat, id) => {
    fetch(`/api/tiempos/eliminar/${id}`, { method: 'POST' })
    .then(() => { cargarDatosDesdeServidor(); setTimeout(() => renderTimeTable(cat), 350); });
};

function fmt(s) { const m = Math.floor(s/60); const sec = Math.floor(s%60); const ms = Math.round((s-Math.floor(s))*1000); return m ? `${m}m ${sec}s ${ms}ms` : `${sec}s ${ms}ms`; }

window.exportAllToExcel = () => {
    const wb = XLSX.utils.book_new();

    // 🎨 DICCIONARIO DE ESTILOS PREMIUM
    const styleHeader = {
        font: { bold: true, color: { rgb: "FFFFFFFF" }, sz: 12 },
        fill: { fgColor: { rgb: "FF047857" } }, // Verde FIME (Emerald 700)
        alignment: { horizontal: "center", vertical: "center" },
        border: { top: { style: "medium", color: { rgb: "FF064E3B" } }, bottom: { style: "medium", color: { rgb: "FF064E3B" } } }
    };

    const styleColPosicion = { fill: { fgColor: { rgb: "FFF8FAFC" } }, alignment: { horizontal: "center", vertical: "center" }, font: { bold: true, color: { rgb: "FF475569" } } };
    const styleColNombre = { fill: { fgColor: { rgb: "FFFFFFFF" } }, alignment: { horizontal: "left", vertical: "center" }, font: { bold: true, color: { rgb: "FF1E293B" } } };
    const styleColPuntos = { fill: { fgColor: { rgb: "FFF0FDF4" } }, alignment: { horizontal: "center", vertical: "center" }, font: { bold: true, color: { rgb: "FF166534" } } };

    // Función inyectora de colores
    const applyStyles = (ws) => {
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const address = XLSX.utils.encode_cell({ r: R, c: C });
                if (!ws[address]) continue;

                if (R === 0) {
                    ws[address].s = styleHeader; // Fila 0 es el encabezado
                } else {
                    if (C === 0) ws[address].s = styleColPosicion;
                    if (C === 1) ws[address].s = styleColNombre;
                    if (C === 2) ws[address].s = styleColPuntos;
                }
            }
        }
        // Ancho de las columnas
        ws['!cols'] = [{ wch: 12 }, { wch: 35 }, { wch: 28 }];
    };

    // 1. PROCESAR CATEGORÍAS DE COMBATE (Por Puntos)
    const categoriasCombate = [
        { id: 'pequenos', nombre: 'Pequeños' },
        { id: 'mediano', nombre: 'Mediano' },
        { id: 'grandes', nombre: 'Grandes' }
    ];

    categoriasCombate.forEach(cat => {
        let rows = [['Posición', 'Robot / Equipo', 'Puntos Totales']];
        const data = tournamentData[cat.id];

        if (data && data.participants && data.participants.length > 0) {
            let scores = [];
            data.participants.forEach(p => {
                scores.push({ name: p, score: (data.puntosTotales && data.puntosTotales[p]) ? data.puntosTotales[p] : 0 });
            });
            scores.sort((a, b) => b.score - a.score);
            scores.forEach((r, idx) => {
                rows.push([r.score > 0 ? (idx + 1) : '-', r.name, r.score]);
            });
        } else {
            rows.push(['-', 'Aún no hay equipos registrados', '-']);
        }
        
        let ws = XLSX.utils.aoa_to_sheet(rows);
        applyStyles(ws);
        XLSX.utils.book_append_sheet(wb, ws, cat.nombre);
    });

    // 2. PROCESAR CATEGORÍAS DE CARRERA (Por Tiempo)
    const categoriasCarrera = [
        { id: 'seguimiento', nombre: 'Seguimiento' },
        { id: 'evasor', nombre: 'Evasor' }
    ];

    categoriasCarrera.forEach(cat => {
        let rows = [['Posición', 'Robot / Equipo', 'Tiempo Oficial (Segundos)']];
        const data = tournamentData[cat.id];

        if (data && data.participants && data.participants.length > 0) {
            let tiempos = [];
            data.participants.forEach(p => {
                let t = (window.tiempoCarreras[cat.id] && window.tiempoCarreras[cat.id][p]) ? window.tiempoCarreras[cat.id][p] : null;
                tiempos.push({ name: p, time: t });
            });
            tiempos.sort((a, b) => {
                if (a.time === null && b.time === null) return 0;
                if (a.time === null) return 1;
                if (b.time === null) return -1;
                return a.time - b.time;
            });
            tiempos.forEach((r, idx) => {
                let tiempoFormat = r.time ? Number(r.time).toFixed(2) : "Sin tiempo";
                rows.push([r.time ? (idx + 1) : '-', r.name, tiempoFormat]);
            });
        } else {
            rows.push(['-', 'Aún no hay equipos registrados', '-']);
        }
        
        let ws = XLSX.utils.aoa_to_sheet(rows);
        applyStyles(ws);
        XLSX.utils.book_append_sheet(wb, ws, cat.nombre);
    });

    XLSX.writeFile(wb, 'Resultados_Guerra_Robots_FIME.xlsx');
};

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function escAttr(s) { return s.replace(/'/g,"\\'").replace(/"/g,'\\"'); }

window.activarModoArena = function() {
    // Averiguamos en qué categoría estamos y abrimos la pestaña pública
    const activeView = document.querySelector('.view.active')?.id.replace('view-', '') || 'pequenos';
    window.open(`pantalla_publico.html?cat=${activeView}`, '_blank');
};



// --- ESTILO PARA EL MODAL (Animación suave) ---
if (!document.getElementById('modal-styles')) {
    const style = document.createElement('style');
    style.id = 'modal-styles';
    style.innerHTML = `
        .modal-overlay { background-color: rgba(0, 0, 0, 0.6); backdrop-filter: blur(4px); z-index: 99999; }
        .modal-content { animation: modalFadeIn 0.3s ease-out forwards; }
        @keyframes modalFadeIn { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
    `;
    document.head.appendChild(style);
}

// --- FUNCIÓN PARA DIBUJAR Y ABRIR EL MODAL ---
window.abrirModalPuntajes = function(cat) {
    const data = tournamentData[cat];
    if (!data) return;

    // 1. Puntos Exclusivos del Juez (Misma lógica que la Arena)
    let scores = {};
    data.participants.forEach(p => {
        scores[p] = (data.puntosTotales && data.puntosTotales[p]) ? data.puntosTotales[p] : 0;
    });

    let ranking = Object.keys(scores).map(name => ({ name, score: scores[name] })).sort((a,b) => b.score - a.score);

    // 2. Creamos la estructura visual de la ventanita emergente (Modal)
    let modalHtml = `
    <div id="puntajes-modal" class="fixed inset-0 modal-overlay flex justify-center items-center p-4">
        <div class="modal-content bg-white w-full max-w-md rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden border border-gray-100 relative">
            
            <!-- Cabecera del Modal -->
            <div class="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center sticky top-0 z-10">
                <div>
                    <h2 class="text-xl font-black text-emerald-800 uppercase tracking-tighter">🏆 Scoreboard Oficial</h2>
                    <p class="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-0.5">Categoría ${cat}</p>
                </div>
                <button onclick="document.getElementById('puntajes-modal').remove()" class="text-gray-400 hover:text-red-500 bg-white hover:bg-red-50 border border-gray-200 p-2 rounded-full transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>

            <!-- Lista de Equipos (Con Scroll si son muchos) -->
            <div class="flex-grow overflow-y-auto p-5 flex flex-col gap-3 bg-gray-50/30">`;

    ranking.forEach((robot, index) => {
        let medal = index + 1;
        if (index === 0 && robot.score > 0) medal = '🥇';
        if (index === 1 && robot.score > 0) medal = '🥈';
        if (index === 2 && robot.score > 0) medal = '🥉';
        let rankColor = index < 3 ? 'text-amber-500' : 'text-gray-400';
        let bgStyle = index === 0 && robot.score > 0 ? 'bg-amber-50 border-amber-200 shadow-md' : 'bg-white border-gray-100 shadow-sm';
        
        modalHtml += `
        <div class="w-full ${bgStyle} border rounded-xl p-3 flex justify-between items-center transition-all hover:shadow-md">
            <div class="flex items-center gap-4">
                <span class="text-xl font-black w-8 text-center ${rankColor} drop-shadow-sm">${medal}</span>
                <div class="flex flex-col">
                    <span class="font-extrabold text-sm text-gray-800 uppercase tracking-tight">${esc(robot.name)}</span>
                    <span class="text-[9px] text-gray-400 font-bold uppercase">${esc(docentesMap[robot.name] || 'Sin Asesor')}</span>
                </div>
            </div>
            <div class="font-black text-emerald-600 text-xl tracking-tighter">${robot.score} <span class="text-[10px] text-gray-400 font-bold">PTS</span></div>
        </div>`;
    });

    modalHtml += `
            </div>
        </div>
    </div>`;

    // 3. Inyectamos el Modal directamente en el Body de la página
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

// =====================================================================
// CONEXIÓN DIRECTA CON EL PANEL DE CONTROL (LOBBY)
// =====================================================================
window.prepararPanel = function(cat, r1, r2) {
    const isCarrera = cat.toLowerCase().includes('segui') || cat.toLowerCase().includes('evas');
    
    if (isCarrera) {
        if(!r1 || r1==='null' || r1==='EMPTY') return alert("⚠️ Necesitas que el robot esté definido.");
        r2 = ""; 
    } else {
        if(!r1 || !r2 || r1==='null' || r2==='null' || r1==='EMPTY' || r2==='EMPTY') {
            return alert("⚠️ Necesitas que ambos robots estén definidos en esta llave.");
        }
    }
    
    // 1. Llenamos los selectores del Lobby directamente (sin señales de radio)
    const selectR1 = document.getElementById(`sa-r1-${cat}`);
    const selectR2 = document.getElementById(`sa-r2-${cat}`);
    
    if (selectR1) selectR1.value = r1;
    if (selectR2 && !isCarrera) selectR2.value = r2;
    
    // 2. Lo regresamos automáticamente al menú principal (Lobby)
    if (typeof window.goToMenu === 'function') {
        window.goToMenu();
    }
    
    // 3. Efecto visual (hace palpitar el panel para que el Admin sepa dónde dar clic)
    setTimeout(() => {
        const panel = selectR1?.closest('.rounded-xl');
        if (panel) {
            panel.classList.add('ring-4', 'ring-emerald-400', 'scale-[1.02]');
            setTimeout(() => panel.classList.remove('ring-4', 'ring-emerald-400', 'scale-[1.02]'), 400);
        }
    }, 100);
};
// =====================================================================
// 👁️ OJO DE DIOS Y BOTÓN NUCLEAR (SÚPER ADMIN)
// =====================================================================

// 1. Botón Nuclear para Carreras
window.nuclearResetCarreras = async function(cat) {
    if(!confirm(`☢️ ¡PELIGRO! ☢️\n¿Estás absolutamente seguro de querer borrar TODOS los tiempos de "${cat.toUpperCase()}"?\n\nLos puntos de estos robots regresarán a 0. Esta acción NO se puede deshacer.`)) return;

    try {
        const qTiempos = await getDocs(collection(db, "tiempos_carreras"));
        const batch = writeBatch(db);
        let count = 0;
        let robotsAfectados = [];

        qTiempos.forEach(d => {
            let docCat = d.data().categoria || '';
            // Si coincide la categoría (ej. "segui" con "Seguimiento")
            if(docCat.toLowerCase().includes(cat.substring(0,4).toLowerCase())) { 
                batch.delete(d.ref);
                robotsAfectados.push(d.data().robot);
                count++;
            }
        });

        if (robotsAfectados.length > 0) {
            const compSnap = await getDocs(collection(db, "competidores"));
            compSnap.forEach(c => {
                if(robotsAfectados.includes(c.data().nombre)) {
                    batch.update(c.ref, { score: 0 });
                }
            });
        }

        await batch.commit();
        
        // 🔥 FORZAMOS LA LIMPIEZA INMEDIATA EN PANTALLA SIN F5
        const catClean = cat.toLowerCase().includes('seg') ? 'seguimiento' : 'evasor';
        window.tiempoCarreras[catClean] = {};
        if (typeof window.renderTimeTable === 'function') {
            window.renderTimeTable(catClean);
        }

        alert(`☢️ ¡BOOM! ${count} tiempos eliminados. Pista limpia.`);
    } catch(e) { console.error(e); alert("Error en el borrado nuclear."); }
};


// 🔥 MODO SOLITARIO ESTADO GLOBAL
window.isModoSolitarioActivo = false;

window.toggleModoSolitario = function() {
    window.isModoSolitarioActivo = !window.isModoSolitarioActivo;
    const btn = document.getElementById('btnModoSolitario');
    
    if (window.isModoSolitarioActivo) {
        btn.innerHTML = "📺 Activar Admin Multi-Pantallas";
        btn.classList.replace('bg-purple-600', 'bg-blue-600');
        btn.classList.replace('hover:bg-purple-700', 'hover:bg-blue-700');
    } else {
        btn.innerHTML = "🦸‍♂️ Activar Admin Solitario";
        btn.classList.replace('bg-blue-600', 'bg-purple-600');
        btn.classList.replace('hover:bg-blue-700', 'hover:bg-purple-700');
    }
    
    // Recargar los paneles para aplicar los nuevos permisos (Ojo de Dios -> Panel de Control)
    inyectarOjoDeDios();
    
    // 🔥 MAGIA UX: Forzamos el regreso al Lobby para que el usuario vea el cambio de paneles
    if (typeof window.goToMenu === 'function') {
        window.goToMenu();
    }
};

// 2. Conexión del Panel (Monitores para Súper Admin / Controles para Admin Normal)
function inyectarOjoDeDios() {
    const isSuperAdmin = sessionStorage.getItem('juez_superadmin') === 'true';
    const miCatAdmin = sessionStorage.getItem('juez_categoria');
    
    function getMiTag() {
        if(!miCatAdmin) return '';
        const b = miCatAdmin.toLowerCase();
        if(b.includes('peque')) return 'pequenos';
        if(b.includes('media')) return 'mediano';
        if(b.includes('grand')) return 'grandes';
        if(b.includes('segui')) return 'seguimiento';
        if(b.includes('evas')) return 'evasor';
        return '';
    }
    const miTag = getMiTag();
    const categorias = ['pequenos', 'mediano', 'grandes', 'seguimiento', 'evasor'];
    
    categorias.forEach(cat => {
        const panel = document.getElementById(`panel-superadmin-${cat}`);
        if (!panel) return;
        const isCarrera = cat === 'seguimiento' || cat === 'evasor';

        // 🔥 Condición de Poder: Eres Admin Normal de tu categoría OR Eres Súper Admin en Modo Solitario
        const tienePoderes = (!isSuperAdmin && cat === miTag) || (isSuperAdmin && window.isModoSolitarioActivo);

        if (isSuperAdmin && !window.isModoSolitarioActivo) {
            // SÚPER ADMIN MULTI-PANTALLAS (Normal): Solo ve el panel de lectura (Monitor)
            panel.classList.remove('hidden');
            // Restaurar aspecto de monitor visual
            panel.className = "bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm";
            const tituloPanelMonitor = `👁️ Monitor: ${cat}`;
            panel.innerHTML = `
                <h4 class="text-[10px] font-black text-amber-800 uppercase tracking-widest text-center mb-3">${tituloPanelMonitor}</h4>
                <div class="flex items-center justify-between gap-2 mb-4">
                    <div class="flex-1 bg-white border border-gray-200 rounded-xl p-2 text-center shadow-inner truncate">
                        <span id="ojo-r1-${cat}" class="text-[11px] font-bold text-gray-400 uppercase">-- Esperando --</span>
                    </div>
                    ${(cat === 'seguimiento' || cat === 'evasor') ? '' : `<span class="text-[10px] font-black text-red-600 uppercase">VS</span>
                    <div class="flex-1 bg-white border border-gray-200 rounded-xl p-2 text-center shadow-inner truncate">
                        <span id="ojo-r2-${cat}" class="text-[11px] font-bold text-gray-400 uppercase">-- Esperando --</span>
                    </div>`}
                </div>
                <button onclick="limpiarArenaLocal('${cat}')" class="w-full bg-slate-600 hover:bg-slate-700 text-white font-black py-2.5 rounded-xl text-[10px] uppercase tracking-widest transition-all shadow-md">
                    🧹 Limpiar ${cat === 'seguimiento' || cat === 'evasor' ? 'Pista' : 'Arena'}
                </button>
            `;
            
        } else if (tienePoderes) {
            // ADMIN NORMAL O SUPER ADMIN SOLITARIO: Convertimos el panel en sus controles
            panel.classList.remove('hidden');
            
            // 🔥 ARREGLO VISUAL: Dejar que el panel inferior ocupe el espacio que necesita sin encimarse
            panel.className = "bg-emerald-50 border-2 border-emerald-600 rounded-2xl p-4 shadow-sm w-full transition-all animate-fade-in mt-4";
            
            // IMPORTANTE: También debemos arreglar la tarjeta blanca "padre" para que no limite la altura
            const tarjetaBlanca = panel.previousElementSibling;
            if (tarjetaBlanca) {
                tarjetaBlanca.classList.remove('h-full');
            }

            const tituloPanel = isCarrera ? '🏎️ Control de Pista' : '🥊 Control de Arena';
            
            // Inyectamos los botones y selectores con llamadas directas y seguras
            panel.innerHTML = `
                <h4 class="text-[10px] font-black uppercase tracking-wider text-emerald-800 mb-3 flex items-center justify-center">${tituloPanel}</h4>
                
                ${isCarrera ? '' : `
                <!-- NUEVOS CONTROLES DE RONDA Y TIEMPO -->
                <div class="flex justify-between items-center bg-white p-2 rounded-lg border border-gray-200 shadow-sm mb-3">
                    <div class="flex flex-col w-1/2 border-r border-gray-100 pr-2">
                        <span class="text-[8px] font-bold text-gray-400 uppercase">Tiempo:</span>
                        <select id="sa-tiempo-${cat}" class="text-[10px] font-black text-emerald-700 bg-transparent focus:outline-none cursor-pointer">
                            <option value="60">1 Minuto</option>
                            <option value="180">3 Minutos</option>
                            <option value="300">5 Minutos</option>
                        </select>
                    </div>
                    <div class="flex flex-col w-1/2 pl-2">
                        <span class="text-[8px] font-bold text-gray-400 uppercase">Round:</span>
                        <select id="sa-ronda-${cat}" class="text-[10px] font-black text-emerald-700 bg-transparent focus:outline-none cursor-pointer">
                            <option value="1">Round 1</option>
                            <option value="2">Round 2</option>
                            <option value="3">Round 3 (Desempate)</option>
                        </select>
                    </div>
                </div>`}

                <div class="flex gap-2 mb-3 items-center">
                    <select id="sa-r1-${cat}" class="${isCarrera ? 'w-full' : 'w-[45%]'} p-2 bg-white border border-gray-200 text-gray-800 font-black uppercase rounded-xl text-center shadow-sm text-[10px] focus:outline-none focus:border-blue-500 transition-all">
                        <option value="">-- ESPERANDO R1 --</option>
                    </select>
                    ${isCarrera ? '' : `
                    <div class="flex flex-col w-[10%] items-center justify-center">
                        <span class="text-[8px] font-black text-gray-400 mb-0.5">WINS</span>
                        <div class="flex gap-1 text-sm font-black bg-gray-100 px-2 py-1 rounded-md shadow-inner">
                            <span id="sa-v1-${cat}" class="text-blue-600">0</span>
                            <span class="text-gray-300">-</span>
                            <span id="sa-v2-${cat}" class="text-orange-500">0</span>
                        </div>
                    </div>
                    <select id="sa-r2-${cat}" class="w-[45%] p-2 bg-white border border-gray-200 text-gray-800 font-black uppercase rounded-xl text-center shadow-sm text-[10px] focus:outline-none focus:border-orange-500 transition-all">
                        <option value="">-- ESPERANDO R2 --</option>
                    </select>`}
                </div>
                <div class="flex flex-wrap gap-2">
                    <button id="sa-btn-iniciar-${cat}" onclick="window.saAccionArena('${cat}', 'iniciar')" class="flex-1 min-w-[30%] bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-lg text-[10px] uppercase tracking-widest shadow-md transition-all active:scale-95">Iniciar</button>
                    <button onclick="window.saAccionArena('${cat}', 'ko')" class="flex-1 min-w-[25%] bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-lg text-[10px] uppercase tracking-widest shadow-md transition-all active:scale-95">${isCarrera ? '🏁 Fin' : '🥊 K.O.'}</button>
                    <button onclick="window.saAccionArena('${cat}', 'limpiar')" class="flex-1 min-w-[30%] bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 rounded-lg text-[10px] uppercase tracking-widest shadow-md transition-all active:scale-95">🧹 Limpiar</button>
                    ${isCarrera ? '' : `
                    <button onclick="window.saAccionArena('${cat}', 'reset_victorias')" class="w-full mt-1 bg-slate-500 hover:bg-slate-600 text-white font-bold py-2.5 rounded-lg text-[10px] uppercase tracking-widest shadow-sm transition-all active:scale-95 flex justify-center items-center gap-2">
                        🔄 Reiniciar Marcador a 0 - 0
                    </button>
                    <!-- 🔥 EL NUEVO BOTÓN TODO-EN-UNO -->
                    <button onclick="window.abrirBotoneraJuez('${cat}')" class="w-full mt-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg text-[11px] uppercase tracking-widest shadow-lg transition-all active:scale-95 flex justify-center items-center gap-2">
                        📱 ABRIR MI BOTONERA DE JUEZ
                    </button>`}
                </div>
            `;
        }

        // Reconectamos el Radar a Firebase
        if (isSuperAdmin || cat === miTag) {
            onSnapshot(doc(db, "arenas", cat), (docSnap) => {
                if(!docSnap.exists()) return;
                const data = docSnap.data();
                
                // 🔥 NUEVO: Guardar estado en vivo y refrescar el bracket
                window.arenasLiveCache = window.arenasLiveCache || {};
                window.arenasLiveCache[cat] = data;
                
                const activeView = document.querySelector('.view.active')?.id.replace('view-', '');
                if (activeView === cat && typeof currentSubView !== 'undefined') {
                    renderTournament(cat, currentSubView);
                }

                if (isSuperAdmin && !window.isModoSolitarioActivo) {
                    // Actualiza solo etiquetas (Labels) para el Súper Admin Multi-Pantallas
                    const labelR1 = document.getElementById(`ojo-r1-${cat}`);
                    const labelR2 = document.getElementById(`ojo-r2-${cat}`);
                    
                    if (labelR1) {
                        if (data.robot1 && data.estado !== 'inactivo') {
                            labelR1.innerText = data.robot1;
                            labelR1.className = "text-[11px] font-black text-emerald-700 uppercase";
                        } else {
                            labelR1.innerText = isCarrera ? "-- Pista Libre --" : "-- Esperando --";
                            labelR1.className = "text-[11px] font-bold text-gray-400 uppercase";
                        }
                    }
                    if (!isCarrera && labelR2) {
                        if (data.robot2 && data.estado !== 'inactivo') {
                            labelR2.innerText = data.robot2;
                            labelR2.className = "text-[11px] font-black text-emerald-700 uppercase";
                        } else {
                            labelR2.innerText = "-- Esperando --";
                            labelR2.className = "text-[11px] font-bold text-gray-400 uppercase";
                        }
                    }
                } else {
                    // Actualiza selectores y bloquea/desbloquea botones para el Admin Normal
                    const selR1 = document.getElementById(`sa-r1-${cat}`);
                    const selR2 = document.getElementById(`sa-r2-${cat}`);
                    const selTiempo = document.getElementById(`sa-tiempo-${cat}`);
                    const selRonda = document.getElementById(`sa-ronda-${cat}`);
                    const btnIniciar = document.getElementById(`sa-btn-iniciar-${cat}`);
                    
                    // 🔥 MAGIA DE MEMORIA: Leemos y fijamos los robots
                    if(selR1) {
                        if (data.robot1) selR1.value = data.robot1;
                        else selR1.value = ""; // Si el admin usó "🧹 Limpiar", lo regresamos a ESPERANDO
                    }
                    if(selR2) {
                        if (data.robot2) selR2.value = data.robot2;
                        else selR2.value = "";
                    }
                    
                    if(selTiempo && data.tiempo_ronda) selTiempo.value = data.tiempo_ronda;
                    if(selRonda && data.ronda_actual) selRonda.value = data.ronda_actual;
                    
                    // 🔥 ACTUALIZAR MARCADOR VISUAL
                    const mk1 = document.getElementById(`sa-v1-${cat}`);
                    const mk2 = document.getElementById(`sa-v2-${cat}`);
                    if(mk1) mk1.innerText = data.victorias_r1 || 0;
                    if(mk2) mk2.innerText = data.victorias_r2 || 0;
                    
                    if(btnIniciar) {
                        if (data.estado === 'peleando') {
                            btnIniciar.className = "flex-1 bg-amber-500 text-white font-bold py-2 rounded-lg text-[10px] uppercase tracking-widest shadow-md cursor-not-allowed";
                            btnIniciar.innerHTML = "⏳ En Curso...";
                            btnIniciar.disabled = true;
                        } else {
                            btnIniciar.className = "flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-lg text-[10px] uppercase tracking-widest shadow-md transition-all active:scale-95";
                            btnIniciar.innerHTML = "Iniciar";
                            btnIniciar.disabled = false;
                            // ❌ FUERA: Ya no vaciamos los campos mágicamente al estar inactivo
                        }
                    }
                }
                
                // Marca el Ganador Automático
                if (data.estado === 'inactivo' && data.ganador_automatico) {
                    const tData = tournamentData[cat];
                    if (tData) {
                        const marcarLlave = (fase, arr) => {
                            if(!arr) return false;
                            for(let i=0; i<arr.length; i++) {
                                let m = arr[i];
                                if ((m.player1 === data.robot1 && m.player2 === data.robot2) || (m.player1 === data.robot2 && m.player2 === data.robot1)) {
                                    if (m.winner === null) {
                                        window.selectWinner(cat, fase, i, data.ganador_automatico, currentSubView);
                                        return true;
                                    }
                                }
                            }
                            return false;
                        };
                        let encontrado = false;
                        if(!encontrado) encontrado = marcarLlave('round1', tData.round1Matches);
                        if(!encontrado) encontrado = marcarLlave('repechage', tData.repechageMatches);
                        if(!encontrado && tData.laterRounds) {
                        for(let r=0; r<tData.laterRounds.length; r++) {
                            for(let i=0; i<tData.laterRounds[r].matches.length; i++) {
                                let m = tData.laterRounds[r].matches[i];
                                if ((m.player1 === data.robot1 && m.player2 === data.robot2) || (m.player1 === data.robot2 && m.player2 === data.robot1)) {
                                    if (m.winner === null) {
                                        window.selectWinner(cat, 'laterRounds', [r, i], data.ganador_automatico, currentSubView);
                                        encontrado = true;
                                    }
                                }
                            }
                        }
                    }
                }
                    updateDoc(doc(db, "arenas", cat), { ganador_automatico: null });
                }
            });
        }
    });

    // Restauramos el llenado de los selectores (Para Admin Normal O SuperAdmin Solitario)
    if ((!isSuperAdmin && miTag) || (isSuperAdmin && window.isModoSolitarioActivo)) {
        onSnapshot(collection(db, "competidores"), (snap) => {
            let comp = [];
            snap.forEach(doc => comp.push(doc.data()));
            
            // Si es súper admin solitario, llenamos TODOS los selectores. Si es normal, solo el suyo.
            const categoriasALlenar = isSuperAdmin ? ['pequenos', 'mediano', 'grandes', 'seguimiento', 'evasor'] : [miTag];
            
            categoriasALlenar.forEach(catLoop => {
                const selR1 = document.getElementById(`sa-r1-${catLoop}`);
                const selR2 = document.getElementById(`sa-r2-${catLoop}`);
                if(!selR1) return;
                
                const currentR1 = selR1.value;
                const currentR2 = selR2 ? selR2.value : '';
                
                let opts = `<option value="">-- ESPERANDO --</option>`;
                comp.filter(c => {
                    let cTag = c.categoria_tag || '';
                    let cOrig = (c.categoria_original || '').toLowerCase();
                    return cTag === catLoop || cOrig.includes(catLoop.substring(0,4));
                }).sort((a,b) => a.nombre.localeCompare(b.nombre)).forEach(c => {
                    opts += `<option value="${c.nombre}">${c.nombre}</option>`;
                });
                
                selR1.innerHTML = opts;
                if(selR2) selR2.innerHTML = opts;
                
                selR1.value = currentR1;
                if(selR2) selR2.value = currentR2;
            });
        });
    }
} // <--- 🔥 ESTA LLAVE CIERRA inyectarOjoDeDios() CORRECTAMENTE

// 3. Restauramos las Funciones de Control (Iniciar, K.O., Limpiar, Reglas)
window.saAccionArena = async function(cat, accion) {
    const arenaRef = doc(db, "arenas", cat);
    const isCarrera = cat === 'seguimiento' || cat === 'evasor';
    
    if (accion === 'limpiar') {
        if(!confirm(`🧹 ¿Limpiar arena de ${cat.toUpperCase()}?`)) return;
        await setDoc(arenaRef, { robot1: '', robot2: '', estado: 'inactivo' }, { merge: true });
        const selR1 = document.getElementById(`sa-r1-${cat}`);
        const selR2 = document.getElementById(`sa-r2-${cat}`);
        if (selR1) selR1.value = '';
        if (selR2) selR2.value = '';
    } 
    else if (accion === 'ko') {
        if(!confirm(isCarrera ? '🏁 ¿Forzar fin de carrera?' : '🥊 ¿Declarar K.O.?')) return;
        await updateDoc(arenaRef, { estado: 'ko' });
    }
    else if (accion === 'reset_victorias') {
        if(!confirm("🔄 ¿Deseas reiniciar el marcador de victorias a 0 - 0 y regresar la categoría al Round 1?")) return;
        await setDoc(arenaRef, { 
            victorias_r1: 0, 
            victorias_r2: 0, 
            ronda_actual: 1 
        }, { merge: true });
    }
    else if (accion === 'iniciar') {
        const r1 = document.getElementById(`sa-r1-${cat}`).value;
        const r2 = document.getElementById(`sa-r2-${cat}`) ? document.getElementById(`sa-r2-${cat}`).value : '';
        
        const tiempoInput = document.getElementById(`sa-tiempo-${cat}`);
        const rondaInput = document.getElementById(`sa-ronda-${cat}`);
        
        const tiempoRound = isCarrera ? 300 : (tiempoInput ? parseInt(tiempoInput.value) : 60);
        const numeroRonda = isCarrera ? 1 : (rondaInput ? parseInt(rondaInput.value) : 1);
        
        if (isCarrera) {
            if (!r1) return window.mostrarAvisoAdmin("Faltan Datos", "Por favor selecciona un robot para iniciar la pista.", "error");
        } else {
            if (!r1 || !r2) return window.mostrarAvisoAdmin("Faltan Datos", "Por favor selecciona a ambos robots para la batalla.", "error");
            if (r1 === r2) return window.mostrarAvisoAdmin("Error de Selección", "No puedes enfrentar al mismo robot consigo mismo.", "error");
            
            // 🔥 LÓGICA INTELIGENTE DE RONDAS
            const v1Node = document.getElementById(`sa-v1-${cat}`);
            const v2Node = document.getElementById(`sa-v2-${cat}`);
            const currentV1 = v1Node ? parseInt(v1Node.innerText) : 0;
            const currentV2 = v2Node ? parseInt(v2Node.innerText) : 0;
            
            // Regla A: Advertencia inteligente si están 0-0 y avanzan de ronda (Por Empate)
            if (currentV1 === 0 && currentV2 === 0 && numeroRonda > 1) {
                if(!confirm("⚠️ El marcador está 0 - 0 pero intentas iniciar una ronda avanzada.\n\n¿Hubo un EMPATE TÉCNICO previo y deseas continuar?")) {
                    if(rondaInput) rondaInput.value = "1";
                    return;
                }
            }
            
            // Regla B: Si ya llevan puntos y le pican al "Round 1", les advertimos de que se va a resetear.
            if ((currentV1 > 0 || currentV2 > 0) && numeroRonda === 1) {
                if(!confirm(`⚠️ ¡ATENCIÓN!\nEl marcador actual es ${currentV1} - ${currentV2}.\nSi inicias una pelea en el ROUND 1, el marcador se reiniciará a 0 - 0.\n\n¿Estás seguro de reiniciar los puntajes y empezar de cero?`)) {
                    // Revertimos el selector visual a la ronda correcta si cancelan
                    if(rondaInput) rondaInput.value = (currentV1 + currentV2 + 1).toString();
                    return;
                }
            }
        }
        
        let payloadInicio = { 
            robot1: r1, 
            robot2: isCarrera ? '' : r2, 
            estado: 'peleando',
            tiempo_inicio: Date.now() / 1000,
            tiempo_ronda: tiempoRound,
            ronda_actual: numeroRonda,
            // 🔥 NUEVO: Limpiamos la urna de votos para el nuevo round
            votos_r1: 0,
            votos_r2: 0,
            jueces_votaron: [] 
        };
        
        // Si inician forzosamente en Round 1, ejecutamos el reseteo del marcador en la base de datos
        if (numeroRonda === 1 && !isCarrera) {
            payloadInicio.victorias_r1 = 0;
            payloadInicio.victorias_r2 = 0;
        }
        
        await setDoc(arenaRef, payloadInicio, { merge: true });
    }
};

// 4. Funciones de Control Override (Solo queda Limpiar)
window.limpiarArenaLocal = async function(cat) {
    if(!confirm(`🧹 ¿Forzar la limpieza de la arena de ${cat.toUpperCase()}?`)) return;
    await setDoc(doc(db, "arenas", cat), { robot1: '', robot2: '', estado: 'inactivo' }, { merge: true });
};

// Arrancamos los motores al cargar el script
setTimeout(() => { inyectarOjoDeDios(); }, 500);

// =====================================================================
// 🔒 FILTRO DE LOBBY PARA ADMINS NORMALES
// =====================================================================
function filtrarLobbyParaAdmins() {
    const isSuperAdmin = sessionStorage.getItem('juez_superadmin') === 'true';
    if (isSuperAdmin) return; // El Súper Admin ve todo el lobby completo

    const miCat = sessionStorage.getItem('juez_categoria');
    if (!miCat) return;

    // 1. Ocultar la barra de descarga de Excel para admins normales
    const btnExcel = document.querySelector('[onclick="exportAllToExcel()"]');
    if (btnExcel) {
        // Busca el contenedor blanco que envuelve al botón y lo oculta
        const cajaExcel = btnExcel.closest('.bg-white') || btnExcel.parentElement;
        if (cajaExcel) cajaExcel.style.display = 'none';
    }


    // Convertimos su categoría al formato del HTML
    const base = miCat.toLowerCase().trim();
    let miTag = '';
    if (base.includes('peque')) miTag = 'pequenos';
    else if (base.includes('media')) miTag = 'mediano';
    else if (base.includes('grand')) miTag = 'grandes';
    else if (base.includes('segui')) miTag = 'seguimiento';
    else if (base.includes('evas')) miTag = 'evasor';

    // Ocultamos las tarjetas que no le corresponden
    const categorias = ['pequenos', 'mediano', 'grandes', 'seguimiento', 'evasor'];
    categorias.forEach(cat => {
        if (cat !== miTag) {
            const card = document.querySelector(`[onclick="openCategory('${cat}')"]`);
            if (card) {
                card.style.display = 'none'; // Desaparece del lobby
            }
        }
    });
}

// Ejecutamos el filtro un instante después de cargar la página
setTimeout(filtrarLobbyParaAdmins, 100);




// 🛡️ 2. FRENO DE MANO PARA EVITAR AMNESIA DE FIREBASE
window.salidaSeguraPanel = function() {
    // Oscurecemos ligeramente el botón para que el usuario sepa que hizo clic
    document.body.style.opacity = '0.7';
    document.body.style.pointerEvents = 'none';
    
    // Le damos 500 milisegundos (medio segundo) a Firebase para terminar de subir el último check
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 500);
};

window.volverMenuEliminatorias = function() {
    const activeView = document.querySelector('.view.active')?.id.replace('view-', '');
    if (activeView) {
        renderTournament(activeView, 'menu');
    }
};

// ==========================================
// 🔥 REINICIO DE TORNEO GLOBAL (SUPER ADMIN)
// ==========================================

// Mostrar el botón SOLO si es Súper Admin
document.addEventListener('DOMContentLoaded', () => {
    const isSuperAdmin = sessionStorage.getItem('juez_superadmin') === 'true';
    if (isSuperAdmin) {
        const btnGlobal = document.getElementById('contenedorResetGlobal');
        if (btnGlobal) btnGlobal.classList.remove('hidden');
    }
});

// ==========================================
// 🔥 REINICIO DE TORNEO GLOBAL (SUPER ADMIN)
// ==========================================
window.reiniciarTorneoGlobal = function() {
    const modal = document.createElement('div');
    modal.id = 'modal-confirm-reset-global';
    modal.className = "fixed inset-0 z-[999999] flex items-center justify-center bg-black/80 backdrop-blur-sm transition-all animate-fade-in";
    modal.innerHTML = `
        <div class="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center border-t-8 border-red-600 transform scale-110 relative overflow-hidden">
            <div class="text-6xl mb-4 drop-shadow-lg">⚠️</div>
            <h2 class="text-2xl font-black text-gray-800 uppercase tracking-tighter mb-2">Reinicio de Torneo</h2>
            <p class="text-gray-600 font-bold text-sm mb-4">¿Estás seguro de reiniciar TODO el torneo?</p>
            <p class="text-[10px] text-red-700 mt-2 mb-6 uppercase tracking-widest bg-red-50 py-3 px-4 rounded-lg border border-red-100 font-bold shadow-inner">
                Se borrarán veredictos, tiempos y se sortearán las llaves de nuevo. <br>¡Los equipos se quedan, pero en 0 puntos!
            </p>
            
            <div class="flex gap-3">
                <button onclick="document.getElementById('modal-confirm-reset-global').remove()" class="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-black py-3.5 rounded-xl text-xs uppercase tracking-widest transition-all active:scale-95">
                    Cancelar
                </button>
                <button id="btn-confirm-nuclear" class="flex-1 bg-red-600 hover:bg-red-700 text-white font-black py-3.5 rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-red-500/30 active:scale-95 transition-all">
                    Sí, Reiniciar
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('btn-confirm-nuclear').addEventListener('click', async () => {
        const btn = document.getElementById('btn-confirm-nuclear');
        btn.innerHTML = "⏳ REINICIANDO Y SORTEANDO...";
        btn.classList.add('animate-pulse', 'cursor-not-allowed');
        btn.disabled = true;

        try {
            const batch = writeBatch(db);
            
            const snapVeredictos = await getDocs(collection(db, "veredictos"));
            snapVeredictos.forEach(docSnap => batch.delete(docSnap.ref));
            
            const snapTiempos = await getDocs(collection(db, "tiempos_carreras"));
            snapTiempos.forEach(docSnap => batch.delete(docSnap.ref));

            const snapBrackets = await getDocs(collection(db, "brackets_estado"));
            snapBrackets.forEach(docSnap => batch.delete(docSnap.ref));
            
            const snapEquipos = await getDocs(collection(db, "competidores"));
            snapEquipos.forEach(docSnap => {
                batch.update(docSnap.ref, { score: 0, puntos: 0, puntaje: 0, puntosTotales: 0 });
            });
            
            const arenasTags = ["pequenos", "mediano", "grandes", "seguimiento", "evasor"];
            for(let tag of arenasTags) {
                batch.update(doc(db, "arenas", tag), {
                    estado: 'inactivo', r1: '', r2: '', robot1: '', robot2: '', ganador_automatico: ''
                });
                localStorage.removeItem('fime_bracket_' + tag);
            }

            await batch.commit();

            // 🔥 LA SOLUCIÓN: Esperamos 1.5 segundos a que Firebase recargue la lista de nombres 
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Ahora sí, hacemos el sorteo automático de los Brackets
            const categoriasCombate = ["pequenos", "mediano", "grandes"];
            for(let cat of categoriasCombate) {
                if (tournamentData[cat] && tournamentData[cat].participants.length > 0) {
                    tournamentData[cat].round1Matches = [];
                    generateInitialMatches(cat);
                }
            }
            
            const modalContent = modal.querySelector('div');
            modalContent.className = "bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center border-t-8 border-emerald-500 transform scale-110 relative overflow-hidden";
            modalContent.innerHTML = `
                <div class="text-6xl mb-4 animate-bounce">✅</div>
                <h2 class="text-2xl font-black text-emerald-800 uppercase tracking-tighter mb-2">¡Sorteos Listos!</h2>
                <p class="text-gray-500 font-bold text-sm">Los torneos se limpiaron y se sortearon de nuevo automáticamente.</p>
            `;
            
            setTimeout(() => {
                window.location.reload();
            }, 2000);
            
        } catch (e) {
            console.error("🔥 Error al reiniciar:", e);
            alert("Ocurrió un error. Revisa la consola (F12).");
            modal.remove();
        }
    });
};

// ========================================================
// 🎉 SISTEMA DE CONFETI (POR ENFRENTE) Y POP-UP 
// ========================================================
window.lanzarPopUpFase1 = function() {
    if (window.confetiLanzado) return;
    window.confetiLanzado = true;

    const durationMs = 15000;

    // 1. Limpieza de fantasmas
    const viejoPop = document.getElementById('modal-celebracion-fime');
    if (viejoPop) viejoPop.remove();

    // 2. EL POP-UP
    const pop = document.createElement('div');
    pop.id = 'modal-celebracion-fime';
    pop.style.cssText = 'position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; z-index: 2147483646 !important; display: flex !important; align-items: center !important; justify-content: center !important; background: rgba(0,0,0,0.85) !important; backdrop-filter: blur(5px) !important; opacity: 1 !important; visibility: visible !important; transition: opacity 0.5s ease !important;';
    pop.innerHTML = `
        <div style="background: white !important; border-radius: 1.5rem !important; padding: 3rem !important; text-align: center !important; max-width: 28rem !important; width: 100% !important; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5) !important; border-top: 8px solid #FBBF24 !important; transform: scale(1.1) !important;">
            <div style="font-size: 5rem; margin-bottom: 1rem; animation: bounce 1s infinite;">🏆</div>
            <h2 style="font-size: 2.25rem; font-weight: 900; color: #1F2937; text-transform: uppercase; letter-spacing: -0.05em; margin-bottom: 0.5rem;">¡Felicidades!</h2>
            <p style="color: #6B7280; font-weight: 700; font-size: 1.125rem; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 1.5rem;">Fase Inicial Superada</p>
            <p style="font-size: 0.75rem; color: #B45309; text-transform: uppercase; letter-spacing: 0.1em; background: #FEF3C7; padding: 0.75rem; border-radius: 0.5rem; border: 1px solid #FDE68A; font-weight: 700;">
                Las Eliminatorias están desbloqueadas
            </p>
        </div>
    `;
    document.body.appendChild(pop);

    // 3. AUTO-DESTRUCCIÓN LIMPIA
    setTimeout(() => {
        if (pop) { 
            pop.style.opacity = '0 !important'; 
            setTimeout(() => pop.remove(), 500); 
        }
        window.confetiLanzado = false;
        if (typeof confetti !== 'undefined') confetti.reset(); // Apaga el motor al final
    }, durationMs);

    // 4. DISPARAR CAÑONES GLOBALES
    const dispararCanones = () => {
        if (typeof confetti === 'undefined') return;
        const animationEnd = Date.now() + durationMs;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 2147483647 }; 

        // Limpiamos intervalos viejos por si acaso
        if (window.intervaloConfeti) clearInterval(window.intervaloConfeti);

        window.intervaloConfeti = setInterval(function() {
            // Si se acaba el tiempo o el admin aborta la celebración, detenemos el ciclo
            if (Date.now() > animationEnd || !window.confetiLanzado) {
                return clearInterval(window.intervaloConfeti);
            }
            const particleCount = 50 * ((animationEnd - Date.now()) / durationMs);
            
            // Disparo global (No crashea la memoria)
            confetti(Object.assign({}, defaults, { particleCount, origin: { x: Math.random() * 0.2 + 0.1, y: Math.random() - 0.2 } }));
            confetti(Object.assign({}, defaults, { particleCount, origin: { x: Math.random() * 0.2 + 0.7, y: Math.random() - 0.2 } }));
        }, 250);
    };

    // 5. CARGAR LIBRERÍA
    if (typeof confetti === 'undefined') {
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js";
        script.onload = dispararCanones;
        document.head.appendChild(script);
    } else {
        dispararCanones();
    }
};


// --- BOTONERA DE JUEZ INTEGRADA (TODO EN UNO) ---
window.abrirBotoneraJuez = function(cat) {
    const viejo = document.getElementById('modal-botonera-juez');
    if (viejo) viejo.remove();

    const m = document.createElement('div');
    m.id = 'modal-botonera-juez';
    // Se sobrepone a todo (z-[999999]), fondo oscuro, ocupa el 100% de la pantalla
    m.className = "fixed inset-0 z-[999999] flex flex-col bg-gray-900 animate-fade-in";
    m.innerHTML = `
        <div class="bg-gray-800 flex justify-between items-center p-3 shadow-md z-10">
            <span class="text-white font-black text-sm uppercase tracking-widest flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span> Juez Activo
            </span>
            <button onclick="document.getElementById('modal-botonera-juez').remove()" class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest shadow-md transition-colors active:scale-95">
                ❌ Cerrar Botonera
            </button>
        </div>
        <!-- Inyectamos index.html con un parámetro secreto -->
        <iframe src="index.html?modo=juez" class="flex-grow w-full border-none bg-gray-50"></iframe>
    `;
    document.body.appendChild(m);
};



// --- MODAL ELEGANTE PARA EL ADMIN ---
window.mostrarAvisoAdmin = function(titulo, texto, tipo = 'info') {
    const viejo = document.getElementById('modal-aviso-admin');
    if (viejo) viejo.remove();

    let icono = '⚠️';
    let colorBorde = 'border-amber-500';
    let colorBoton = 'bg-amber-500 hover:bg-amber-600';
    
    if (tipo === 'error') {
        icono = '❌'; colorBorde = 'border-red-500'; colorBoton = 'bg-red-600 hover:bg-red-700';
    } else if (tipo === 'success') {
        icono = '✅'; colorBorde = 'border-emerald-500'; colorBoton = 'bg-emerald-600 hover:bg-emerald-700';
    }

    const m = document.createElement('div');
    m.id = 'modal-aviso-admin';
    m.className = "fixed inset-0 z-[999999] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in px-4";
    m.innerHTML = `
        <div class="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center border-t-8 ${colorBorde} transform scale-110">
            <div class="text-5xl mb-4 drop-shadow-sm">${icono}</div>
            <h2 class="text-lg font-black text-gray-800 uppercase tracking-tight mb-2">${titulo}</h2>
            <p class="text-gray-600 font-bold text-xs mb-8 whitespace-pre-line leading-relaxed">${texto}</p>
            <button onclick="document.getElementById('modal-aviso-admin').remove()" class="${colorBoton} text-white font-black py-4 px-6 rounded-xl w-full text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all">
                Entendido
            </button>
        </div>
    `;
    document.body.appendChild(m);
};