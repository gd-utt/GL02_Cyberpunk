# Readme (SRU-Tool)

## Auteurs
Projet réalisé par **KHIAT Magdalena**, **LACOUR Doniphan** et **APEAPEA MIGUE Yves** dans le cadre de l'unité d'enseignement GL02 à l'UTT (Université de Technologie de Troyes).

## Licence
Ce projet est sous la licence MIT, voir le fichier de licence pour plus de détails.

## Description : Software aims and principles
**SRU-Tool** est un utilitaire en ligne de commande (CLI) conçu pour faciliter la gestion et l'analyse des emplois du temps au format **.cru**.

L'objectif principal du logiciel est de fournir une interface rapide pour extraire des informations pertinentes des fichiers de données brutes. Ses principes reposent sur la simplicité d'utilisation via le terminal et la génération de visualisations claires.

Les fonctionnalités principales incluent :
* La consultation des salles associées à un type de cours spécifique.
* La recherche de créneaux libres pour une salle ou un horaire donné.
* La vérification de la cohérence des données (détection de conflits).
* L'analyse synthétique de l'occupation des salles (avec génération de graphiques).
* Le classement des salles par capacité.

## Utilisation

### Execution
Le programme s'exécute via **Node.js**.

**Commande générique :**
```bash
node sru-tool.js [options] <fichier.cru>
```
**Format du fichier ```.cru```**
Le fichier est organisé par matières, annoncées par un ```+```
Exemple : +GL02

Puis chaque cours est une ligne du type : ```1,CM,P=30,H=L H=08:00-10:00,1,C006//```
- type : ``CM`` / ``TD`` / ``TP``
- capacité : ``P=30`` 
- jour ``H=L``
- horaires :  ``H=08:00-10:00``
- salle ``C006``

Un exemple de CRU est donné dans le fichier ``sample.cru``

Pour obtenir de l'aide: 
```bash
node sru-tool.js --help
```
**Options disponibles**

--cours <type>  
Affiche les salles utilisées par un CM, TD ou TP.
Exemple : 
```bash
node sru-tool.js --cours CM emploi.cru
```

--salle <nom>  
Affiche les créneaux où une salle est libre.

--salleCreneau <jour/hdeb/hfin>  
Affiche les salles libres pendant un créneau donné.
Exemple : 
```bash
node sru-tool.js --salleCreneau L/10:00/12:00 emploi.cru
```

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
```bash
node sru-tool.js emploi.cru -ical GL02 2025-02-10 2025-05-20 emploi.cru
```

**Installation (Si nécessaire)**
Si vous installez le projet pour la première fois:
 - Prérequis : Assurez-vous d'avoir Node.js (version 16+) et Git installés.
 - Cloner le dépôt et installer les dépendances :
 
```bash
git clone <url_repo>
cd sru-tool
npm install
```

## Lien vers documentation supplémentaire
- https://caporal.io/guide/
- https://vega.github.io/vega-lite/tutorials/getting_started.html

## Dépendances 

**Environnement**
- Node.js >= 16
- Git (pour GitLab)

**Module et Librairie**
Le projet utilise les modules Node.js suivants :

-```fs(module natif)``` Gestion des opérations de lecture/écriture de fichiers.

-```commander``` Pour l'analyse et la gestion des arguments en ligne de commande.

-```vega``` et ```vega-lite``` Bibliothèques de visualisation de données pour la génération des graphiques synthétiques.

## Contact 
- magdalena.khiat@utt.fr
- doniphan.lacour@utt.fr
- yves.apeapea_migue@utt.fr

