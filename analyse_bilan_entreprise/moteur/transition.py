"""Modèle de probabilités de transition par "inertie matricielle".

Avertissement méthodologique : contrairement au Z-Score d'Altman (méthode
académique publiée), ce module implémente un modèle heuristique construit
pour cette application -- il ne s'agit pas d'une méthode statistique
validée empiriquement, mais d'une manière structurée et reproductible de
transformer la tendance des 3 derniers bilans en probabilités a priori sur
4 scénarios. Les poids utilisés sont des paramètres d'ingénierie,
modifiables, et documentés ci-dessous.

Principe :
1. Chaque exercice est classé dans l'un des 4 états, à partir de la marge
   nette (résultat net / chiffre d'affaires) et de la variation du
   résultat net par rapport à l'exercice précédent :
     - BENEFICE       : marge nette > +2 %
     - EQUILIBRE      : marge nette entre -1 % et +2 % (quasi pareggio)
     - MOINS_DE_PERTES: marge nette < -1 % ET résultat net en hausse
                        par rapport à l'exercice précédent (pertes qui
                        se réduisent)
     - PLUS_DE_PERTES : marge nette < -1 % ET résultat net stable ou en
                        baisse (pertes qui s'aggravent)

2. Une matrice de transition empirique 4x4 est estimée à partir des
   transitions observées entre les 3 exercices (lissage de Laplace pour
   éviter les probabilités nulles avec un échantillon aussi réduit).

3. Une pente de tendance (régression linéaire du résultat net sur les 3
   exercices, via ``scipy.stats.linregress``) mesure la dynamique globale
   et vient renforcer ("inertie") la probabilité de rester dans le
   scénario le plus proche de la trajectoire observée.

4. Les probabilités historiques finales sont la ligne de la matrice de
   transition correspondant au dernier état observé, pondérée avec un
   vecteur d'inertie centré sur cet état et orienté par le signe de la
   pente.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy import stats

# Ordre fixe des 4 états, du plus défavorable au plus favorable
ETATS = ["plus_de_pertes", "moins_de_pertes", "equilibre", "benefice"]
NB_ETATS = len(ETATS)

SEUIL_MARGE_BENEFICE = 0.02
SEUIL_MARGE_EQUILIBRE_BAS = -0.01

# Poids de mélange entre matrice empirique et vecteur d'inertie (0..1)
POIDS_EMPIRIQUE = 0.5


def _classer_etat(resultat_net: float, chiffre_affaires: float, delta_resultat: float | None) -> str:
    """Classe un exercice comptable dans l'un des 4 états."""
    marge = resultat_net / chiffre_affaires if chiffre_affaires else 0.0

    if marge > SEUIL_MARGE_BENEFICE:
        return "benefice"
    if marge >= SEUIL_MARGE_EQUILIBRE_BAS:
        return "equilibre"
    # Marge nettement négative : distinguer amélioration / dégradation
    if delta_resultat is not None and delta_resultat > 0:
        return "moins_de_pertes"
    return "plus_de_pertes"


@dataclass
class ResultatTransition:
    etats_observes: list[str]
    matrice_transition: np.ndarray  # 4x4, lignes = état de départ
    pente_tendance: float
    probabilites_historiques: dict[str, float]  # clés = ETATS


def calculer_transition_inertie(
    resultats_nets: list[float], chiffres_affaires: list[float]
) -> ResultatTransition:
    """Calcule les probabilités historiques des 4 scénarios à partir des
    3 (ou plus) derniers exercices, triés par année croissante.
    """
    if len(resultats_nets) < 2 or len(resultats_nets) != len(chiffres_affaires):
        raise ValueError("Il faut au moins 2 exercices comparables (résultat net + CA) pour estimer une tendance.")

    # 1. Classification de chaque exercice
    etats: list[str] = []
    for i, (rn, ca) in enumerate(zip(resultats_nets, chiffres_affaires)):
        delta = None if i == 0 else resultats_nets[i] - resultats_nets[i - 1]
        etats.append(_classer_etat(rn, ca, delta))

    # 2. Matrice de transition empirique avec lissage de Laplace (alpha=1)
    comptes = np.ones((NB_ETATS, NB_ETATS))  # lissage
    for etat_avant, etat_apres in zip(etats[:-1], etats[1:]):
        i, j = ETATS.index(etat_avant), ETATS.index(etat_apres)
        comptes[i, j] += 1
    matrice = comptes / comptes.sum(axis=1, keepdims=True)

    # 3. Pente de tendance du résultat net (régression linéaire)
    annees_index = np.arange(len(resultats_nets), dtype=float)
    regression = stats.linregress(annees_index, resultats_nets)
    echelle = max(abs(ca) for ca in chiffres_affaires) or 1.0
    pente_normalisee = float(np.clip(regression.slope / echelle * len(resultats_nets), -1.0, 1.0))

    # 4. Vecteur d'inertie centré sur le dernier état observé, décalé selon la pente
    dernier_etat_idx = ETATS.index(etats[-1])
    position_cible = dernier_etat_idx + pente_normalisee  # pente>0 pousse vers "benefice"
    largeur_inertie = 1.2  # écart-type du noyau gaussien d'inertie
    positions = np.arange(NB_ETATS, dtype=float)
    vecteur_inertie = np.exp(-0.5 * ((positions - position_cible) / largeur_inertie) ** 2)
    vecteur_inertie /= vecteur_inertie.sum()

    # 5. Mélange matrice empirique (ligne du dernier état) + vecteur d'inertie
    ligne_empirique = matrice[dernier_etat_idx]
    probabilites = POIDS_EMPIRIQUE * ligne_empirique + (1 - POIDS_EMPIRIQUE) * vecteur_inertie
    probabilites /= probabilites.sum()

    return ResultatTransition(
        etats_observes=etats,
        matrice_transition=matrice,
        pente_tendance=regression.slope,
        probabilites_historiques=dict(zip(ETATS, probabilites.tolist())),
    )
