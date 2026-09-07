"""Application Streamlit -- Analyse prédictive et probabiliste de bilans
d'entreprises françaises. Version volontairement ultra-simple et robuste :
pas de fonction complexe mise en cache pour les données financières (source
d'un TypeError en production après un redéploiement partiel), pas de
dépendance à des API tierces nécessitant des identifiants (INPI, Pappers).

Lancement :
    streamlit run app.py

Étapes :
    1. Mot de passe ("Olano2026" par défaut, voir ``st.secrets``).
    2. Recherche d'identité légale réelle via l'API publique et gratuite du
       gouvernement français (recherche-entreprises.api.gouv.fr).
    3. Saisie du chiffre d'affaires et du résultat net des 3 derniers
       exercices (``st.number_input``, pré-remplis avec les données réelles
       vérifiées d'Olano Provence si l'entreprise trouvée correspond,
       sinon à 0) -- l'utilisateur lit ces chiffres sur Pappers ou un
       autre registre officiel et les saisit lui-même ; l'application
       n'en invente ni n'en télécharge aucun.
    4. Calcul des probabilités de transition (inertie matricielle, voir
       ``moteur/transition.py``) puis correction bayésienne (2 facteurs
       humains en sidebar, voir ``moteur/bayes.py``) et graphique en
       couronne Plotly (voir ``moteur/visualisation.py``) -- recalculés
       instantanément à chaque modification d'un chiffre ou d'un facteur.

Avertissement méthodologique : le modèle de transition par inertie et les
vraisemblances bayésiennes sont des heuristiques d'ingénierie construites
pour cette application, pas des statistiques mesurées empiriquement -- voir
les docstrings de ``moteur/transition.py`` et ``moteur/bayes.py``.
"""

from __future__ import annotations

import datetime
import unicodedata

import streamlit as st

from moteur import annuaire_entreprises, bayes, transition, visualisation

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
    """Priorité à ``st.secrets["MOT_DE_PASSE_APP"]`` (Streamlit Cloud :
    Settings > Secrets) pour éviter d'exposer le mot de passe en clair dans
    le dépôt public ; sinon la valeur par défaut ci-dessus."""
    try:
        return st.secrets.get("MOT_DE_PASSE_APP", MOT_DE_PASSE_PAR_DEFAUT)
    except Exception:
        return MOT_DE_PASSE_PAR_DEFAUT


def _verifier_authentification() -> None:
    """Bloque l'accès à l'application tant que le mot de passe correct n'a
    pas été saisi."""
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

st.sidebar.markdown("---")
if st.sidebar.button("🗑️ Réinitialiser les données"):
    for _i in range(3):
        st.session_state[f"ca_{_i}"] = 0.0
        st.session_state[f"rn_{_i}"] = 0.0
st.sidebar.caption("Remet les 3 champs de chiffre d'affaires et de résultat net à 0,00 €.")


# ---------------------------------------------------------------------------
# Recherche d'entreprise (identité légale réelle)
# ---------------------------------------------------------------------------

st.title("📊 Analyse prédictive et probabiliste de bilans d'entreprises")
st.caption(
    "Identité légale en temps réel (API publique gouvernementale) + saisie du CA et du "
    "résultat net -- modèle d'inertie matricielle et correction bayésienne."
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
    identite = annuaire_entreprises.rechercher_entreprise(requete_active.strip())

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
# 1. Chiffre d'affaires et résultat net (saisie directe)
# ---------------------------------------------------------------------------

st.header("1. Données financières")
st.caption(
    "Saisissez le chiffre d'affaires et le résultat net réels des 3 derniers exercices "
    "(source : Pappers ou un autre registre officiel). Chaque modification recalcule "
    "immédiatement l'analyse ci-dessous."
)


def _normaliser(texte: str) -> str:
    texte_sans_accents = unicodedata.normalize("NFKD", texte).encode("ascii", "ignore").decode("ascii")
    return " ".join(texte_sans_accents.upper().split())


# Pré-remplissage avec les données réelles vérifiées d'Olano Provence si
# l'entreprise trouvée y correspond (comparaison souple : la dénomination
# officielle renvoyée par l'API peut inclure un suffixe de forme juridique).
# Pour toute autre entreprise, les champs sont initialisés à 0 -- aucune
# valeur n'est devinée ou inventée par l'application.
ANNEE_COURANTE = datetime.date.today().year
if "OLANO PROVENCE" in _normaliser(identite.denomination):
    valeurs_par_defaut = [
        (2024, 8_980_000.0, -2_190_000.0),
        (2023, 18_100_000.0, -1_190_000.0),
        (2022, 32_100_000.0, 0.0),
    ]
else:
    valeurs_par_defaut = [(ANNEE_COURANTE - i, 0.0, 0.0) for i in (1, 2, 3)]

annees: list[int] = []
chiffres_affaires: list[float] = []
resultats_nets: list[float] = []

for indice, (annee_defaut, ca_defaut, rn_defaut) in enumerate(valeurs_par_defaut):
    col_annee, col_ca, col_rn = st.columns(3)
    annee = col_annee.number_input(
        "Année", min_value=2000, max_value=ANNEE_COURANTE,
        value=annee_defaut, step=1, key=f"annee_{indice}",
    )
    chiffre_affaires = col_ca.number_input(
        "Chiffre d'affaires (€)", min_value=0.0, value=ca_defaut,
        step=1000.0, format="%.2f", key=f"ca_{indice}",
    )
    resultat_net = col_rn.number_input(
        "Résultat net (€)", value=rn_defaut,
        step=1000.0, format="%.2f", key=f"rn_{indice}",
    )
    annees.append(int(annee))
    chiffres_affaires.append(chiffre_affaires)
    resultats_nets.append(resultat_net)

ordre = sorted(range(len(annees)), key=lambda i: annees[i])
annees = [annees[i] for i in ordre]
chiffres_affaires = [chiffres_affaires[i] for i in ordre]
resultats_nets = [resultats_nets[i] for i in ordre]

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

st.markdown("---")

# ---------------------------------------------------------------------------
# 4. Simulateur de scénarios & projections financières
# ---------------------------------------------------------------------------

st.header("🔮 Simulateur de Scénarios & Projections Financières")
st.caption(
    "Simulation de sensibilité, indépendante du modèle probabiliste ci-dessus : quel "
    "impact aurait une variation du volume d'activité sur le résultat net du dernier "
    "exercice ? Hypothèse simplificatrice de **charges 100% fixes** : toute variation "
    "du chiffre d'affaires se répercute intégralement, en euros, sur le résultat net "
    "-- une baisse d'activité aggrave donc toujours le résultat (qu'il soit déjà "
    "bénéficiaire ou déficitaire), une hausse l'améliore toujours. C'est un scénario "
    "de sensibilité maximale (le plus défavorable en cas de baisse), pas une "
    "prévision réaliste qui tiendrait compte de charges variables."
)

variation_pct = st.slider(
    "Variation attendue du prochain exercice (%)",
    min_value=-100, max_value=100, value=0, step=5,
    format="%d%%",
)

dernier_ca_connu = chiffres_affaires[-1]
dernier_resultat_net_connu = resultats_nets[-1]

nouveau_ca_simule = dernier_ca_connu * (1 + variation_pct / 100)

# Le résultat net simulé n'est pas obtenu en multipliant le résultat net par
# le même facteur que le CA : cette approche naïve inverse le sens
# économique dès que le résultat net de départ est négatif (une baisse
# d'activité réduirait alors artificiellement la perte au lieu de
# l'aggraver -- voir la discussion dans l'historique du projet). Avec
# l'hypothèse de charges 100% fixes, la variation du CA (en euros) se
# reporte intégralement, à l'identique, sur le résultat net : le signe de
# l'effet ne dépend donc jamais du signe du résultat de départ.
variation_ca_euros = dernier_ca_connu * (variation_pct / 100)
nouveau_resultat_net_simule = dernier_resultat_net_connu + variation_ca_euros

col_sim_1, col_sim_2 = st.columns(2)
with col_sim_1:
    st.metric(
        f"Volume d'activité simulé (base {annees[-1]}, {variation_pct:+d} %)",
        f"{nouveau_ca_simule:,.0f} €",
        delta=f"{nouveau_ca_simule - dernier_ca_connu:,.0f} €",
    )

couleur_resultat_simule = "#2ECC71" if nouveau_resultat_net_simule >= 0 else "#E74C3C"
libelle_resultat_simule = "Bénéfice probable" if nouveau_resultat_net_simule >= 0 else "Perte probable"
with col_sim_2:
    st.markdown(
        f"""
        <div style="background-color:{couleur_resultat_simule}22;border:2px solid {couleur_resultat_simule};
                    border-radius:10px;padding:1rem;text-align:center;">
            <div style="font-size:0.9rem;color:#555;">{libelle_resultat_simule} ({variation_pct:+d} %)</div>
            <div style="font-size:1.8rem;font-weight:700;color:{couleur_resultat_simule};">
                {nouveau_resultat_net_simule:,.0f} €
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

st.markdown("---")

# ---------------------------------------------------------------------------
# Section informative : méthodologie
# ---------------------------------------------------------------------------

st.header("🔬 Méthodologie Mathématique & Scientifique")

st.subheader("1. Chaînes de Markov (Inertie matricielle)")
st.markdown(
    """
    Chaque exercice comptable est classé dans l'un de 4 états — **Bénéfice**,
    **Équilibre**, **Moins de pertes**, **Plus de pertes** — selon la marge
    nette et son évolution par rapport à l'exercice précédent. La probabilité
    de passer d'un état à l'autre s'écrit, comme dans une chaîne de Markov
    classique :
    """
)
st.latex(r"P(X_{t+1} = j \mid X_t = i) = M_{ij}")
st.markdown(
    """
    Avec seulement 3 bilans réels disponibles, une matrice de transition
    estimée uniquement sur ces observations serait trop peu fiable
    statistiquement. Le modèle applique donc un principe d'**inertie** : il
    mélange la matrice de transition empirique (lissage de Laplace, pour
    éviter les probabilités nulles) avec un vecteur d'inertie centré sur le
    **dernier état observé**, orienté par la pente de la tendance du résultat
    net (régression linéaire sur les 3 derniers exercices). Concrètement :
    plus la trajectoire récente de l'entreprise est nette et confirmée, plus
    le modèle attribue une probabilité forte à la persistance de cette
    trajectoire — d'où le terme d'*inertie matricielle*.

    ⚠️ Ce n'est pas une chaîne de Markov calibrée sur des données empiriques
    à grande échelle : c'est une heuristique d'ingénierie construite pour
    cette application, avec des paramètres documentés et ajustables dans
    `moteur/transition.py`.
    """
)

st.subheader("2. Théorème de Bayes (Facteur humain)")
st.markdown(
    """
    Les probabilités calculées ci-dessus (« probabilités historiques »)
    reflètent uniquement les chiffres comptables. Or deux entreprises avec
    la même trajectoire financière peuvent avoir des perspectives très
    différentes selon leur contexte opérationnel réel. Les réponses aux
    deux facteurs de terrain dans la barre latérale (nouveaux clients,
    blocage des flux de transport par la filiale Vedène) corrigent donc ces
    probabilités via le théorème de Bayes :
    """
)
st.latex(r"P(S \mid E) = \frac{P(E \mid S)\,P(S)}{P(E)}")
st.markdown(
    """
    où **S** est un scénario (Bénéfice, Équilibre, Moins de pertes, Plus de
    pertes), **P(S)** sa probabilité historique (calculée à l'étape 1), et
    **P(E | S)** la vraisemblance de la réponse observée si ce
    scénario se réalisait. Les deux facteurs sont supposés indépendants
    conditionnellement au scénario (hypothèse dite « naïve », classique pour
    combiner plusieurs indices) : leurs vraisemblances se multiplient avant
    normalisation pour obtenir la probabilité corrigée finale, affichée dans
    le graphique en couronne ci-dessus.

    Dès qu'un facteur est modifié dans la barre latérale, Streamlit relance
    l'intégralité du calcul et le graphique se met à jour **instantanément**
    — aucune étape de validation supplémentaire n'est nécessaire.

    ⚠️ Les vraisemblances P(E | S) sont des hypothèses d'expert
    (voir `moteur/bayes.py`, `TABLE_VRAISEMBLANCES`), pas des probabilités
    mesurées empiriquement : le théorème de Bayes lui-même est appliqué
    correctement, mais ses données d'entrée restent des estimations
    métier, ajustables selon le contexte.
    """
)
