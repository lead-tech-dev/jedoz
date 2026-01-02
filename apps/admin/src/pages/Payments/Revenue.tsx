import React, { useEffect, useMemo, useState } from "react";
import { AdminPage, AdminSection } from "../../components/AdminPage";
import { apiGet } from "../../lib/api";
import { useAdminAuth } from "../../lib/auth";
import { formatStatus } from "../../lib/status";
import { formatProductType } from "../../lib/products";

type TotalsRow = { provider: string; status: string; productType: string; _count: { _all: number }; _sum: { amount: number | null } };
type DailyRow = { day: string; provider: string; amount: number };

export default function Revenue() {
  const { token } = useAdminAuth();
  const [range, setRange] = useState<{ from: string; to: string }>(() => {
    const to = new Date();
    const from = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
  });
  const [loading, setLoading] = useState(false);
  const [totals, setTotals] = useState<TotalsRow[]>([]);
  const [daily, setDaily] = useState<DailyRow[]>([]);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (range.from) p.set("from", new Date(range.from).toISOString());
    if (range.to) p.set("to", new Date(range.to + "T23:59:59.999Z").toISOString());
    return p.toString();
  }, [range]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const json = await apiGet<any>(`/admin/payments/revenue?${query}`, token);
        setTotals(json.totals || []);
        setDaily((json.daily || []).map((d: any) => ({
          day: new Date(d.day).toISOString().slice(0, 10),
          provider: d.provider,
          amount: Number(d.amount || 0),
        })));
      } finally {
        setLoading(false);
      }
    })();
  }, [query, token]);

  const successSum = totals
    .filter((t) => String(t.status).toUpperCase() === "SUCCESS")
    .reduce((acc, t) => acc + (t._sum?.amount || 0), 0);
  const successCount = totals
    .filter((t) => String(t.status).toUpperCase() === "SUCCESS")
    .reduce((acc, t) => acc + (t._count?._all || 0), 0);

  return (
    <AdminPage title="Revenus" subtitle="KPIs (SUCCESS) + breakdown provider / produit.">
      <AdminSection title="KPIs">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
          <div className="panel pad">
            <div className="small">Total SUCCESS</div>
            <div style={{ fontWeight: 900, fontSize: 22 }}>{successSum}</div>
          </div>
          <div className="panel pad">
            <div className="small"># Transactions SUCCESS</div>
            <div style={{ fontWeight: 900, fontSize: 22 }}>{successCount}</div>
          </div>
          <div className="panel pad" style={{ gridColumn: "span 2" }}>
            <div className="small">Période</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
              <input className="input" type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
              <input className="input" type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
            </div>
          </div>
        </div>
      </AdminSection>

      <AdminSection title="Breakdown">
        <div style={{ overflowX: "auto" }}>
          <table style={{ minWidth: 900, width: "100%", fontSize: 13 }}>
            <thead>
              <tr className="small" style={{ textAlign: "left" }}>
                <th style={{ padding: "10px 12px" }}>Provider</th>
                <th style={{ padding: "10px 12px" }}>Status</th>
                <th style={{ padding: "10px 12px" }}>Product</th>
                <th style={{ padding: "10px 12px", textAlign: "right" }}>Count</th>
                <th style={{ padding: "10px 12px", textAlign: "right" }}>Sum(amount)</th>
              </tr>
            </thead>
            <tbody>
              {totals.map((t, idx) => (
                <tr key={idx} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 700 }}>{t.provider}</td>
                  <td style={{ padding: "10px 12px" }}>{formatStatus(t.status)}</td>
                  <td style={{ padding: "10px 12px" }}>{formatProductType(t.productType)}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>{t._count?._all || 0}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>{t._sum?.amount || 0}</td>
                </tr>
              ))}
              {!totals.length && !loading ? (
                <tr><td className="small" style={{ padding: 12 }} colSpan={5}>Aucune donnée.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </AdminSection>

      <AdminSection title="Daily SUCCESS">
        <div style={{ overflowX: "auto" }}>
          <table style={{ minWidth: 700, width: "100%", fontSize: 13 }}>
            <thead>
              <tr className="small" style={{ textAlign: "left" }}>
                <th style={{ padding: "10px 12px" }}>Day</th>
                <th style={{ padding: "10px 12px" }}>Provider</th>
                <th style={{ padding: "10px 12px", textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {daily.map((d, idx) => (
                <tr key={idx} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ padding: "10px 12px" }}>{d.day}</td>
                  <td style={{ padding: "10px 12px", fontWeight: 700 }}>{d.provider}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>{d.amount}</td>
                </tr>
              ))}
              {!daily.length && !loading ? (
                <tr><td className="small" style={{ padding: 12 }} colSpan={3}>Aucune donnée.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </AdminSection>
    </AdminPage>
  );
}
