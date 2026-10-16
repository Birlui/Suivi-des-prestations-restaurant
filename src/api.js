// ---------------------------------------------------------------------------
// Client API pour le backend Spring Boot.
//
// Le backend s'authentifie en HTTP Basic (voir SecurityConfig côté Java) :
// chaque requête doit porter un en-tête "Authorization: Basic base64(id:mdp)".
// Les identifiants sont fournis une fois via setCredentials() après la
// connexion (voir Login.jsx) et réutilisés pour tous les appels suivants.
// ---------------------------------------------------------------------------

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

let credentials = null; // { identifiant, motDePasse }

export function setCredentials(identifiant, motDePasse) {
  credentials = { identifiant, motDePasse };
}

export function clearCredentials() {
  credentials = null;
}

function authHeader() {
  if (!credentials) return {};
  const jeton = btoa(unescape(encodeURIComponent(`${credentials.identifiant}:${credentials.motDePasse}`)));
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
