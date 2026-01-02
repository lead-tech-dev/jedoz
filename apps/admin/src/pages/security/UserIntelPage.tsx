import React, { useState } from "react";
import { AdminPage, AdminSection } from "../../components/AdminPage";
import { getUserDevices, getUserDuplicates, UserDevice, AdFingerprint } from "../../api/security";

export default function UserIntelPage() {
  const [userId, setUserId] = useState("");
  const [devices, setDevices] = useState<UserDevice[]>([]);
  const [dupes, setDupes] = useState<AdFingerprint[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    const uid = userId.trim();
    if (!uid) return;
    setLoading(true);
    try {
      const d = await getUserDevices(uid);
      const f = await getUserDuplicates(uid);
      setDevices(d.items || []);
      setDupes(f.items || []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminPage title="User Intel" subtitle="Devices & doublons (fingerprints) d’un utilisateur.">
      <AdminSection title="Recherche">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div className="small">UserId</div>
            <input className="input" value={userId} onChange={e => setUserId(e.target.value)} placeholder="uuid user" />
          </div>
          <button className="btn primary" onClick={load} disabled={loading}>
            {loading ? "Chargement..." : "Charger"}
          </button>
        </div>
      </AdminSection>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
        <AdminSection title="Devices">
          {devices.length ? (
            <div style={{ display: "grid", gap: 8 }}>
              {devices.map(d => (
                <div key={d.id} className="panel pad" style={{ padding: 10 }}>
                  <div className="small" style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" }}>{d.deviceId}</div>
                  <div className="small">first: {new Date(d.firstSeen).toLocaleString()}</div>
                  <div className="small">last: {new Date(d.lastSeen).toLocaleString()}</div>
                  <div className="small">ip: {d.ipLast || "-"}</div>
                  <div className="small" style={{ wordBreak: "break-word" }}>ua: {d.userAgent || "-"}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="small">Aucun device.</div>
          )}
        </AdminSection>

        <AdminSection title="Doublons (fingerprints)">
          {dupes.length ? (
            <div style={{ display: "grid", gap: 8 }}>
              {dupes.map(f => (
                <div key={f.id} className="panel pad" style={{ padding: 10 }}>
                  <div className="small" style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" }}>ad: {f.adId}</div>
                  <div className="small">created: {new Date(f.createdAt).toLocaleString()}</div>
                  <div className="small" style={{ wordBreak: "break-word" }}>{f.fpText}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="small">Aucun fingerprint.</div>
          )}
        </AdminSection>
      </div>
    </AdminPage>
  );
}
