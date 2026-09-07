"""Application Streamlit -- Analyse prédictive et probabiliste de bilans
d'entreprises françaises.

Lancement :
    streamlit run app.py

Architecture (voir le paquet ``moteur/``) :
    1. annuaire_entreprises -- identité légale réelle via l'API publique
                                gratuite du gouvernement français
                                (recherche-entreprises.api.gouv.fr)
    2. donnees_financieres  -- chiffre d'affaires / résultat net réels,
                                via l'API Pappers si configurée, sinon un
                                unique jeu de données vérifié (Olano
                                Provence) -- jamais de valeur inventée
    3. transition           -- probabilités de transition par inertie
                                matricielle, à partir des 3 derniers
                                exercices réels
    4. bayes                -- correction bayésienne à partir de 2 facteurs
                                humains (sidebar)
    5. visualisation        -- graphique en couronne (donut) Plotly

Avertissement méthodologique : le modèle de transition par inertie et les
vraisemblances bayésiennes sont des heuristiques d'ingénierie construites
pour cette application, pas des statistiques mesurées empiriquement -- voir
les docstrings de ``moteur/transition.py`` et ``moteur/bayes.py``.
"""

from __future__ import annotations

import streamlit as st

from moteur import annuaire_entreprises, bayes, donnees_financieres, transition, visualisation

st.set_page_config(
    page_title="Analyse prédictive de bilans d'entreprises",
    page_icon="📊",
    layout="wide",
)


# ---------------------------------------------------------------------------
# Écran de verrouillage par mot de passe
# ---------------------------------------------------------------------------

MOT_DE_PASSE_PAR_DEFAUT = "Olano2026"


def _obtenir_mot_de_passe_attendu() -> str:
    """Retourne le mot de passe attendu.

    Priorité à ``st.secrets["MOT_DE_PASSE_APP"]`` s'il est défini (méthode
    recommandée sur Streamlit Community Cloud : Settings > Secrets), ce qui
    évite d'exposer le mot de passe en clair dans le dépôt public. À défaut,
    la valeur par défaut ci-dessus est utilisée.
    """
    try:
        return st.secrets.get("MOT_DE_PASSE_APP", MOT_DE_PASSE_PAR_DEFAUT)
    except Exception:
        return MOT_DE_PASSE_PAR_DEFAUT


def _verifier_authentification() -> None:
    """Bloque l'accès à l'application tant que le mot de passe correct n'a
    pas été saisi. Interrompt l'exécution du script (``st.stop()``) tant que
    l'utilisateur n'est pas authentifié."""
    if st.session_state.get("authentifie", False):
        return

    st.title("🔒 Accès restreint")
    st.caption("Cette application est protégée par mot de passe.")

    with st.form("formulaire_authentification"):
        mot_de_passe_saisi = st.text_input("Mot de passe", type="password")
        soumis = st.form_submit_button("Se connecter")

    if soumis:
        if mot_de_passe_saisi == _obtenir_mot_de_passe_attendu():
            st.session_state["authentifie"] = True
            st.rerun()
        else:
            st.error("Mot de passe incorrect.")

    st.stop()


_verifier_authentification()


# ---------------------------------------------------------------------------
# Barre latérale : facteur bayésien
# ---------------------------------------------------------------------------

st.sidebar.header("🧠 Facteur bayésien")
st.sidebar.caption(
    "Ces réponses corrigent les probabilités historiques via le théorème de Bayes."
)

reponse_nouveaux_clients = (
    st.sidebar.radio("De nouveaux clients ont-ils été acquis ?", ["Non", "Oui"], horizontal=True) == "Oui"
)
reponse_flux_bloques = (
    st.sidebar.radio(
        "Les flux de transport sont-ils bloqués par une autre filiale (Vedène) ?",
        ["Non", "Oui"],
        horizontal=True,
    )
    == "Oui"
)

reponses_bayesiennes = {
    "nouveaux_clients": reponse_nouveaux_clients,
    "flux_bloques": reponse_flux_bloques,
}


# ---------------------------------------------------------------------------
# Corps principal -- recherche d'entreprise
# ---------------------------------------------------------------------------

st.title("📊 Analyse prédictive et probabiliste de bilans d'entreprises")
st.caption(
    "Identité légale en temps réel (API publique gouvernementale) + données "
    "financières réelles -- modèle d'inertie matricielle et correction bayésienne."
)

with st.form("formulaire_recherche"):
    requete_utilisateur = st.text_input(
        "Nom de l'entreprise ou numéro SIRET",
        placeholder="ex. : Olano Provence, ou 552032534...",
        value=st.session_state.get("derniere_requete", ""),
    )
    lancer_recherche = st.form_submit_button("Rechercher")

if lancer_recherche and requete_utilisateur.strip():
    st.session_state["derniere_requete"] = requete_utilisateur.strip()

requete_active = st.session_state.get("derniere_requete", "")

if not requete_active:
    st.info("Saisissez le nom d'une entreprise française ou son SIRET pour lancer l'analyse.")
    st.stop()

with st.spinner(f"Recherche de « {requete_active} » sur le registre public (api.gouv.fr)..."):
    identite = annuaire_entreprises.rechercher_entreprise(requete_active)

if identite is None:
    st.error(
        f"❌ Entreprise introuvable pour « {requete_active} » sur le registre public "
        "(recherche-entreprises.api.gouv.fr). Vérifiez l'orthographe ou le numéro SIRET saisi."
    )
    st.stop()

st.success(f"✅ Entreprise trouvée sur le registre public : « {identite.denomination} »")

col_identite_1, col_identite_2, col_identite_3, col_identite_4 = st.columns(4)
col_identite_1.metric("Dénomination", identite.denomination)
col_identite_2.metric("SIRET", identite.siret)
col_identite_3.metric("Code NAF", identite.code_naf)
col_identite_4.metric("Commune du siège", identite.commune_siege)
st.caption(
    "Champs renvoyés tels quels par l'API publique recherche-entreprises.api.gouv.fr "
    f"(catégorie juridique, code INSEE : {identite.categorie_juridique_code})."
)

st.markdown("---")

# ---------------------------------------------------------------------------
# 1. Données financières réelles
# ---------------------------------------------------------------------------

st.header("1. Données financières")

exercices, source_financiere = donnees_financieres.obtenir_donnees_financieres(
    identite.denomination, identite.siret
)

if exercices is None:
    st.error(
        "❌ **Données financières non disponibles sur les registres publics.** "
        "Aucune valeur n'est affichée ou estimée pour cette entreprise : ni l'API Pappers "
        "(non configurée ou sans résultat) ni la base vérifiée manuellement ne contiennent "
        "ses comptes. Pour activer l'API Pappers, définissez la variable d'environnement "
        "`PAPPERS_API_KEY`."
    )
    st.stop()

if source_financiere == "api_pappers":
    st.success("✅ Chiffre d'affaires et résultat net récupérés via l'API Pappers.")
else:
    st.info(
        "ℹ️ Chiffre d'affaires et résultat net : données réelles vérifiées manuellement "
        "(l'API Pappers n'est pas configurée -- définissez `PAPPERS_API_KEY` pour l'activer)."
    )

if len(exercices) < 2:
    st.error("Au moins 2 exercices comptables sont nécessaires pour cette analyse ; un seul est disponible.")
    st.stop()

exercices_tries = sorted(exercices, key=lambda e: e.annee)
annees = [ex.annee for ex in exercices_tries]
resultats_nets = [ex.resultat_net for ex in exercices_tries]
chiffres_affaires = [ex.chiffre_affaires for ex in exercices_tries]

st.dataframe(
    {
        "Année": annees,
        "Chiffre d'affaires (€)": chiffres_affaires,
        "Résultat net (€)": resultats_nets,
    },
    use_container_width=True,
    hide_index=True,
)

st.plotly_chart(
    visualisation.graphique_evolution_historique(annees, resultats_nets),
    use_container_width=True,
)

st.markdown("---")

# ---------------------------------------------------------------------------
# 2. Probabilités de transition (inertie matricielle)
# ---------------------------------------------------------------------------

st.header("2. Probabilités de transition (inertie matricielle)")

resultat_transition = transition.calculer_transition_inertie(resultats_nets, chiffres_affaires)

libelles_etats_observes = [visualisation.LIBELLES[e] for e in resultat_transition.etats_observes]
st.write(
    "États observés sur les exercices "
    + ", ".join(f"{a} → *{lib}*" for a, lib in zip(annees, libelles_etats_observes))
)

col_trans_1, col_trans_2 = st.columns([1, 1])
with col_trans_1:
    st.markdown("**Probabilités historiques (avant facteur humain)**")
    for etat in transition.ETATS:
        proba = resultat_transition.probabilites_historiques[etat]
        st.progress(
            min(max(proba, 0.0), 1.0),
            text=f"{visualisation.LIBELLES[etat]} — {proba * 100:.1f} %",
        )
with col_trans_2:
    tendance_txt = "en amélioration 📈" if resultat_transition.pente_tendance > 0 else "en dégradation 📉"
    st.metric("Pente de tendance du résultat net", f"{resultat_transition.pente_tendance:,.0f} €/an")
    st.caption(f"Tendance générale des {len(annees)} derniers bilans : {tendance_txt}")
    st.caption(
        "Modèle heuristique (voir `moteur/transition.py`) : mélange d'une matrice "
        "de transition empirique (lissage de Laplace) et d'un vecteur d'inertie "
        "centré sur le dernier état observé."
    )

st.markdown("---")

# ---------------------------------------------------------------------------
# 3. Correction bayésienne et résultat final
# ---------------------------------------------------------------------------

st.header("3. Correction bayésienne et résultat final")

resultat_bayes = bayes.corriger_probabilites(
    resultat_transition.probabilites_historiques, reponses_bayesiennes
)

col_bayes_resume, col_bayes_donut = st.columns([1, 1])

with col_bayes_resume:
    st.markdown("**Facteurs humains appliqués**")
    for question, reponse in reponses_bayesiennes.items():
        icone = "✅ Oui" if reponse else "❌ Non"
        st.write(f"- {bayes.LIBELLES_QUESTIONS[question]} : {icone}")

    scenario_le_plus_probable = max(
        resultat_bayes.probabilites_posterieures, key=resultat_bayes.probabilites_posterieures.get
    )
    proba_max = resultat_bayes.probabilites_posterieures[scenario_le_plus_probable]
    couleur_scenario = visualisation.COULEURS[scenario_le_plus_probable]
    st.markdown(
        f"""
        <div style="background-color:{couleur_scenario}22;border:2px solid {couleur_scenario};
                    border-radius:10px;padding:1rem;text-align:center;margin-top:1rem;">
            <div style="font-size:0.9rem;color:#555;">Scénario le plus probable</div>
            <div style="font-size:1.5rem;font-weight:700;color:{couleur_scenario};">
                {visualisation.LIBELLES[scenario_le_plus_probable]} ({proba_max * 100:.1f} %)
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

with col_bayes_donut:
    st.plotly_chart(
        visualisation.graphique_donut_scenarios(
            resultat_bayes.probabilites_posterieures, "Répartition finale des scénarios"
        ),
        use_container_width=True,
    )

st.caption(
    "Les vraisemblances utilisées pour la correction bayésienne sont des "
    "hypothèses d'expert définies dans `moteur/bayes.py` (TABLE_VRAISEMBLANCES), "
    "pas des statistiques mesurées — elles sont ajustables selon le contexte métier."
)
