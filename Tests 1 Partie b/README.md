# SRU-Tool

SRU-Tool est un petit programme en ligne de commande permettant de lire et analyser
des fichiers .cru (emplois du temps).  
Il propose plusieurs fonctionnalités : recherche de salles, vérification du planning,
classement des salles, génération d’un fichier iCalendar, etc.

## Utilisation

    node sru-tool.js <fichier.cru> [options]

## Options

--cours <type>  
Affiche les salles utilisées par un CM, TD ou TP (ex : --cours CM).

--salle <nom>  
Affiche les créneaux où une salle est libre.

--salleCreneau <jour/hdeb/hfin>  
Affiche les salles libres pendant un créneau donné.
Exemple : --salleCreneau L/10:00/12:00

--capaciteMax <salle>  
Affiche la capacité maximale d’une salle.

--verif  
Vérifie la cohérence du fichier .cru : heures invalides, chevauchements
dans une même salle, etc.

--genererSynthetic  
Produit un fichier CSV et un graphique PNG donnant le taux d'utilisation
de chaque salle.

--classement  
Affiche les salles triées par capacité maximale.

--iCalendar <course> <date_debut> <date_fin>
Génère un fichier .ics (iCalendar) contenant tous les créneaux du cours
indiqué, répétés chaque semaine entre les deux dates.
Exemple :
node sru-tool.js emploi.cru -ical GL02 2025-02-10 2025-05-20

## Format du fichier .cru

Le fichier est organisé par matières, annoncées par :

    +GL02

Puis chaque cours est une ligne du type :

    1,CM,P=30,H=L H=08:00-10:00,1,C006
- type : CM / TD / TP
- capacité 
- jour 
- horaires : début et fin
- salle

Un exemple de CRU est donné dans le fichier sample.cru

## Auteurs
Projet réalisé par APEAPEA MIGUE Yves, KHIAT Magdalena et LACOUR Doniphan
dans le cadre d'un projet du cours de GL02 à l'UTT.

