import React, { useEffect, useState } from "react";
import { AdminPage, AdminSection } from "../../components/AdminPage";
import { CreditPack, listCreditPacks, toggleCreditPack, upsertCreditPack } from "../../api/monetization";

export default function CreditPacksPage() {
  const [items, setItems] = useState<CreditPack[]>([]);
  const [form, setForm] = useState<any>({ name: "", credits: 100, price: 1000, currency: "XAF", country: "CM" });
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await listCreditPacks();
      setItems(res.items || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function save() {
    await upsertCreditPack({
      name: form.name,
      credits: Number(form.credits),
      price: Number(form.price),
      currency: form.currency,
      country: form.country || null,
      isActive: true,
    });
    setForm({ ...form, name: "" });
    await load();
  }

  async function toggle(id: string) {
    await toggleCreditPack(id);
    await load();
  }

  return (
    <AdminPage title="Packs crédits" subtitle="Créer/activer/désactiver les packs vendus." actions={<button className="btn" onClick={load} disabled={loading}>{loading ? "Chargement..." : "Rafraîchir"}</button>}>
      <AdminSection title="Créer un pack">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 10 }}>
          <div style={{ gridColumn: "span 2" }}>
            <div className="small">Nom</div>
            <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Pack Starter" />
          </div>
          <div>
            <div className="small">Crédits</div>
            <input className="input" type="number" value={form.credits} onChange={e => setForm({ ...form, credits: e.target.value })} />
          </div>
          <div>
            <div className="small">Prix</div>
            <input className="input" type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
          </div>
          <div>
            <div className="small">Devise</div>
            <input className="input" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} />
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

      <AdminSection title="Liste des packs">
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 900 }}>
            <div className="small" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 100px 120px", gap: 12, padding: "10px 12px" }}>
              <div>Nom</div>
              <div>Crédits</div>
              <div>Prix</div>
              <div>Devise</div>
              <div>Pays</div>
              <div></div>
            </div>
            {items.map(it => (
              <div key={it.id} className="panel pad" style={{ marginTop: 8, display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 100px 120px", gap: 12, alignItems: "center" }}>
                <div>{it.name}</div>
                <div>{it.credits}</div>
                <div>{it.price}</div>
                <div>{it.currency}</div>
                <div className="small">{it.country || "-"}</div>
                <div style={{ textAlign: "right" }}>
                  <button className="btn" onClick={() => toggle(it.id)}>
                    {it.isActive ? "Off" : "On"}
                  </button>
                </div>
              </div>
            ))}
            {!items.length && <div className="small">Aucun pack.</div>}
          </div>
        </div>
      </AdminSection>
    </AdminPage>
  );
}
