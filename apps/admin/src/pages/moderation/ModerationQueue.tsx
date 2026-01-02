import React, { useEffect, useMemo, useState } from "react";
import { Select } from "@repo/ui";
import { AdminPage, AdminSection } from "../../components/AdminPage";
import { listCases, ModerationCase, ModerationCaseStatus } from "../../api/moderation";
import { Link } from "react-router-dom";
import { formatStatus } from "../../lib/status";

export default function ModerationQueue() {
  const [status, setStatus] = useState<ModerationCaseStatus>("OPEN");
  const [minScore, setMinScore] = useState<number>(50);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<ModerationCase[]>([]);
  const [loading, setLoading] = useState(false);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(i =>
      [i.id, i.adId, i.userId, i.country ?? "", i.categorySlug ?? ""].some(v => (v || "").toLowerCase().includes(s))
    );
  }, [items, q]);

  async function load() {
    setLoading(true);
    try {
      const res = await listCases({ status, minScore });
      setItems(res.items || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [status, minScore]);

  return (
    <AdminPage
      title="Modération"
      subtitle="File de cas à traiter (auto-modération)."
      actions={<button className="btn" onClick={load} disabled={loading}>{loading ? "Chargement..." : "Rafraîchir"}</button>}
    >
      <AdminSection title="Filtres">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
          <div>
            <div className="small">Statut</div>
            <Select className="input" value={status} onChange={value => setStatus(value as any)} ariaLabel="Statut">
              <option value="OPEN">{formatStatus("OPEN")}</option>
              <option value="ESCALATED">{formatStatus("ESCALATED")}</option>
              <option value="CLOSED">{formatStatus("CLOSED")}</option>
            </Select>
          </div>
          <div>
            <div className="small">Score min</div>
            <input className="input" type="number" value={minScore} onChange={e => setMinScore(Number(e.target.value))} />
          </div>
          <div style={{ gridColumn: "span 2" }}>
            <div className="small">Recherche</div>
            <input className="input" value={q} onChange={e => setQ(e.target.value)} placeholder="caseId, adId, userId, pays, catégorie..." />
          </div>
        </div>
      </AdminSection>

      <AdminSection title="File de modération" subtitle={filtered.length ? `${filtered.length} cas` : "Aucun cas pour ces filtres."}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 880 }}>
            <div className="small" style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1.5fr 1.5fr 0.6fr 1fr", gap: 10, padding: "10px 12px" }}>
              <div>Case</div>
              <div>Annonce</div>
              <div>User</div>
              <div>Pays/Cat</div>
              <div>Score</div>
              <div>Statut</div>
            </div>
            {filtered.map(item => (
              <Link
                key={item.id}
                to={`/admin/moderation/cases/${item.id}`}
                className="panel pad"
                style={{ marginTop: 8, display: "grid", gridTemplateColumns: "2fr 2fr 1.5fr 1.5fr 0.6fr 1fr", gap: 10, textDecoration: "none" }}
              >
                <div className="small" style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" }}>{item.id}</div>
                <div className="small" style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" }}>{item.adId}</div>
                <div className="small" style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" }}>{item.userId}</div>
                <div className="small">{item.country || "-"} / {item.categorySlug || "-"}</div>
                <div style={{ fontWeight: 700 }}>{item.score}</div>
                <div className="small">{formatStatus(item.status)}</div>
              </Link>
            ))}
          </div>
        </div>
        {!filtered.length && (
          <div className="small">Aucun cas pour ces filtres.</div>
        )}
      </AdminSection>
    </AdminPage>
  );
}
