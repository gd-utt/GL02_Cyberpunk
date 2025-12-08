const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Chemin du script à tester et du fichier CRU
const SRU_TOOL = path.join(__dirname, '..', 'sru-tool.js');
const SAMPLE_CRU = path.join(__dirname, '..', 'sample.cru');

// Fichiers générés par les tests
const TEST_OUTPUT_ICS = 'GL02.ics';
const TEST_OUTPUT_CSV = './fiche_synthetic_'; // Doit gérer le nom dynamique

/**
 * Exécute le script sru-tool.js avec les arguments donnés et retourne la sortie standard.
 * @param {string} args - Les arguments à passer à sru-tool.js (ex: "-v").
 * @returns {string} La sortie console (stdout).
 */
function runSruTool(args) {
    // La commande à exécuter : node /chemin/vers/sru-tool.js /chemin/vers/sample.cru [args]
    const command = `node ${SRU_TOOL} ${SAMPLE_CRU} ${args}`;
    
    // execSync exécute la commande et retourne le stdout
    // Note: Utiliser try/catch pour gérer les erreurs et les codes de sortie non nuls
    try {
        const stdout = execSync(command, { encoding: 'utf8' });
        return stdout.trim();
    } catch (error) {
        // En cas d'erreur CLI, retourner stderr pour l'assertion
        return error.stderr.trim(); 
    }
}

// Nettoyage des fichiers générés
afterAll(() => {
    try {
        if (fs.existsSync(TEST_OUTPUT_ICS)) fs.unlinkSync(TEST_OUTPUT_ICS);
        // Nettoyage des fichiers CSV et PNG générés dynamiquement par -g
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        const csvPath = path.join(__dirname, '..', `${TEST_OUTPUT_CSV}${currentMonth}_${currentYear}.csv`);
        const pngPath = path.join(__dirname, '..', `${TEST_OUTPUT_CSV}${currentMonth}_${currentYear}.png`);

        if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);
        if (fs.existsSync(pngPath)) fs.unlinkSync(pngPath);

    } catch (err) {
        console.error('Erreur lors du nettoyage après les tests :', err);
    }
});

// -----------------------------------------------------
// DÉBUT DES TESTS UNITAIRES EN MODE CLI
// -----------------------------------------------------

describe('Test en mode CLI (sru-tool.js)', () => {
    
    test('Option --verif (-v) doit retourner "Le fichier est correct"', () => {
        const output = runSruTool('-v');
        expect(output).toContain("Le fichier est correct");
    });
    
    test('Option --cours CM doit lister 3 salles (C006, C007, C010)', () => {
        const output = runSruTool('--cours CM');
        expect(output).toContain("Salle C006 | L H=08:00-10:00 | GL02");
        expect(output).toContain("Salle C007 | MA H=09:00-11:00 | GL02");
        expect(output).toContain("Salle C010 | MA H=09:00-11:00 | GL03");
        expect(output).not.toContain("TP"); // Vérifie qu'il ne liste pas les TP
    });

    test('Option --capaciteMax C006 (-c) doit retourner 30', () => {
        const output = runSruTool('-c C006');
        expect(output).toContain("La capicite max de la salle C006 est : 30");
    });

    test('Option --salleCreneau J/16:00/17:00 (-sc) doit lister C006', () => {
        const output = runSruTool('-sc J/16:00/17:00');
        expect(output).toContain("Les salles libres sont :");
        expect(output).toContain("C006 | J H=16:00-17:00 | Cap=20");
    });

    test('Option --classement (-cl) doit commencer par C007 (40)', () => {
        const output = runSruTool('-cl');
        const lines = output.split('\n');
        // Le premier élément du classement doit être C007: 40
        expect(lines[1]).toContain("C007: 40"); 
    });

    test('Option --genererSynthetic (-g) doit créer les fichiers CSV et PNG', () => {
        const output = runSruTool('-g');
        expect(output).toContain("Fiche synthetic generee : "); // Vérifie le message de succès
        
        // Vérifie la présence des fichiers générés dynamiquement
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        const csvPath = path.join(__dirname, '..', `${TEST_OUTPUT_CSV}${currentMonth}_${currentYear}.csv`);
        const pngPath = path.join(__dirname, '..', `${TEST_OUTPUT_CSV}${currentMonth}_${currentYear}.png`);
        
        expect(fs.existsSync(csvPath)).toBe(true);
        // On suppose que Vegashop a bien généré le PNG 
    });

    test('Option --iCalendar doit créer le fichier GL02.ics', () => {
        const args = `-ical GL02 2025-02-10 2025-02-28`;
        const output = runSruTool(args);
        
        expect(output).toContain("Fichier iCalendar : GL02.ics");
        expect(fs.existsSync(TEST_OUTPUT_ICS)).toBe(true);
        
        const icsContent = fs.readFileSync(TEST_OUTPUT_ICS, 'utf8');
        expect(icsContent).toContain('BEGIN:VCALENDAR');
        expect((icsContent.match(/BEGIN:VEVENT/g) || []).length).toBe(6); // 3 semaines * 2 événements par semaine
    });
});