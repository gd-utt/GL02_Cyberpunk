#!/usr/bin/env node
/**
 * sru-tool.js — outil CLI pour manipuler fichiers CRU
 *
 * Modifié : ajoute verifyNoOverlap, generateOccupationCSV, rankByCapacity
 */

const fs = require('fs');
const path = require('path');
const { program } = require('commander');

// --- Data model ---
class Creneau {
    constructor(matiere, type, capacitaire, jour, heure_debut, heure_fin, sousgroupe, salle) {
        this.matiere = matiere;
        this.type = type;
        this.capacitaire = capacitaire;
        this.jour = jour;
        this.heure_debut = heure_debut; // {h,m}
        this.heure_fin = heure_fin;     // {h,m}
        this.sousgroupe = sousgroupe;
        this.salle = salle;
    }
}

// --- Parsing CRU ---
const CRU_LINE_RE = /^1,([^,]+),P=(\d+),H=([A-Z]+)\s+([0-9]{2}:[0-9]{2})-([0-9]{2}:[0-9]{2}),([^,]+),([^,\s]+)/;

function parseTime(str) {
    const [h, m] = str.split(':').map(Number);
    return { h, m };
}

function timeToMinutes(t) {
    if (typeof t === 'number') return t;
    return t.h * 60 + t.m;
}

function minutesToTime(m) {
    return { h: Math.floor(m / 60), m: m % 60 };
}

function formatTime(t) {
    const pad = n => n.toString().padStart(2, '0');
    return `${pad(t.h)}:${pad(t.m)}`;
}

function formatPeriod(start, end) {
    return `${formatTime(start)}-${formatTime(end)}`;
}

function parseCRU(filepath) {
    const content = fs.readFileSync(filepath, 'utf-8');
    const lines = content.split(/\r?\n/);
    let currentMatiere = null;
    const entries = [];

    for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;
        if (line.startsWith('+')) {
            currentMatiere = line.slice(1).trim();
            continue;
        }
        if (line.startsWith('1,')) {
            const m = line.match(CRU_LINE_RE);
            if (!m) continue;
            const type = m[1];
            const capacitaire = parseInt(m[2], 10);
            const jour = m[3];
            const h1 = parseTime(m[4]);
            const h2 = parseTime(m[5]);
            const sousgroupe = m[6];
            const salle = m[7];
            const matiere = currentMatiere || "UNKNOWN";
            entries.push(new Creneau(matiere, type, capacitaire, jour, h1, h2, sousgroupe, salle));
        }
    }
    return entries;
}

// --- SPEC utilities ---
const WEEK_DAYS = ['L', 'MA', 'ME', 'J', 'V'];
const WORK_START = { h: 8, m: 0 };
const WORK_END = { h: 20, m: 0 };

// --- SPEC functions ---
function sallesForCourse(cru, code_cours) {
    const mapping = {};
    cru.forEach(c => {
        // match code anywhere in matiere (as tests expect)
        if (String(c.matiere).includes(code_cours)) {
            if (!mapping[c.salle]) mapping[c.salle] = [];
            mapping[c.salle].push(`${c.jour} ${formatPeriod(c.heure_debut, c.heure_fin)}`);
        }
    });
    const result = Object.entries(mapping).map(([s, hs]) => [s, hs.sort()]);
    return result.sort((a, b) => a[0].localeCompare(b[0]));
}

function capacityOfRoom(cru, room) {
    const caps = cru.filter(c => c.salle === room).map(c => c.capacitaire);
    return caps.length > 0 ? Math.max(...caps) : 0;
}

// --- Free slots ---
function freeSlotsForRoom(cru, room) {
    const occupied = {};
    WEEK_DAYS.forEach(d => occupied[d] = []);
    cru.forEach(c => {
        if (c.salle === room) {
            occupied[c.jour] = occupied[c.jour] || [];
            occupied[c.jour].push([timeToMinutes(c.heure_debut), timeToMinutes(c.heure_fin)]);
        }
    });

    const startMin = timeToMinutes(WORK_START);
    const endMin = timeToMinutes(WORK_END);
    const free = {};

    WEEK_DAYS.forEach(d => {
        const intervals = (occupied[d] || []).slice().sort((a, b) => a[0] - b[0]);
        let cursor = startMin;
        const frees = [];
        intervals.forEach(([a, b]) => {
            if (b <= cursor) return;
            if (a > cursor) frees.push([cursor, a]);
            cursor = Math.max(cursor, b);
        });
        if (cursor < endMin) frees.push([cursor, endMin]);
        free[d] = frees.map(([s, e]) => formatPeriod(minutesToTime(s), minutesToTime(e)));
    });
    return free;
}

// --- Rooms available ---
function roomsAvailableForCreneau(cru, query) {
    const m = query.match(/([A-Z]+)\s+H?=?\s*([0-9]{2}:[0-9]{2})-([0-9]{2}:[0-9]{2})/);
    if (!m) throw new Error("Format du créneau invalide. Ex: 'L H=09:00-11:00'");
    const jour = m[1];
    const q_start = timeToMinutes(parseTime(m[2]));
    const q_end = timeToMinutes(parseTime(m[3]));
    const rooms = [...new Set(cru.map(c => c.salle))];
    const result = [];
    rooms.sort().forEach(room => {
        const overlaps = cru.some(c => c.salle === room && c.jour === jour && !(q_end <= timeToMinutes(c.heure_debut) || q_start >= timeToMinutes(c.heure_fin)));
        if (!overlaps) result.push(room);
    });
    return result;
}

// --- Verify overlaps ---
// Return array of violations: each is {salle, jour, a: {debut,fin,mat}, b: {...}}
function verifyNoOverlap(cru) {
    const byRoomDay = {};
    cru.forEach(c => {
        const key = `${c.salle}__${c.jour}`;
        byRoomDay[key] = byRoomDay[key] || [];
        byRoomDay[key].push(c);
    });
    const violations = [];
    for (const key of Object.keys(byRoomDay)) {
        const items = byRoomDay[key].slice().sort((x, y) => timeToMinutes(x.heure_debut) - timeToMinutes(y.heure_debut));
        for (let i = 0; i < items.length; i++) {
            const a = items[i];
            for (let j = i + 1; j < items.length; j++) {
                const b = items[j];
                // overlap if a.start < b.end && a.end > b.start
                const aStart = timeToMinutes(a.heure_debut);
                const aEnd = timeToMinutes(a.heure_fin);
                const bStart = timeToMinutes(b.heure_debut);
                const bEnd = timeToMinutes(b.heure_fin);
                if ((aStart < bEnd) && (aEnd > bStart)) {
                    violations.push({
                        salle: a.salle,
                        jour: a.jour,
                        a: {
                            matiere: a.matiere,
                            debut: formatPeriod(a.heure_debut, a.heure_fin)
                        },
                        b: {
                            matiere: b.matiere,
                            debut: formatPeriod(b.heure_debut, b.heure_fin)
                        }
                    });
                }
            }
        }
    }
    return violations;
}

// --- Generate occupation CSV ---
// CSV columns: salle,minutes_occupées,minutes_total,taux_occupation (0-1)
function generateOccupationCSV(cru, outDir = 'data') {
    // compute for each room total occupied minutes within WORK_START..WORK_END across week (sum days)
    const rooms = [...new Set(cru.map(c => c.salle))].sort();
    const startMin = timeToMinutes(WORK_START);
    const endMin = timeToMinutes(WORK_END);
    const dayWindow = endMin - startMin;
    const totalWindow = dayWindow * WEEK_DAYS.length;

    const occupancy = {};
    rooms.forEach(r => occupancy[r] = 0);

    // For each room and day, merge intervals then sum
    WEEK_DAYS.forEach(d => {
        const byRoom = {};
        cru.forEach(c => {
            if (c.jour !== d) return;
            byRoom[c.salle] = byRoom[c.salle] || [];
            // clamp to working window
            const s = Math.max(startMin, timeToMinutes(c.heure_debut));
            const e = Math.min(endMin, timeToMinutes(c.heure_fin));
            if (e > s) byRoom[c.salle].push([s, e]);
        });
        Object.keys(byRoom).forEach(room => {
            const intervals = byRoom[room].slice().sort((a, b) => a[0] - b[0]);
            let merged = [];
            intervals.forEach(iv => {
                if (!merged.length) merged.push(iv.slice());
                else {
                    const last = merged[merged.length - 1];
                    if (iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1]);
                    else merged.push(iv.slice());
                }
            });
            const minutes = merged.reduce((acc, [s, e]) => acc + (e - s), 0);
            occupancy[room] = (occupancy[room] || 0) + minutes;
        });
    });

    // Ensure outDir exists
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }
    const outFile = path.join(outDir, 'occupation.csv');
    const header = 'salle,minutes_occupees,minutes_total,taux_occupation\n';
    const lines = [header];
    rooms.forEach(r => {
        const minutes_occ = occupancy[r] || 0;
        const taux = (totalWindow === 0) ? 0 : (minutes_occ / totalWindow);
        lines.push(`${r},${minutes_occ},${totalWindow},${taux.toFixed(6)}\n`);
    });
    fs.writeFileSync(outFile, lines.join(''), 'utf-8');
    return outFile;
}

// --- Rank by capacity ---
function rankByCapacity(cru) {
    const capsByRoom = {};
    cru.forEach(c => {
        capsByRoom[c.salle] = Math.max(capsByRoom[c.salle] || 0, c.capacitaire || 0);
    });
    const arr = Object.entries(capsByRoom).map(([salle, cap]) => ({ salle, cap }));
    arr.sort((a, b) => b.cap - a.cap || a.salle.localeCompare(b.salle));
    // Return as array of [salle, cap] to be simple for tests
    return arr.map(x => [x.salle, x.cap]);
}

// --- CLI ---
program
    .argument("<crufile>", "fichier CRU")
    .option("--cours <code>", "Rechercher salles d'un cours")
    .option("-c, --capaciteMax <salle>", "Récupérer capacité max d'une salle")
    .option("-s, --salle <salle>", "Afficher créneaux libres d'une salle")
    .option("--salleCreneau <creneau>", "Afficher salles libres pour créneau")
    .option("-v, --verif", "Vérifier chevauchements")
    .option("-g, --genererSynthetique", "Générer CSV taux d'occupation")
    .option("--rank-capacity", "Classer les salles par capacité")
    .option("--ical <code> <dateDebut> <dateFin>", "Générer .ics pour un cours entre deux dates") // placeholder: not fully implemented in this file
    .parse(process.argv);

const options = program.opts();
const crufile = program.args[0];

if (!fs.existsSync(crufile)) {
    console.error("Fichier CRU introuvable:", crufile);
    // If script used as module, throw; but since CLI, exit.
    if (require.main === module) process.exit(2);
    else throw new Error(`Fichier CRU introuvable: ${crufile}`);
}

const cru = parseCRU(crufile);

// CLI behaviors (keep existing ones)
if (options.cours) {
    const res = sallesForCourse(cru, options.cours);
    if (!res.length) console.log("Aucune salle trouvée pour le cours", options.cours);
    else {
        console.log(`Salles pour ${options.cours}:`);
        res.forEach(([s, hs]) => {
            console.log(` - ${s}:`);
            hs.forEach(h => console.log(`    ${h}`));
        });
    }
    if (require.main === module) process.exit(0);
}

if (options.capaciteMax) {
    const c = capacityOfRoom(cru, options.capaciteMax);
    if (c === 0) console.log("Aucune capacité trouvée pour la salle", options.capaciteMax);
    else console.log(`Capacité maximale pour ${options.capaciteMax}: ${c}`);
    if (require.main === module) process.exit(0);
}

if (options.salle) {
    const free = freeSlotsForRoom(cru, options.salle);
    console.log(`Créneaux libres pour ${options.salle} (plage 08:00-20:00):`);
    WEEK_DAYS.forEach(d => {
        const slots = free[d];
        console.log(` ${d}: ${slots.length > 0 ? slots.join(', ') : '(aucun créneau libre)'}`);
    });
    if (require.main === module) process.exit(0);
}

if (options.salleCreneau) {
    try {
        const rooms = roomsAvailableForCreneau(cru, options.salleCreneau);
        if (rooms.length) {
            console.log("Salles disponibles pour", options.salleCreneau);
            rooms.forEach(r => console.log(" -", r));
        } else console.log("Aucune salle disponible pour ce créneau.");
    } catch (e) {
        console.error("Erreur:", e.message);
        if (require.main === module) process.exit(2);
    }
    if (require.main === module) process.exit(0);
}

if (options.verif) {
    const viol = verifyNoOverlap(cru);
    if (!viol.length) console.log("Aucun chevauchement détecté.");
    else {
        console.log("Chevauchements détectés :");
        viol.forEach(v => {
            console.log(` - Salle ${v.salle} (${v.jour}): ${v.a.matiere} ${v.a.debut} <-> ${v.b.matiere} ${v.b.debut}`);
        });
    }
    if (require.main === module) process.exit(0);
}

if (options.genererSynthetique) {
    const out = generateOccupationCSV(cru, 'data');
    console.log(`CSV d'occupation généré : ${out}`);
    if (require.main === module) process.exit(0);
}

if (options.rankCapacity || options.rankCapacity === true || options['rank-capacity']) {
    const ranking = rankByCapacity(cru);
    console.log("Classement des salles par capacité (salle — capacité) :");
    ranking.forEach(([s, c]) => console.log(` - ${s} — ${c}`));
    if (require.main === module) process.exit(0);
}

// If no option, show help
if (process.argv.length <= 2 && require.main === module) {
    program.help();
}

// --- Exports for tests / programmatic use ---
module.exports = {
    parseCRU,
    sallesForCourse,
    capacityOfRoom,
    freeSlotsForRoom,
    roomsAvailableForCreneau,
    verifyNoOverlap,
    generateOccupationCSV,
    rankByCapacity
};