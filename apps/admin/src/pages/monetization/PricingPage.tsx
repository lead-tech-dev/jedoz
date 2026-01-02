import React, { useEffect, useState } from "react";
import { AdminPage, AdminSection } from "../../components/AdminPage";
import { CountryPricing, listPricing, upsertPricing } from "../../api/monetization";

export default function PricingPage() {
  const [items, setItems] = useState<CountryPricing[]>([]);
  const [form, setForm] = useState<any>({ country: "CM", creditValueXaf: 2, currency: "XAF" });
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await listPricing();
      setItems(res.items || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function save() {
    await upsertPricing({
      country: form.country,
      creditValueXaf: Number(form.creditValueXaf),
      currency: form.currency,
    });
    await load();
  }

  return (
    <AdminPage title="Pricing par pays" subtitle="Override de valeur crédit et devise." actions={<button className="btn" onClick={load} disabled={loading}>{loading ? "Chargement..." : "Rafraîchir"}</button>}>
      <AdminSection title="Mettre à jour un pays">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
          <div>
            <div className="small">Pays</div>
            <input className="input" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} />
          </div>
          <div>
            <div className="small">Valeur crédit (XAF)</div>
            <input className="input" type="number" value={form.creditValueXaf} onChange={e => setForm({ ...form, creditValueXaf: e.target.value })} />
          </div>
          <div>
            <div className="small">Devise</div>
            <input className="input" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} />
          </div>
          <div style={{ gridColumn: "span 3" }}>
            <button className="btn primary" onClick={save}>Enregistrer</button>
          </div>
        </div>
      </AdminSection>

      <AdminSection title="Pays configurés">
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 700 }}>
            <div className="small" style={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr", gap: 12, padding: "10px 12px" }}>
              <div>Pays</div>
              <div>Valeur crédit (XAF)</div>
              <div>Devise</div>
            </div>
            {items.map(it => (
              <div key={it.id} className="panel pad" style={{ marginTop: 8, display: "grid", gridTemplateColumns: "120px 1fr 1fr", gap: 12 }}>
                <div>{it.country}</div>
                <div>{it.creditValueXaf}</div>
                <div>{it.currency}</div>
              </div>
            ))}
            {!items.length && <div className="small">Aucun pricing défini.</div>}
          </div>
        </div>
      </AdminSection>
    </AdminPage>
  );
}
