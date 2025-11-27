#!/usr/bin/env node
/**
 * sru-tool.js — outil CLI pour manipuler fichiers CRU
 */

const fs = require('fs');
const path = require('path');
const { program } = require('commander');
const { parse } = require('csv-parse/sync');
const { v4: uuidv4 } = require('uuid');

// --- Data model ---
class Creneau {
    constructor(matiere, type, capacitaire, jour, heure_debut, heure_fin, sousgroupe, salle) {
        this.matiere = matiere;
        this.type = type;
        this.capacitaire = capacitaire;
        this.jour = jour;
        this.heure_debut = heure_debut; // "HH:MM"
        this.heure_fin = heure_fin;     // "HH:MM"
        this.sousgroupe = sousgroupe;
        this.salle = salle;
    }
}

// --- Parsing CRU ---
const CRU_LINE_RE = /^1,([^,]+),P=(\d+),H=([A-Z]+)\s+([0-9]{2}:[0-9]{2})-([0-9]{2}:[0-9]{2}),([^,]+),([^,\s]+)/;

function parseTime(str) {
    const [h,m] = str.split(':').map(Number);
    return {h,m};
}

function timeToMinutes(t) {
    return t.h*60 + t.m;
}

function minutesToTime(m) {
    return { h: Math.floor(m/60), m: m%60 };
}

function formatTime(t) {
    const pad = n => n.toString().padStart(2,'0');
    return `${pad(t.h)}:${pad(t.m)}`;
}

function formatPeriod(start, end) {
    return `${formatTime(start)}-${formatTime(end)}`;
}

function parseCRU(filepath) {
    const lines = fs.readFileSync(filepath, 'utf-8').split(/\r?\n/);
    let currentMatiere = null;
    const entries = [];

    for (const line of lines) {
        const l = line.trim();
        if (!l) continue;
        if (l.startsWith('+')) {
            currentMatiere = l.slice(1).trim();
            continue;
        }
        if (l.startsWith('1,')) {
            const m = l.match(CRU_LINE_RE);
            if (!m) continue;
            const type = m[1];
            const capacitaire = parseInt(m[2]);
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
const WEEK_DAYS = ['L','MA','ME','J','V'];
const WORK_START = {h:8,m:0};
const WORK_END = {h:20,m:0};

// --- SPEC functions ---
function sallesForCourse(cru, code_cours) {
    const mapping = {};
    cru.forEach(c => {
        if (c.matiere.includes(code_cours)) {
            if (!mapping[c.salle]) mapping[c.salle] = [];
            mapping[c.salle].push(`${c.jour} ${formatPeriod(c.heure_debut,c.heure_fin)}`);
        }
    });
    const result = Object.entries(mapping).map(([s,hs])=>[s, hs.sort()]);
    return result.sort((a,b)=>a[0].localeCompare(b[0]));
}

function capacityOfRoom(cru, room) {
    const caps = cru.filter(c => c.salle===room).map(c => c.capacitaire);
    return caps.length>0? Math.max(...caps):0;
}

// --- Free slots ---
function freeSlotsForRoom(cru, room) {
    const occupied = {};
    WEEK_DAYS.forEach(d => occupied[d]=[]);
    cru.forEach(c => {
        if (c.salle===room) {
            occupied[c.jour].push([timeToMinutes(c.heure_debut), timeToMinutes(c.heure_fin)]);
        }
    });

    const startMin = timeToMinutes(WORK_START);
    const endMin = timeToMinutes(WORK_END);
    const free = {};

    WEEK_DAYS.forEach(d => {
        const intervals = occupied[d].sort((a,b)=>a[0]-b[0]);
        let cursor = startMin;
        const frees = [];
        intervals.forEach(([a,b])=>{
            if (b<=cursor) return;
            if (a>cursor) frees.push([cursor,a]);
            cursor = Math.max(cursor,b);
        });
        if (cursor<endMin) frees.push([cursor,endMin]);
        free[d] = frees.map(([s,e])=>formatPeriod(minutesToTime(s), minutesToTime(e)));
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
    const rooms = [...new Set(cru.map(c=>c.salle))];
    const result = [];
    rooms.sort().forEach(room=>{
        const overlaps = cru.some(c=>c.salle===room && c.jour===jour && !(q_end <= timeToMinutes(c.heure_debut) || q_start>=timeToMinutes(c.heure_fin)));
        if (!overlaps) result.push(room);
    });
    return result;
}

// --- CLI ---
program
    .argument("<crufile>", "fichier CRU")
    .option("--cours <code>", "Rechercher salles d'un cours")
    .option("-c, --capaciteMax <salle>", "Récupérer capacité max d'une salle")
    .option("-s, --salle <salle>", "Afficher créneaux libres d'une salle")
    .option("--salleCreneau <creneau>", "Afficher salles libres pour créneau")
    .parse(process.argv);

const options = program.opts();
const crufile = program.args[0];

if (!fs.existsSync(crufile)) {
    console.error("Fichier CRU introuvable:", crufile);
    process.exit(2);
}

const cru = parseCRU(crufile);

if (options.cours) {
    const res = sallesForCourse(cru, options.cours);
    if (!res.length) console.log("Aucune salle trouvée pour le cours", options.cours);
    else {
        console.log(`Salles pour ${options.cours}:`);
        res.forEach(([s,hs])=>{
            console.log(` - ${s}:`);
            hs.forEach(h=>console.log(`    ${h}`));
        });
    }
    process.exit(0);
}

if (options.capaciteMax) {
    const c = capacityOfRoom(cru, options.capaciteMax);
    if (c===0) console.log("Aucune capacité trouvée pour la salle", options.capaciteMax);
    else console.log(`Capacité maximale pour ${options.capaciteMax}: ${c}`);
    process.exit(0);
}

if (options.salle) {
    const free = freeSlotsForRoom(cru, options.salle);
    console.log(`Créneaux libres pour ${options.salle} (plage 08:00-20:00):`);
    WEEK_DAYS.forEach(d=>{
        const slots = free[d];
        console.log(` ${d}: ${slots.length>0 ? slots.join(', ') : '(aucun créneau libre)'}`);
    });
    process.exit(0);
}

if (options.salleCreneau) {
    try {
        const rooms = roomsAvailableForCreneau(cru, options.salleCreneau);
        if (rooms.length) {
            console.log("Salles disponibles pour", options.salleCreneau);
            rooms.forEach(r=>console.log(" -", r));
        } else console.log("Aucune salle disponible pour ce créneau.");
    } catch(e) {
        console.error("Erreur:", e.message);
        process.exit(2);
    }
    process.exit(0);
}
