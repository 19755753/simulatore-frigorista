"""Application Streamlit -- Analyse prédictive et probabiliste de bilans
d'entreprises françaises.

Lancement :
    streamlit run app.py

Architecture (voir le paquet ``moteur/``) :
    1. donnees_entreprise -- récupération des données (API Pappers ou simulation)
    2. zscore             -- Z''-Score d'Altman (probabilité de défaillance)
    3. transition          -- probabilités de transition par inertie matricielle
    4. bayes                -- correction bayésienne à partir du facteur humain
    5. visualisation          -- graphiques Plotly

Avertissement : cet outil est une aide à la décision pédagogique. Le Z-Score
d'Altman est une méthode académique publiée (Altman, 1995) ; le modèle de
transition par inertie et les vraisemblances bayésiennes sont des
heuristiques d'ingénierie construites pour cette application, pas des
statistiques mesurées empiriquement -- voir les docstrings des modules
``transition.py`` et ``bayes.py`` pour le détail des hypothèses.
"""

from __future__ import annotations

import streamlit as st

from moteur import bayes, donnees_entreprise, transition, visualisation, zscore

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
# Barre latérale : sélection de l'entreprise + facteur bayésien
# ---------------------------------------------------------------------------

st.sidebar.header("🏢 Entreprise")

entreprises_demo = donnees_entreprise.liste_entreprises_demo()
options_siret = list(entreprises_demo.keys()) + ["Autre SIRET (saisie manuelle)"]
etiquettes = {siret: f"{entreprises_demo[siret]} — {siret}" for siret in entreprises_demo}
etiquettes["Autre SIRET (saisie manuelle)"] = "Autre SIRET (saisie manuelle)"

choix = st.sidebar.selectbox(
    "Entreprise (démonstration)",
    options=options_siret,
    format_func=lambda s: etiquettes[s],
)

if choix == "Autre SIRET (saisie manuelle)":
    siret_saisi = st.sidebar.text_input("Numéro SIRET (14 chiffres)", max_chars=14)
    siret_actif = siret_saisi.strip()
else:
    siret_actif = choix

st.sidebar.markdown("---")
st.sidebar.header("🧠 Facteur bayésien")
st.sidebar.caption(
    "Ces réponses corrigent les probabilités historiques via le théorème de Bayes."
)

reponse_nouveaux_clients = st.sidebar.toggle("De nouveaux clients ont été acquis ?", value=False)
reponse_flux_bloques = st.sidebar.toggle(
    "Flux de transport bloqués par une autre filiale (ex : Vedène) ?", value=False
)
reponse_projet_fusion = st.sidebar.toggle(
    "Projet de fusion / optimisation des coûts en cours ?", value=False
)

reponses_bayesiennes = {
    "nouveaux_clients": reponse_nouveaux_clients,
    "flux_bloques": reponse_flux_bloques,
    "projet_fusion": reponse_projet_fusion,
}


# ---------------------------------------------------------------------------
# Corps principal
# ---------------------------------------------------------------------------

st.title("📊 Analyse prédictive et probabiliste de bilans d'entreprises")
st.caption(
    "Application d'aide à la décision — Z-Score d'Altman, modèle d'inertie "
    "matricielle et correction bayésienne."
)

if not siret_actif:
    st.info("Renseignez un SIRET dans la barre latérale pour lancer l'analyse.")
    st.stop()

entreprise, source = donnees_entreprise.obtenir_entreprise(siret_actif)

if entreprise is None:
    st.error(
        f"Aucune donnée trouvée pour le SIRET « {siret_actif} ». "
        "Sélectionnez une entreprise de démonstration dans la barre latérale, "
        "ou configurez la variable d'environnement PAPPERS_API_KEY pour "
        "interroger l'API réelle."
    )
    st.stop()

if source == "simulation" and entreprise.donnees_fictives:
    st.warning(
        f"⚠️ **Mode démonstration** : les données de « {entreprise.denomination} » "
        "sont **simulées** (données fictives à but pédagogique), pas des données "
        "réelles issues de l'INPI ou de Pappers. Pour connecter l'API réelle, "
        "définissez la variable d'environnement `PAPPERS_API_KEY`."
    )
elif source == "simulation" and not entreprise.donnees_fictives:
    st.info(
        f"ℹ️ **Données réelles partielles** : le chiffre d'affaires et le résultat net de "
        f"« {entreprise.denomination} » sont des données réelles fournies manuellement "
        "(hors API INPI/Pappers). Les autres postes du bilan (capitaux propres, dettes, "
        "actif/passif circulant, EBIT, report à nouveau) ne sont pas renseignés : le "
        "Z-Score d'Altman n'est donc pas calculable pour cette entreprise (voir section 2.1)."
    )
elif source == "api_pappers":
    st.success(f"✅ Données récupérées via l'API Pappers pour « {entreprise.denomination} ».")

exercices_tries = sorted(entreprise.exercices, key=lambda e: e.annee)
if len(exercices_tries) < 2:
    st.error("Au moins 2 exercices comptables sont nécessaires pour cette analyse.")
    st.stop()

col_identite_1, col_identite_2, col_identite_3 = st.columns(3)
col_identite_1.metric("Dénomination", entreprise.denomination)
col_identite_2.metric("Forme juridique", entreprise.forme_juridique or "N/C")
col_identite_3.metric("Code NAF", entreprise.code_naf or "N/C")

st.markdown("---")

# ---------------------------------------------------------------------------
# 1. Analyse historique
# ---------------------------------------------------------------------------

st.header("1. Analyse historique")

historique_df = entreprise.historique_dataframe()
st.dataframe(historique_df, use_container_width=True, hide_index=True)

annees = [ex.annee for ex in exercices_tries]
resultats_nets = [ex.resultat_net for ex in exercices_tries]
chiffres_affaires = [ex.chiffre_affaires for ex in exercices_tries]

st.plotly_chart(
    visualisation.graphique_evolution_historique(annees, resultats_nets),
    use_container_width=True,
)

st.markdown("---")

# ---------------------------------------------------------------------------
# 2. Moteur mathématique -- Z-Score d'Altman
# ---------------------------------------------------------------------------

st.header("2. Moteur mathématique")

st.subheader("2.1. Z-Score d'Altman (probabilité de défaillance)")

dernier_exercice = exercices_tries[-1]

if not dernier_exercice.donnees_bilan_completes:
    st.info(
        "ℹ️ Le Z-Score d'Altman ne peut pas être calculé pour cette entreprise : "
        "les postes de bilan nécessaires (capitaux propres, dettes, actif/passif "
        "circulant, résultat d'exploitation, report à nouveau) ne sont pas "
        "renseignés pour l'exercice le plus récent. Aucune valeur n'est estimée ou "
        "inventée à leur place."
    )
else:
    try:
        resultat_z = zscore.calculer_zscore_altman(
            actif_total=dernier_exercice.actif_total,
            actif_circulant=dernier_exercice.actif_circulant,
            passif_circulant=dernier_exercice.passif_circulant,
            report_a_nouveau=dernier_exercice.report_a_nouveau,
            resultat_exploitation=dernier_exercice.resultat_exploitation,
            capitaux_propres=dernier_exercice.capitaux_propres,
            dettes_totales=dernier_exercice.dettes_totales,
        )
    except ValueError as erreur:
        st.error(f"Impossible de calculer le Z-Score : {erreur}")
        st.stop()

    couleur_zone = visualisation.COULEURS_ZONE_ZSCORE[resultat_z.zone]
    col_zscore_1, col_zscore_2 = st.columns([1, 2])
    with col_zscore_1:
        st.markdown(
            f"""
            <div style="background-color:{couleur_zone}22;border:2px solid {couleur_zone};
                        border-radius:10px;padding:1.2rem;text-align:center;">
                <div style="font-size:0.9rem;color:#555;">Z''-Score d'Altman ({dernier_exercice.annee})</div>
                <div style="font-size:2.2rem;font-weight:700;color:{couleur_zone};">{resultat_z.z_score:.2f}</div>
                <div style="font-size:1rem;font-weight:600;color:{couleur_zone};">Zone {resultat_z.zone}</div>
            </div>
            """,
            unsafe_allow_html=True,
        )
    with col_zscore_2:
        st.markdown(
            "- **Zone Verte** (Z'' > 2.6) : risque de défaillance faible\n"
            "- **Zone Jaune** (1.1 ≤ Z'' ≤ 2.6) : zone d'incertitude, vigilance requise\n"
            "- **Zone Rouge** (Z'' < 1.1) : risque de défaillance élevé"
        )

    with st.expander("Détail des composantes du Z''-Score"):
        st.table(
            {
                "Composante": [
                    "X1 — Fonds de roulement / Actif total",
                    "X2 — Réserves (report à nouveau) / Actif total",
                    "X3 — Résultat d'exploitation / Actif total",
                    "X4 — Capitaux propres / Dettes totales",
                ],
                "Valeur": [
                    f"{resultat_z.x1_fonds_roulement:.3f}",
                    f"{resultat_z.x2_reserves:.3f}",
                    f"{resultat_z.x3_rentabilite_exploitation:.3f}",
                    f"{resultat_z.x4_solvabilite:.3f}",
                ],
            }
        )
        st.caption(
            "Modèle Z''-Score d'Altman pour entreprises non-manufacturières / "
            "marchés émergents (Altman, Hartzell & Peck, 1995)."
        )

st.markdown("")
st.subheader("2.2. Probabilités de transition (inertie matricielle)")

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
# 3. et 4. Correction bayésienne et résultat final
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

st.plotly_chart(
    visualisation.graphique_barres_comparaison(
        resultat_bayes.probabilites_anterieures, resultat_bayes.probabilites_posterieures
    ),
    use_container_width=True,
)

st.caption(
    "Les vraisemblances utilisées pour la correction bayésienne sont des "
    "hypothèses d'expert définies dans `moteur/bayes.py` (TABLE_VRAISEMBLANCES), "
    "pas des statistiques mesurées — elles sont ajustables selon le contexte métier."
)
