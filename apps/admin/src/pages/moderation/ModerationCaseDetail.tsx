import React, { useEffect, useState } from "react";
import { AdminPage, AdminSection } from "../../components/AdminPage";
import { decideCase, getCase, ModerationAction, ModerationCase } from "../../api/moderation";
import { Link, useParams } from "react-router-dom";
import { formatStatus } from "../../lib/status";

function JsonBlock({ value }: { value: any }) {
  return (
    <pre className="panel pad small" style={{ whiteSpace: "pre-wrap", margin: 0 }}>
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default function ModerationCaseDetail() {
  const { id } = useParams();
  const [item, setItem] = useState<ModerationCase | null>(null);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const res = await getCase(id);
      setItem(res.item);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function act(action: ModerationAction) {
    if (!id) return;
    await decideCase(id, { action, reason: reason.trim() || undefined });
    await load();
  }

  return (
    <AdminPage
      title={`Case ${id ?? ""}`}
      subtitle="Décision de modération"
      actions={<button className="btn" onClick={load} disabled={loading}>{loading ? "Chargement..." : "Rafraîchir"}</button>}
    >
      <div className="small"><Link to="/admin/moderation">← Retour file</Link></div>
      {!item ? (
        <div className="small">Chargement...</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
          <div style={{ display: "grid", gap: 12 }}>
            <AdminSection title="Contexte" subtitle={`Score ${item.score} · Statut ${formatStatus(item.status)}`}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                <div>
                  <div className="small">Annonce</div>
                  <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace", fontSize: 12 }}>{item.adId}</div>
                </div>
                <div>
                  <div className="small">Utilisateur</div>
                  <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace", fontSize: 12 }}>{item.userId}</div>
                </div>
                <div>
                  <div className="small">Pays</div>
                  <div>{item.country || "-"}</div>
                </div>
                <div>
                  <div className="small">Catégorie</div>
                  <div>{item.categorySlug || "-"}</div>
                </div>
              </div>
            </AdminSection>

            <AdminSection title="Raisons (JSON)">
              <JsonBlock value={item.reasons} />
            </AdminSection>

            <AdminSection title="Décisions">
              {item.decisions?.length ? (
                <div style={{ display: "grid", gap: 8 }}>
                  {item.decisions.map(d => (
                    <div key={d.id} className="panel pad" style={{ padding: 10 }}>
                      <div className="row" style={{ justifyContent: "space-between" }}>
                        <div style={{ fontWeight: 700 }}>{d.action}</div>
                        <div className="small">{new Date(d.createdAt).toLocaleString()}</div>
                      </div>
                      <div className="small" style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" }}>staff: {d.staffUserId}</div>
                      {d.reason && <div className="small" style={{ marginTop: 6 }}>{d.reason}</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="small">Aucune décision pour le moment.</div>
              )}
            </AdminSection>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <AdminSection title="Action modérateur">
              <div className="small">Motif (optionnel)</div>
              <textarea className="input" style={{ minHeight: 90 }} value={reason} onChange={e => setReason(e.target.value)} />
              <div style={{ height: 10 }} />
              <div style={{ display: "grid", gap: 8 }}>
                <button className="btn primary" onClick={() => act("APPROVE")}>
                  Approve (Publier)
                </button>
                <button className="btn" onClick={() => act("REJECT")}>
                  Reject
                </button>
                <button className="btn" onClick={() => act("ESCALATE")}>
                  Escalate
                </button>
              </div>
              <div className="small" style={{ marginTop: 10 }}>
                Approve → annonce publiée. Reject → annonce rejetée. Escalate → case escaladé.
              </div>
            </AdminSection>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
