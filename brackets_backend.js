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
            alert("🚪 Tu sesión ha sido cerrada o modificada por el sistema.");
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
        // 🔥 LIMPIEZA SEGURA: Solo vaciamos los nombres y puntos, INTOCABLES las llaves y ganadores
        ['pequenos', 'mediano', 'grandes'].forEach(cat => {
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
            if (contenedorTarjetas) contenedorTarjetas.className = "flex justify-center w-full";
            
            todasLasTarjetas.forEach(cat => {
                const tarjeta = document.querySelector(`[onclick="openCategory('${cat}')"]`);
                if (tarjeta) {
                    if (cat === myViewId) {
                        tarjeta.style.display = 'block'; 
                        tarjeta.classList.add('w-full', 'max-w-sm'); 
                    } else {
                        tarjeta.style.display = 'none'; 
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
                tournamentData[cat].round1Matches = data.round1Matches || [];
                tournamentData[cat].repechageMatches = data.repechageMatches || [];
                tournamentData[cat].laterRounds = data.laterRounds || [];
                tournamentData[cat].champion = data.champion || null;
                tournamentData[cat].byePlayer = data.byePlayer || null;
                tournamentData[cat].phase = data.phase || 'round1';

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
};
window.openCategory = (cat) => {
    showView(cat);
    document.getElementById('btnReturnAdmin').classList.add('hidden');
    if (['pequenos', 'mediano', 'grandes'].includes(cat)) {
        // 🔥 FORZAMOS LA VISTA AL MENÚ SIEMPRE QUE SE ENTRE DESDE EL LOBBY
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

    // Calcular cajas exactas de Repechaje (Perdedores R1 + El Impar)
    const numR1 = data.round1Matches.length;
    const totalRepPlayers = numR1 + (data.byePlayer ? 1 : 0);
    const numRepBoxes = Math.ceil(totalRepPlayers / 2);

    for (let i = 0; i < numRepBoxes; i++) {
        data.repechageMatches.push({ player1: null, player2: null, winner: null });
    }

    // MAGIA: Sienta al Impar directamente en su lugar de Repechaje desde el inicio
    if (data.byePlayer) {
        const byeBoxIdx = Math.floor(numR1 / 2);
        if (numR1 % 2 === 0) {
            data.repechageMatches[byeBoxIdx].player1 = data.byePlayer;
        } else {
            data.repechageMatches[byeBoxIdx].player2 = data.byePlayer;
        }
    }

    guardarBracketFirebase(cat);
}

// 🔥 NUEVO: POP-UP DE CELEBRACIÓN FASE 1
window.lanzarPopUpFase1 = function() {
    const pop = document.createElement('div');
    pop.className = "fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-all";
    pop.innerHTML = `
        <div class="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center border-t-8 border-emerald-500 transform scale-110 animate-fade-in modal-content">
            <div class="text-6xl mb-4 animate-bounce">🎉</div>
            <h2 class="text-2xl font-black text-emerald-800 uppercase tracking-tighter mb-2">¡Felicidades!</h2>
            <p class="text-gray-600 font-bold text-sm">Finalizaron con éxito la Fase Inicial.</p>
            <p class="text-[10px] text-gray-400 mt-4 uppercase tracking-widest bg-gray-50 py-2 rounded-lg border border-gray-100 shadow-inner">Las Eliminatorias están desbloqueadas</p>
        </div>
    `;
    document.body.appendChild(pop);
    setTimeout(() => { pop.remove(); }, 10000); // Se quita solito en 10 segundos
};

function checkPhase1Completion(data) {
    const r1Done = data.round1Matches.every(m => m.winner !== null);
    if (!r1Done) return; 

    data.repechageMatches.forEach(m => {
        if (m.player1 && !m.player2) m.winner = m.player1;
        if (!m.player1 && m.player2) m.winner = m.player2;
        if (!m.player1 && !m.player2) m.winner = 'EMPTY';
    });

    const repDone = data.repechageMatches.every(m => m.winner !== null);

    if (r1Done && repDone && (!data.laterRounds || data.laterRounds.length === 0)) {
        buildPhase2Bracket(data);
        window.lanzarPopUpFase1(); // 🔥 DISPARAMOS LA CELEBRACIÓN
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
        if (m.player1 && !m.player2) { m.winner = m.player1; m.isBye = true; }
        if (m.player2 && !m.player1) { m.winner = m.player2; m.isBye = true; }
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
    // 🔥 MODO SOLO LECTURA: El Súper Admin no puede tocar los brackets
    if (sessionStorage.getItem('juez_superadmin') === 'true') return;

    const data = tournamentData[cat];
    let match;

    if (phase === 'round1') match = data.round1Matches[matchIdx];
    else if (phase === 'repechage') match = data.repechageMatches[matchIdx];
    else if (phase === 'laterRounds') match = data.laterRounds[matchIdx[0]].matches[matchIdx[1]];

    if (!match || (!match.player1 && phase !== 'repechage') || match.isBye) return;

    match.winner = match.winner === playerName ? null : playerName;

    // Lógica de perdedores hacia el repechaje
    if (phase === 'round1') {
        const loser = match.winner === match.player1 ? match.player2 : (match.winner === match.player2 ? match.player1 : null);
        const repMatchIdx = Math.floor(matchIdx / 2);
        const isPlayer1 = matchIdx % 2 === 0;
        const repMatch = data.repechageMatches[repMatchIdx];

        if (repMatch) {
            if (isPlayer1) {
                repMatch.player1 = loser;
                if (!loser && repMatch.winner === repMatch.player1) repMatch.winner = null;
            } else {
                repMatch.player2 = loser;
                if (!loser && repMatch.winner === repMatch.player2) repMatch.winner = null;
            }
        }
    }

    // 🔥 BLINDAJE ANTI-AMNESIA: Verificamos estados precisos de las fases
    if (phase === 'round1' || phase === 'repechage') {
        // Si el admin se arrepiente y "desmarca" a alguien, volvemos a bloquear Fase 2
        if (match.winner === null) {
            data.laterRounds = []; 
            data.champion = null;
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

    if (data.participants.length === 0) {
        container.innerHTML = `<div class="text-center p-12 bg-white rounded-3xl border border-gray-200 shadow-sm w-full max-w-4xl mx-auto"><span class="text-6xl block mb-4">📭</span><h3 class="text-2xl font-black text-gray-400 uppercase tracking-widest">Categoría Vacía</h3><p class="text-gray-400 font-bold mt-2">Sube tu padrón desde el Panel Admin.</p></div>`;
        return;
    }

    const adminName = sessionStorage.getItem('juez_nombre') || 'Administrador';
    const isPhase2Unlocked = data.laterRounds && data.laterRounds.length > 0;
    const isSuperAdmin = sessionStorage.getItem('juez_superadmin') === 'true';

    if (subView === 'menu') {
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
    <div id="arena-header" class="mb-6 w-full grid grid-cols-3 items-center bg-white p-3 rounded-2xl shadow-sm border border-gray-200" style="${isArena ? 'display: none;' : ''}">
        <div class="flex justify-start">
            <button onclick="abrirModalPuntajes('${cat}')" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3.5 rounded-xl font-extrabold shadow-md hover:shadow-lg transition-all text-sm uppercase tracking-widest flex items-center gap-3 active:scale-95">
                📊 Tabla de Puntajes
            </button>
        </div>
        <div class="flex justify-center">
            <button onclick="activarModoArena()" class="bg-sky-100 hover:bg-sky-200 text-sky-900 border-2 border-sky-300 px-6 py-3.5 rounded-xl font-extrabold shadow-md hover:shadow-lg transition-all text-sm uppercase tracking-widest flex items-center gap-3 active:scale-95">
                🖥️ Modo Arena
            </button>
        </div>
        <div class="flex justify-end">
            <button onclick="renderTournament('${cat}', 'menu')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3.5 rounded-xl font-extrabold shadow-md hover:shadow-lg transition-all text-sm uppercase tracking-widest flex items-center gap-3 active:scale-95">
                🔙 Menú Eliminatorias
            </button>
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
        html += `<div class="bracket-wrapper min-w-max justify-center">`;
        
        const r1Total = data.round1Matches.length;
        const halfR1 = Math.ceil(r1Total / 2);
        const leftR1 = data.round1Matches.slice(0, halfR1);
        const rightR1 = data.round1Matches.slice(halfR1);

        html += `<div class="bracket-col">
                    <h4 class="absolute -top-10 left-0 w-full text-center text-[11px] font-black text-emerald-800 uppercase tracking-widest border-b-2 border-emerald-100 pb-2">Ronda 1</h4>`;
        leftR1.forEach((m, idx) => { html += renderMatchBox(cat, 'round1', idx, m, subView); });
        html += `</div>`;

        if (data.repechageMatches && data.repechageMatches.length > 0) {
            html += `<div class="bracket-col justify-start px-8 mx-4 border-x-2 border-dashed border-gray-200 bg-gray-50/50 rounded-3xl pb-8 min-h-full">
                        <h4 class="absolute -top-10 left-0 w-full text-center text-[11px] font-black text-emerald-800 uppercase tracking-widest border-b-2 border-emerald-100 pb-2">Repechaje</h4>`;
            data.repechageMatches.forEach((m, idx) => { html += renderMatchBox(cat, 'repechage', idx, m, subView); });
            html += `</div>`;
        }

        if (rightR1.length > 0) {
            html += `<div class="bracket-col">
                        <h4 class="absolute -top-10 left-0 w-full text-center text-[11px] font-black text-emerald-800 uppercase tracking-widest border-b-2 border-emerald-100 pb-2">Ronda 1</h4>`;
            rightR1.forEach((m, idx) => {
                let actualIdx = halfR1 + idx;
                html += renderMatchBox(cat, 'round1', actualIdx, m, subView);
            });
            html += `</div>`;
        }
        
        html += `</div>`;
    
    } else if (subView === 'phase2') {
        html += `<div class="bracket-wrapper min-w-max justify-center">`;
        const roundTitles = ["Ronda 2", "Octavos", "Cuartos", "Semifinal"];
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
                    <span class="player-name ${strikethrough} ${nameColorClass}">${esc(player)} ${tagHtml}</span>
                    <span class="docente-text ${docColorClass}">${esc(docentesMap[player] || 'Sin Asesor')}</span>
                </div>
                <span class="score-box bg-transparent border border-gray-200/50 flex items-center justify-center w-6 h-6">${icon}</span>
            </div>
        `;
    };

    // Detectamos si estamos en Modo Arena O si es Súper Admin
    const isArena = !!document.fullscreenElement;
    const isSuperAdmin = sessionStorage.getItem('juez_superadmin') === 'true';
    const ocultarRayito = isArena || isSuperAdmin;

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

        if (isSuperAdmin) {
            // SÚPER ADMIN: Solo ve el panel de lectura (Monitor)
            panel.classList.remove('hidden');
        } else if (cat === miTag) {
            // ADMIN NORMAL: Convertimos el panel en sus controles de combate
            panel.classList.remove('hidden');
            panel.className = "bg-emerald-50 border-2 border-emerald-600 rounded-2xl p-4 shadow-sm w-full transition-all animate-fade-in";
            const tituloPanel = isCarrera ? '🏎️ Control de Pista' : '🥊 Control de Arena';
            
            // Inyectamos los botones y selectores
            panel.innerHTML = `
                <h4 class="text-[10px] font-black uppercase tracking-wider text-emerald-800 mb-3 flex items-center justify-center">${tituloPanel}</h4>
                <div class="flex gap-2 mb-3">
                    <select id="sa-r1-${cat}" class="${isCarrera ? 'w-full' : 'w-1/2'} p-2 bg-white border border-gray-200 text-gray-800 font-black uppercase rounded-xl text-center shadow-sm text-[10px] focus:outline-none focus:border-emerald-500 transition-all">
                        <option value="">-- ESPERANDO R1 --</option>
                    </select>
                    ${isCarrera ? '' : `
                    <span class="text-xs font-black text-red-500 self-center">VS</span>
                    <select id="sa-r2-${cat}" class="w-1/2 p-2 bg-white border border-gray-200 text-gray-800 font-black uppercase rounded-xl text-center shadow-sm text-[10px] focus:outline-none focus:border-emerald-500 transition-all">
                        <option value="">-- ESPERANDO R2 --</option>
                    </select>`}
                </div>
                <div class="flex gap-2">
                    <button id="sa-btn-iniciar-${cat}" onclick="saAccionArena('${cat}', 'iniciar')" class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-lg text-[10px] uppercase tracking-widest shadow-md transition-all active:scale-95">Iniciar</button>
                    <button onclick="saAccionArena('${cat}', 'ko')" class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-3 rounded-lg text-[10px] uppercase tracking-widest shadow-md transition-all active:scale-95">${isCarrera ? '🏁 Fin' : '🥊 K.O.'}</button>
                    <button onclick="saAccionArena('${cat}', 'limpiar')" class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-3 rounded-lg text-[10px] uppercase tracking-widest shadow-md transition-all active:scale-95">🧹 Limpiar</button>
                </div>
            `;
        }

        // Reconectamos el Radar a Firebase
        if (isSuperAdmin || cat === miTag) {
            onSnapshot(doc(db, "arenas", cat), (docSnap) => {
                if(!docSnap.exists()) return;
                const data = docSnap.data();
                
                if (isSuperAdmin) {
                    // Actualiza solo etiquetas (Labels) para el Súper Admin
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
                    const btnIniciar = document.getElementById(`sa-btn-iniciar-${cat}`);
                    
                    if(selR1 && data.robot1) selR1.value = data.robot1;
                    if(selR2 && data.robot2) selR2.value = data.robot2;
                    
                    if(btnIniciar) {
                        if (data.estado === 'peleando') {
                            btnIniciar.className = "flex-1 bg-amber-500 text-white font-bold py-2 rounded-lg text-[10px] uppercase tracking-widest shadow-md cursor-not-allowed";
                            btnIniciar.innerHTML = "⏳ En Curso...";
                            btnIniciar.disabled = true;
                        } else {
                            btnIniciar.className = "flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-lg text-[10px] uppercase tracking-widest shadow-md transition-all active:scale-95";
                            btnIniciar.innerHTML = "Iniciar";
                            btnIniciar.disabled = false;
                            if(data.estado === 'inactivo') {
                                if(selR1) selR1.value = '';
                                if(selR2) selR2.value = '';
                            }
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

    // Restauramos el llenado de los selectores (Solo para el Admin Normal)
    if (!isSuperAdmin && miTag) {
        onSnapshot(collection(db, "competidores"), (snap) => {
            let comp = [];
            snap.forEach(doc => comp.push(doc.data()));
            
            const selR1 = document.getElementById(`sa-r1-${miTag}`);
            const selR2 = document.getElementById(`sa-r2-${miTag}`);
            if(!selR1) return;
            
            const currentR1 = selR1.value;
            const currentR2 = selR2 ? selR2.value : '';
            
            let opts = `<option value="">-- ESPERANDO --</option>`;
            comp.filter(c => {
                let cTag = c.categoria_tag || '';
                let cOrig = (c.categoria_original || '').toLowerCase();
                return cTag === miTag || cOrig.includes(miTag.substring(0,4));
            }).sort((a,b) => a.nombre.localeCompare(b.nombre)).forEach(c => {
                opts += `<option value="${c.nombre}">${c.nombre}</option>`;
            });
            
            selR1.innerHTML = opts;
            if(selR2) selR2.innerHTML = opts;
            
            selR1.value = currentR1;
            if(selR2) selR2.value = currentR2;
        });
    }
}

// 3. Restauramos las Funciones de Control (Iniciar, K.O., Limpiar)
window.saAccionArena = async function(cat, accion) {
    const arenaRef = doc(db, "arenas", cat);
    
    if (accion === 'limpiar') {
        if(!confirm(`🧹 ¿Limpiar arena de ${cat.toUpperCase()}?`)) return;
        await setDoc(arenaRef, { robot1: '', robot2: '', estado: 'inactivo' });
    } 
    else if (accion === 'ko') {
        const isCarrera = cat === 'seguimiento' || cat === 'evasor';
        if(!confirm(isCarrera ? '🏁 ¿Forzar fin de carrera?' : '🥊 ¿Declarar K.O.?')) return;
        await updateDoc(arenaRef, { estado: 'ko' });
    }
    else if (accion === 'iniciar') {
        const r1 = document.getElementById(`sa-r1-${cat}`).value;
        const r2 = document.getElementById(`sa-r2-${cat}`) ? document.getElementById(`sa-r2-${cat}`).value : '';
        const isCarrera = cat === 'seguimiento' || cat === 'evasor';
        
        if (isCarrera) {
            if (!r1) return alert("Selecciona un robot.");
        } else {
            if (!r1 || !r2) return alert("Selecciona ambos robots.");
            if (r1 === r2) return alert("Mismo robot.");
        }
        
        await setDoc(arenaRef, { 
            robot1: r1, 
            robot2: isCarrera ? '' : r2, 
            estado: 'peleando',
            tiempo_inicio: Date.now() / 1000 
        });
    }
};


// 3. Funciones de Control Override (Solo queda Limpiar)
window.limpiarArenaLocal = async function(cat) {
    if(!confirm(`🧹 ¿Forzar la limpieza de la arena de ${cat.toUpperCase()}?`)) return;
    await setDoc(doc(db, "arenas", cat), { robot1: '', robot2: '', estado: 'inactivo' });
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


// 🔥 1. POP-UP INVENCIBLE EN MODO ARENA (Z-Index Extremo)
window.lanzarPopUpFase1 = function() {
    const pop = document.createElement('div');
    // Le pusimos z-[999999] para asegurar que rompa la pantalla completa
    pop.className = "fixed inset-0 z-[999999] flex items-center justify-center bg-black/70 backdrop-blur-sm transition-all";
    pop.innerHTML = `
        <div class="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center border-t-8 border-emerald-500 transform scale-110 animate-fade-in">
            <div class="text-6xl mb-4 animate-bounce">🎉</div>
            <h2 class="text-2xl font-black text-emerald-800 uppercase tracking-tighter mb-2">¡Felicidades!</h2>
            <p class="text-gray-600 font-bold text-sm">Finalizaron con éxito la Fase Inicial.</p>
            <p class="text-[10px] text-gray-400 mt-4 uppercase tracking-widest bg-emerald-50 py-2 rounded-lg border border-emerald-100 shadow-inner">Las Eliminatorias están desbloqueadas</p>
        </div>
    `;
    // Lo inyectamos directo en el nivel más alto
    document.documentElement.appendChild(pop);
    setTimeout(() => { pop.remove(); }, 10000); // 10 segundos de gloria
};

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