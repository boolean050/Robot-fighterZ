import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

const urlParams = new URLSearchParams(window.location.search);
const cat = urlParams.get('cat') || 'pequenos';
const isCarrera = cat === 'seguimiento' || cat === 'evasor';

let tournamentData = { participants: [], round1Matches: [], repechageMatches: [], laterRounds: [], puntosTotales: {} };
let tiempoCarreras = {};
let docentesMap = {};
let faseInicialCompletada = false; 

// 🔥 ESTADO DE VISTA PÚBLICA (Controla qué brackets está viendo el proyector)
window.currentPublicView = 'phase1';

document.addEventListener('DOMContentLoaded', () => {
    onSnapshot(collection(db, "competidores"), (snap) => {
        tournamentData.participants = [];
        snap.forEach(docSnap => {
            const c = docSnap.data();
            let cTag = (c.categoria_tag || c.categoria_original || c.categoria || '').toLowerCase();
            let targetTag = cat;
            if(cat === 'seguimiento' && cTag.includes('segui')) targetTag = cat;
            if(cat === 'evasor' && cTag.includes('evas')) targetTag = cat;

            if (cTag === targetTag || cTag.includes(targetTag.substring(0,4))) {
                tournamentData.participants.push(c.nombre);
                tournamentData.puntosTotales[c.nombre] = Number(c.puntos || c.puntaje || c.score || 0);
                docentesMap[c.nombre] = c.docente || c.facultad || 'Sin Asesor';
            }
        });
        if(isCarrera) renderTimeTable();
    });

    if (isCarrera) {
        onSnapshot(collection(db, "tiempos_carreras"), (snap) => {
            tiempoCarreras = {};
            snap.forEach(docT => {
                const t = docT.data();
                if ((cat === 'seguimiento' && t.categoria.toLowerCase().includes('seg')) || 
                    (cat === 'evasor' && t.categoria.toLowerCase().includes('eva'))) {
                    if (!tiempoCarreras[t.robot] || t.tiempo_segundos < tiempoCarreras[t.robot]) {
                        tiempoCarreras[t.robot] = t.tiempo_segundos;
                    }
                }
            });
            renderTimeTable();
        });
    } else {
        onSnapshot(doc(db, "brackets_estado", cat), (docSnap) => {
            if(!docSnap.exists()) return;
            const data = docSnap.data();
            tournamentData.round1Matches = data.round1Matches || [];
            tournamentData.repechageMatches = data.repechageMatches || [];
            tournamentData.laterRounds = data.laterRounds || [];
            tournamentData.champion = data.champion || null;
            tournamentData.byePlayer = data.byePlayer || null;
            
            let r1Done = tournamentData.round1Matches.length > 0 && tournamentData.round1Matches.every(m => m.winner !== null);
            let repDone = tournamentData.repechageMatches.length === 0 || tournamentData.repechageMatches.every(m => m.winner !== null);
            
            if (r1Done && repDone && !faseInicialCompletada) {
                faseInicialCompletada = true;
                lanzarPopUpFase1();
            } else if (!r1Done || !repDone) {
                faseInicialCompletada = false; 
                window.currentPublicView = 'phase1'; // Regresa a Fase 1 si el admin deshace un check
            }

            renderBracketsPublicos();
        });
    }
});

function lanzarPopUpFase1() {
    const pop = document.createElement('div');
    pop.className = "fixed inset-0 modal-overlay flex items-center justify-center bg-black/80";
    pop.innerHTML = `
        <div class="bg-white rounded-3xl shadow-2xl p-12 max-w-lg w-full text-center border-t-8 border-emerald-500 modal-content">
            <div class="text-[80px] mb-6 animate-bounce">🏆</div>
            <h2 class="text-4xl font-black text-emerald-800 uppercase tracking-tighter mb-4">¡Fase Superada!</h2>
            <p class="text-gray-600 font-bold text-xl uppercase tracking-widest">Las Eliminatorias han comenzado</p>
        </div>
    `;
    document.body.appendChild(pop);
    setTimeout(() => { pop.remove(); }, 8000); 
}

// 🔥 FUNCIÓN PARA CAMBIAR MANUALMENTE LA VISTA DEL PROYECTOR
window.cambiarVistaPublica = function(vista) {
    window.currentPublicView = vista;
    renderBracketsPublicos();
};

function renderBracketsPublicos() {
    const container = document.getElementById('proyeccion-root');
    // Decide qué fase mostrar basado en el ESTADO MANUAL, no automático
    const showingPhase2 = window.currentPublicView === 'phase2';

    let html = `
    <div class="flex-grow h-screen overflow-auto bg-gray-50 p-8 relative">
        <div class="absolute top-4 left-8 z-50 bg-white/90 backdrop-blur px-6 py-2 rounded-full border border-gray-200 shadow-sm">
            <h1 class="text-emerald-800 font-black tracking-widest uppercase text-sm">⚔️ Torneo: ${cat}</h1>
        </div>
        <div class="bracket-wrapper min-w-max justify-center pt-16 ${showingPhase2 ? 'phase-2-tree' : ''}">`;

    if (!showingPhase2) {
        const r1Total = tournamentData.round1Matches.length;
        const halfR1 = Math.ceil(r1Total / 2);
        const leftR1 = tournamentData.round1Matches.slice(0, halfR1);
        const rightR1 = tournamentData.round1Matches.slice(halfR1);

        html += `<div class="bracket-col"><h4 class="absolute -top-10 w-full text-center text-[11px] font-black text-emerald-800 uppercase tracking-widest border-b-2 border-emerald-100 pb-2">Ronda 1</h4>`;
        leftR1.forEach(m => { html += renderMatchReadonly(m, 'round1'); });
        html += `</div>`;

        if (tournamentData.repechageMatches.length > 0) {
            html += `<div class="bracket-col px-8 mx-4 border-x-2 border-dashed border-gray-200 bg-gray-50/50 rounded-3xl pb-8"><h4 class="absolute -top-10 w-full text-center text-[11px] font-black text-emerald-800 uppercase tracking-widest border-b-2 border-emerald-100 pb-2">Repechaje</h4>`;
            tournamentData.repechageMatches.forEach(m => { html += renderMatchReadonly(m, 'repechage'); });
            html += `</div>`;
        }

        if (rightR1.length > 0) {
            html += `<div class="bracket-col"><h4 class="absolute -top-10 w-full text-center text-[11px] font-black text-emerald-800 uppercase tracking-widest border-b-2 border-emerald-100 pb-2">Ronda 1</h4>`;
            rightR1.forEach(m => { html += renderMatchReadonly(m, 'round1'); });
            html += `</div>`;
        }
    } else {
        const roundTitles = ["Ronda 2", "Octavos", "Cuartos", "Semifinal"];
        const totalRounds = tournamentData.laterRounds.length;
        
        for (let rIdx = 0; rIdx < totalRounds - 1; rIdx++) {
            let matches = tournamentData.laterRounds[rIdx].matches;
            let leftMatches = matches.slice(0, matches.length / 2);
            let titleIndex = roundTitles.length - (totalRounds - 1 - rIdx);
            html += `<div class="bracket-col col-left"><h4 class="absolute -top-10 w-full text-center text-[11px] font-black text-emerald-800 uppercase tracking-widest border-b-2 border-emerald-100 pb-2">${titleIndex >= 0 ? roundTitles[titleIndex] : `Ronda ${rIdx + 2}`}</h4>`;
            leftMatches.forEach(m => { html += renderMatchReadonly(m, 'laterRounds'); });
            html += `</div>`;
        }

        html += `<div class="bracket-col justify-center px-8 mx-4 border-x-2 border-dashed border-gray-200 bg-gray-50/30 rounded-3xl pb-8">
                 <h4 class="absolute -top-10 w-full text-center text-[11px] font-black text-amber-600 uppercase tracking-widest border-b-2 border-amber-200 pb-2">Gran Final</h4>`;
        html += renderMatchReadonly(tournamentData.laterRounds[totalRounds - 1].matches[0], 'laterRounds');
        
        if (tournamentData.champion) {
            html += `<div class="mt-8 bg-gradient-to-br from-emerald-500 to-emerald-700 border-4 border-emerald-300 rounded-xl p-8 shadow-2xl text-center transform scale-110 w-[260px] animate-pulse mx-auto">
                        <h4 class="text-[10px] font-black text-emerald-100 uppercase tracking-widest mb-3">🏆 Campeón</h4>
                        <div class="text-2xl font-black text-white drop-shadow-md mb-2">${esc(tournamentData.champion)}</div>
                        <div class="text-[9px] font-bold text-emerald-200 pt-3 border-t border-emerald-400 uppercase tracking-wider">${esc(docentesMap[tournamentData.champion])}</div>
                     </div>`;
        }
        html += `</div>`;

        for (let rIdx = totalRounds - 2; rIdx >= 0; rIdx--) {
            let matches = tournamentData.laterRounds[rIdx].matches;
            let rightMatches = matches.slice(matches.length / 2);
            let titleIndex = roundTitles.length - (totalRounds - 1 - rIdx);
            html += `<div class="bracket-col col-right"><h4 class="absolute -top-10 w-full text-center text-[11px] font-black text-emerald-800 uppercase tracking-widest border-b-2 border-emerald-100 pb-2">${titleIndex >= 0 ? roundTitles[titleIndex] : `Ronda ${rIdx + 2}`}</h4>`;
            rightMatches.forEach(m => { html += renderMatchReadonly(m, 'laterRounds'); });
            html += `</div>`;
        }
    }

    html += `</div></div>`;
    html += renderSidebarPuntajes();
    container.innerHTML = html;
}

function renderMatchReadonly(match, phase) {
    const renderRow = (player, isNullRow) => {
        if (!player) return `<div class="player-row bg-gray-50 text-gray-400"><div class="player-info"><span class="player-name">TBD</span></div><span class="score-box text-gray-300">?</span></div>`;
        const isWinner = match.winner === player;
        const isLoser = match.winner !== null && match.winner !== player;
        const isImpar = phase === 'repechage' && player === tournamentData.byePlayer;
        
        let rc = isWinner ? (phase==='repechage'?'winner-rep':'winner') : (isLoser ? 'opacity-40 grayscale bg-red-50/30' : (isImpar ? 'bg-orange-50' : ''));
        let nc = isImpar ? 'text-orange-700' : '';
        let dc = isImpar ? 'text-orange-500' : '';
        const icon = isWinner ? '✓' : (isLoser ? '❌' : '');
        
        return `<div class="player-row ${rc} relative cursor-default">
                    <div class="player-info">
                        <span class="player-name ${isLoser?'line-through':''} ${nc}">${esc(player)} ${isImpar?'<span class="text-[9px] font-black text-orange-400">(IMPAR)</span>':''}</span>
                        <span class="docente-text ${dc}">${esc(docentesMap[player] || 'Sin Asesor')}</span>
                    </div>
                    <span class="score-box border border-gray-200/50">${icon}</span>
                </div>`;
    };
    return `<div class="match-container"><div class="match-card">${renderRow(match.player1, match.player1===null)}${renderRow(match.player2, match.player2===null)}</div></div>`;
}

function renderSidebarPuntajes() {
    let scores = {};
    tournamentData.participants.forEach(p => scores[p] = tournamentData.puntosTotales[p] || 0);
    let ranking = Object.keys(scores).map(name => ({ name, score: scores[name] })).sort((a,b) => b.score - a.score);

    let html = `<div class="w-[400px] flex-shrink-0 bg-white shadow-[-10px_0_20px_rgba(0,0,0,0.05)] border-l border-gray-200 p-6 flex flex-col z-10 h-screen relative">
                <h2 class="text-2xl font-black text-center text-gray-800 mb-6 uppercase tracking-tighter pb-4 border-b-2 border-gray-100">🏆 General</h2>
                <div class="flex-grow overflow-y-auto flex flex-col gap-3 pr-2">`;
    
    ranking.forEach((r, idx) => {
        let m = idx === 0 && r.score>0 ? '🥇' : idx === 1 && r.score>0 ? '🥈' : idx === 2 && r.score>0 ? '🥉' : `${idx+1}`;
        html += `<div class="w-full bg-white border border-gray-100 rounded-xl p-3 flex justify-between items-center shadow-sm">
                    <div class="flex items-center gap-3">
                        <span class="text-lg font-black w-6 text-center ${idx<3?'text-amber-500':'text-gray-300'}">${m}</span>
                        <div class="flex flex-col">
                            <span class="font-bold text-sm text-gray-800 uppercase tracking-tight">${esc(r.name)}</span>
                            <span class="text-[9px] text-gray-400 font-bold uppercase">${esc(docentesMap[r.name] || 'Sin Asesor')}</span>
                        </div>
                    </div>
                    <div class="font-black text-emerald-600 text-xl">${r.score}</div>
                 </div>`;
    });
    html += `</div>`; // Cierra la lista de ranking

    // 🔥 INYECCIÓN DE LOS BOTONES DE TRANSICIÓN AL FINAL DE LA TABLA
    const r1Done = tournamentData.round1Matches.length > 0 && tournamentData.round1Matches.every(m => m.winner !== null);
    const repDone = tournamentData.repechageMatches.length === 0 || tournamentData.repechageMatches.every(m => m.winner !== null);
    const hasPhase2 = tournamentData.laterRounds && tournamentData.laterRounds.length > 0;

    if (window.currentPublicView === 'phase1' && r1Done && repDone && hasPhase2) {
        // Botón para ir a Eliminatorias
        html += `
        <button onclick="cambiarVistaPublica('phase2')" class="mt-6 bg-amber-500 hover:bg-amber-600 text-white w-full py-4 rounded-xl font-extrabold text-sm uppercase tracking-widest shadow-md flex items-center justify-center gap-2 transition-transform active:scale-95">
            🏆 Ir a Eliminatorias
        </button>`;
    } else if (window.currentPublicView === 'phase2') {
        // Botón Minimalista Clon para regresar a Fase Inicial
        html += `
        <button onclick="cambiarVistaPublica('phase1')" class="mt-6 bg-white hover:bg-gray-50 border border-gray-200 text-gray-600 w-full py-4 rounded-full font-bold shadow-md hover:shadow-lg transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Regresar a Brackets Fase Inicial
        </button>`;
    }

    return html + `</div>`;
}

function renderTimeTable() {
    const container = document.getElementById('proyeccion-root');
    let title = cat === 'seguimiento' ? '🏎️ SEGUIMIENTO DE LÍNEA' : '🧭 EVASOR DE OBSTÁCULOS';
    
    let res = tournamentData.participants.map(eq => ({ name: eq, time: tiempoCarreras[eq] || null }));
    res.sort((a, b) => {
        if(a.time === null && b.time === null) return 0;
        if(a.time === null) return 1;
        if(b.time === null) return -1;
        return a.time - b.time;
    });

    let html = `<div class="w-full h-screen bg-gray-50 overflow-y-auto p-12">
                <h2 class="text-5xl font-black text-emerald-800 uppercase tracking-tighter text-center mb-12">${title}</h2>
                <div class="max-w-5xl mx-auto bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden">
                <table class="w-full text-left">
                    <thead class="bg-emerald-800 text-white"><tr><th class="py-6 px-10 font-black uppercase text-lg">Equipos</th><th class="py-6 px-10 font-black uppercase text-lg text-right">Tiempos Oficiales</th></tr></thead>
                    <tbody class="divide-y divide-gray-100">`;
    
    res.forEach((r, idx) => {
        let tText = '--:--:--';
        if (r.time) {
            let m = Math.floor(r.time / 60).toString().padStart(2, '0');
            let s = Math.floor(r.time % 60).toString().padStart(2, '0');
            let ms = Math.floor((r.time % 1) * 100).toString().padStart(2, '0');
            tText = `${m}:${s}:${ms}`;
        }
        let med = r.time ? (idx===0?'🥇':idx===1?'🥈':idx===2?'🥉':`${idx+1}.`) : '';
        html += `<tr class="${idx%2===0?'bg-white':'bg-gray-50/50'}">
                    <td class="py-6 px-10"><div class="font-extrabold text-gray-800 uppercase text-2xl flex items-center gap-4"><span class="text-3xl text-amber-500 w-8 text-center">${med}</span> ${esc(r.name)}</div></td>
                    <td class="py-6 px-10 text-right"><span class="font-mono font-black text-4xl ${r.time?'text-emerald-600':'text-gray-300'}">${tText}</span></td>
                 </tr>`;
    });
    container.innerHTML = html + `</tbody></table></div></div>`;
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }