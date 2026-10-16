import React, { useState } from "react";
import { Utensils, Loader2 } from "lucide-react";
import { C, inputCls, inputStyle } from "./ui.jsx";
import { api, setCredentials, clearCredentials, ApiError } from "./api.js";

/**
 * Écran de connexion : envoie les identifiants au backend (HTTP Basic) via
 * GET /api/utilisateurs/moi. Si la réponse est 200, les identifiants sont
 * valides et le rôle renvoyé pilote ensuite tout l'affichage de l'application.
 */
export default function Login({ onLogin }) {
  const [identifiant, setIdentifiant] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setErreur("");
    setLoading(true);
    setCredentials(identifiant.trim(), motDePasse);
    try {
      const utilisateur = await api.moi();
      onLogin(utilisateur);
    } catch (err) {
      clearCredentials();
      if (err instanceof ApiError && err.status === 401) {
        setErreur("Identifiant ou mot de passe incorrect.");
      } else {
        setErreur("Impossible de contacter le serveur. Vérifiez que le backend est démarré et accessible.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4" style={{ background: C.paper }}>
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-6">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: C.spice }}>
            <Utensils size={18} color="#fff" />
          </div>
          <div className="text-lg font-semibold" style={{ color: C.ink }}>Marchés Restauration</div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-6" style={{ borderColor: C.line }}>
          <h1 className="text-base font-semibold mb-4" style={{ color: C.ink }}>Connexion</h1>

          <label className="block mb-3">
            <span className="block text-xs font-medium mb-1" style={{ color: C.muted }}>Identifiant</span>
            <input
              className={inputCls} style={inputStyle} autoFocus
              value={identifiant} onChange={(e) => setIdentifiant(e.target.value)}
              placeholder="admin"
            />
          </label>

          <label className="block mb-4">
            <span className="block text-xs font-medium mb-1" style={{ color: C.muted }}>Mot de passe</span>
            <input
              type="password" className={inputCls} style={inputStyle}
              value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)}
              placeholder="••••••••"
            />
          </label>

          {erreur && (
            <div className="mb-4 text-xs rounded-lg px-3 py-2" style={{ background: "#F7E4E1", color: C.danger }}>
              {erreur}
            </div>
          )}

          <button
            type="submit" disabled={loading || !identifiant || !motDePasse}
            className="w-full py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: C.spice }}
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            Se connecter
          </button>
        </form>

        <p className="text-xs text-center mt-4" style={{ color: C.muted }}>
          Comptes de démonstration : admin/admin123 · comptable/comptable123 · gestionnaire/gestionnaire123 · cuisinier/cuisinier123
        </p>
      </div>
    </div>
  );
}
