import React, { useEffect, useState } from "react";
import {
  LayoutDashboard, FileText, ClipboardList, CalendarDays, Wallet,
  Users, Plus, X, AlertTriangle, TrendingUp, Utensils,
  ChevronDown, LogOut, Loader2,
} from "lucide-react";
import { C, fmt, todayISO, datesBetween, Badge, Card, Stat, Modal, Field, inputCls, inputStyle } from "./ui.jsx";
import { api, clearCredentials, ApiError } from "./api.js";
import Login from "./Login.jsx";

const ROLE_KEY_BY_BACKEND = {
  ADMINISTRATEUR: "admin",
  COMPTABLE: "comptable",
  GESTIONNAIRE_DES_COMMANDES: "gestionnaire",
  CUISINIER: "cuisinier",
};

const ROLES = {
  admin: { label: "Administrateur", color: C.ink },
  comptable: { label: "Comptable", color: C.sage },
  gestionnaire: { label: "Gestionnaire des commandes", color: C.spice },
  cuisinier: { label: "Cuisinier", color: C.gold },
};

const NAV_BY_ROLE = {
  admin: ["dashboard", "commanditaires", "marches", "ordres", "commandes", "reglements"],
  comptable: ["dashboard", "commanditaires", "reglements", "marches"],
  gestionnaire: ["ordres", "commandes"],
  cuisinier: ["commandes"],
};

const NAV_ITEMS = [
  { key: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { key: "commanditaires", label: "Commanditaires", icon: Users },
  { key: "marches", label: "Marchés", icon: FileText },
  { key: "ordres", label: "Ordres de commande", icon: ClipboardList },
  { key: "commandes", label: "Commandes journalières", icon: CalendarDays },
  { key: "reglements", label: "Règlements", icon: Wallet },
];

const TYPES_PRESTATION = ["Pause-café", "Pause-déjeuner", "Pause-café renforcée", "Cocktail", "Location de salle", "Eau / boissons", "Autre (préciser)"];

const STATUT_MARCHE_LABEL = { EN_PREPARATION: "En préparation", EN_COURS: "En cours", CLOTURE: "Clôturé" };
const STATUT_ORDRE_LABEL = { ACTIF: "Actif", SOLDE: "Soldé", ANNULE: "Annulé" };
const STATUT_COMMANDE_LABEL = { ACTIVE: "Active", ANNULEE: "Annulée" };

// ---------------------------------------------------------------------------
export default function App() {
  const [utilisateur, setUtilisateur] = useState(null);

  if (!utilisateur) {
    return <Login onLogin={setUtilisateur} />;
  }

  return (
    <MainApp
      utilisateur={utilisateur}
      onLogout={() => { clearCredentials(); setUtilisateur(null); }}
    />
  );
}

// ---------------------------------------------------------------------------
function MainApp({ utilisateur, onLogout }) {
  const role = ROLE_KEY_BY_BACKEND[utilisateur.role] || "cuisinier";
  const allowedTabs = NAV_BY_ROLE[role] || [];
  const [tab, setTab] = useState(allowedTabs[0] || "commandes");
  const activeTab = allowedTabs.includes(tab) ? tab : allowedTabs[0];

  // ---- données chargées depuis l'API ----
  const [marches, setMarches] = useState([]);
  const [ordres, setOrdres] = useState([]);
  const [commandes, setCommandes] = useState([]);
  const [reglements, setReglements] = useState([]);
  const [commanditaires, setCommanditaires] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erreurChargement, setErreurChargement] = useState("");

  const [showMarcheForm, setShowMarcheForm] = useState(false);
  const [showOrdreForm, setShowOrdreForm] = useState(false);
  const [showCmdForm, setShowCmdForm] = useState(false);
  const [showRegForm, setShowRegForm] = useState(false);
  const [presetOrdreId, setPresetOrdreId] = useState(null);
  const [editingCommande, setEditingCommande] = useState(null);
  const [blockedAlert, setBlockedAlert] = useState(null);

  async function chargerTout() {
    setLoading(true);
    setErreurChargement("");
    try {
      const appels = [];
      if (allowedTabs.includes("dashboard")) appels.push(api.tableauDeBord().then(setDashboard));
      if (allowedTabs.includes("commanditaires")) appels.push(api.listerCommanditaires().then(setCommanditaires));
      if (allowedTabs.includes("marches")) appels.push(api.listerMarches().then(setMarches));
      if (allowedTabs.includes("ordres") || allowedTabs.includes("commandes")) appels.push(api.listerOrdres().then(setOrdres));
      if (allowedTabs.includes("commandes")) appels.push(api.listerCommandes().then(setCommandes));
      if (allowedTabs.includes("reglements")) appels.push(api.listerReglements().then(setReglements));
      await Promise.all(appels);
    } catch (err) {
      setErreurChargement(err.message || "Erreur de chargement des données.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { chargerTout(); /* eslint-disable-next-line */ }, []);

  const prestationById = {};
  marches.forEach((m) => m.prestations.forEach((p) => { prestationById[p.id] = p; }));

  // ---- handlers (appellent l'API puis rechargent) ----
  async function handleAddMarche(data) {
    try {
      await api.creerMarche(data);
      setShowMarcheForm(false);
      chargerTout();
    } catch (err) {
      setBlockedAlert(err.message || "Erreur lors de la création du marché.");
    }
  }

  async function handleAddOrdre(data) {
    try {
      await api.creerOrdre(data);
      setShowOrdreForm(false);
      chargerTout();
    } catch (err) {
      setBlockedAlert(err.message || "Erreur lors de la création de l'ordre.");
    }
  }

  async function handleAddCommande(data) {
    try {
      await api.creerCommande(data);
      setShowCmdForm(false);
      setPresetOrdreId(null);
      chargerTout();
    } catch (err) {
      setBlockedAlert(err.message || "Erreur lors de la création de la commande.");
    }
  }

  async function handleEditCommande(id, data) {
    try {
      await api.modifierCommande(id, data);
      setEditingCommande(null);
      chargerTout();
    } catch (err) {
      setBlockedAlert(err.message || "Erreur lors de la modification de la commande.");
    }
  }

  async function handleCancelCommande(id) {
    try {
      await api.annulerCommande(id);
      chargerTout();
    } catch (err) {
      setBlockedAlert(err.message || "Erreur lors de l'annulation de la commande.");
    }
  }

  async function handleAddReglement(data) {
    try {
      await api.creerReglement(data);
      setShowRegForm(false);
      chargerTout();
    } catch (err) {
      setBlockedAlert(err.message || "Erreur lors de l'enregistrement du règlement.");
    }
  }

  return (
    <div className="min-h-screen w-full flex" style={{ background: C.paper, color: C.ink, fontFamily: "'Georgia', 'Iowan Old Style', serif" }}>
      <style>{`
        * { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; }
        h1, h2, .display { font-family: 'Georgia', 'Iowan Old Style', serif; }
        input:focus, select:focus { box-shadow: 0 0 0 2px ${C.spice}33; border-color: ${C.spice}; }
      `}</style>

      {/* Sidebar (desktop uniquement) */}
      <aside className="hidden md:flex w-60 shrink-0 border-r flex-col" style={{ borderColor: C.line, background: C.panel }}>
        <div className="px-5 py-5 flex items-center gap-2 border-b" style={{ borderColor: C.line }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: C.spice }}>
            <Utensils size={16} color="#fff" />
          </div>
          <div>
            <div className="font-semibold text-sm display leading-tight">Marchés Restauration</div>
            <div className="text-[11px]" style={{ color: C.muted }}>Suivi &amp; exécution</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.filter((n) => allowedTabs.includes(n.key)).map((n) => {
            const Icon = n.icon;
            const active = activeTab === n.key;
            return (
              <button
                key={n.key}
                onClick={() => setTab(n.key)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors"
                style={{ background: active ? C.ink : "transparent", color: active ? "#fff" : C.ink }}
              >
                <Icon size={16} />
                {n.label}
              </button>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t" style={{ borderColor: C.line }}>
          <div className="px-2 mb-2">
            <div className="text-sm font-medium" style={{ color: C.ink }}>{utilisateur.nomComplet || utilisateur.identifiant}</div>
            <div className="text-xs" style={{ color: ROLES[role]?.color }}>{ROLES[role]?.label}</div>
          </div>
          <button onClick={onLogout} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs" style={{ color: C.muted }}>
            <LogOut size={14} /> Se déconnecter
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto min-w-0">
        <header className="px-4 md:px-8 py-4 md:py-5 flex flex-wrap items-center justify-between gap-3 border-b" style={{ borderColor: C.line }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: C.spice }}>
              <Utensils size={15} color="#fff" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg md:text-xl font-semibold display truncate">{NAV_ITEMS.find((n) => n.key === activeTab)?.label}</h1>
              <p className="text-xs mt-0.5 truncate" style={{ color: C.muted }}>
                Connecté en tant que <span style={{ color: ROLES[role]?.color, fontWeight: 600 }}>{ROLES[role]?.label}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center flex-wrap gap-2">
            {activeTab === "marches" && (role === "admin" || role === "comptable") && (
              <button onClick={() => setShowMarcheForm(true)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium text-white" style={{ background: C.spice }}>
                <Plus size={15} /> <span className="hidden sm:inline">Nouveau marché</span>
              </button>
            )}
            {activeTab === "ordres" && (role === "admin" || role === "gestionnaire") && (
              <button onClick={() => setShowOrdreForm(true)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium text-white" style={{ background: C.spice }}>
                <Plus size={15} /> <span className="hidden sm:inline">Nouvel ordre de commande</span>
              </button>
            )}
            {activeTab === "commandes" && (role === "admin" || role === "gestionnaire") && (
              <button onClick={() => { setPresetOrdreId(null); setShowCmdForm(true); }} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium text-white" style={{ background: C.spice }}>
                <Plus size={15} /> <span className="hidden sm:inline">Saisir une commande</span>
              </button>
            )}
            {activeTab === "reglements" && (role === "admin" || role === "comptable") && (
              <button onClick={() => setShowRegForm(true)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium text-white" style={{ background: C.spice }}>
                <Plus size={15} /> <span className="hidden sm:inline">Enregistrer un règlement</span>
              </button>
            )}
            <button onClick={onLogout} className="md:hidden flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border" style={{ borderColor: C.line, color: C.muted }}>
              <LogOut size={14} />
            </button>
          </div>
        </header>

        <div className="p-4 md:p-8 pb-24 md:pb-8">
          {erreurChargement && (
            <div className="mb-4 flex items-center gap-2 text-sm rounded-lg px-3 py-2" style={{ background: "#F7E4E1", color: C.danger }}>
              <AlertTriangle size={15} /> {erreurChargement}
              <button onClick={chargerTout} className="ml-auto underline text-xs">Réessayer</button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center gap-2 text-sm py-12 justify-center" style={{ color: C.muted }}>
              <Loader2 size={16} className="animate-spin" /> Chargement des données…
            </div>
          ) : (
            <>
              {activeTab === "dashboard" && dashboard && <DashboardView dashboard={dashboard} />}
              {activeTab === "commanditaires" && <CommanditairesView commanditaires={commanditaires} />}
              {activeTab === "marches" && <MarchesView marches={marches} />}
              {activeTab === "ordres" && (
                <OrdresView
                  ordres={ordres} role={role}
                  onNewCommande={(ordreId) => { setPresetOrdreId(ordreId); setShowCmdForm(true); }}
                />
              )}
              {activeTab === "commandes" && (
                <CommandesView
                  commandes={commandes} role={role}
                  onCancel={handleCancelCommande}
                  onEdit={(c) => setEditingCommande(c)}
                />
              )}
              {activeTab === "reglements" && <ReglementsView reglements={reglements} />}
            </>
          )}
        </div>
      </main>

      {/* Barre d'onglets mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex overflow-x-auto border-t" style={{ borderColor: C.line, background: C.panel }}>
        {NAV_ITEMS.filter((n) => allowedTabs.includes(n.key)).map((n) => {
          const Icon = n.icon;
          const active = activeTab === n.key;
          return (
            <button key={n.key} onClick={() => setTab(n.key)} className="flex-1 min-w-[76px] flex flex-col items-center justify-center gap-1 py-2.5 px-1" style={{ color: active ? C.spice : C.muted }}>
              <Icon size={18} />
              <span className="text-[10px] leading-none text-center">{n.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Modales */}
      {showMarcheForm && <MarcheForm onClose={() => setShowMarcheForm(false)} onSubmit={handleAddMarche} />}
      {showOrdreForm && <OrdreForm marches={marches} onClose={() => setShowOrdreForm(false)} onSubmit={handleAddOrdre} />}
      {showCmdForm && (
        <CommandeForm
          ordres={ordres} defaultOrdreId={presetOrdreId}
          onClose={() => { setShowCmdForm(false); setPresetOrdreId(null); }}
          onSubmit={handleAddCommande}
        />
      )}
      {editingCommande && (
        <CommandeEditForm
          commande={editingCommande} ordres={ordres}
          onClose={() => setEditingCommande(null)}
          onSubmit={(data) => handleEditCommande(editingCommande.id, data)}
        />
      )}
      {showRegForm && <ReglementForm marches={marches} ordres={ordres} onClose={() => setShowRegForm(false)} onSubmit={handleAddReglement} />}

      {blockedAlert && (
        <Modal title="Action refusée" onClose={() => setBlockedAlert(null)}>
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} style={{ color: C.danger }} className="shrink-0 mt-0.5" />
            <p className="text-sm" style={{ color: C.ink }}>{blockedAlert}</p>
          </div>
          <button onClick={() => setBlockedAlert(null)} className="w-full mt-4 py-2.5 rounded-lg text-sm font-medium text-white" style={{ background: C.ink }}>
            Compris
          </button>
        </Modal>
      )}
    </div>
  );
}

// ============================================================
// Vues
// ============================================================

function DashboardView({ dashboard }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Montant exécuté" value={fmt(dashboard.montantExecuteTotal)} icon={TrendingUp} accent={C.sage} />
        <Stat label="Montant facturé" value={fmt(dashboard.montantFactureTotal)} icon={FileText} accent={C.gold} />
        <Stat label="Montant encaissé" value={fmt(dashboard.montantEncaisseTotal)} icon={Wallet} accent={C.ink} />
        <Stat label="Restant à recevoir" value={fmt(dashboard.restantARecevoirTotal)} icon={AlertTriangle} accent={C.spice} />
      </div>
      <Stat label="Commandes aujourd'hui" value={dashboard.commandesAujourdhui} icon={CalendarDays} accent={C.ink} />

      <Card className="p-5">
        <h3 className="font-semibold mb-3">Alertes</h3>
        {dashboard.alertes.length === 0 ? (
          <p className="text-sm" style={{ color: C.muted }}>Aucune alerte active.</p>
        ) : (
          <div className="space-y-2">
            {dashboard.alertes.map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <Badge tone={a.tone}>{a.tone === "danger" ? "Critique" : "Attention"}</Badge>
                <span>{a.message}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function CommanditairesView({ commanditaires }) {
  const [expanded, setExpanded] = useState({});
  return (
    <div className="space-y-6">
      {commanditaires.length === 0 && <p className="text-sm" style={{ color: C.muted }}>Aucun marché enregistré pour le moment.</p>}
      {commanditaires.map((c) => (
        <Card key={c.nom} className="p-5">
          <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
            <div>
              <h3 className="font-semibold">{c.nom}</h3>
              <div className="text-xs" style={{ color: C.muted }}>{c.contrats.length} contrat{c.contrats.length > 1 ? "s" : ""}</div>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="text-right"><div style={{ color: C.muted }}>Montant prévu</div><div className="font-medium">{fmt(c.montantPrevuTotal)}</div></div>
              <div className="text-right"><div style={{ color: C.muted }}>Montant exécuté</div><div className="font-medium">{fmt(c.montantExecuteTotal)}</div></div>
            </div>
          </div>

          <div className="space-y-3">
            {c.contrats.map((contrat) => {
              const isOpen = !!expanded[contrat.marcheId];
              return (
                <div key={contrat.marcheId} className="border rounded-lg" style={{ borderColor: C.line }}>
                  <button
                    onClick={() => setExpanded((prev) => ({ ...prev, [contrat.marcheId]: !prev[contrat.marcheId] }))}
                    className="w-full flex items-center justify-between px-4 py-3 text-left"
                  >
                    <div>
                      <span className="font-medium text-sm">{contrat.reference}</span>
                      <span className="text-xs ml-2" style={{ color: C.muted }}>{contrat.objet}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge tone="ok">{contrat.statut}</Badge>
                      <ChevronDown size={16} style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .15s", color: C.muted }} />
                    </div>
                  </button>

                  <div className="px-4 pb-3 overflow-x-auto">
                    <table className="text-xs w-full" style={{ borderCollapse: "collapse", tableLayout: "fixed" }}>
                      <colgroup>
                        <col style={{ width: "40%" }} />
                        <col style={{ width: "20%" }} />
                        <col style={{ width: "20%" }} />
                        <col style={{ width: "20%" }} />
                      </colgroup>
                      <thead>
                        <tr className="text-left" style={{ color: C.muted }}>
                          <th className="font-normal pb-2 pr-3">Prestation</th>
                          <th className="font-normal pb-2 px-2 text-center">Total</th>
                          <th className="font-normal pb-2 px-2 text-center">Servi</th>
                          <th className="font-normal pb-2 px-2 text-center">Restant</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contrat.prestations.map((p) => (
                          <tr key={p.nom} className="border-t" style={{ borderColor: C.line }}>
                            <td className="py-1.5 pr-3 truncate">{p.nom}</td>
                            <td className="py-1.5 px-2 text-center">{p.total}</td>
                            <td className="py-1.5 px-2 text-center"><Badge tone={p.servi > 0 ? "ok" : "default"}>{p.servi}</Badge></td>
                            <td className="py-1.5 px-2 text-center"><Badge tone={p.restant <= 0 ? "danger" : p.restant / (p.total || 1) < 0.2 ? "warn" : "default"}>{p.restant}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {isOpen && (
                    <div className="px-4 pb-4 border-t pt-3" style={{ borderColor: C.line }}>
                      <div className="grid grid-cols-3 gap-3 text-xs mb-3">
                        <div><div style={{ color: C.muted }}>Montant prévu</div><div className="font-medium">{fmt(contrat.montantPrevu)}</div></div>
                        <div><div style={{ color: C.muted }}>Montant réglé</div><div className="font-medium">{fmt(contrat.montantRegle)}</div></div>
                        <div><div style={{ color: C.muted }}>Montant restant</div><div className="font-medium" style={{ color: C.spiceDeep }}>{fmt(contrat.montantRestant)}</div></div>
                      </div>
                      {contrat.ordresCommande.map((o) => (
                        <div key={o.id} className="text-xs py-1.5 border-t" style={{ borderColor: C.line }}>
                          <span className="font-medium">{o.numero}</span> — exécuté {fmt(o.montantExecute)}, facturé {fmt(o.montantFacture)}, réglé {fmt(o.montantRegle)}
                          {o.reglements.length > 0 && (
                            <ul className="ml-4 mt-1 list-disc" style={{ color: C.muted }}>
                              {o.reglements.map((r) => <li key={r.id}>{r.numeroFacture} du {r.dateFacture} — {fmt(r.montantRegle)} / {fmt(r.montantTTC)}</li>)}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}

function MarchesView({ marches }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {marches.length === 0 && <p className="text-sm" style={{ color: C.muted }}>Aucun marché enregistré pour le moment.</p>}
      {marches.map((m) => (
        <Card key={m.id} className="p-5">
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="text-xs" style={{ color: C.muted }}>{m.reference}</div>
              <h3 className="font-semibold">{m.objet}</h3>
              <div className="text-xs mt-0.5" style={{ color: C.muted }}>{m.commanditaire} · {m.dateDebut} → {m.dateFin}</div>
            </div>
            <Badge tone="ok">{STATUT_MARCHE_LABEL[m.statut] || m.statut}</Badge>
          </div>
          <div className="mt-3">
            <div className="text-xs mb-1.5" style={{ color: C.muted }}>Prestations ({m.prestations.length})</div>
            <div className="flex flex-wrap gap-1.5">
              {m.prestations.map((p) => (
                <span key={p.id} className="text-xs px-2 py-1 rounded-full" style={{ background: "#EFEBDD", color: C.ink }}>
                  {p.nom} · {p.quantitePrevue} × {fmt(p.prixUnitaire)} · TVA {p.tauxTVA}%
                </span>
              ))}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function OrdresView({ ordres, role, onNewCommande }) {
  return (
    <div className="space-y-4">
      {ordres.length === 0 && <p className="text-sm" style={{ color: C.muted }}>Aucun ordre de commande enregistré pour le moment.</p>}
      {ordres.map((o) => (
        <Card key={o.id} className="p-5">
          <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
            <div>
              <div className="font-semibold">{o.numero}</div>
              <div className="text-xs" style={{ color: C.muted }}>Marché {o.marcheReference} · {o.date}</div>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="ok">{STATUT_ORDRE_LABEL[o.statut] || o.statut}</Badge>
              {(role === "admin" || role === "gestionnaire") && (
                <button onClick={() => onNewCommande(o.id)} className="text-xs px-2.5 py-1 rounded-lg border" style={{ borderColor: C.spice, color: C.spice }}>
                  + Commande
                </button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs" style={{ color: C.muted }}>
                  <th className="font-normal pb-2">Prestation</th>
                  <th className="font-normal pb-2">Prévue</th>
                  <th className="font-normal pb-2">Consommée</th>
                  <th className="font-normal pb-2">Restante</th>
                </tr>
              </thead>
              <tbody>
                {o.lignes.map((l) => (
                  <tr key={l.prestationId} className="border-t" style={{ borderColor: C.line }}>
                    <td className="py-1.5">{l.prestationNom}</td>
                    <td className="py-1.5">{l.quantitePrevue}</td>
                    <td className="py-1.5"><Badge tone={l.quantiteConsommee > 0 ? "ok" : "default"}>{l.quantiteConsommee}</Badge></td>
                    <td className="py-1.5"><Badge tone={l.quantiteRestante <= 0 ? "danger" : l.quantiteRestante / l.quantitePrevue < 0.2 ? "warn" : "default"}>{l.quantiteRestante}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}

function CommandesView({ commandes, role, onCancel, onEdit }) {
  const canCancel = role === "admin" || role === "comptable";
  const canEdit = role === "admin";
  const sorted = [...commandes].sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="text-left text-xs" style={{ color: C.muted, background: C.paper }}>
              <th className="font-normal px-4 py-2.5">Date</th>
              <th className="font-normal px-4 py-2.5">Ordre de commande</th>
              <th className="font-normal px-4 py-2.5">Marché</th>
              <th className="font-normal px-4 py-2.5">Lieu de livraison</th>
              <th className="font-normal px-4 py-2.5">Détail</th>
              {role !== "cuisinier" && <th className="font-normal px-4 py-2.5">Montant</th>}
              <th className="font-normal px-4 py-2.5">Statut</th>
              {(canCancel || canEdit) && <th className="font-normal px-4 py-2.5"></th>}
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => {
              const annulee = c.statut === "ANNULEE";
              return (
                <tr key={c.id} className="border-t" style={{ borderColor: C.line, opacity: annulee ? 0.55 : 1 }}>
                  <td className="px-4 py-2.5">{c.date}</td>
                  <td className="px-4 py-2.5">{c.ordreNumero}</td>
                  <td className="px-4 py-2.5">{c.marcheReference}</td>
                  <td className="px-4 py-2.5" style={{ color: c.lieuLivraison ? C.ink : C.muted }}>{c.lieuLivraison || "—"}</td>
                  <td className="px-4 py-2.5" style={{ textDecoration: annulee ? "line-through" : "none" }}>
                    {c.lignes.map((l) => `${l.prestationNom} × ${l.quantite}`).join(", ")}
                  </td>
                  {role !== "cuisinier" && <td className="px-4 py-2.5 font-medium">{c.montant != null ? fmt(c.montant) : "—"}</td>}
                  <td className="px-4 py-2.5">{annulee ? <Badge tone="danger">Annulée</Badge> : <Badge tone="ok">Active</Badge>}</td>
                  {(canCancel || canEdit) && (
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {canEdit && !annulee && (
                          <button onClick={() => onEdit(c)} className="text-xs px-2.5 py-1 rounded-lg border" style={{ borderColor: C.line, color: C.ink }}>Modifier</button>
                        )}
                        {canCancel && !annulee && (
                          <button onClick={() => onCancel(c.id)} className="text-xs px-2.5 py-1 rounded-lg border" style={{ borderColor: C.danger, color: C.danger }}>Annuler</button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ReglementsView({ reglements }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="text-left text-xs" style={{ color: C.muted, background: C.paper }}>
              <th className="font-normal px-4 py-2.5">Facture</th>
              <th className="font-normal px-4 py-2.5">Marché</th>
              <th className="font-normal px-4 py-2.5">Ordre de commande</th>
              <th className="font-normal px-4 py-2.5">Date</th>
              <th className="font-normal px-4 py-2.5">Montant TTC</th>
              <th className="font-normal px-4 py-2.5">Réglé</th>
              <th className="font-normal px-4 py-2.5">Mode</th>
              <th className="font-normal px-4 py-2.5">Statut</th>
            </tr>
          </thead>
          <tbody>
            {reglements.map((r) => {
              const numero = r.numeroOrdreCommandeSaisi || r.ordreCommandeNumero;
              return (
                <tr key={r.id} className="border-t" style={{ borderColor: C.line }}>
                  <td className="px-4 py-2.5">{r.numeroFacture}</td>
                  <td className="px-4 py-2.5">{r.marcheReference}</td>
                  <td className="px-4 py-2.5" style={{ color: numero ? C.ink : C.muted }}>
                    {numero || "—"}
                    {numero && !r.rapprochementReussi && <span className="ml-1.5 text-[10px]" style={{ color: C.muted }}>(non rapproché)</span>}
                  </td>
                  <td className="px-4 py-2.5">{r.dateFacture}</td>
                  <td className="px-4 py-2.5">{fmt(r.montantTTC)}</td>
                  <td className="px-4 py-2.5">{fmt(r.montantRegle)}</td>
                  <td className="px-4 py-2.5">{r.modeReglement}</td>
                  <td className="px-4 py-2.5">{r.soldee ? <Badge tone="ok">Soldée</Badge> : <Badge tone="warn">Reste {fmt(r.reste)}</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ============================================================
// Formulaires
// ============================================================

function MarcheForm({ onClose, onSubmit }) {
  const [f, setF] = useState({ reference: "", objet: "", commanditaire: "", dateDebut: todayISO(), dateFin: "", tauxTVA: 18 });
  const [prestations, setPrestations] = useState([{ nom: TYPES_PRESTATION[0], prixUnitaire: "", quantitePrevue: "", tauxTVA: 18 }]);

  function updatePrestation(i, patch) {
    setPrestations((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  function submit() {
    onSubmit({
      ...f,
      tauxTVA: Number(f.tauxTVA),
      prestations: prestations
        .filter((p) => p.nom && p.prixUnitaire !== "" && p.quantitePrevue !== "")
        .map((p) => ({ nom: p.nom, prixUnitaire: Number(p.prixUnitaire), quantitePrevue: Number(p.quantitePrevue), tauxTVA: Number(p.tauxTVA) })),
    });
  }

  return (
    <Modal title="Nouveau marché" onClose={onClose}>
      <Field label="Référence du marché"><input className={inputCls} style={inputStyle} placeholder="MR-2026-XXX" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Field>
      <Field label="Objet du marché"><input className={inputCls} style={inputStyle} value={f.objet} onChange={(e) => setF({ ...f, objet: e.target.value })} /></Field>
      <Field label="Commanditaire"><input className={inputCls} style={inputStyle} value={f.commanditaire} onChange={(e) => setF({ ...f, commanditaire: e.target.value })} /></Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Date de début"><input type="date" className={inputCls} style={inputStyle} value={f.dateDebut} onChange={(e) => setF({ ...f, dateDebut: e.target.value })} /></Field>
        <Field label="Date de fin"><input type="date" className={inputCls} style={inputStyle} value={f.dateFin} onChange={(e) => setF({ ...f, dateFin: e.target.value })} /></Field>
      </div>

      <Field label="Prestations du marché">
        <div className="space-y-3">
          {prestations.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <select className={inputCls} style={inputStyle} value={p.nom} onChange={(e) => updatePrestation(i, { nom: e.target.value })}>
                {TYPES_PRESTATION.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input type="number" placeholder="Prix unit." className="w-24 border rounded-lg px-2 py-2 text-sm" style={inputStyle} value={p.prixUnitaire} onChange={(e) => updatePrestation(i, { prixUnitaire: e.target.value })} />
              <input type="number" placeholder="Qté prévue" className="w-24 border rounded-lg px-2 py-2 text-sm" style={inputStyle} value={p.quantitePrevue} onChange={(e) => updatePrestation(i, { quantitePrevue: e.target.value })} />
              <input type="number" placeholder="TVA %" className="w-16 border rounded-lg px-2 py-2 text-sm" style={inputStyle} value={p.tauxTVA} onChange={(e) => updatePrestation(i, { tauxTVA: e.target.value })} />
              {prestations.length > 1 && (
                <button onClick={() => setPrestations((prev) => prev.filter((_, idx) => idx !== i))}><X size={16} style={{ color: C.muted }} /></button>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={() => setPrestations((prev) => [...prev, { nom: TYPES_PRESTATION[0], prixUnitaire: "", quantitePrevue: "", tauxTVA: 18 }])}
          className="text-xs mt-2 flex items-center gap-1" style={{ color: C.spice }}
        >
          <Plus size={13} /> Ajouter une prestation
        </button>
      </Field>

      <button onClick={submit} className="w-full mt-2 py-2.5 rounded-lg text-sm font-medium text-white" style={{ background: C.spice }}>
        Créer le marché
      </button>
    </Modal>
  );
}

function OrdreForm({ marches, onClose, onSubmit }) {
  const [marcheId, setMarcheId] = useState(marches[0]?.id || "");
  const [date, setDate] = useState(todayISO());
  const [quantites, setQuantites] = useState({});
  const marche = marches.find((m) => m.id === marcheId);

  return (
    <Modal title="Nouvel ordre de commande" onClose={onClose}>
      <Field label="Marché">
        <select className={inputCls} style={inputStyle} value={marcheId} onChange={(e) => { setMarcheId(e.target.value); setQuantites({}); }}>
          {marches.map((m) => <option key={m.id} value={m.id}>{m.reference} — {m.commanditaire}</option>)}
        </select>
      </Field>
      <Field label="Date"><input type="date" className={inputCls} style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <Field label="Quantités prévues par prestation">
        <div className="space-y-2">
          {marche?.prestations.map((p) => (
            <div key={p.id} className="flex items-center gap-2">
              <span className="text-sm flex-1">{p.nom}</span>
              <input type="number" min="0" className="w-24 border rounded-lg px-2 py-1.5 text-sm" style={inputStyle}
                value={quantites[p.id] || ""} onChange={(e) => setQuantites({ ...quantites, [p.id]: Number(e.target.value) })} />
            </div>
          ))}
        </div>
      </Field>
      <button
        onClick={() => onSubmit({
          date, marcheId,
          lignes: Object.entries(quantites).filter(([, q]) => q > 0).map(([prestationId, q]) => ({ prestationId: Number(prestationId), quantitePrevue: q })),
        })}
        className="w-full mt-2 py-2.5 rounded-lg text-sm font-medium text-white" style={{ background: C.spice }}
      >
        Créer l'ordre de commande
      </button>
    </Modal>
  );
}

function CommandeForm({ ordres, defaultOrdreId, onClose, onSubmit }) {
  const [ordreId, setOrdreId] = useState(defaultOrdreId || ordres[0]?.id || "");
  const [pleinePeriode, setPleinePeriode] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [dateDebut, setDateDebut] = useState(todayISO());
  const [dateFin, setDateFin] = useState(todayISO());
  const [lieuLivraison, setLieuLivraison] = useState("");
  const [quantites, setQuantites] = useState({});
  const ordre = ordres.find((o) => o.id === ordreId);

  const dates = pleinePeriode ? datesBetween(dateDebut, dateFin) : [date];
  const nbJours = dates.length;

  return (
    <Modal title="Saisir une commande journalière" onClose={onClose}>
      <Field label="Ordre de commande">
        <select className={inputCls} style={inputStyle} value={ordreId} onChange={(e) => { setOrdreId(e.target.value); setQuantites({}); }}>
          {ordres.map((o) => <option key={o.id} value={o.id}>{o.numero} — Marché {o.marcheReference}</option>)}
        </select>
        {ordre && <div className="mt-1.5 text-xs" style={{ color: C.muted }}>Marché mère : <span style={{ color: C.spice, fontWeight: 600 }}>{ordre.marcheReference}</span></div>}
      </Field>

      <Field label="Lieu de livraison">
        <input className={inputCls} style={inputStyle} value={lieuLivraison} onChange={(e) => setLieuLivraison(e.target.value)} placeholder="Ex. Site Administratif Central - Salle A" />
      </Field>

      <label className="flex items-center gap-2 mb-3 text-sm cursor-pointer select-none">
        <input type="checkbox" checked={pleinePeriode} onChange={(e) => setPleinePeriode(e.target.checked)} className="w-4 h-4 rounded" />
        Activité sur plusieurs jours (ex. séminaire toute la semaine)
      </label>

      {!pleinePeriode ? (
        <Field label="Date"><input type="date" className={inputCls} style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Date de début"><input type="date" className={inputCls} style={inputStyle} value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} /></Field>
            <Field label="Date de fin"><input type="date" className={inputCls} style={inputStyle} value={dateFin} onChange={(e) => setDateFin(e.target.value)} /></Field>
          </div>
          <p className="text-xs mb-3 -mt-1.5" style={{ color: nbJours > 0 ? C.muted : C.danger }}>
            {nbJours > 0 ? `Une commande journalière sera créée pour chacun des ${nbJours} jour${nbJours > 1 ? "s" : ""} de la période.` : "La date de fin doit être postérieure ou égale à la date de début."}
          </p>
        </>
      )}

      <Field label={pleinePeriode ? "Quantités demandées par jour" : "Quantités demandées"}>
        <div className="space-y-2">
          {ordre?.lignes.map((l) => {
            const qte = Number(quantites[l.prestationId] || 0);
            const totalPeriode = qte * nbJours;
            return (
              <div key={l.prestationId}>
                <div className="flex items-center gap-2">
                  <span className="text-sm flex-1">{l.prestationNom}</span>
                  <span className="text-xs" style={{ color: C.muted }}>restant {l.quantiteRestante}</span>
                  <input type="number" min="0" className="w-20 border rounded-lg px-2 py-1.5 text-sm" style={inputStyle}
                    value={quantites[l.prestationId] || ""} onChange={(e) => setQuantites({ ...quantites, [l.prestationId]: Number(e.target.value) })} />
                </div>
                {pleinePeriode && qte > 0 && (
                  <div className="text-[11px] text-right mt-0.5" style={{ color: totalPeriode > l.quantiteRestante ? C.danger : C.muted }}>
                    Total sur la période : {totalPeriode} {totalPeriode > l.quantiteRestante ? "— dépasse le solde restant" : ""}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Field>

      <button
        onClick={() => onSubmit({
          ordreId,
          date: pleinePeriode ? null : date,
          dateDebut: pleinePeriode ? dateDebut : null,
          dateFin: pleinePeriode ? dateFin : null,
          lieuLivraison,
          lignes: Object.entries(quantites).filter(([, q]) => q > 0).map(([prestationId, quantite]) => ({ prestationId: Number(prestationId), quantite })),
        })}
        disabled={nbJours === 0}
        className="w-full mt-2 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: C.spice }}
      >
        {pleinePeriode ? `Enregistrer les ${nbJours} commande${nbJours > 1 ? "s" : ""}` : "Enregistrer la commande"}
      </button>
    </Modal>
  );
}

function CommandeEditForm({ commande, ordres, onClose, onSubmit }) {
  const ordre = ordres.find((o) => o.id === commande.ordreId);
  const [date, setDate] = useState(commande.date);
  const [lieuLivraison, setLieuLivraison] = useState(commande.lieuLivraison || "");
  const initial = {};
  commande.lignes.forEach((l) => { initial[l.prestationId] = l.quantite; });
  const [quantites, setQuantites] = useState(initial);

  return (
    <Modal title={`Modifier la commande du ${commande.date}`} onClose={onClose}>
      <Field label="Date"><input type="date" className={inputCls} style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <Field label="Lieu de livraison"><input className={inputCls} style={inputStyle} value={lieuLivraison} onChange={(e) => setLieuLivraison(e.target.value)} /></Field>
      <Field label="Quantités">
        <div className="space-y-2">
          {ordre?.lignes.map((l) => (
            <div key={l.prestationId} className="flex items-center gap-2">
              <span className="text-sm flex-1">{l.prestationNom}</span>
              <span className="text-xs" style={{ color: C.muted }}>restant {l.quantiteRestante}</span>
              <input type="number" min="0" className="w-20 border rounded-lg px-2 py-1.5 text-sm" style={inputStyle}
                value={quantites[l.prestationId] || ""} onChange={(e) => setQuantites({ ...quantites, [l.prestationId]: Number(e.target.value) })} />
            </div>
          ))}
        </div>
      </Field>
      <button
        onClick={() => onSubmit({
          date, lieuLivraison,
          lignes: Object.entries(quantites).filter(([, q]) => q > 0).map(([prestationId, quantite]) => ({ prestationId: Number(prestationId), quantite })),
        })}
        className="w-full mt-2 py-2.5 rounded-lg text-sm font-medium text-white" style={{ background: C.spice }}
      >
        Enregistrer les modifications
      </button>
    </Modal>
  );
}

function ReglementForm({ marches, ordres, onClose, onSubmit }) {
  const [f, setF] = useState({ marcheId: marches[0]?.id || "", numeroOrdreCommande: "", numeroFacture: "", dateFacture: todayISO(), montantTTC: "", montantRegle: "", modeReglement: "VIREMENT" });
  const marche = marches.find((m) => m.id === f.marcheId);
  const ordresDuMarche = ordres.filter((o) => o.marcheId === f.marcheId);

  function submit() {
    const ttc = Number(f.montantTTC) || 0;
    const taux = marche?.tauxTVA ?? 18;
    const montantTVA = ttc - ttc / (1 + taux / 100);
    const montantHT = ttc - montantTVA;
    onSubmit({
      marcheId: f.marcheId,
      numeroOrdreCommande: f.numeroOrdreCommande,
      numeroFacture: f.numeroFacture,
      dateFacture: f.dateFacture,
      montantHT: Math.round(montantHT),
      montantTVA: Math.round(montantTVA),
      montantTTC: ttc,
      montantRegle: Number(f.montantRegle) || 0,
      dateReglement: f.dateFacture,
      modeReglement: f.modeReglement,
    });
  }

  return (
    <Modal title="Enregistrer un règlement" onClose={onClose}>
      <Field label="Marché">
        <select className={inputCls} style={inputStyle} value={f.marcheId} onChange={(e) => setF({ ...f, marcheId: e.target.value, numeroOrdreCommande: "" })}>
          {marches.map((m) => <option key={m.id} value={m.id}>{m.reference}</option>)}
        </select>
      </Field>
      <Field label="Numéro de l'ordre de commande">
        <input className={inputCls} style={inputStyle} value={f.numeroOrdreCommande} onChange={(e) => setF({ ...f, numeroOrdreCommande: e.target.value })}
          placeholder="Ex. OC-2026-047 (laisser vide pour une facture globale du marché)" list="ordres-suggestions" />
        <datalist id="ordres-suggestions">{ordresDuMarche.map((o) => <option key={o.id} value={o.numero} />)}</datalist>
      </Field>
      <Field label="Numéro de facture"><input className={inputCls} style={inputStyle} value={f.numeroFacture} onChange={(e) => setF({ ...f, numeroFacture: e.target.value })} /></Field>
      <Field label="Date"><input type="date" className={inputCls} style={inputStyle} value={f.dateFacture} onChange={(e) => setF({ ...f, dateFacture: e.target.value })} /></Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Montant TTC facture"><input type="number" className={inputCls} style={inputStyle} value={f.montantTTC} onChange={(e) => setF({ ...f, montantTTC: e.target.value })} /></Field>
        <Field label="Montant réglé"><input type="number" className={inputCls} style={inputStyle} value={f.montantRegle} onChange={(e) => setF({ ...f, montantRegle: e.target.value })} /></Field>
      </div>
      <Field label="Mode de règlement">
        <select className={inputCls} style={inputStyle} value={f.modeReglement} onChange={(e) => setF({ ...f, modeReglement: e.target.value })}>
          <option value="ESPECES">Espèces</option>
          <option value="CHEQUE">Chèque</option>
          <option value="VIREMENT">Virement</option>
          <option value="MOBILE_MONEY">Mobile Money</option>
          <option value="AUTRE">Autre</option>
        </select>
      </Field>
      <button onClick={submit} className="w-full mt-2 py-2.5 rounded-lg text-sm font-medium text-white" style={{ background: C.spice }}>
        Enregistrer le règlement
      </button>
    </Modal>
  );
}
