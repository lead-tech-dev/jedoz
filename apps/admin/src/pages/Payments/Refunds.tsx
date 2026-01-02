import React, { useEffect, useMemo, useState } from "react";
import { AdminPage, AdminSection } from "../../components/AdminPage";
import { apiGet, apiPost } from "../../lib/api";
import { useAdminAuth } from "../../lib/auth";
import { formatStatus } from "../../lib/status";
import { formatProductType } from "../../lib/products";

type Intent = any;

export default function Refunds() {
  const { token } = useAdminAuth();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Intent[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const query = useMemo(() => {
    const p = new URLSearchParams();
    p.set("provider", "STRIPE");
    if (q) p.set("q", q);
    p.set("limit", "50");
    return p.toString();
  }, [q]);

  async function load() {
    setLoading(true);
    setMessage(null);
    try {
      const json = await apiGet<any>(`/admin/payments/intents?${query}`, token);
      setItems(json.items || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [query]);

  async function refund(intentId: string) {
    setMessage(null);
    const ok = confirm("Confirmer le remboursement Stripe ? (action irréversible)");
    if (!ok) return;
    setLoading(true);
    try {
      try {
        const json = await apiPost<any>(`/admin/payments/intents/${intentId}/refund`, {}, token);
        setMessage(`Refund OK: ${json.refundId}`);
        await load();
      } catch (e: any) {
        setMessage(e?.error || "Refund failed");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminPage title="Refunds (Stripe)" subtitle="Rechercher une intent Stripe et déclencher un remboursement.">
      <AdminSection title="Recherche">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <input className="input" style={{ minWidth: 320 }} placeholder="Search (intent id / providerRef)" value={q} onChange={e => setQ(e.target.value)} />
          <button className="btn" onClick={() => load()} disabled={loading}>
            {loading ? "Chargement…" : "Rafraîchir"}
          </button>
        </div>
        {message ? <div className="small" style={{ marginTop: 10, fontWeight: 700 }}>{message}</div> : null}
      </AdminSection>

      <AdminSection title="Résultats" subtitle={items.length ? `${items.length} intents` : "Aucune intent trouvée."}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ minWidth: 1100, width: "100%", fontSize: 13 }}>
            <thead>
              <tr className="small" style={{ textAlign: "left" }}>
                <th style={{ padding: "10px 12px" }}>Intent</th>
                <th style={{ padding: "10px 12px" }}>Status</th>
                <th style={{ padding: "10px 12px" }}>Product</th>
                <th style={{ padding: "10px 12px", textAlign: "right" }}>Amount</th>
                <th style={{ padding: "10px 12px" }}>providerRef</th>
                <th style={{ padding: "10px 12px" }}>Created</th>
                <th style={{ padding: "10px 12px", textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it: any) => (
                <tr key={it.id} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ padding: "10px 12px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace", fontSize: 12 }}>{it.id}</td>
                  <td style={{ padding: "10px 12px" }}>{formatStatus(it.status)}</td>
                  <td style={{ padding: "10px 12px" }}>{formatProductType(it.productType)}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>{it.amount}</td>
                  <td style={{ padding: "10px 12px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace", fontSize: 12 }}>{it.providerRef || ""}</td>
                  <td style={{ padding: "10px 12px" }}>{it.createdAt ? new Date(it.createdAt).toLocaleString() : ""}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>
                    <button
                      className="btn"
                      disabled={loading || it.status !== "SUCCESS"}
                      onClick={() => refund(it.id)}
                    >Refund</button>
                  </td>
                </tr>
              ))}
              {!items.length && !loading ? (
                <tr><td className="small" style={{ padding: 12 }} colSpan={7}>Aucune intent trouvée.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </AdminSection>
    </AdminPage>
  );
}
