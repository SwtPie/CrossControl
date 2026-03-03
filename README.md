# 🏃 Cross Manager

Application de gestion de cross scolaire — arrivées, classements, calcul %VMA.

## Installation

```bash
pip install pywebview
```

## Lancement

```bash
python main.py
```

## Structure des fichiers

```
cross_manager/
├── main.py          # Serveur pywebview + API Python (SQLite)
├── app.html         # Interface complète (HTML/CSS/JS)
├── requirements.txt
└── cross_data.db    # Base de données (créée automatiquement)
```

## Fonctionnalités

### 👥 Participants
- Saisie manuelle : nom, prénom, classe, établissement, sexe, VMA, dossard
- Attribution automatique des dossards (numérotation séquentielle)
- Recherche et filtrage

### 🏁 Gestion des courses
- Création de courses avec nom, distance, plage VMA
- Inscription manuelle ou automatique par tranche VMA (min/max)

### ⏱️ Course en direct
1. Sélectionner la course et cliquer **Démarrer**
2. Appuyer sur **UN PARTICIPANT EST ARRIVÉ** à chaque arrivée
3. Après la course : saisir les dossards depuis la tige (ordre inverse = 1er arrivé en premier)

### 🏆 Classement
- Classement automatique avec podium
- Calcul vitesse (km/h) et % VMA pour chaque coureur

## Formule de calcul

```
Vitesse (km/h) = (Distance en m / Temps en s) × 3.6
% VMA          = (Vitesse réelle / VMA) × 100
```
