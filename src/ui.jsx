import React from "react";
import { X } from "lucide-react";

// ---------- Design tokens (repris du prototype) ----------
export const C = {
  ink: "#1E2A28",
  paper: "#F6F4EE",
  panel: "#FFFFFF",
  line: "#E3DFD3",
  spice: "#B5501E",
  spiceDeep: "#8C3B15",
  sage: "#5B6E52",
  gold: "#C79A3E",
  muted: "#8A8577",
  danger: "#B23A2E",
  okBg: "#EEF2E9",
};

export const fmt = (n) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n || 0)) + " FCFA";

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const datesBetween = (start, end) => {
  if (!start || !end) return [];
  const out = [];
  let cur = new Date(start + "T00:00:00");
  const last = new Date(end + "T00:00:00");
  if (isNaN(cur) || isNaN(last) || cur > last) return [];
  while (cur <= last) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
};

export function Badge({ children, tone = "default" }) {
  const tones = {
    default: { bg: "#EFEBDD", fg: C.ink },
    ok: { bg: C.okBg, fg: C.sage },
    warn: { bg: "#FBEFE2", fg: C.spiceDeep },
    danger: { bg: "#F7E4E1", fg: C.danger },
  };
  const t = tones[tone];
  return (
    <span style={{ background: t.bg, color: t.fg }} className="px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap">
      {children}
    </span>
  );
}

export function Card({ children, className = "" }) {
  return (
    <div className={`bg-white rounded-xl border ${className}`} style={{ borderColor: C.line }}>
      {children}
    </div>
  );
}

export function Stat({ label, value, sub, icon: Icon, accent }) {
  return (
    <Card className="p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide" style={{ color: C.muted }}>{label}</span>
        {Icon && <Icon size={16} style={{ color: accent || C.muted }} />}
      </div>
      <div className="text-2xl font-semibold" style={{ color: C.ink }}>{value}</div>
      {sub && <div className="text-xs" style={{ color: C.muted }}>{sub}</div>}
    </Card>
  );
}

export function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4" style={{ background: "rgba(30,42,40,0.45)" }}>
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl flex flex-col" style={{ maxHeight: "90vh" }}>
        <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b shrink-0" style={{ borderColor: C.line }}>
          <h3 className="font-semibold" style={{ color: C.ink }}>{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-black/5"><X size={18} /></button>
        </div>
        <div className="p-4 sm:p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs font-medium mb-1" style={{ color: C.muted }}>{label}</span>
      {children}
    </label>
  );
}

export const inputCls = "w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2";
export const inputStyle = { borderColor: C.line };
