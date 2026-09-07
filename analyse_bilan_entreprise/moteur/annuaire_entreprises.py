"""Recherche de l'identité légale d'une entreprise française, en temps réel,
via l'API publique et gratuite du gouvernement français "Recherche
d'entreprises" (https://recherche-entreprises.api.gouv.fr) -- aucune clé
requise. La requête peut être une dénomination sociale ou un numéro SIRET :
l'API sait reconnaître les deux formats.

Avertissement d'honnêteté : le mapping des champs ci-dessous suit le schéma
documenté publiquement pour cette API au moment de l'écriture de ce code,
mais n'a pas pu être vérifié contre un appel réseau réel dans cet
environnement de développement (l'accès réseau sortant y est restreint par
un proxy sortant). Le code est écrit de façon défensive (accès ``.get()``
avec valeurs de repli, capture large des exceptions réseau/format) pour
échouer proprement -- renvoyer ``None`` -- plutôt que de planter si un champ
de la réponse diffère de ce qui est documenté. Vérifiez son comportement
avec un appel réel avant un usage en production, et signalez tout écart de
schéma constaté.
"""

from __future__ import annotations

from dataclasses import dataclass

import requests
import streamlit as st

URL_RECHERCHE = "https://recherche-entreprises.api.gouv.fr/search"


@dataclass
class IdentiteEntreprise:
    denomination: str
    siret: str
    siren: str
    code_naf: str
    categorie_juridique_code: str
    commune_siege: str


@st.cache_data(show_spinner=False, ttl=3600)
def rechercher_entreprise(requete: str) -> IdentiteEntreprise | None:
    """Recherche une entreprise par nom ou SIRET sur le registre public.

    Retourne ``None`` si la requête est vide, si l'entreprise est
    introuvable, ou si l'appel échoue pour n'importe quelle raison (réseau,
    format de réponse inattendu, timeout) -- dans tous les cas, l'appelant
    doit alors afficher un message clair plutôt que des données partielles
    ou incohérentes.
    """
    requete = requete.strip()
    if not requete:
        return None

    try:
        reponse = requests.get(
            URL_RECHERCHE,
            params={"q": requete, "page": 1, "per_page": 1},
            timeout=10,
        )
        reponse.raise_for_status()
        donnees = reponse.json()
    except (requests.RequestException, ValueError):
        return None

    resultats = donnees.get("results") or []
    if not resultats:
        return None

    resultat = resultats[0]
    siege = resultat.get("siege") or {}

    siret = siege.get("siret")
    if not siret:
        return None

    return IdentiteEntreprise(
        denomination=resultat.get("nom_complet") or resultat.get("nom_raison_sociale") or "Dénomination inconnue",
        siret=siret,
        siren=resultat.get("siren") or "N/C",
        code_naf=resultat.get("activite_principale") or "N/C",
        categorie_juridique_code=resultat.get("nature_juridique") or "N/C",
        commune_siege=siege.get("libelle_commune") or "N/C",
    )
