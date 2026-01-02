import React, { useEffect, useState } from "react";
import { AdminPage, AdminSection } from "../../components/AdminPage";
import { listShadowbans, setShadowban, UserSecurity } from "../../api/security";

export default function ShadowbanPage() {
  const [items, setItems] = useState<UserSecurity[]>([]);
  const [userId, setUserId] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await listShadowbans();
      setItems(res.items || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function ban() {
    const uid = userId.trim();
    if (!uid) return;
    await setShadowban(uid, { isShadowBanned: true, reason: reason.trim() || undefined });
    setUserId("");
    setReason("");
    await load();
  }

  async function unban(uid: string) {
    await setShadowban(uid, { isShadowBanned: false });
    await load();
  }

  return (
    <AdminPage
      title="Shadowban"
      subtitle="Masque les annonces publiquement tout en laissant l’utilisateur “voir normal”."
      actions={<button className="btn" onClick={load} disabled={loading}>{loading ? "Chargement..." : "Rafraîchir"}</button>}
    >
      <AdminSection title="Ajouter un shadowban">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
          <div>
            <div className="small">UserId</div>
            <input className="input" value={userId} onChange={e => setUserId(e.target.value)} placeholder="uuid user" />
          </div>
          <div style={{ gridColumn: "span 2" }}>
            <div className="small">Raison</div>
            <input className="input" value={reason} onChange={e => setReason(e.target.value)} placeholder="fraud/spam..." />
          </div>
          <div style={{ gridColumn: "span 3" }}>
            <button className="btn primary" onClick={ban}>Shadowban</button>
          </div>
        </div>
      </AdminSection>

      <AdminSection title="Shadowbans actifs">
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 720 }}>
            <div className="small" style={{ display: "grid", gridTemplateColumns: "2fr 2fr 120px", gap: 12, padding: "10px 12px" }}>
              <div>User</div>
              <div>Raison</div>
              <div></div>
            </div>
            {items.map(it => (
              <div key={it.id} className="panel pad" style={{ marginTop: 8, display: "grid", gridTemplateColumns: "2fr 2fr 120px", gap: 12, alignItems: "center" }}>
                <div className="small" style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" }}>{it.userId}</div>
                <div className="small">{it.shadowReason || "-"}</div>
                <div style={{ textAlign: "right" }}>
                  <button className="btn" onClick={() => unban(it.userId)}>
                    Unban
                  </button>
                </div>
              </div>
            ))}
            {!items.length && <div className="small">Aucun shadowban actif.</div>}
          </div>
        </div>
      </AdminSection>
    </AdminPage>
  );
}
