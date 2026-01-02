import React, { useEffect, useMemo, useState } from "react";
import { Select } from "@repo/ui";
import { AdminPage, AdminSection } from "../../components/AdminPage";
import { apiGet, API_BASE } from "../../lib/api";
import { useAdminAuth } from "../../lib/auth";
import { formatStatus } from "../../lib/status";
import { formatProductType } from "../../lib/products";

type Intent = any;

export default function Transactions() {
  const { token } = useAdminAuth();
  const [items, setItems] = useState<Intent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState({
    provider: "",
    status: "",
    productType: "",
    q: "",
  });

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (filters.provider) p.set("provider", filters.provider);
    if (filters.status) p.set("status", filters.status);
    if (filters.productType) p.set("productType", filters.productType);
    if (filters.q) p.set("q", filters.q);
    return p.toString();
  }, [filters]);

  async function load(cursor?: string | null, reset?: boolean) {
    setLoading(true);
    try {
      const p = new URLSearchParams(query);
      if (cursor) p.set("cursor", cursor);
      const json = await apiGet<any>(`/admin/payments/intents?${p.toString()}`, token);
      setItems(prev => reset ? json.items : [...prev, ...json.items]);
      setNextCursor(json.nextCursor);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(null, true); }, [query, token]);

  return (
    <AdminPage
      title="Transactions"
      subtitle="Payment intents (MTN/ORANGE/STRIPE) with filters and CSV export."
      actions={(
        <a className="btn" href={`${API_BASE}/admin/payments/export.csv?${query}`}>
          Export CSV
        </a>
      )}
    >
      <AdminSection
        title="Filtres"
        actions={<button className="btn" onClick={() => load(null, true)} disabled={loading}>{loading ? "Chargement…" : "Rafraîchir"}</button>}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
          <Select className="input" value={filters.provider} onChange={(value) => setFilters(f => ({...f, provider: value}))} ariaLabel="Provider">
            <option value="">Provider (all)</option>
            <option value="MTN">MTN</option>
            <option value="ORANGE">ORANGE</option>
            <option value="STRIPE">STRIPE</option>
          </Select>
          <Select className="input" value={filters.status} onChange={(value) => setFilters(f => ({...f, status: value}))} ariaLabel="Status">
            <option value="">Status (all)</option>
            <option value="INITIATED">{formatStatus("INITIATED")}</option>
            <option value="PENDING">{formatStatus("PENDING")}</option>
            <option value="SUCCESS">{formatStatus("SUCCESS")}</option>
            <option value="FAILED">{formatStatus("FAILED")}</option>
            <option value="CANCELLED">{formatStatus("CANCELLED")}</option>
          </Select>
          <Select className="input" value={filters.productType} onChange={(value) => setFilters(f => ({...f, productType: value}))} ariaLabel="Product">
            <option value="">Product (all)</option>
            <option value="CREDIT_PACK">{formatProductType("CREDIT_PACK")}</option>
            <option value="PRO_SUBSCRIPTION">{formatProductType("PRO_SUBSCRIPTION")}</option>
            <option value="BOOST">{formatProductType("BOOST")}</option>
          </Select>
          <input className="input" placeholder="Search (intent/user/providerRef)" value={filters.q} onChange={e => setFilters(f => ({...f, q: e.target.value}))} />
        </div>
      </AdminSection>

      <AdminSection title="Résultats" subtitle={items.length ? `${items.length} transactions` : "Aucune transaction."}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ minWidth: 900, width: "100%", fontSize: 13 }}>
            <thead>
              <tr className="small" style={{ textAlign: "left" }}>
                <th style={{ padding: "10px 12px" }}>Created</th>
                <th style={{ padding: "10px 12px" }}>Provider</th>
                <th style={{ padding: "10px 12px" }}>Status</th>
                <th style={{ padding: "10px 12px" }}>Product</th>
                <th style={{ padding: "10px 12px" }}>Amount</th>
                <th style={{ padding: "10px 12px" }}>User</th>
                <th style={{ padding: "10px 12px" }}>Ref</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ padding: "10px 12px" }}>{new Date(it.createdAt).toLocaleString()}</td>
                  <td style={{ padding: "10px 12px", fontWeight: 700 }}>{it.provider}</td>
                  <td style={{ padding: "10px 12px" }}>{formatStatus(it.status)}</td>
                  <td style={{ padding: "10px 12px" }}>{formatProductType(it.productType)}</td>
                  <td style={{ padding: "10px 12px" }}>{it.amount} {it.currency}</td>
                  <td style={{ padding: "10px 12px" }}>{it.user?.email ?? it.userId}</td>
                  <td style={{ padding: "10px 12px" }}>{it.providerRef ?? "-"}</td>
                </tr>
              ))}
              {!items.length && !loading && (
                <tr><td className="small" style={{ padding: 12 }} colSpan={7}>No transactions.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ height: 12 }} />
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            className="btn"
            disabled={!nextCursor || loading}
            onClick={() => load(nextCursor ?? undefined)}
          >
            {loading ? "Loading..." : (nextCursor ? "Load more" : "No more")}
          </button>
        </div>
      </AdminSection>
    </AdminPage>
  );
}
