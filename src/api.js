// ---------------------------------------------------------------------------
// Client API pour le backend Spring Boot.
//
// Le backend s'authentifie en HTTP Basic (voir SecurityConfig côté Java) :
// chaque requête doit porter un en-tête "Authorization: Basic base64(id:mdp)".
// Les identifiants sont fournis une fois via setCredentials() après la
// connexion (voir Login.jsx) et réutilisés pour tous les appels suivants.
// Le jeton est conservé dans sessionStorage pour survivre au rafraîchissement
// de la page ; il est effacé à la fermeture de l'onglet ou à la déconnexion.
// ---------------------------------------------------------------------------

// "??" (et non "||") pour qu'une chaîne vide reste possible (frontend et API sur
// la même origine). Le "/" final éventuel est retiré pour éviter les "//api".
const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080").replace(/\/+$/, "");

if (import.meta.env.PROD && BASE_URL.includes("localhost")) {
  console.warn(
    `[api] VITE_API_BASE_URL pointe vers ${BASE_URL} dans un build de production : ` +
      "définissez-la sur la plateforme de déploiement puis relancez le build."
  );
}

const STORAGE_KEY = "marches-restauration.auth";

function lireJetonStocke() {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // stockage indisponible (navigation privée stricte, etc.)
  }
}

let jeton = lireJetonStocke(); // base64("identifiant:motDePasse")

export function setCredentials(identifiant, motDePasse) {
  jeton = btoa(unescape(encodeURIComponent(`${identifiant}:${motDePasse}`)));
  try {
    sessionStorage.setItem(STORAGE_KEY, jeton);
  } catch {
    // sans stockage, la session reste valable jusqu'au prochain rafraîchissement
  }
}

export function clearCredentials() {
  jeton = null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // rien à faire
  }
}

/** Vrai si des identifiants sont mémorisés (session à restaurer au chargement). */
export function hasCredentials() {
  return jeton !== null;
}

function authHeader() {
  if (!jeton) return {};
  return { Authorization: `Basic ${jeton}` };
}

/** Erreur enrichie avec le statut HTTP et le message renvoyé par le backend (ErreurResponse). */
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Le backend délègue certains contrôles à Bean Validation (Hibernate Validator),
// dont les messages par défaut sont en anglais (ex. "lignes : must not be empty").
// On les traduit ici pour ne jamais afficher de texte anglais dans l'interface.
const TRADUCTIONS_VALIDATION = [
  [/must not be empty/gi, "ne doit pas être vide"],
  [/must not be blank/gi, "ne doit pas être vide"],
  [/must not be null/gi, "ne doit pas être nul"],
  [/must be greater than or equal to (.+)/gi, "doit être supérieur ou égal à $1"],
  [/must be less than or equal to (.+)/gi, "doit être inférieur ou égal à $1"],
  [/must be greater than (.+)/gi, "doit être supérieur à $1"],
  [/must be less than (.+)/gi, "doit être inférieur à $1"],
  [/size must be between (.+) and (.+)/gi, "la taille doit être comprise entre $1 et $2"],
  [/must be a valid (.+)/gi, "doit être un(e) $1 valide"],
];

function traduireMessage(message) {
  if (!message) return message;
  return TRADUCTIONS_VALIDATION.reduce(
    (texte, [motif, remplacement]) => texte.replace(motif, remplacement),
    message
  );
}

async function requete(path, { method = "GET", body } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  let data = null;
  const texte = await res.text();
  if (texte) {
    try {
      data = JSON.parse(texte);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const message = traduireMessage(data?.message) || `Erreur ${res.status} sur ${path}`;
    throw new ApiError(message, res.status);
  }

  return data;
}

// ---------------------------------------------------------------------------
// Identité / authentification
// ---------------------------------------------------------------------------
export const api = {
  moi: () => requete("/api/utilisateurs/moi"),

  // -- Marchés --------------------------------------------------------------
  listerMarches: () => requete("/api/marches"),
  creerMarche: (payload) => requete("/api/marches", { method: "POST", body: payload }),
  cloturerMarche: (id) => requete(`/api/marches/${id}/cloturer`, { method: "PATCH" }),

  // -- Ordres de commande -----------------------------------------------------
  listerOrdres: (marcheId) => requete(`/api/ordres${marcheId ? `?marcheId=${marcheId}` : ""}`),
  creerOrdre: (payload) => requete("/api/ordres", { method: "POST", body: payload }),

  // -- Commandes journalières ---------------------------------------------
  listerCommandes: ({ ordreId, date } = {}) => {
    const params = new URLSearchParams();
    if (ordreId) params.set("ordreId", ordreId);
    if (date) params.set("date", date);
    const qs = params.toString();
    return requete(`/api/commandes${qs ? `?${qs}` : ""}`);
  },
  creerCommande: (payload) => requete("/api/commandes", { method: "POST", body: payload }),
  modifierCommande: (id, payload) => requete(`/api/commandes/${id}`, { method: "PUT", body: payload }),
  annulerCommande: (id) => requete(`/api/commandes/${id}/annuler`, { method: "POST" }),

  // -- Règlements -----------------------------------------------------------
  listerReglements: (marcheId) => requete(`/api/reglements${marcheId ? `?marcheId=${marcheId}` : ""}`),
  creerReglement: (payload) => requete("/api/reglements", { method: "POST", body: payload }),

  // -- Commanditaires (vue consolidée) --------------------------------------
  listerCommanditaires: () => requete("/api/commanditaires"),

  // -- Tableau de bord --------------------------------------------------------
  tableauDeBord: () => requete("/api/tableau-de-bord"),
};

export default api;
