# SRU-Tool — Gestion des salles (CLI) — Node.js

Outil en ligne de commande pour consulter / analyser / exporter des emplois du temps au format CRU.

## Prérequis
- Node.js >= 16
- Git (pour GitLab)

## Installation
```bash
git clone <url_repo>
cd sru-tool
npm install

##Aide 
node sru-tool.js --help
# ou après `npm install -g .` :
# sru-tool --help

##Exemple

Rechercher les salles d’un cours :
node sru-tool.js --cours GL02 sample.cru

Capacité d’une salle :
node sru-tool.js -c C006 sample.cru

Disponibilités d'une salle (fenêtre 08:00-20:00) :
node sru-tool.js -s C006 sample.cru

Salles disponibles pour un créneau (ex: "L H=09:00-11:00"):
node sru-tool.js --salleCreneau "L H=09:00-11:00" sample.cru

Vérifier chevauchements :
node sru-tool.js -v sample.cru

Générer .ics pour un cours entre deux dates :
node sru-tool.js --ical GL02 2025-10-01 2025-12-31 sample.cru

Générer CSV taux d'occupation :
node sru-tool.js -g sample.cru
# output -> data/occupation.csv

Classer salles par capacité :
node sru-tool.js --rank-capacity sample.cru

##Tests unitaires

npm test
