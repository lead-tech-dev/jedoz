import React, { useEffect, useState } from "react";
import { AdminPage, AdminSection } from "../../components/AdminPage";
import { listCases } from "../../api/moderation";

type KPI = { label: string; value: number };

export default function ModerationStats() {
  const [kpis, setKpis] = useState<KPI[]>([]);

  useEffect(() => {
    (async () => {
      const open = await listCases({ status: "OPEN", minScore: 0 });
      const esc = await listCases({ status: "ESCALATED", minScore: 0 });
      const closed = await listCases({ status: "CLOSED", minScore: 0 });

      const avg = (arr: any[]) => arr.length ? Math.round(arr.reduce((a, x) => a + (x.score || 0), 0) / arr.length) : 0;

      setKpis([
        { label: "OPEN", value: open.items.length },
        { label: "ESCALATED", value: esc.items.length },
        { label: "CLOSED", value: closed.items.length },
        { label: "AVG score (OPEN)", value: avg(open.items) },
      ]);
    })();
  }, []);

  return (
    <AdminPage title="Stats modération" subtitle="KPIs clients">
      <AdminSection title="Vue d’ensemble">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
          {kpis.map(k => (
            <div key={k.label} className="panel pad">
              <div className="small">{k.label}</div>
              <div style={{ fontWeight: 900, fontSize: 24 }}>{k.value}</div>
            </div>
          ))}
        </div>
      </AdminSection>
    </AdminPage>
  );
}
