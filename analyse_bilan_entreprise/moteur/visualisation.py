"""Construction des graphiques Plotly de l'application.

Palette de couleurs imposée par le cahier des charges :
    Vert   -> Bénéfice / Utile
    Bleu   -> Moins de pertes
    Orange -> Équilibre / Pareggio
    Rouge  -> Plus de pertes
"""

from __future__ import annotations

import plotly.graph_objects as go

from .transition import ETATS

COULEURS: dict[str, str] = {
    "plus_de_pertes": "#E74C3C",  # Rouge
    "moins_de_pertes": "#3498DB",  # Bleu
    "equilibre": "#F39C12",  # Orange
    "benefice": "#2ECC71",  # Vert
}

LIBELLES: dict[str, str] = {
    "plus_de_pertes": "Plus de pertes",
    "moins_de_pertes": "Moins de pertes",
    "equilibre": "Équilibre",
    "benefice": "Bénéfice",
}

COULEURS_ZONE_ZSCORE: dict[str, str] = {
    "Verte": "#2ECC71",
    "Jaune": "#F39C12",
    "Rouge": "#E74C3C",
}


def graphique_donut_scenarios(probabilites: dict[str, float], titre: str) -> go.Figure:
    """Donut chart des 4 scénarios finaux."""
    labels = [LIBELLES[etat] for etat in ETATS]
    valeurs = [probabilites[etat] * 100 for etat in ETATS]
    couleurs = [COULEURS[etat] for etat in ETATS]

    figure = go.Figure(
        data=[
            go.Pie(
                labels=labels,
                values=valeurs,
                hole=0.55,
                marker=dict(colors=couleurs, line=dict(color="#FFFFFF", width=2)),
                textinfo="label+percent",
                textfont=dict(size=13),
                sort=False,
            )
        ]
    )
    figure.update_layout(
        title=titre,
        showlegend=True,
        margin=dict(t=60, b=20, l=20, r=20),
        height=420,
    )
    return figure


def graphique_barres_comparaison(
    probabilites_avant: dict[str, float], probabilites_apres: dict[str, float]
) -> go.Figure:
    """Bar chart horizontal comparant probabilités historiques vs corrigées."""
    labels = [LIBELLES[etat] for etat in ETATS]
    couleurs = [COULEURS[etat] for etat in ETATS]
    valeurs_avant = [probabilites_avant[etat] * 100 for etat in ETATS]
    valeurs_apres = [probabilites_apres[etat] * 100 for etat in ETATS]

    figure = go.Figure()
    figure.add_trace(
        go.Bar(
            y=labels,
            x=valeurs_avant,
            name="Probabilité historique (avant Bayes)",
            orientation="h",
            marker=dict(color=couleurs, opacity=0.40),
            text=[f"{v:.1f} %" for v in valeurs_avant],
            textposition="inside",
        )
    )
    figure.add_trace(
        go.Bar(
            y=labels,
            x=valeurs_apres,
            name="Probabilité corrigée (après Bayes)",
            orientation="h",
            marker=dict(color=couleurs),
            text=[f"{v:.1f} %" for v in valeurs_apres],
            textposition="inside",
        )
    )
    figure.update_layout(
        title="Comparaison des probabilités avant / après correction bayésienne",
        barmode="group",
        xaxis_title="Probabilité (%)",
        margin=dict(t=60, b=20, l=20, r=20),
        height=420,
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="left", x=0),
    )
    return figure


def graphique_evolution_historique(annees: list[int], resultats_nets: list[float]) -> go.Figure:
    """Courbe d'évolution du résultat net sur les exercices disponibles,
    colorée en vert (positif) ou rouge (négatif) par point."""
    couleurs_points = ["#2ECC71" if r >= 0 else "#E74C3C" for r in resultats_nets]

    figure = go.Figure(
        data=[
            go.Scatter(
                x=annees,
                y=resultats_nets,
                mode="lines+markers",
                line=dict(color="#7F8C8D", width=2),
                marker=dict(color=couleurs_points, size=12, line=dict(color="#FFFFFF", width=1)),
            )
        ]
    )
    figure.add_hline(y=0, line_dash="dash", line_color="#95A5A6")
    figure.update_layout(
        title="Évolution du résultat net",
        xaxis_title="Année",
        yaxis_title="Résultat net (€)",
        margin=dict(t=60, b=20, l=20, r=20),
        height=320,
    )
    return figure
