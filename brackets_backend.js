// =====================================================================
// MOTOR CORE OPTIMIZADO - BRACKETS CLÁSICOS (IZQUIERDA A DERECHA)
// =====================================================================

if (!document.getElementById('classic-bracket-styles')) {
    const style = document.createElement('style');
    style.id = 'classic-bracket-styles';
    style.innerHTML = `
        .bracket-wrapper { display: flex; flex-direction: row; align-items: stretch; justify-content: flex-start; overflow-x: auto; padding: 2rem 4rem; min-height: 75vh; gap: 3rem; background: #f8fafc; }
        .bracket-col { display: flex; flex-direction: column; justify-content: space-around; position: relative; min-width: 250px; gap: 1rem; }
        
        .match-container { display: flex; flex-direction: column; justify-content: center; position: relative; flex: 1; padding: 10px 0; }

        /* Líneas horizontales tipo Bracket Clásico */
        .match-container::after { content: ''; position: absolute; right: -3rem; top: 50%; width: 3rem; height: 2px; background-color: #94a3b8; z-index: 0; }
        .bracket-col:last-child .match-container::after { display: none; } /* El campeón no saca línea */
        
        .match-container::before { content: ''; position: absolute; left: -3rem; top: 50%; width: 3rem; height: 2px; background-color: #94a3b8; z-index: 0; }
        .bracket-col:first-child .match-container::before { display: none; } /* La primera ronda no recibe línea */

        /* Diseño de la tarjeta apilada tipo eSports */
        .match-card { background: white; border: 2px solid #e2e8f0; border-radius: 8px; display: flex; flex-direction: column; z-index: 10; position: relative; box-shadow: 0 2px 4px rgba(0,0,0,0.05); overflow: hidden; width: 100%; }
        .player-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-bottom: 2px solid #f1f5f9; cursor: pointer; transition: all 0.2s ease; }
        .player-row:last-child { border-bottom: none; }
        .player-row:hover { background: #f1f5f9; }
        
        /* Estilos cuando un jugador gana */
        .player-row.winner { background: #10b981; color: white; border-color: #059669; }
        .player-row.winner .docente-text { color: #d1fae5; }
        .player-row.winner .score-box { background: rgba(255,255,255,0.2); color: white; }
        
        .player-info { display: flex; flex-direction: column; overflow: hidden; }
        .player-name { font-weight: 900; font-size: 0.85rem; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 170px; letter-spacing: 0.5px; }
        .docente-text { font-size: 0.6rem; color: #94a3b8; font-weight: 700; text-transform: uppercase; margin-top: 3px; letter-spacing: 0.5px; }
        .score-box { font-size: 0.8rem; font-weight: 900; background: #f1f5f9; color: #cbd5e1; padding: 3px 8px; border-radius: 6px; }
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

document.addEventListener('DOMContentLoaded', () => {
    cargarDatosDesdeServidor();
});

function cargarDatosDesdeServidor() {
    fetch('/api/competidores/obtener_todos')
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            ['pequenos','mediano','grandes'].forEach(c => tournamentData[c].participants = []);
            timeParticipants.seguimiento = []; timeParticipants.evasor = [];
            timeData.seguimiento = []; timeData.evasor = [];
            docentesMap = {};

            data.competidores.forEach(c => {
                docentesMap[c.nombre] = c.docente || 'Sin Asesor'; 
                if (['pequenos','mediano','grandes'].includes(c.categoria_tag)) {
                    tournamentData[c.categoria_tag].participants.push(c.nombre);
                } else {
                    timeParticipants[c.categoria_tag].push(c.nombre);
                }
            });

            data.tiempos.forEach(t => timeData[t.categoria_tag].push(t));

            ['pequenos','mediano','grandes'].forEach(c => {
                if (tournamentData[c].participants.length >= 2 && tournamentData[c].round1Matches.length === 0) {
                    generateInitialMatches(c);
                }
            });
            
            const activeView = document.querySelector('.view.active').id.replace('view-', '');
            if(['pequenos', 'mediano', 'grandes'].includes(activeView)) renderTournament(activeView);
            if(['seguimiento', 'evasor'].includes(activeView)) renderTimeTable(activeView);
        }
    });
}

function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-' + viewId).classList.add('active');
    document.getElementById('btnBack').classList.toggle('hidden', viewId === 'menu');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.goToMenu = () => showView('menu');
window.openCategory = (cat) => {
    showView(cat);
    if (['pequenos', 'mediano', 'grandes'].includes(cat)) renderTournament(cat);
    else renderTimeTable(cat);
};

// --- ALGORITMO CORE ---

function generateInitialMatches(cat) {
    const data = tournamentData[cat];
    if (data.participants.length < 2) return;
    
    const shuffled = [...data.participants].sort(() => Math.random() - 0.5);
    data.byePlayer = shuffled.length % 2 !== 0 ? shuffled.pop() : null;
    data.round1Matches = [];
    
    for (let i = 0; i < shuffled.length; i += 2) {
        data.round1Matches.push({ player1: shuffled[i], player2: shuffled[i + 1], winner: null });
    }
    data.phase = 'round1';
}

function checkAndAdvance(data) {
    if (data.phase === 'round1' && data.round1Matches.every(m => m.winner !== null)) {
        const losers = [];
        data.round1Matches.forEach(m => losers.push(m.winner === m.player1 ? m.player2 : m.player1));
        if (data.byePlayer) losers.push(data.byePlayer);
        
        if (losers.length >= 2) {
            data.byePlayer = losers.length % 2 !== 0 ? losers.pop() : null;
            data.repechageMatches = [];
            for (let i = 0; i < losers.length; i += 2) {
                data.repechageMatches.push({ player1: losers[i], player2: losers[i + 1], winner: null });
            }
            data.phase = 'repechage';
        } else { buildNextRound(data); }
    } 
    else if (data.phase === 'repechage' && data.repechageMatches.every(m => m.winner !== null)) {
        buildNextRound(data);
    } 
    else if (data.phase === 'laterRounds') {
        const currentRound = data.laterRounds[data.laterRounds.length - 1];
        if (currentRound && currentRound.every(m => m.winner !== null)) {
            const winners = currentRound.map(m => m.winner);
            if (winners.length === 1) {
                data.champion = winners[0];
                data.phase = 'finished';
            } else { buildNextRound(data); }
        }
    }
}

function buildNextRound(data) {
    const winnersR1 = data.round1Matches.map(m => m.winner).filter(w => w !== null);
    const winnersRep = (data.repechageMatches || []).map(m => m.winner).filter(w => w !== null);
    const allWinners = [...winnersR1, ...winnersRep];
    
    if (data.byePlayer) allWinners.push(data.byePlayer);

    if (allWinners.length < 2) {
        data.champion = allWinners[0] || null;
        data.phase = 'finished';
        return;
    }

    const nextPlayers = [...allWinners];
    data.byePlayer = nextPlayers.length % 2 !== 0 ? nextPlayers.pop() : null;
    
    const nextMatches = [];
    for (let i = 0; i < nextPlayers.length; i += 2) {
        nextMatches.push({ player1: nextPlayers[i], player2: nextPlayers[i + 1], winner: null });
    }
    data.laterRounds.push(nextMatches);
    data.phase = 'laterRounds';
}

window.selectWinner = function(cat, phase, matchIndex, playerName) {
    const data = tournamentData[cat];
    let match;
    
    if (phase === 'round1') match = data.round1Matches[matchIndex];
    else if (phase === 'repechage') match = data.repechageMatches[matchIndex];
    else if (phase === 'laterRounds') {
        if (!data.laterRounds[matchIndex[0]]) return;
        match = data.laterRounds[matchIndex[0]][matchIndex[1]];
    }
    
    if (!match || match.player1 === null) return; 

    match.winner = match.winner === playerName ? null : playerName;
    checkAndAdvance(data);
    renderTournament(cat);
};

// =====================================================================
// RENDERIZADO VISUAL: ÁRBOL CLÁSICO DE IZQUIERDA A DERECHA
// =====================================================================

function renderTournament(cat) {
    const container = document.getElementById('tournament-' + cat);
    const data = tournamentData[cat];
    if (!container) return;

    if (data.participants.length === 0) {
        container.innerHTML = `<div class="text-center p-12 bg-white rounded-3xl border border-gray-200 shadow-sm w-full max-w-4xl mx-auto"><span class="text-6xl block mb-4">📭</span><h3 class="text-2xl font-black text-gray-400 uppercase tracking-widest">Categoría Vacía</h3><p class="text-gray-400 font-bold mt-2">Sube tu padrón desde el Panel Admin.</p></div>`;
        return;
    }
    if (data.participants.length === 1) {
        container.innerHTML = `<div class="text-center p-12 bg-white rounded-3xl border-2 border-amber-300 shadow-sm w-full max-w-4xl mx-auto"><span class="text-6xl block mb-4">⚠️</span><h3 class="text-2xl font-black text-amber-500 uppercase tracking-widest">Faltan Competidores</h3><p class="text-gray-600 font-bold mt-2 text-lg">Solo hay 1 robot inscrito.</p></div>`;
        return;
    }

    // Calculamos rondas vacías para dibujar el árbol hasta la final
    const totalExpectedRounds = Math.ceil(Math.log2(data.participants.length));
    let renderLaterRounds = [...data.laterRounds];
    let lastMatchCount = renderLaterRounds.length > 0 ? renderLaterRounds[renderLaterRounds.length - 1].length : data.round1Matches.length;

    while (renderLaterRounds.length < totalExpectedRounds - 1 && lastMatchCount > 1) {
        lastMatchCount = Math.ceil(lastMatchCount / 2);
        let emptyRound = [];
        for(let i=0; i<lastMatchCount; i++) emptyRound.push({player1: null, player2: null, winner: null});
        renderLaterRounds.push(emptyRound);
    }

    // Juntamos todas las columnas
    const allPhases = [];
    allPhases.push({ phase: 'round1', matches: data.round1Matches, title: 'Dieciseisavos' });
    if (data.repechageMatches && data.repechageMatches.length > 0) {
        allPhases.push({ phase: 'repechage', matches: data.repechageMatches, title: 'Repechaje' });
    }
    
    const roundTitles = ["Octavos", "Cuartos", "Semifinal", "Gran Final"];
    renderLaterRounds.forEach((r, idx) => {
        let titleIndex = roundTitles.length - (renderLaterRounds.length - idx);
        let phaseTitle = titleIndex >= 0 ? roundTitles[titleIndex] : `Ronda ${idx + 2}`;
        allPhases.push({ phase: 'laterRounds', matches: r, roundIndex: idx, title: phaseTitle });
    });

    let html = `<div class="relative w-full bg-white rounded-3xl shadow-lg border border-gray-200 overflow-hidden">`;
    html += `<div class="bracket-wrapper">`;

    // Renderizamos las columnas de izquierda a derecha
    allPhases.forEach((ph) => {
        html += `<div class="bracket-col">
                    <h4 class="absolute -top-6 left-0 w-full text-center text-[11px] font-black text-emerald-800 uppercase tracking-widest border-b-2 border-emerald-100 pb-2">${ph.title}</h4>`;
        
        ph.matches.forEach((m, idx) => {
            let actualIdx = ph.phase === 'laterRounds' ? [ph.roundIndex, idx] : idx;
            html += renderMatchBox(cat, ph.phase, actualIdx, m);
        });
        
        html += `</div>`;
    });

    // Columna Final: Campeón
    if (data.champion) {
        html += `<div class="bracket-col justify-center pl-4">
                    <div class="match-container">
                        <div class="bg-gradient-to-br from-emerald-500 to-emerald-700 border-4 border-emerald-300 rounded-xl p-8 shadow-2xl text-center transform scale-110 w-[260px] animate-pulse">
                            <h4 class="text-[10px] font-black text-emerald-100 uppercase tracking-widest mb-3">🏆 Campeón Absoluto</h4>
                            <div class="text-2xl font-black text-white drop-shadow-md mb-2">${esc(data.champion)}</div>
                            <div class="text-[9px] font-bold text-emerald-200 pt-3 border-t border-emerald-400 uppercase tracking-wider">${esc(docentesMap[data.champion])}</div>
                        </div>
                    </div>
                 </div>`;
    }

    html += `</div>`; // Fin de bracket-wrapper

    // CAJA DE REPECHAJE (IMPAR) ESQUINA INFERIOR IZQUIERDA
    if (data.byePlayer && data.phase === 'round1') {
        html += `<div class="absolute bottom-6 left-6 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-400 rounded-xl p-4 shadow-lg min-w-[220px] z-30">
                    <div class="flex items-center gap-2 mb-2 border-b border-amber-200 pb-1">
                        <span class="text-amber-500 text-lg">🎟️</span>
                        <span class="text-[9px] font-black text-amber-700 uppercase tracking-widest">Pase Directo / Impar</span>
                    </div>
                    <div class="font-black text-sm text-amber-900 truncate">${esc(data.byePlayer)}</div>
                    <div class="text-[8px] font-bold text-amber-700 mt-1 uppercase truncate opacity-80">${esc(docentesMap[data.byePlayer])}</div>
                 </div>`;
    }

    // BOTÓN DE REINICIAR (Arriba a la derecha)
    html += `<div class="absolute top-6 right-6 z-30">
                <button class="bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-200 font-bold py-2 px-4 rounded-lg shadow-sm transition-all active:scale-95 uppercase tracking-wider text-[9px]" onclick="resetTournament('${cat}')">
                    🔄 Reiniciar Llaves
                </button>
             </div>`;

    html += `</div>`;
    container.innerHTML = html;
}

function renderMatchBox(cat, phase, matchIdx, match) {
    const renderRow = (player) => {
        // Cajas vacías (Esperando a que ganen las rondas previas)
        if (!player) return `
            <div class="player-row text-gray-400 bg-gray-50/50 cursor-not-allowed">
                <div class="player-info">
                    <span class="player-name text-gray-300">TBD</span>
                    <span class="docente-text text-gray-300">-</span>
                </div>
                <span class="score-box bg-gray-100 text-gray-300">?</span>
            </div>`;
        
        const isWinner = match.winner === player;
        const winnerClass = isWinner ? 'winner' : '';
        const checkIcon = isWinner ? '✓' : '';
        
        return `
            <div class="player-row ${winnerClass}" onclick="selectWinner('${cat}','${phase}',${JSON.stringify(matchIdx)},'${escAttr(player)}')">
                <div class="player-info">
                    <span class="player-name">${esc(player)}</span>
                    <span class="docente-text">${esc(docentesMap[player] || 'Sin Asesor')}</span>
                </div>
                <span class="score-box">${checkIcon}</span>
            </div>
        `;
    };

    return `
        <div class="match-container">
            <div class="match-card">
                ${renderRow(match.player1)}
                ${renderRow(match.player2)}
            </div>
        </div>
    `;
}

window.resetTournament = function(cat) {
    if (confirm("⚠️ ¿Deseas reiniciar las llaves de esta categoría? Se borrarán las selecciones de ganadores actuales.")) {
        tournamentData[cat].round1Matches = []; tournamentData[cat].laterRounds = []; tournamentData[cat].repechageMatches = []; tournamentData[cat].champion = null;
        generateInitialMatches(cat); renderTournament(cat);
    }
};

// =====================================================================
// MÓDULO DE TIEMPOS (CARRERAS) - INTACTO
// =====================================================================
function renderTimeTable(cat) {
    const container = document.getElementById('time-' + cat);
    const sorted = [...timeData[cat]].sort((a,b) => a.timeSeconds - b.timeSeconds);
    const equipos = timeParticipants[cat] || [];
    
    if (equipos.length === 0) {
        container.innerHTML = `<div class="text-center p-12 bg-white rounded-3xl border border-gray-200 shadow-sm w-full max-w-4xl mx-auto"><span class="text-6xl block mb-4">⏱️</span><h3 class="text-2xl font-black text-gray-400 uppercase tracking-widest">Pista Vacía</h3><p class="text-gray-400 font-bold mt-2">Aún no hay robots registrados en esta categoría.</p></div>`;
        return;
    }

    container.innerHTML = `
        <div class="bg-white p-6 rounded-2xl shadow-md border border-gray-100 mb-8 w-full max-w-4xl mx-auto flex flex-col md:flex-row gap-4 items-center justify-center">
            <select id="time-select-${cat}" class="bg-gray-50 border-2 border-gray-200 text-gray-800 text-sm font-bold rounded-xl focus:ring-emerald-500 focus:border-emerald-500 block w-full md:w-auto p-3 outline-none transition-colors">
                <option value="">-- Seleccionar Robot --</option>
                ${equipos.map(e=>`<option>${esc(e)}</option>`).join('')}
            </select>
            <div class="flex gap-2">
                <input id="time-min-${cat}" placeholder="Min" type="number" value="0" min="0" class="w-20 bg-gray-50 border-2 border-gray-200 text-center text-gray-800 text-sm font-bold rounded-xl p-3 focus:border-emerald-500 outline-none transition-colors">
                <input id="time-seg-${cat}" placeholder="Seg" type="number" value="0" min="0" max="59" class="w-20 bg-gray-50 border-2 border-gray-200 text-center text-gray-800 text-sm font-bold rounded-xl p-3 focus:border-emerald-500 outline-none transition-colors">
                <input id="time-ms-${cat}" placeholder="ms" type="number" value="0" min="0" max="999" class="w-24 bg-gray-50 border-2 border-gray-200 text-center text-gray-800 text-sm font-bold rounded-xl p-3 focus:border-emerald-500 outline-none transition-colors">
            </div>
            <button class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl shadow-md transition-all active:scale-95 uppercase tracking-wider text-xs w-full md:w-auto" onclick="addTime('${cat}')">
                ⏱️ Registrar
            </button>
        </div>

        <div class="overflow-x-auto bg-white rounded-2xl shadow-md border border-gray-100 w-full max-w-5xl mx-auto">
            <table class="w-full text-sm text-left text-gray-600">
                <thead class="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                    <tr>
                        <th scope="col" class="px-6 py-4 text-center font-extrabold tracking-wider">Posición</th>
                        <th scope="col" class="px-6 py-4 font-extrabold tracking-wider">Competidor & Docente</th>
                        <th scope="col" class="px-6 py-4 text-center font-extrabold tracking-wider">Marca Oficial</th>
                        <th scope="col" class="px-6 py-4 text-center font-extrabold tracking-wider">Acción</th>
                    </tr>
                </thead>
                <tbody>
                ${sorted.map((e,i)=>{
                    let medal = `<span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-600 font-bold border border-gray-300">${i+1}</span>`; 
                    if(i===0) medal=`<span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-yellow-100 text-yellow-700 font-black border-2 border-yellow-400 shadow-sm">1</span>`; 
                    if(i===1) medal=`<span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-black border-2 border-slate-300 shadow-sm">2</span>`; 
                    if(i===2) medal=`<span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-50 text-orange-800 font-black border-2 border-orange-300 shadow-sm">3</span>`;
                    
                    return `<tr class="bg-white border-b hover:bg-gray-50 transition-colors">
                        <td class="px-6 py-4 text-center">${medal}</td>
                        <td class="px-6 py-4">
                            <div class="font-black text-gray-900 text-base">${esc(e.name)}</div>
                            <div class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">${esc(docentesMap[e.name] || '')}</div>
                        </td>
                        <td class="px-6 py-4 text-center font-mono font-extrabold text-lg text-emerald-700">${fmt(e.timeSeconds)}</td>
                        <td class="px-6 py-4 text-center">
                            <button class="text-red-500 hover:text-red-700 hover:scale-125 transition-transform" onclick="deleteTime('${cat}',${e.id})">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        </td>
                    </tr>`;
                }).join('')}
                </tbody>
            </table>
        </div>`;
}

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
    const rows = [['Nombre del equipo','Categoria']];
    ['pequenos','mediano','grandes'].forEach(c => tournamentData[c].participants.forEach(p => rows.push([p,c])));
    ['seguimiento','evasor'].forEach(c => timeParticipants[c].forEach(p => rows.push([p,c])));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Respaldo_FIME');
    XLSX.writeFile(wb, 'respaldo_guerra_robots.xlsx');
};

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function escAttr(s) { return s.replace(/'/g,"\\'").replace(/"/g,'\\"'); }