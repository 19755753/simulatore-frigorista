"""Récupération des données financières réelles (chiffre d'affaires,
résultat net) d'une entreprise sur ses derniers exercices.

Deux sources, interrogées dans cet ordre :

1. API Pappers (https://www.pappers.fr/api), si la variable d'environnement
   ``PAPPERS_API_KEY`` est définie. Comme pour le module
   ``annuaire_entreprises``, cette intégration suit la documentation
   publique de l'API mais n'a pas pu être validée par un appel réel dans cet
   environnement de développement (accès réseau sortant restreint, pas de
   clé de test disponible) -- vérifiez-la avec votre propre clé avant un
   usage en production.

2. Dictionnaire de secours contenant EXCLUSIVEMENT les données réelles et
   vérifiées d'Olano Provence, communiquées explicitement par l'utilisateur
   de cette application. Aucune autre entreprise n'y figure et aucune valeur
   n'y est estimée ou complétée : pour toute autre société, si l'API Pappers
   n'est pas configurée ou ne renvoie rien, ``obtenir_donnees_financieres``
   retourne ``(None, "indisponible")`` et l'application doit afficher un
   message d'erreur explicite plutôt que d'inventer des chiffres.
"""

from __future__ import annotations

import os
import unicodedata
from dataclasses import dataclass

import requests
import streamlit as st


@dataclass
class ExerciceFinancier:
    annee: int
    chiffre_affaires: float
    resultat_net: float


def _normaliser(texte: str) -> str:
    """Normalise un nom d'entreprise pour comparaison (majuscules, sans accents ni espaces superflus)."""
    texte_sans_accents = unicodedata.normalize("NFKD", texte).encode("ascii", "ignore").decode("ascii")
    return " ".join(texte_sans_accents.upper().split())


# Données réelles vérifiées, communiquées explicitement par l'utilisateur.
# Aucun numéro SIRET officiel n'est connu pour cette entreprise à ce jour :
# le rapprochement se fait donc par dénomination normalisée. À remplacer par
# une clé SIRET dès qu'il devient disponible (rapprochement plus fiable
# qu'une comparaison de nom, qui peut échouer sur une variante orthographique
# renvoyée par l'annuaire officiel).
_DONNEES_FINANCIERES_VERIFIEES: dict[str, list[ExerciceFinancier]] = {
    _normaliser("Olano Provence"): [
        ExerciceFinancier(annee=2022, chiffre_affaires=32_100_000, resultat_net=0),
        ExerciceFinancier(annee=2023, chiffre_affaires=18_100_000, resultat_net=-1_190_000),
        ExerciceFinancier(annee=2024, chiffre_affaires=8_980_000, resultat_net=-2_190_000),
    ],
}


def _recuperer_via_pappers(siret: str, cle_api: str) -> list[ExerciceFinancier] | None:
    try:
        reponse = requests.get(
            "https://api.pappers.fr/v2/entreprise",
            params={"api_token": cle_api, "siret": siret, "comptes": "true"},
            timeout=10,
        )
        reponse.raise_for_status()
        payload = reponse.json()
    except (requests.RequestException, ValueError):
        return None

    exercices: list[ExerciceFinancier] = []
    for compte in payload.get("comptes", []):
        annee_str = str(compte.get("date_cloture_exercice", ""))[:4]
        chiffre_affaires = compte.get("chiffre_affaires")
        resultat_net = compte.get("resultat_net")
        if not annee_str.isdigit() or chiffre_affaires is None or resultat_net is None:
            continue
        exercices.append(
            ExerciceFinancier(annee=int(annee_str), chiffre_affaires=float(chiffre_affaires), resultat_net=float(resultat_net))
        )

    exercices.sort(key=lambda e: e.annee)
    return exercices[-3:] if exercices else None


@st.cache_data(show_spinner=False, ttl=3600)
def obtenir_donnees_financieres(denomination: str, siret: str) -> tuple[list[ExerciceFinancier] | None, str]:
    """Retourne ``(exercices, source)``.

    ``source`` vaut ``"api_pappers"``, ``"verifie_manuel"`` ou
    ``"indisponible"``. ``exercices`` vaut ``None`` uniquement dans ce
    dernier cas -- jamais de liste partiellement inventée.
    """
    cle_api = os.environ.get("PAPPERS_API_KEY")
    if cle_api and siret and siret != "N/C":
        donnees_pappers = _recuperer_via_pappers(siret, cle_api)
        if donnees_pappers:
            return donnees_pappers, "api_pappers"

    donnees_verifiees = _DONNEES_FINANCIERES_VERIFIEES.get(_normaliser(denomination))
    if donnees_verifiees:
        return donnees_verifiees, "verifie_manuel"

    return None, "indisponible"
