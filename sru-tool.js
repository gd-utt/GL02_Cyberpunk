#!/usr/bin/env node

const fs = require("fs");
const { program } = require("commander");
//const vega = require("vega");
//const vegaLite = require("vega-lite");
const { url } = require("inspector");

program
    .argument("<file>", "fichier .cru")
    .option("--cours <type>", "Affiche la salle associe a un cours (CM, TD, TP)")
    .option("-s ,--salle <salle>", "Affiche les dates pour lesquelles une salle est libre ")
    .option("-sc ,--salleCreneau <creneau>", "Affiche les salle qui sont libres a un creneau donne (jour/HeureDebut/HeureFin) Format heure xx:xx")
    .option("-c, --capaciteMax <salle>", "Affiche la capacite maximale d'une salle donnee")
    .option("-v, --verif", "Verifie si le cru est coherent dans les planning")
    .option("-g, --genererSynthetic", "Donne un visuel synthetic de l'usage de chaque classe")
    .option("-cl, --classement", "Classe les salles selon leur capacite maximale")
    .option("-ical, --iCalendar <course> <date_debut> <date_fin>", "Générer un fichier iCalendar (RFC 5545) entre deux dates données pour un enseignement")
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

/* ------------------ CLASSEUR ------------------ */
function classeur(table){
    const mapOrdre = new Map();
    odreJour = ["L", "MA", "ME", "J", "V"];
    odreJour.forEach((jour, i) => {
        mapOrdre.set(jour,i);
    });
    table.sort((j1, j2) => {
        const i1 = mapOrdre.get(j1['jour']);
        const i2 = mapOrdre.get(j2['jour']);
        return i1-i2;
    });
}

/* ------------------ CHIFFREUR ------------------ */
function toNumber(horaire) {
            return parseInt(horaire.replace(/\D/g, ""));
        }

/* ------------------ TRANSFORMERS ------------------ */
function optimusPrime(table, enTete){
    enTete.join(',');
    const lignes = table.map(s => {
        return s.join(',');
    });
    return [enTete, ...lignes].join('\n');
}

/* ------------------ PHOTOSHOP ------------------ */
async function Vegashop(vegaprint, cheminFichePng) {
    const { compile } = await import("vega-lite");
    const vega = await import("vega");
    const canvas = await import("canvas");
    const vegaSpec = compile(vegaprint).spec;
    const view = new vega.View(vega.parse(vegaSpec),{renderer: "none"});
    await view.runAsync();
    const canvasResult = await view.toCanvas(1, { type: "png", context: { canvas: canvas.createCanvas } });
    const buffer = canvasResult.toBuffer("image/png");
    fs.writeFileSync(cheminFichePng, buffer);
}

/* ------------------ EXECUTION ------------------ */

const data = parseCRU(cruFile);

// Filtrage
let result = data;

if (options.cours) {
    result = result.filter(e => e.type.toUpperCase() === options.cours.toUpperCase());
    if (result.length === 0) {
        console.log("Aucun cours trouvé selon le critère.");
        process.exit(0);
    }else{
        console.log(`Les salles occupees par un ${options.cours.toUpperCase()} sont : `);
        //classe les salles selon le jour 
       classeur(result);
        for (let e of result) {
            console.log(
                ` Salle ${e.salle} | ${e.jour} ${e.h1}-${e.h2} | ${e.matiere}`
            );
        }
    }
    
}

if (options.capaciteMax) {
    //expliquez moi pourquoi une salle a des capacites differentes
    result = result.filter(e => e.salle.toUpperCase() === options.capaciteMax.toUpperCase());
    if (result.length === 0) {
        console.log("La salle n'a pas ete trouvee ");
        process.exit(0);
    }
    else{
        const capMax = result.reduce((max, sCap) => {
            const valSalle = sCap['capacitaire'];
            return Math.max(max, valSalle);
        }, -Infinity);
        console.log(`La capicite max de la salle ${options.capaciteMax.toUpperCase()} est : ${capMax}`);
    }
}

if (options.salle){
    result = result.filter(e => (e.matiere.toUpperCase() === "LIBRE") && (e.salle.toUpperCase() == options.salle.toUpperCase()));
    if (result.length === 0) {
        console.log("Aucune salle n'est libre pour le moment");
        process.exit(0);
    }else{
        console.log(`La salle ${options.salle.toUpperCase()} est libre aux horaires suivants :  `);
        for (let e of result) {
            console.log(
                ` ${e.jour} ${e.h1}-${e.h2} | Capacité=${e.capacitaire}`
            );
        }
    }
}

if (options.salleCreneau) {
    result = result.filter(e => (e.matiere.toUpperCase() === "LIBRE"));
    if (result.length === 0) {
        console.log("Aucune salle n'est libre");
    }
    else {
        const creneau = options.salleCreneau.split("/");

        if (toNumber(creneau[1]) >= toNumber(creneau[2])){
            console.log("Horaires invalides");
            process.exit(0);
        }

        const try1 = result.filter(e => (toNumber(e.h1) <= toNumber(creneau[1]) && toNumber(e.h2) >= toNumber(creneau[2]) && creneau[0].toUpperCase() === e.jour.toUpperCase()));
        if (try1.length === 0) {
            console.log("Aucune salle n'est libre");
        } else {
            console.log("Les salles libres sont : ");
            for (let e of try1) {
                console.log(
                    `${e.salle} | ${e.jour} ${e.h1}-${e.h2} | Cap=${e.capacitaire}`
                );
            }
        }
    }
}

if (options.verif){
        classeur(result);
        let i = 0;
        let conflictCount =0;
        for(let e of result){
            if(toNumber(e.h1) >= toNumber(e.h2)){
                conflictCount++;
                console.log(`Horaire invalide pour ${mat2} le ${e.jour}`);
            }
            for(let j = 0; j < result.length; j++){
                if(i <= j){
                    continue;
                }
                if(e.jour == result[j].jour){
                    if(e.salle === result[j].salle){
                        if((toNumber(e.h1) >= toNumber(result[j].h1)) && (toNumber(e.h1) < toNumber(result[j].h2)) && (toNumber(e.h2) <= toNumber(result[j].h2) || toNumber(e.h2) >= toNumber(result[j].h2) ) ){
                            conflictCount++;
                            let mat1;
                            let mat2;
                            if(e.matiere.toUpperCase() == "LIBRE"){
                                mat1 = "'Horaire libre'";
                            }else{
                                mat1 = e.matiere;
                            }
                            if(result[j].matiere.toUpperCase() == "LIBRE"){
                                mat2 = "'Horaire libre'";
                            }else{
                                mat2 = result[j].matiere;
                            }
                            console.log(`Conflict de programme entre ${mat1}(${e.type}) et ${mat2}(${result[j].type}) le ${e.jour} ${e.h1}-${e.h2} `);
                        }
                    }
                }else{
                    break;
                } 
            }
            i++;
        }
        if(conflictCount == 0){
                console.log("Le fichier est correct");
        }else{
                console.log("Nombre total de conflict rencontre : " + conflictCount);
        }
    }

    if(options.genererSynthetic){
        const nbr = result.length;
        const salleUseCount = result.reduce((acc, cur) =>{
            const salle = cur.salle;
            acc.set(salle, (acc.get(salle) || 0)+1);
            return acc;
        }, new Map());
        const salleUseTaux = new Map();
        for([salle, count] of salleUseCount){
            const taux = (count/nbr)*100;
            salleUseTaux.set(salle, taux.toFixed(2));
        }
        const enTete = ["Salle", "Taux"];
        const contenuCSV = optimusPrime(Array.from(salleUseTaux),enTete);
        const instant = new Date();
        const cheminFicheCSV = `./fiche_synthetic_${instant.getMonth() + 1}_${instant.getFullYear()}.csv`;
        fs.writeFileSync(cheminFicheCSV, contenuCSV, "utf8");
        const vegaprint ={
            $schema: "https://vega.github.io/schema/vega-lite/v5.json",
            description: "Usage des salles",
            data: { url: cheminFicheCSV },
            mark: "bar",
            encoding: {
                y: {field:"Salle", type:"nominal"},
                x: {field:"Taux", type:"quantitative"},
                color: {field:"Salle", type:"nominal"}
            }
        };
        const cheminFichePng = `./fiche_synthetic_${instant.getMonth() + 1}_${instant.getFullYear()}.png`;
        Vegashop(vegaprint, cheminFichePng).then(() => {
            console.log(`Fiche synthetic generee : ${cheminFicheCSV}, ${cheminFichePng}`);
            process.exit(0);
        }).catch(err => {
            console.error("Erreur lors de la generation du PNG:", err);
            process.exit(1);
        });
        return;
    }

    if(options.classement){
        const salleCapacite = result.reduce((acc, cur) =>{
            const salle = cur.salle;
            const capacite = cur.capacitaire;
            if(!acc.has(salle) || acc.get(salle) < capacite){
                acc.set(salle, capacite);
            }
            return acc;
        }, new Map());
        const salleCapaciteArray = Array.from(salleCapacite, ([salle, capacite]) => ({ salle, capacite }));
        salleCapaciteArray.sort((a, b) => b.capacite - a.capacite);
        console.log("Classement des salles selon leur capacite maximale :");
        for (const { salle, capacite } of salleCapaciteArray) {
            console.log(`${salle}: ${capacite}`);
        }
        
    }

   /* if (options.verif) {
        let errors = [];
        for (let x = 0; x < result.length; x++) {
            for (let y = x + 1; y < result.length; y++) {

                const i = result[x];
                const j = result[y];

                if (i.salle === j.salle && i.jour === j.jour) {

                    if (toNumber(j.h1) < toNumber(i.h2) &&
                        toNumber(i.h1) < toNumber(j.h2)) {

                        errors.push(
                            `Conflit dans la salle ${i.salle} (${i.jour}) : ` +
                            `${i.matiere} ${i.h1}-${i.h2} chevauche ` +
                            `${j.matiere} ${j.h1}-${j.h2}`
                        );
                    }
                }
            }
        }

        return errors;
    }*/

if (options.iCalendar) {

    const course = options.iCalendar;
    const dateDebut = program.args[1];
    const dateFin   = program.args[2];
    if (!dateDebut || !dateFin) {
        console.log("Format attendu :");
        console.log("node sru-tool.js fichier.cru --iCalendar GL02 2025-02-10 2025-05-20");
        process.exit(0);
    }

    const filtered = result.filter(e =>
        e.matiere.toUpperCase() === course.toUpperCase()
    );

    if (filtered.length === 0) {
        console.log("Aucun créneau trouvé pour ce cours.");
        process.exit(0);
    }

    function toICS(h) {
        let heure = h;
        if (heure.includes("=")) {
            const parts = heure.split("=");
            heure = parts[1];
        }
        const hm = heure.split(":");
        const HH = hm[0];
        const MM = hm[1];
        return HH + MM + "00";
    }

    function twoDigits(n) {
        if (n < 10) {
            return "0" + n;
        } else {
            return "" + n;
        }
    }

    function getFirstDate(startDate, jourCRU) {
        const mapJour = { L: 1, MA: 2, ME: 3, J: 4, V: 5 };
        const targetDay = mapJour[jourCRU];
        let d = new Date(startDate);
        while (d.getDay() !== targetDay) {
            d.setDate(d.getDate() + 1);
        }
        return d;
    }

    let ics = "BEGIN:VCALENDAR\nVERSION:2.0\n";
    for (let e of filtered) {
        const first = getFirstDate(dateDebut, e.jour);
        const yyyy = first.getFullYear();
        const mm   = twoDigits(first.getMonth() + 1);
        const dd   = twoDigits(first.getDate());
        const DTSTART = `${yyyy}${mm}${dd}T${toICS(e.h1)}`;
        const DTEND   = `${yyyy}${mm}${dd}T${toICS(e.h2)}`;
        const UNTIL   = dateFin.replace(/-/g, "") + "T235959Z";
        ics += "BEGIN:VEVENT\n";
        ics += `SUMMARY:${course}\n`;
        ics += `LOCATION:${e.salle}\n`;
        ics += `DTSTART:${DTSTART}\n`;
        ics += `DTEND:${DTEND}\n`;
        ics += `RRULE:FREQ=WEEKLY;UNTIL=${UNTIL}\n`;
        ics += "END:VEVENT\n";
    }
    ics += "END:VCALENDAR";
    fs.writeFileSync(`${course}.ics`, ics, "utf8");
    console.log(`Fichier iCalendar : ${course}.ics`);
    process.exit(0);
}


process.exit(0);


