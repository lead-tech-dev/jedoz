import React, { useEffect, useState } from "react";
import { Select } from "@repo/ui";
import { AdminPage, AdminSection } from "../../components/AdminPage";
import { listProOffers, createProOffer, updateProOffer, ProOffer } from "../../api/monetization";

export default function ProOffersPage() {
  const [items, setItems] = useState<ProOffer[]>([]);
  const [form, setForm] = useState<any>({ name: "PRO Mensuel", plan: "MONTHLY", creditsCost: 500, durationDays: 30, country: "CM", isActive: true });
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await listProOffers();
      setItems(res.items || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function create() {
    await createProOffer({
      name: form.name,
      plan: form.plan,
      creditsCost: Number(form.creditsCost),
      durationDays: Number(form.durationDays),
      country: form.country || null,
      isActive: !!form.isActive,
    });
    await load();
  }

  async function toggle(it: ProOffer) {
    await updateProOffer(it.id, { isActive: !it.isActive });
    await load();
  }

  return (
    <AdminPage title="Offres PRO" subtitle="Gérer les offres d’abonnement PRO." actions={<button className="btn" onClick={load} disabled={loading}>{loading ? "Chargement..." : "Rafraîchir"}</button>}>
      <AdminSection title="Créer une offre">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 10 }}>
          <div style={{ gridColumn: "span 2" }}>
            <div className="small">Nom</div>
            <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <div className="small">Plan</div>
            <Select className="input" value={form.plan} onChange={value => setForm({ ...form, plan: value })} ariaLabel="Plan">
              <option value="MONTHLY">MONTHLY</option>
              <option value="YEARLY">YEARLY</option>
            </Select>
          </div>
          <div>
            <div className="small">Coût crédits</div>
            <input className="input" type="number" value={form.creditsCost} onChange={e => setForm({ ...form, creditsCost: e.target.value })} />
          </div>
          <div>
            <div className="small">Durée (jours)</div>
            <input className="input" type="number" value={form.durationDays} onChange={e => setForm({ ...form, durationDays: e.target.value })} />
          </div>
          <div>
            <div className="small">Pays</div>
            <input className="input" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} />
          </div>
          <div style={{ gridColumn: "span 6" }}>
            <button className="btn primary" onClick={create}>Créer</button>
          </div>
        </div>
      </AdminSection>

      <AdminSection title="Offres existantes">
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 900 }}>
            <div className="small" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 100px 120px", gap: 12, padding: "10px 12px" }}>
              <div>Nom</div>
              <div>Plan</div>
              <div>Crédits</div>
              <div>Durée</div>
              <div>Pays</div>
              <div></div>
            </div>
            {items.map(it => (
              <div key={it.id} className="panel pad" style={{ marginTop: 8, display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 100px 120px", gap: 12, alignItems: "center" }}>
                <div>{it.name}</div>
                <div>{it.plan}</div>
                <div>{it.creditsCost}</div>
                <div>{it.durationDays}j</div>
                <div className="small">{it.country || "-"}</div>
                <div style={{ textAlign: "right" }}>
                  <button className="btn" onClick={() => toggle(it)}>
                    {it.isActive ? "Off" : "On"}
                  </button>
                </div>
              </div>
            ))}
            {!items.length && <div className="small">Aucune offre.</div>}
          </div>
        </div>
      </AdminSection>
    </AdminPage>
  );
}
