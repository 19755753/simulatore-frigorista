"""Package moteur : logique métier de l'application d'analyse de bilans.

Modules :
    annuaire_entreprises -- identité légale réelle (API publique api.gouv.fr)
    donnees_financieres  -- chiffre d'affaires / résultat net réels (API
                             Pappers ou jeu de données vérifié)
    transition           -- modèle d'inertie matricielle (probabilités historiques)
    bayes                -- correction bayésienne à partir du facteur humain
    visualisation         -- construction des graphiques Plotly
"""
