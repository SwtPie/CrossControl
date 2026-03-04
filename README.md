# CrossControl
### Logiciel de gestion de cross scolaire

CrossControl centralise l'ensemble des opérations liées à l'organisation d'un cross : inscription des participants, gestion des courses, chronométrage en direct et édition des classements. L'application fonctionne sans connexion internet, sans compte utilisateur et sans installation de dépendances — un double-clic suffit.

---

## Gain de temps concret

| Tâche | Sans CrossControl | Avec CrossControl |
|---|---|---|
| Saisie des participants | Ressaisie manuelle depuis les listes papier ou Excel | Import direct du fichier Excel ou CSV de chaque établissement |
| Attribution des dossards | Attribution manuelle avec risque de doublons | Attribution automatique en un clic |
| Chronométrage | Chrono + carnet papier + reconstitution après course | Enregistrement horodaté de chaque arrivée, saisie des dossards dans le calme |
| Classement | Calcul manuel ou tableur après coup | Classement généré instantanément, corrigeable à tout moment |
| Statistiques | Croisements manuels sur tableur | Graphiques générés automatiquement |

---

## Fonctionnalités

### Gestion des événements
- Création d'événements indépendants (un par date, établissement ou compétition)
- Chaque événement possède ses propres participants, courses et résultats
- Modification et suppression à tout moment

### Participants
- Ajout manuel individuel
- **Import de fichiers CSV ou Excel (.xlsx)**
  - Aperçu des données avant validation
  - Détection automatique des doublons
  - Normalisation des noms (correction des exports tout-majuscules de Pronote)
  - Reconnaissance flexible des colonnes (orthographe, langue, casse)
  - Champ établissement applicable à toute une liste importée en une seule opération
- Attribution automatique ou manuelle des dossards
- Recherche et filtrage en temps réel

### Courses
- Nombre de courses illimité par événement
- Paramétrage par distance et plage de VMA
- **Ajout rapide** par filtres combinés : sexe, VMA, classe, établissement
- Ajout individuel avec recherche

### Chronométrage en direct
- Chronomètre intégré (démarrage, pause, reprise, fin)
- Enregistrement d'arrivée en un clic, annulation possible en cas d'erreur
- Saisie des dossards dissociée de l'enregistrement des temps

### Classements et résultats
- Classement automatique avec temps, vitesse réelle et pourcentage de VMA
- Visualisation podium pour les trois premiers
- Correction post-course : ajout, suppression ou modification d'arrivées
- Masquage des courses terminées dans la vue principale

### Statistiques
- Répartition des participants par sexe
- Répartition par établissement
- Répartition par tranche de VMA (arrondi arithmétique)

### Paramètres
- Thème sombre ou clair, sauvegardé automatiquement

---

## Installation

Aucune installation requise. Aucun droit administrateur nécessaire.

1. Dézipper l'archive `CrossControl.zip`
2. Lancer `CrossControl.exe`

> Éviter de placer le dossier dans `C:\Program Files\` — Windows bloque l'écriture dans ce répertoire sans droits administrateur. Privilégier le Bureau, le dossier Documents ou une clé USB.

**Structure du dossier**
```
CrossControl/
├── CrossControl.exe
└── data/
    ├── events.db       ← base des événements, créée au premier lancement
    └── races/          ← une base SQLite par événement
```

Les données sont intégralement contenues dans le dossier `data/`. La sauvegarde consiste à copier ce dossier. Le transfert vers un autre poste consiste à copier l'intégralité du dossier `CrossControl/`.

---

## Format d'import

Les fichiers **CSV** (séparateur auto-détecté) et **Excel (.xlsx)** sont acceptés.

Colonnes reconnues (l'ordre et la casse ne sont pas contraignants) :

| Champ | Noms acceptés |
|---|---|
| Nom | `nom`, `name`, `last_name`, `lastname` |
| Prénom | `prenom`, `prénom`, `first_name`, `firstname` |
| Classe | `classe`, `class`, `groupe`, `group`, `niveau` |
| Établissement | `etablissement`, `établissement`, `school`, `ecole` |
| Sexe | `sexe`, `genre`, `sex` — valeurs : F / M, Féminin / Masculin |
| VMA | `vma`, `vma (km/h)`, `vitesse` |
| Dossard | `dossard`, `bib`, `numero`, `n°` |

Seuls **Nom** et **Prénom** sont obligatoires.

---

## Développement

**Stack**
- Python 3.x + [pywebview](https://pywebview.flowrl.com/)
- HTML / CSS / JavaScript
- SQLite
- openpyxl (lecture Excel)

**Dépendances**
```
pywebview
openpyxl
```

**Lancement**
```bash
python main.py
```

**Compilation Windows**
```bash
pip install pyinstaller
pyinstaller --onefile --windowed --name CrossControl main.py
```