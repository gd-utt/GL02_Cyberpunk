#!/usr/bin/env node

const fs = require("fs");
const { program } = require("commander");

program
    .argument("<file>", "fichier .cru")
    .option("--cours <type>", "filtrer par type de cours (CM, TD, TP)")
    .option("--matiere <name>", "filtrer par matière (GL02, GL03...)")
    .option("--salle <room>", "filtrer par salle (C006, C007...)")
    .parse(process.argv);

const options = program.opts();
const cruFile = program.args[0];

/* ------------------ PARSE ------------------ */

function parseCRU(path) {
    const text = fs.readFileSync(path, "utf8").replace(/\r/g, "");
    const lines = text.split("\n");

    let currentMatiere = null;
    let entries = [];

    for (let raw of lines) {
        const line = raw.trim();
        if (!line) continue;

        // Nouveau bloc matière : +GL02
        if (line.startsWith("+")) {
            currentMatiere = line.substring(1).trim();
            continue;
        }

        // Ligne de cours
        if (line.startsWith("1,")) {
            const clean = line.replace(/\/\/$/, "");

            // structure : 1,CM,P=30,H=L H=08:00-10:00,1,C006
            const parts = clean.split(",");

            const type = parts[1].trim();           // CM
            const capacitaire = Number(parts[2].split("=")[1]);

            // H=L H=08:00-10:00
            const h = parts[3].substring(2).trim().split(" ");
            const jour = h[0];                     // L
            const heures = h[1].split("-");
            const h1 = heures[0];                  // 08:00
            const h2 = heures[1];                  // 10:00

            const salle = parts[5].trim();         // C006

            entries.push({
                matiere: currentMatiere,
                type,
                capacitaire,
                jour,
                h1,
                h2,
                salle
            });
        }
    }

    return entries;
}

/* ------------------ EXECUTION ------------------ */

const data = parseCRU(cruFile);

// Filtrage
let result = data;

if (options.cours) {
    result = result.filter(e => e.type.toUpperCase() === options.cours.toUpperCase());
}

if (options.matiere) {
    result = result.filter(e => e.matiere.toUpperCase() === options.matiere.toUpperCase());
}

if (options.salle) {
    result = result.filter(e => e.salle.toUpperCase() === options.salle.toUpperCase());
}

if (result.length === 0) {
    console.log("Aucun cours trouvé selon les critères.");
    process.exit(0);
}

console.log("Cours trouvés :");
for (let e of result) {
    console.log(
        ` ${e.matiere} | ${e.type} | ${e.jour} ${e.h1}-${e.h2} | Salle ${e.salle} | Cap=${e.capacitaire}`
    );
}
