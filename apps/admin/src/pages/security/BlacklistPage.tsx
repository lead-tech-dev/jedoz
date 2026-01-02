import React, { useEffect, useState } from "react";
import { Select } from "@repo/ui";
import { AdminPage, AdminSection } from "../../components/AdminPage";
import { listBlacklist, toggleBlacklist, upsertBlacklist, BlacklistItem, BlacklistType } from "../../api/security";

export default function BlacklistPage() {
  const [items, setItems] = useState<BlacklistItem[]>([]);
  const [type, setType] = useState<BlacklistType>("IP");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await listBlacklist();
      setItems(res.items || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function add() {
    const v = value.trim();
    if (!v) return;
    await upsertBlacklist({ type, value: v, reason: reason.trim() || undefined });
    setValue("");
    setReason("");
    await load();
  }

  async function toggle(id: string) {
    await toggleBlacklist(id);
    await load();
  }

  return (
    <AdminPage title="Blacklist" subtitle="Bloque IP / Téléphone / Device ID." actions={<button className="btn" onClick={load} disabled={loading}>{loading ? "Chargement..." : "Rafraîchir"}</button>}>
      <AdminSection title="Ajouter une règle">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
          <div>
            <div className="small">Type</div>
            <Select className="input" value={type} onChange={value => setType(value as any)} ariaLabel="Type">
              <option value="IP">IP</option>
              <option value="PHONE">PHONE</option>
              <option value="DEVICE">DEVICE</option>
            </Select>
          </div>
          <div style={{ gridColumn: "span 2" }}>
            <div className="small">Valeur</div>
            <input className="input" value={value} onChange={e => setValue(e.target.value)} placeholder="1.2.3.4 / 2376xxxxxx / device-id" />
          </div>
          <div>
            <div className="small">Motif</div>
            <input className="input" value={reason} onChange={e => setReason(e.target.value)} placeholder="spam, fraud..." />
          </div>
          <div style={{ gridColumn: "span 4" }}>
            <button className="btn primary" onClick={add}>Ajouter</button>
          </div>
        </div>
      </AdminSection>

      <AdminSection title="Liste">
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 900 }}>
            <div className="small" style={{ display: "grid", gridTemplateColumns: "120px 2fr 1fr 80px 120px", gap: 12, padding: "10px 12px" }}>
              <div>Type</div>
              <div>Valeur</div>
              <div>Motif</div>
              <div>Actif</div>
              <div></div>
            </div>
            {items.map(it => (
              <div key={it.id} className="panel pad" style={{ marginTop: 8, display: "grid", gridTemplateColumns: "120px 2fr 1fr 80px 120px", gap: 12, alignItems: "center" }}>
                <div>{it.type}</div>
                <div className="small" style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" }}>{it.value}</div>
                <div className="small">{it.reason || "-"}</div>
                <div className="small">{it.isActive ? "YES" : "NO"}</div>
                <div style={{ textAlign: "right" }}>
                  <button className="btn" onClick={() => toggle(it.id)}>
                    {it.isActive ? "Désactiver" : "Activer"}
                  </button>
                </div>
              </div>
            ))}
            {!items.length && <div className="small">Aucun élément.</div>}
          </div>
        </div>
      </AdminSection>
    </AdminPage>
  );
}
