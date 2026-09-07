"""Correction bayésienne des probabilités historiques ("facteur humain").

On applique le théorème de Bayes :

    P(scénario | réponses) ∝ P(réponses | scénario) * P(scénario)

où P(scénario) est la probabilité "historique" issue du modèle d'inertie
matricielle (module ``transition``), et P(réponses | scénario) est estimée
en supposant l'indépendance conditionnelle des 3 réponses sachant le
scénario (hypothèse "naïve" classique qui permet de multiplier les
vraisemblances individuelles) :

    P(réponses | scénario) = Π_i P(réponse_i | scénario)

Les vraisemblances individuelles ci-dessous (``TABLE_VRAISEMBLANCES``)
sont des hypothèses d'expert construites pour ce cas d'usage (impact d'un
nouveau client, d'un blocage logistique inter-filiales, d'un projet de
fusion/optimisation), pas des statistiques mesurées empiriquement. Elles
sont clairement isolées ici pour rester ajustables et auditables.
"""

from __future__ import annotations

from dataclasses import dataclass

from .transition import ETATS

# P(réponse="oui" | scénario) pour chaque question. La probabilité pour
# "non" est déduite par complémentarité (1 - P(oui|scénario)) : chaque
# question est modélisée comme un facteur binaire dont on connaît l'effet
# relatif attendu sur chacun des 4 scénarios.
TABLE_VRAISEMBLANCES: dict[str, dict[str, float]] = {
    "nouveaux_clients": {
        # De nouveaux clients augmentent la probabilité des scénarios favorables
        "plus_de_pertes": 0.20,
        "moins_de_pertes": 0.45,
        "equilibre": 0.55,
        "benefice": 0.75,
    },
    "flux_bloques": {
        # Un blocage logistique (ex. filiale Vedène) pénalise surtout les
        # scénarios déjà fragiles
        "plus_de_pertes": 0.70,
        "moins_de_pertes": 0.50,
        "equilibre": 0.30,
        "benefice": 0.15,
    },
    "projet_fusion": {
        # Un projet de fusion/optimisation des coûts favorise la réduction
        # des pertes et l'équilibre à court terme, effet plus incertain
        # sur le passage direct à un bénéfice plein
        "plus_de_pertes": 0.35,
        "moins_de_pertes": 0.60,
        "equilibre": 0.55,
        "benefice": 0.40,
    },
}

LIBELLES_QUESTIONS: dict[str, str] = {
    "nouveaux_clients": "Nouveaux clients acquis récemment",
    "flux_bloques": "Flux de transport bloqués par une autre filiale",
    "projet_fusion": "Projet de fusion / optimisation des coûts en cours",
}


@dataclass
class ResultatBayes:
    probabilites_anterieures: dict[str, float]
    probabilites_posterieures: dict[str, float]
    facteurs_appliques: dict[str, bool]


def _vraisemblance(question: str, reponse_oui: bool, scenario: str) -> float:
    p_oui = TABLE_VRAISEMBLANCES[question][scenario]
    return p_oui if reponse_oui else (1.0 - p_oui)


def corriger_probabilites(
    probabilites_historiques: dict[str, float],
    reponses: dict[str, bool],
) -> ResultatBayes:
    """Met à jour les probabilités historiques avec les réponses du facteur humain.

    ``reponses`` doit contenir les clés ``nouveaux_clients``, ``flux_bloques``
    et ``projet_fusion`` associées à un booléen (True = "Oui").
    """
    posterieures: dict[str, float] = {}
    for scenario in ETATS:
        proba = probabilites_historiques[scenario]
        for question, reponse_oui in reponses.items():
            proba *= _vraisemblance(question, reponse_oui, scenario)
        posterieures[scenario] = proba

    somme = sum(posterieures.values())
    if somme <= 0:
        # Cas dégénéré (vraisemblances toutes nulles) : repli sur les
        # probabilités historiques non corrigées plutôt que de diviser par 0
        posterieures = dict(probabilites_historiques)
    else:
        posterieures = {scenario: valeur / somme for scenario, valeur in posterieures.items()}

    return ResultatBayes(
        probabilites_anterieures=dict(probabilites_historiques),
        probabilites_posterieures=posterieures,
        facteurs_appliques=dict(reponses),
    )
