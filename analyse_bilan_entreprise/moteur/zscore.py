"""Calcul du Z''-Score d'Altman (modèle non-manufacturier / marchés émergents).

Référence : E. I. Altman, "Corporate Credit Scoring - Insolvency Risk
Models" (Altman, Hartzell & Peck, 1995), variante dite "Z''-Score" ou
"EM Score", conçue pour les entreprises privées, non manufacturières et/ou
des marchés émergents -- contrairement au Z-Score original (1968) qui
suppose une société cotée du secteur industriel.

Formule :
    Z'' = 6.56*X1 + 3.26*X2 + 6.72*X3 + 1.05*X4

    X1 = Fonds de roulement / Actif total
       = (Actif circulant - Passif circulant) / Actif total
    X2 = Report à nouveau (réserves) / Actif total
    X3 = Résultat d'exploitation (EBIT) / Actif total
    X4 = Capitaux propres / Dettes totales

Zones de risque (seuils originaux d'Altman) :
    Z'' > 2.6            -> Zone "Sûre" (verte)
    1.1 <= Z'' <= 2.6     -> Zone "Grise" / incertaine (jaune)
    Z'' < 1.1             -> Zone "Détresse" (rouge)

Ce score est un indicateur statistique de probabilité de défaillance,
pas une certitude : il doit être interprété comme une aide à la décision.
"""

from __future__ import annotations

from dataclasses import dataclass

SEUIL_ZONE_VERTE = 2.6
SEUIL_ZONE_ROUGE = 1.1

COEF_X1 = 6.56
COEF_X2 = 3.26
COEF_X3 = 6.72
COEF_X4 = 1.05


@dataclass
class ResultatZScore:
    z_score: float
    zone: str  # "Verte", "Jaune" ou "Rouge"
    x1_fonds_roulement: float
    x2_reserves: float
    x3_rentabilite_exploitation: float
    x4_solvabilite: float


def calculer_zscore_altman(
    actif_total: float,
    actif_circulant: float,
    passif_circulant: float,
    report_a_nouveau: float,
    resultat_exploitation: float,
    capitaux_propres: float,
    dettes_totales: float,
) -> ResultatZScore:
    """Calcule le Z''-Score d'Altman à partir des postes comptables fournis.

    Lève ``ValueError`` si l'actif total ou les dettes totales sont nuls ou
    négatifs, car ces grandeurs sont des dénominateurs du modèle.
    """
    if actif_total <= 0:
        raise ValueError("L'actif total doit être strictement positif pour calculer le Z-Score.")
    if dettes_totales <= 0:
        raise ValueError("Les dettes totales doivent être strictement positives pour calculer le Z-Score.")

    x1 = (actif_circulant - passif_circulant) / actif_total
    x2 = report_a_nouveau / actif_total
    x3 = resultat_exploitation / actif_total
    x4 = capitaux_propres / dettes_totales

    z = COEF_X1 * x1 + COEF_X2 * x2 + COEF_X3 * x3 + COEF_X4 * x4

    if z > SEUIL_ZONE_VERTE:
        zone = "Verte"
    elif z >= SEUIL_ZONE_ROUGE:
        zone = "Jaune"
    else:
        zone = "Rouge"

    return ResultatZScore(
        z_score=z,
        zone=zone,
        x1_fonds_roulement=x1,
        x2_reserves=x2,
        x3_rentabilite_exploitation=x3,
        x4_solvabilite=x4,
    )
