"""Récupération des données financières d'une entreprise française.

Deux sources sont possibles :

1. API Pappers (https://www.pappers.fr/api) -- si la variable d'environnement
   ``PAPPERS_API_KEY`` est définie, le module tente un appel réel à
   l'endpoint documenté ``GET https://api.pappers.fr/v2/entreprise``.
   Cet appel nécessite une clé API valide fournie par l'utilisateur et n'a
   pas pu être testé dans cet environnement de développement (pas d'accès
   réseau externe garanti) : il est fourni "prêt à l'emploi" mais doit être
   validé par l'utilisateur avec sa propre clé.

2. Base simulée (par défaut) : un dictionnaire structuré de type
   "extrait de bilan complet" (tel que retourné par Pappers/INPI), portant
   sur des entreprises FICTIVES créées uniquement pour la démonstration.
   Aucune de ces données ne correspond à une entreprise réelle -- les noms,
   SIRET et montants sont inventés à des fins pédagogiques.

Le mode actif est toujours affiché explicitement dans l'interface pour
éviter toute confusion entre donnée réelle et donnée simulée.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field

import pandas as pd
import requests
import streamlit as st

# ---------------------------------------------------------------------------
# Structure d'un exercice comptable (un "bilan" annuel)
# ---------------------------------------------------------------------------


@dataclass
class ExerciceComptable:
    """Postes comptables d'un exercice, tels que fournis par un extrait de
    bilan complet (compte de résultat + bilan actif/passif).

    Les 4 postes demandés par le cahier des charges (chiffre d'affaires,
    résultat net, capitaux propres, dettes) sont complétés par les postes
    strictement nécessaires au calcul rigoureux du Z''-Score d'Altman
    (actif total, actif circulant, passif circulant, résultat
    d'exploitation, report à nouveau). Tous ces postes figurent dans un
    extrait de bilan complet INPI/Pappers standard.
    """

    annee: int
    chiffre_affaires: float
    resultat_net: float
    capitaux_propres: float
    dettes_totales: float
    actif_circulant: float
    passif_circulant: float
    resultat_exploitation: float  # EBIT
    report_a_nouveau: float  # réserves / résultats cumulés non distribués

    @property
    def actif_total(self) -> float:
        """Total du bilan (actif = passif = capitaux propres + dettes)."""
        return self.capitaux_propres + self.dettes_totales


@dataclass
class Entreprise:
    siret: str
    denomination: str
    forme_juridique: str
    code_naf: str
    exercices: list[ExerciceComptable] = field(default_factory=list)

    def historique_dataframe(self) -> pd.DataFrame:
        """Retourne l'historique des 4 indicateurs demandés sous forme de
        DataFrame pandas, trié par année croissante."""
        lignes = [
            {
                "Année": ex.annee,
                "Chiffre d'affaires (€)": ex.chiffre_affaires,
                "Résultat net (€)": ex.resultat_net,
                "Capitaux propres (€)": ex.capitaux_propres,
                "Dettes (€)": ex.dettes_totales,
            }
            for ex in sorted(self.exercices, key=lambda e: e.annee)
        ]
        return pd.DataFrame(lignes)


# ---------------------------------------------------------------------------
# Base de démonstration (données 100% fictives)
# ---------------------------------------------------------------------------

_BASE_SIMULEE: dict[str, Entreprise] = {
    "90212345600018": Entreprise(
        siret="90212345600018",
        denomination="TRANSLOG ATLANTIQUE (exemple fictif)",
        forme_juridique="SAS",
        code_naf="4941A - Transports routiers de fret",
        exercices=[
            ExerciceComptable(
                annee=2023, chiffre_affaires=4_850_000, resultat_net=-310_000,
                capitaux_propres=620_000, dettes_totales=2_180_000,
                actif_circulant=1_450_000, passif_circulant=980_000,
                resultat_exploitation=-190_000, report_a_nouveau=140_000,
            ),
            ExerciceComptable(
                annee=2024, chiffre_affaires=4_600_000, resultat_net=-520_000,
                capitaux_propres=310_000, dettes_totales=2_540_000,
                actif_circulant=1_280_000, passif_circulant=1_120_000,
                resultat_exploitation=-410_000, report_a_nouveau=-170_000,
            ),
            ExerciceComptable(
                annee=2025, chiffre_affaires=4_420_000, resultat_net=-380_000,
                capitaux_propres=-70_000, dettes_totales=2_690_000,
                actif_circulant=1_190_000, passif_circulant=1_260_000,
                resultat_exploitation=-260_000, report_a_nouveau=-540_000,
            ),
        ],
    ),
    "81234567800025": Entreprise(
        siret="81234567800025",
        denomination="MENUISERIE DU RHÔNE (exemple fictif)",
        forme_juridique="SARL",
        code_naf="1623Z - Fabrication de charpentes",
        exercices=[
            ExerciceComptable(
                annee=2023, chiffre_affaires=2_100_000, resultat_net=45_000,
                capitaux_propres=380_000, dettes_totales=690_000,
                actif_circulant=520_000, passif_circulant=310_000,
                resultat_exploitation=68_000, report_a_nouveau=210_000,
            ),
            ExerciceComptable(
                annee=2024, chiffre_affaires=2_260_000, resultat_net=61_000,
                capitaux_propres=428_000, dettes_totales=705_000,
                actif_circulant=560_000, passif_circulant=320_000,
                resultat_exploitation=84_000, report_a_nouveau=255_000,
            ),
            ExerciceComptable(
                annee=2025, chiffre_affaires=2_395_000, resultat_net=79_000,
                capitaux_propres=497_000, dettes_totales=712_000,
                actif_circulant=605_000, passif_circulant=305_000,
                resultat_exploitation=103_000, report_a_nouveau=316_000,
            ),
        ],
    ),
    "75398765400012": Entreprise(
        siret="75398765400012",
        denomination="NORD PROPRETÉ SERVICES (exemple fictif)",
        forme_juridique="SAS",
        code_naf="8121Z - Nettoyage courant des bâtiments",
        exercices=[
            ExerciceComptable(
                annee=2023, chiffre_affaires=1_320_000, resultat_net=8_000,
                capitaux_propres=95_000, dettes_totales=410_000,
                actif_circulant=260_000, passif_circulant=220_000,
                resultat_exploitation=14_000, report_a_nouveau=22_000,
            ),
            ExerciceComptable(
                annee=2024, chiffre_affaires=1_355_000, resultat_net=-4_000,
                capitaux_propres=91_000, dettes_totales=430_000,
                actif_circulant=255_000, passif_circulant=235_000,
                resultat_exploitation=2_000, report_a_nouveau=18_000,
            ),
            ExerciceComptable(
                annee=2025, chiffre_affaires=1_340_000, resultat_net=3_000,
                capitaux_propres=94_000, dettes_totales=425_000,
                actif_circulant=258_000, passif_circulant=228_000,
                resultat_exploitation=9_000, report_a_nouveau=21_000,
            ),
        ],
    ),
}


def liste_entreprises_demo() -> dict[str, str]:
    """Retourne {SIRET: dénomination} pour peupler le sélecteur Streamlit."""
    return {siret: e.denomination for siret, e in _BASE_SIMULEE.items()}


# ---------------------------------------------------------------------------
# Accès réel à l'API Pappers (optionnel, nécessite une clé utilisateur)
# ---------------------------------------------------------------------------


def _construire_entreprise_depuis_pappers(payload: dict) -> Entreprise:
    """Convertit la réponse JSON de l'API Pappers en objet ``Entreprise``.

    Note d'honnêteté : le mapping des champs ci-dessous suit le schéma
    documenté par Pappers pour l'endpoint ``/entreprise`` avec le paramètre
    ``comptes=true`` (bloc ``comptes``), mais n'a pas pu être vérifié contre
    une réponse réelle dans cet environnement. Vérifiez les noms de champs
    avec votre propre clé API avant un usage en production.
    """
    exercices: list[ExerciceComptable] = []
    for compte in payload.get("comptes", []):
        exercices.append(
            ExerciceComptable(
                annee=int(str(compte.get("date_cloture_exercice", ""))[:4] or 0),
                chiffre_affaires=float(compte.get("chiffre_affaires") or 0),
                resultat_net=float(compte.get("resultat_net") or 0),
                capitaux_propres=float(compte.get("capitaux_propres") or 0),
                dettes_totales=float(compte.get("total_dettes") or 0),
                actif_circulant=float(compte.get("actif_circulant") or 0),
                passif_circulant=float(compte.get("dettes_court_terme") or 0),
                resultat_exploitation=float(compte.get("resultat_exploitation") or 0),
                report_a_nouveau=float(compte.get("report_a_nouveau") or 0),
            )
        )
    return Entreprise(
        siret=payload.get("siret", ""),
        denomination=payload.get("nom_entreprise", "Entreprise (API Pappers)"),
        forme_juridique=payload.get("forme_juridique", ""),
        code_naf=payload.get("code_naf", ""),
        exercices=exercices,
    )


def recuperer_via_api_pappers(siret: str) -> Entreprise | None:
    """Interroge l'API Pappers si ``PAPPERS_API_KEY`` est défini.

    Retourne ``None`` si la clé n'est pas configurée, si l'entreprise est
    introuvable, ou si l'appel échoue (réseau, quota, clé invalide) -- dans
    tous les cas l'appelant doit alors se rabattre sur la base simulée.
    """
    cle_api = os.environ.get("PAPPERS_API_KEY")
    if not cle_api:
        return None
    try:
        reponse = requests.get(
            "https://api.pappers.fr/v2/entreprise",
            params={"api_token": cle_api, "siret": siret, "comptes": "true"},
            timeout=10,
        )
        reponse.raise_for_status()
        return _construire_entreprise_depuis_pappers(reponse.json())
    except (requests.RequestException, ValueError, KeyError):
        return None


# ---------------------------------------------------------------------------
# Point d'entrée unique utilisé par l'application
# ---------------------------------------------------------------------------


@st.cache_data(show_spinner=False)
def obtenir_entreprise(siret: str) -> tuple[Entreprise | None, str]:
    """Récupère une entreprise par SIRET.

    Retourne ``(entreprise, source)`` où ``source`` vaut ``"api_pappers"``
    ou ``"simulation"``. ``entreprise`` vaut ``None`` si le SIRET est
    introuvable dans les deux sources.
    """
    entreprise_api = recuperer_via_api_pappers(siret)
    if entreprise_api is not None and entreprise_api.exercices:
        return entreprise_api, "api_pappers"

    entreprise_simulee = _BASE_SIMULEE.get(siret)
    if entreprise_simulee is not None:
        return entreprise_simulee, "simulation"

    return None, "introuvable"
