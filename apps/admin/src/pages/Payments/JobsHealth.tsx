import React from "react";
import { AdminPage, AdminSection } from "../../components/AdminPage";
import { apiGet } from "../../lib/api";
import { useAdminAuth } from "../../lib/auth";

export default function JobsHealth() {
  const { token } = useAdminAuth();
  const [data, setData] = React.useState<any>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const r = await apiGet("/admin/jobs/health", token);
      setData(r);
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, [token]);

  return (
    <AdminPage
      title="Jobs & Queue"
      subtitle="Santé de la file BullMQ + compteurs intents."
      actions={<button onClick={load} className="btn">Rafraîchir</button>}
    >
      {loading && <div className="small">Chargement…</div>}
      {err && <div className="small" style={{ color: "var(--red)" }}>{err}</div>}

      {data && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
          <AdminSection title="Queue (payments)">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
              {Object.entries(data.queue || {}).map(([k, v]) => (
                <div key={k} className="panel pad" style={{ padding: "8px 10px" }}>
                  <div className="small">{k}</div>
                  <div style={{ fontWeight: 700 }}>{String(v)}</div>
                </div>
              ))}
            </div>
          </AdminSection>

          <AdminSection title="PaymentIntents">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
              <div className="panel pad" style={{ padding: "8px 10px" }}>
                <div className="small">pending</div>
                <div style={{ fontWeight: 700 }}>{String(data.intents?.pending ?? 0)}</div>
              </div>
              <div className="panel pad" style={{ padding: "8px 10px" }}>
                <div className="small">initiated</div>
                <div style={{ fontWeight: 700 }}>{String(data.intents?.initiated ?? 0)}</div>
              </div>
            </div>
            <div className="small" style={{ marginTop: 10 }}>
              Si beaucoup d’intents restent en PENDING, vérifie Redis/worker et les callbacks providers.
            </div>
          </AdminSection>
        </div>
      )}
    </AdminPage>
  );
}
