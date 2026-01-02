import React, { useEffect, useState } from "react";
import { Select } from "@repo/ui";
import { AdminPage, AdminSection } from "../../components/AdminPage";
import { apiGet, apiPost } from "../../lib/api";
import { useAdminAuth } from "../../lib/auth";
import { formatStatus } from "../../lib/status";
import { formatProductType } from "../../lib/products";

export default function Reconciliation() {
  const { token } = useAdminAuth();
  const [items, setItems] = useState<any[]>([]);
  const [minAgeMinutes, setMinAgeMinutes] = useState(10);
  const [provider, setProvider] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      p.set("minutes", String(minAgeMinutes));
      if (provider) p.set("provider", provider);
      const json = await apiGet<any>(`/admin/reconciliation/stuck?${p.toString()}`, token);
      setItems(json.items);
    } finally {
      setLoading(false);
    }
  }

  async function reverify(id: string) {
    await apiPost(`/admin/reconciliation/${id}/reverify`, {}, token);
    await load();
  }

  async function cancel(id: string) {
    await apiPost(`/admin/reconciliation/${id}/cancel`, {}, token);
    await load();
  }

  useEffect(() => { load(); }, [token]);

  return (
    <AdminPage title="Reconciliation" subtitle="Find stuck PENDING/INITIATED intents and re-verify them." actions={<button className="btn" onClick={load}>Rafraîchir</button>}>
      <AdminSection title="Filtres">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
          <input className="input" type="number" value={minAgeMinutes} onChange={e => setMinAgeMinutes(parseInt(e.target.value || "10", 10))} />
          <Select className="input" value={provider} onChange={setProvider} ariaLabel="Provider">
            <option value="">Provider (all)</option>
            <option value="MTN">MTN</option>
            <option value="ORANGE">ORANGE</option>
            <option value="STRIPE">STRIPE</option>
          </Select>
          <button className="btn" onClick={load}>
            Appliquer
          </button>
        </div>
      </AdminSection>

      <AdminSection title="Transactions bloquées">
        {items.map((it) => (
          <div key={it.id} className="panel pad" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 900 }}>{it.provider} • {formatStatus(it.status)} • {formatProductType(it.productType)}</div>
              <div className="small">{it.id} — {new Date(it.createdAt).toLocaleString()}</div>
              <div className="small">ref: {it.providerRef ?? "-"}</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn" onClick={() => reverify(it.id)}>
                Re-verify
              </button>
              <button className="btn ghost" onClick={() => cancel(it.id)}>
                Cancel
              </button>
            </div>
          </div>
        ))}
        {!items.length && !loading && <div className="small">No stuck intents.</div>}
        {loading && <div className="small">Loading…</div>}
      </AdminSection>
    </AdminPage>
  );
}
