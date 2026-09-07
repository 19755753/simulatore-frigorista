# Analyse prédictive et probabiliste de bilans d'entreprises françaises

Application Streamlit d'aide à la décision : Z-Score d'Altman, modèle de
transition par inertie matricielle, et correction bayésienne à partir de
facteurs humains (nouveaux clients, blocages logistiques, projet de fusion).

## Installation et lancement

```bash
cd analyse_bilan_entreprise
pip install -r requirements.txt
streamlit run app.py
```

## Sources de données

- **Mode démonstration (par défaut)** : 3 entreprises fictives (SIRET
  inventés) avec 3 exercices comptables simulés, pour tester l'application
  sans clé API.
- **Mode API réelle (optionnel)** : définissez la variable d'environnement
  `PAPPERS_API_KEY` avec une clé valide de [pappers.fr](https://www.pappers.fr/api)
  pour interroger de vraies données d'entreprises françaises par SIRET.
  Ce chemin de code est fourni mais n'a pas pu être testé en conditions
  réelles dans l'environnement de développement (voir `moteur/donnees_entreprise.py`).

## Architecture

```
app.py                          Interface Streamlit (orchestration)
moteur/
  donnees_entreprise.py         Récupération des données (API ou simulation)
  zscore.py                     Z''-Score d'Altman (Altman, 1995)
  transition.py                 Probabilités de transition (inertie matricielle)
  bayes.py                      Correction bayésienne (facteur humain)
  visualisation.py              Graphiques Plotly
```

## Avertissement méthodologique

- Le **Z''-Score d'Altman** est une méthode académique publiée (Altman,
  Hartzell & Peck, 1995), adaptée aux entreprises non-manufacturières.
- Le **modèle de transition par inertie matricielle** et les
  **vraisemblances bayésiennes** sont des heuristiques d'ingénierie
  construites pour cette application, documentées et ajustables dans le
  code — ce ne sont pas des modèles statistiques validés empiriquement.
  Cet outil est une aide à la décision, pas une prévision certaine.
