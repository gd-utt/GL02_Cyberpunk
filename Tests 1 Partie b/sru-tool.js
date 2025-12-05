#!/usr/bin/env node

const fs = require("fs");
const { program } = require("commander");

program
    .argument("<file>", "fichier .cru")
    .option("--cours <type>", "Affiche la salle associe a un cours (CM, TD, TP)")
    .option("-s ,--salle <salle>", "Affiche les dates pour lesquelles une salle est libre ")
    .option("-sc ,--salleCreneau <creneau>", "Affiche les salle qui sont libres a un creneau donne (jour/HeureDebut/HeureFin) Format heure xx:xx")
    .option("-c, --capaciteMax <salle>", "Affiche la capacite maximale d'une salle donnee")
    .option("-v, --verif", "Verifie si le cru est coherent dans les planning")
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
    //PUTAIN expliquez moi pourquoi une salle a des capacites differentes
    result = result.filter(e => e.salle.toUpperCase() === options.capaciteMax.toUpperCase());
    if (result.length === 0) {
        console.log("La salle n'a pas ete trouvee ");
        process.exit(0);
    }else{
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

        const try1 = result.filter(e => (toNumber(e.h1) <= toNumber(creneau[1]) && toNumber(e.h2) >= toNumber(creneau[2])));
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







    /*if (options.salleCreneau){
    result = result.filter(e => (e.matiere.toUpperCase() === "LIBRE"));
    if(result.length === 0){
         console.log("Aucune salle n'est libre");
    }else{
        const creneau = options.salleCreneau.split("/");
        const try1 = result.filter(e => (e.h1 === "H="+creneau[1] && e.h2 === creneau[2] && e.jour === creneau[0]));
        if(try1.length === 0){
            const try2 = result.filter(e => (e.h1 === "H="+creneau[1]));
            const try3 = result.filter(e => (e.h2 === "H="+creneau[2]));

            if(try2.length === 0 && try3.length === 0) {
                console.log("Le creneau donnee n'a aucune corexpondance");
            }
            else if (try3.length === 0 && try2.length !== 0){

            } else{
                console.log("Le creneau n'a pas correspondance mais des horaires sont utilisables");
                for (let e of try2) {
                    console.log(
                        `${e.salle} | ${e.jour} ${e.h1} jusqu'a ${e.h2} | Cap=${e.capacitaire}`
                    );
                }
            }
        }else{
            console.log("Les salles libres sont : ");
            for (let e of try1) {
                console.log(
                    `${e.salle} | ${e.jour} ${e.h1}-${e.h2} | Cap=${e.capacitaire}`
                );
            }
        }
    }
}
*/
    if(options.verif){
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

process.exit(0);


