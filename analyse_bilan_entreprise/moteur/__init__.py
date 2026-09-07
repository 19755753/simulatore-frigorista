"""Package moteur : logique métier de l'application d'analyse de bilans.

Modules :
    annuaire_entreprises -- identité légale réelle (API publique api.gouv.fr)
    transition            -- modèle d'inertie matricielle (probabilités historiques)
    bayes                 -- correction bayésienne à partir du facteur humain
    visualisation          -- construction des graphiques Plotly

Le chiffre d'affaires et le résultat net sont saisis directement dans
``app.py`` (``st.number_input``) : pas de module dédié, volontairement,
pour éviter toute fonction complexe mise en cache source de bugs entre
deux versions du code.
"""
