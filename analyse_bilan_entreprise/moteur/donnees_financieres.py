"""Récupération des données financières réelles (chiffre d'affaires,
résultat net) d'une entreprise sur ses derniers exercices.

Sources interrogées dans cet ordre :

1. API RNE de l'INPI (Registre National des Entreprises,
   https://registre-national-entreprises.inpi.fr/api), si les variables
   d'environnement ``INPI_USERNAME`` et ``INPI_PASSWORD`` sont définies.
   C'est la source "officielle" demandée en priorité : contrairement à
   api.gouv.fr ou Pappers (simple clé), l'API RNE exige un compte INPI
   (gratuit, à créer sur inpi.fr) échangé contre un jeton porteur.

   ⚠️ AVERTISSEMENT D'HONNÊTETÉ IMPORTANT (à lire avant toute mise en
   production) : cette intégration n'a PAS pu être testée contre un compte
   INPI réel ni un appel réseau réel dans l'environnement où ce code a été
   écrit (accès réseau sortant restreint par un proxy sortant, aucun compte
   de test disponible). Le flux d'authentification (identifiants -> jeton
   porteur) suit le principe documenté publiquement pour l'API RNE, mais
   l'emplacement exact des champs "chiffre d'affaires" / "résultat net"
   dans la réponse JSON n'a pas pu être confirmé. Point structurel encore
   plus important : sur le RNE, les comptes annuels de nombreuses
   entreprises sont déposés sous forme de DOCUMENT (PDF ou liasse XBRL),
   pas de champs numériques déjà extraits -- il est donc possible que cette
   fonction ne trouve jamais de chiffre exploitable même avec un compte
   valide et une entreprise aux comptes publics, simplement parce que
   l'API ne les expose pas sous cette forme. Si c'est le cas, une étape de
   récupération + lecture du document (PDF/XBRL) serait nécessaire, ce qui
   dépasse le cadre d'un simple appel JSON et n'a pas été implémenté ici.
   Testez avec un compte réel et signalez tout écart de schéma constaté.

2. API Pappers (https://www.pappers.fr/api), si ``PAPPERS_API_KEY`` est
   définie -- source de repli à valeur ajoutée qui, elle, expose bien des
   chiffres déjà extraits. Même avertissement de non-vérification en
   conditions réelles que pour l'INPI (voir ``_recuperer_via_pappers``).

3. Dictionnaire de secours contenant EXCLUSIVEMENT les données réelles et
   vérifiées d'Olano Provence, communiquées explicitement par l'utilisateur
   de cette application. Aucune autre entreprise n'y figure et aucune
   valeur n'y est estimée ou complétée.

Si aucune de ces sources ne renvoie de chiffres : ``obtenir_donnees_financieres``
retourne ``(None, "indisponible")`` -- ou ``(None, "confidentiel")`` si
l'INPI signale explicitement des comptes non publics (article L.232-25 du
code de commerce, ouvert à certaines petites entreprises). Dans tous les
cas, l'application affiche un message explicite plutôt que d'inventer des
chiffres.
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


def _extraire_annee(valeur) -> int | None:
    chaine = str(valeur)[:4] if valeur is not None else ""
    return int(chaine) if chaine.isdigit() else None


# Données réelles vérifiées, communiquées explicitement par l'utilisateur.
# Aucun numéro SIRET officiel n'est connu pour cette entreprise à ce jour :
# le rapprochement se fait donc par dénomination normalisée. À remplacer par
# une clé SIRET/SIREN dès qu'il devient disponible (rapprochement plus
# fiable qu'une comparaison de nom).
_DONNEES_FINANCIERES_VERIFIEES: dict[str, list[ExerciceFinancier]] = {
    _normaliser("Olano Provence"): [
        ExerciceFinancier(annee=2022, chiffre_affaires=32_100_000, resultat_net=0),
        ExerciceFinancier(annee=2023, chiffre_affaires=18_100_000, resultat_net=-1_190_000),
        ExerciceFinancier(annee=2024, chiffre_affaires=8_980_000, resultat_net=-2_190_000),
    ],
}


# ---------------------------------------------------------------------------
# 1. API RNE de l'INPI (source officielle, prioritaire)
# ---------------------------------------------------------------------------


@st.cache_data(show_spinner=False, ttl=3000)
def _obtenir_jeton_inpi() -> str | None:
    """Authentifie l'application auprès de l'API RNE via un compte INPI
    (identifiant/mot de passe -> jeton porteur). Retourne ``None`` si les
    identifiants ne sont pas configurés ou si la connexion échoue."""
    identifiant = os.environ.get("INPI_USERNAME")
    mot_de_passe = os.environ.get("INPI_PASSWORD")
    if not identifiant or not mot_de_passe:
        return None
    try:
        reponse = requests.post(
            "https://registre-national-entreprises.inpi.fr/api/sso/login",
            json={"username": identifiant, "password": mot_de_passe},
            timeout=10,
        )
        reponse.raise_for_status()
        return reponse.json().get("token")
    except (requests.RequestException, ValueError):
        return None


def _recuperer_via_inpi(siren: str) -> tuple[list[ExerciceFinancier] | None, bool]:
    """Tente de récupérer les comptes annuels réels d'une entreprise depuis
    le RNE (INPI), à partir de son SIREN.

    Retourne ``(exercices, confidentiel)`` :
      - ``(liste nom vide, False)`` si des chiffres exploitables ont été extraits ;
      - ``(None, True)`` si l'entreprise a explicitement déclaré ses comptes
        confidentiels, ou si l'accès à ses comptes est refusé (403/451) --
        signal le plus probable de confidentialité sur cette API ;
      - ``(None, False)`` dans tous les autres cas (pas de compte INPI
        configuré, entreprise introuvable, erreur réseau, comptes déposés
        sous forme de document non structuré -- voir l'avertissement en
        tête de ce fichier).
    """
    jeton = _obtenir_jeton_inpi()
    if jeton is None or not siren:
        return None, False

    try:
        reponse = requests.get(
            f"https://registre-national-entreprises.inpi.fr/api/companies/{siren}",
            headers={"Authorization": f"Bearer {jeton}"},
            timeout=15,
        )
        if reponse.status_code in (403, 451):
            return None, True
        reponse.raise_for_status()
        donnees = reponse.json()
    except (requests.RequestException, ValueError):
        return None, False

    # Chemin d'accès aux comptes annuels basé sur la structure générale
    # documentée du RNE (bloc "formality" -> "content" -> comptes annuels) ;
    # NON vérifié contre une réponse réelle -- voir l'avertissement en tête
    # de fichier. Plusieurs chemins plausibles sont tentés par prudence.
    contenu = donnees.get("formality", {}).get("content", {}) if isinstance(donnees, dict) else {}
    blocs_comptes = (
        contenu.get("comptesAnnuels")
        or contenu.get("bilansSaisis")
        or (donnees.get("comptesAnnuels") if isinstance(donnees, dict) else None)
        or []
    )

    if isinstance(blocs_comptes, dict):
        if blocs_comptes.get("confidentialite") or blocs_comptes.get("confidentiel"):
            return None, True
        blocs_comptes = blocs_comptes.get("exercices", [])

    exercices: list[ExerciceFinancier] = []
    for bloc in blocs_comptes or []:
        if not isinstance(bloc, dict):
            continue
        if bloc.get("confidentialite") or bloc.get("confidentiel"):
            return None, True
        annee = _extraire_annee(bloc.get("dateClotureExercice") or bloc.get("annee"))
        chiffre_affaires = bloc.get("chiffreAffaires") or bloc.get("chiffre_affaires")
        resultat_net = bloc.get("resultatNet") or bloc.get("resultat_net")
        if annee is None or chiffre_affaires is None or resultat_net is None:
            continue
        exercices.append(
            ExerciceFinancier(annee=annee, chiffre_affaires=float(chiffre_affaires), resultat_net=float(resultat_net))
        )

    exercices.sort(key=lambda e: e.annee)
    return (exercices[-3:], False) if exercices else (None, False)


# ---------------------------------------------------------------------------
# 2. API Pappers (repli à valeur ajoutée)
# ---------------------------------------------------------------------------


def _recuperer_via_pappers(siret: str, cle_api: str) -> list[ExerciceFinancier] | None:
    """Avertissement identique à l'INPI ci-dessus : suit la documentation
    publique de Pappers, non vérifié par un appel réel dans cet
    environnement (accès réseau sortant restreint)."""
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
        annee = _extraire_annee(compte.get("date_cloture_exercice"))
        chiffre_affaires = compte.get("chiffre_affaires")
        resultat_net = compte.get("resultat_net")
        if annee is None or chiffre_affaires is None or resultat_net is None:
            continue
        exercices.append(
            ExerciceFinancier(annee=annee, chiffre_affaires=float(chiffre_affaires), resultat_net=float(resultat_net))
        )

    exercices.sort(key=lambda e: e.annee)
    return exercices[-3:] if exercices else None


# ---------------------------------------------------------------------------
# Point d'entrée unique utilisé par l'application
# ---------------------------------------------------------------------------


@st.cache_data(show_spinner=False, ttl=3600)
def obtenir_donnees_financieres(
    denomination: str, siret: str, siren: str = ""
) -> tuple[list[ExerciceFinancier] | None, str]:
    """Retourne ``(exercices, source)``.

    ``source`` vaut ``"inpi"``, ``"api_pappers"``, ``"verifie_manuel"``,
    ``"confidentiel"`` ou ``"indisponible"``. ``exercices`` vaut ``None``
    uniquement pour ``"confidentiel"`` et ``"indisponible"`` -- jamais de
    liste partiellement inventée.
    """
    if siren:
        donnees_inpi, confidentiel = _recuperer_via_inpi(siren)
        if donnees_inpi:
            return donnees_inpi, "inpi"
        if confidentiel:
            return None, "confidentiel"

    cle_api = os.environ.get("PAPPERS_API_KEY")
    if cle_api and siret and siret != "N/C":
        donnees_pappers = _recuperer_via_pappers(siret, cle_api)
        if donnees_pappers:
            return donnees_pappers, "api_pappers"

    donnees_verifiees = _DONNEES_FINANCIERES_VERIFIEES.get(_normaliser(denomination))
    if donnees_verifiees:
        return donnees_verifiees, "verifie_manuel"

    return None, "indisponible"
