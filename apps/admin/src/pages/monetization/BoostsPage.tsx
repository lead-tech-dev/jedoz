import React, { useEffect, useState } from "react";
import { AdminPage, AdminSection } from "../../components/AdminPage";
import { BoostConfig, listBoosts, toggleBoost, upsertBoost } from "../../api/monetization";

export default function BoostsPage() {
  const [items, setItems] = useState<BoostConfig[]>([]);
  const [form, setForm] = useState<any>({ name: "VIP 24h", creditsCost: 200, durationHours: 24, country: "CM", isActive: true });
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await listBoosts();
      setItems(res.items || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function save() {
    await upsertBoost({
      name: form.name,
      creditsCost: Number(form.creditsCost),
      durationHours: Number(form.durationHours),
      country: form.country || null,
      isActive: true,
    });
    await load();
  }

  async function toggle(id: string) {
    await toggleBoost(id);
    await load();
  }

  return (
    <AdminPage title="Boosts" subtitle="Configurer les boosts (VIP / TOP / URGENT...)." actions={<button className="btn" onClick={load} disabled={loading}>{loading ? "Chargement..." : "Rafraîchir"}</button>}>
      <AdminSection title="Créer un boost">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 10 }}>
          <div style={{ gridColumn: "span 2" }}>
            <div className="small">Nom</div>
            <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <div className="small">Crédits</div>
            <input className="input" type="number" value={form.creditsCost} onChange={e => setForm({ ...form, creditsCost: e.target.value })} />
          </div>
          <div>
            <div className="small">Durée (h)</div>
            <input className="input" type="number" value={form.durationHours} onChange={e => setForm({ ...form, durationHours: e.target.value })} />
          </div>
          <div>
            <div className="small">Pays</div>
            <input className="input" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} />
          </div>
          <div style={{ gridColumn: "span 5" }}>
            <button className="btn primary" onClick={save}>Créer</button>
          </div>
        </div>
      </AdminSection>

      <AdminSection title="Boosts existants">
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 900 }}>
            <div className="small" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 120px", gap: 12, padding: "10px 12px" }}>
              <div>Nom</div>
              <div>Crédits</div>
              <div>Durée</div>
              <div>Pays</div>
              <div></div>
            </div>
            {items.map(it => (
              <div key={it.id} className="panel pad" style={{ marginTop: 8, display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 120px", gap: 12, alignItems: "center" }}>
                <div>{it.name}</div>
                <div>{it.creditsCost}</div>
                <div>{it.durationHours}h</div>
                <div className="small">{it.country || "-"}</div>
                <div style={{ textAlign: "right" }}>
                  <button className="btn" onClick={() => toggle(it.id)}>
                    {it.isActive ? "Off" : "On"}
                  </button>
                </div>
              </div>
            ))}
            {!items.length && <div className="small">Aucun boost.</div>}
          </div>
        </div>
      </AdminSection>
    </AdminPage>
  );
}
