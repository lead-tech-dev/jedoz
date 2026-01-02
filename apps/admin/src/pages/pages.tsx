import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
// Step 4.3/4.4 payments pages
import TransactionsPage from './Payments/Transactions';
import ReconciliationPage from './Payments/Reconciliation';
import RevenuePage from './Payments/Revenue';
import RefundsPage from './Payments/Refunds';
import JobsHealthPage from './Payments/JobsHealth';
// Step 4.10 moderation UI
import ModerationQueuePage from './moderation/ModerationQueue';
import ModerationCaseDetailPage from './moderation/ModerationCaseDetail';
import ModerationStatsPage from './moderation/ModerationStats';
// Step 4.11 security UI
import BlacklistPage from './security/BlacklistPage';
import ShadowbanPage from './security/ShadowbanPage';
import UserIntelPage from './security/UserIntelPage';

import { Checkbox, Select } from '@repo/ui';
import { API_BASE, apiDelete, apiGet, apiPost, apiPut, trackEvent } from '../lib/api';
import { useAdminAuth } from '../lib/auth';
import { AdminPage, AdminSection } from '../components/AdminPage';
import { IconArrows, IconBolt, IconCheck, IconClock, IconDollar, IconFlag, IconTag, IconUsers, IconUser } from '../components/Icons';
import { notifyError, notifyInfo, notifySuccess } from '../lib/toast';
import { formatStatus } from '../lib/status';
import { formatAction } from '../lib/actions';

type Ad = {
  id: string;
  title: string;
  description: string;
  city: string;
  country: string;
  categorySlug: string;
  badges: string[];
  status: string;
  createdAt: string;
  views: number;
  moderation?: any;
};

type AnalyticsSummary = {
  from: string;
  to: string;
  total: number;
  activeUsers: number;
  activeAnonymous: number;
  items: { name: string; count: number }[];
};

type AnalyticsSeries = {
  bucket: string;
  count: number;
};

type AdMedia = { id: string; type?: string; url: string; mime?: string; size?: number };
type AdBoost = { id: string; type: string; startAt: string; endAt: string };
type AdReport = { id: string; type: string; message?: string | null; reporterId?: string | null; createdAt: string };
type AdOwner = { id: string; username: string; email?: string | null; phone?: string | null; city?: string | null; country?: string | null; role?: string };
type AdDetail = Ad & { media?: AdMedia[]; activeBoosts?: AdBoost[]; dynamic?: any; updatedAt?: string };
type AdDetailResponse = { item: AdDetail; user?: AdOwner | null; reports?: AdReport[] };

type Category = { id: string; name: string; slug: string; parentId: string | null; position: number; isActive?: boolean; icon?: string | null; color?: string | null; gradient?: string | null };

type Step = { id: string; name: string; label: string; order: number; flow?: string | null };

type Field = { id: string; name: string; label: string; type?: string | null; unit?: string | null; rules?: any; values?: any; info?: any; disabled?: boolean; default_checked?: boolean };

type CreditPack = { id: string; name: string; credits: number; price: number; currency: string; country?: string | null; position: number; isActive: boolean };
type PricingRule = { id: string; action: string; creditsCost: number; currency: string; country?: string | null; categorySlug?: string | null; priority: number; isActive: boolean };
type QuotaRule = { id: string; action: string; maxPerDay: number; country?: string | null; categorySlug?: string | null; role?: string | null; priority: number; isActive: boolean };
type UserListItem = {
  id: string;
  role: string;
  email?: string | null;
  phone?: string | null;
  username: string;
  firstName?: string | null;
  lastName?: string | null;
  city: string;
  country: string;
  createdAt: string;
  updatedAt?: string | null;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  allowMessages?: boolean;
  allowCalls?: boolean;
  showEmail?: boolean;
  showPhone?: boolean;
  creditWallet?: { id: string; balance: number } | null;
  _count?: { ads: number };
  security?: { isShadowBanned: boolean; shadowReason?: string | null; shadowedAt?: string | null } | null;
};
type UserAd = { id: string; title: string; status: string; createdAt: string; categorySlug: string; city: string; country: string };
type UserDetail = UserListItem & {
  bio?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  website?: string | null;
  whatsapp?: string | null;
  instagram?: string | null;
  telegram?: string | null;
  language?: string | null;
  notificationsEmail?: boolean;
  notificationsPush?: boolean;
  notificationsSms?: boolean;
  ads?: UserAd[];
  _count?: { ads: number; creditTransactions: number };
};

type AdminKpi = {
  ads: { total: number; pending: number; reported: number };
  users: { total: number };
  alerts: { open: number };
  tickets: { open: number; pending: number };
  payments: { pending: number; failed: number; refunded: number; todayCount: number; todayAmount: number };
  updatedAt: string;
};

type AdminAlert = {
  id: string;
  type: string;
  status: string;
  severity?: string | null;
  title: string;
  message?: string | null;
  createdAt: string;
  user?: { id: string; username?: string | null; email?: string | null } | null;
};

type SupportMessage = {
  id: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
  sender?: { id: string; username?: string | null } | null;
};

type SupportTicket = {
  id: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string | null;
  user?: { id: string; username?: string | null; email?: string | null } | null;
  assignedTo?: { id: string; username?: string | null; email?: string | null } | null;
  messages?: SupportMessage[];
};

type AdminAuditLog = {
  id: string;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  createdAt: string;
  actor?: { id: string; username?: string | null; email?: string | null } | null;
  meta?: any;
};

type AdminRole = {
  id: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  permissions?: { permission: { id: string; key: string } }[];
  _count?: { users: number };
};

type AdminPermission = {
  id: string;
  key: string;
  description?: string | null;
};

type ChatAttachment = {
  id?: string;
  url: string;
  mime?: string | null;
  size?: number | null;
  type?: string | null;
};

type ChatRead = { userId: string; readAt: string };
type ChatReaction = { emoji: string; userId: string };

type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  type?: string;
  warning?: string | null;
  spamScore?: number;
  meta?: any;
  createdAt: string;
  sender?: { id: string; username: string };
  attachments?: ChatAttachment[];
  reads?: ChatRead[];
  status?: string;
  flagged?: boolean;
  reactions?: ChatReaction[];
};

type ConversationPreview = {
  id: string;
  adId?: string | null;
  ad?: { id: string; title?: string | null; city?: string | null; country?: string | null; categorySlug?: string | null } | null;
  lastMessageAt?: string | null;
  lastReadAt?: string | null;
  mutedUntil?: string | null;
  pinnedAt?: string | null;
  archivedAt?: string | null;
  unreadCount: number;
  members: { id: string; username: string; city?: string | null; country?: string | null }[];
  lastMessage?: ChatMessage | null;
};

const MAX_CHAT_ATTACHMENTS = 4;
const ADMIN_STICKERS = ['💋', '🔥', '😍', '😊', '😈', '💖', '🎉'];
const ADMIN_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🔥'];

function resolveChatMediaUrl(url: string) {
  if (!url) return url;
  return url.startsWith('http') ? url : `${API_BASE}${url}`;
}

function isChatImageAttachment(att: { url: string; mime?: string | null; type?: string | null }) {
  if (att.type && att.type.toLowerCase() === 'image') return true;
  if (att.mime && att.mime.startsWith('image/')) return true;
  return /\.(png|jpe?g|webp|gif)$/i.test(att.url);
}

function isChatAudioAttachment(att: { url: string; mime?: string | null; type?: string | null }) {
  if (att.type && att.type.toLowerCase() === 'audio') return true;
  if (att.mime && att.mime.startsWith('audio/')) return true;
  return /\.(mp3|wav|m4a|aac|ogg)$/i.test(att.url);
}

function getChatPreview(message?: ChatMessage | null) {
  if (!message) return '';
  const type = message.type || 'text';
  if (type === 'sticker') return message.body || 'Sticker';
  if (type === 'call') return 'Appel audio';
  if (type === 'voice') return 'Message vocal';
  if (message.attachments?.length) return 'Pièce jointe';
  return message.body || '';
}

function groupChatReactions(reactions: ChatReaction[], meId?: string | null) {
  const buckets = new Map<string, { emoji: string; count: number; reacted: boolean }>();
  reactions.forEach((r) => {
    const entry = buckets.get(r.emoji) || { emoji: r.emoji, count: 0, reacted: false };
    entry.count += 1;
    if (meId && r.userId === meId) entry.reacted = true;
    buckets.set(r.emoji, entry);
  });
  return Array.from(buckets.values());
}

function isChatMutedUntil(mutedUntil?: string | null) {
  if (!mutedUntil) return false;
  return new Date(mutedUntil).getTime() > Date.now();
}

function toneForStatus(s: string) {
  const S = String(s).toUpperCase();
  if (S === 'PENDING_REVIEW') return 'warn';
  if (S === 'PUBLISHED') return 'ok';
  if (S === 'SUSPENDED' || S === 'REJECTED') return 'danger';
  return 'neutral';
}

function toneForSeverity(level?: string | null) {
  const L = String(level || '').toLowerCase();
  if (L === 'high') return 'danger';
  if (L === 'medium') return 'warn';
  if (L === 'low') return 'neutral';
  return 'neutral';
}

function toDateInputValue(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function toShortDate(value: string) {
  try {
    const date = new Date(value);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  } catch {
    return value;
  }
}

function weekStartUTC(value: string) {
  const date = new Date(value);
  const day = date.getUTCDay();
  const diff = (day + 6) % 7;
  date.setUTCDate(date.getUTCDate() - diff);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function buildWeeklySeries(items: AnalyticsSeries[]) {
  const buckets = new Map<string, number>();
  items.forEach((item) => {
    const bucket = weekStartUTC(item.bucket).toISOString();
    buckets.set(bucket, (buckets.get(bucket) || 0) + item.count);
  });
  return Array.from(buckets.entries())
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .map(([bucket, count]) => ({ bucket, count }));
}

function formatBucketLabel(value: string, mode: 'day' | 'week') {
  const label = toShortDate(value);
  return mode === 'week' ? `Semaine du ${label}` : label;
}

function seriesMax(items: AnalyticsSeries[]) {
  return items.reduce((max, item) => (item.count > max ? item.count : max), 1);
}

export const Login = () => {
  const { login, token } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) window.location.href = '/admin/dashboard';
  }, [token]);

  return (
    <div style={{ maxWidth: 520, margin: '40px auto' }} className="panel pad">
      <h1 className="h1">Admin Login</h1>
      <div style={{ height: 14 }} />
      {error ? <div className="small" style={{ color: 'var(--red)' }}>Erreur: {error}</div> : null}
      <div style={{ height: 8 }} />
      <div className="small">Email</div>
      <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
      <div style={{ height: 10 }} />
      <div className="small">Mot de passe</div>
      <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <div style={{ height: 14 }} />
      <button
        className="btn primary"
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          setError(null);
          try {
            await login(email, password);
            void trackEvent('admin.login', { method: 'password' }, 'admin');
            window.location.href = '/admin/dashboard';
          } catch (e: any) {
            setError(e?.error || 'Login failed');
            notifyError(e, 'Login failed');
          } finally {
            setLoading(false);
          }
        }}
      >{loading ? 'Connexion…' : 'Se connecter'}</button>
    </div>
  );
};

export const Dashboard = () => {
  const { token } = useAdminAuth();
  const [ads, setAds] = useState<Ad[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [stats, setStats] = useState<{ total: number; pending: number; reported: number } | null>(null);
  const [kpi, setKpi] = useState<AdminKpi | null>(null);
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [analyticsSeries, setAnalyticsSeries] = useState<AnalyticsSeries[]>([]);
  const [loading, setLoading] = useState(false);

  const loadKpi = async () => {
    if (!token) return;
    const res = await apiGet<{ kpis: AdminKpi }>('/admin/kpi', token);
    setKpi(res.kpis);
  };

  const loadAlerts = async () => {
    if (!token) return;
    const res = await apiGet<{ items: AdminAlert[] }>('/admin/alerts?status=OPEN&take=5', token);
    setAlerts(res.items || []);
  };

  const load = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const qs = new URLSearchParams({
        from: from.toISOString(),
        to: now.toISOString(),
      });
      const [adsRes, reps, analyticsRes, analyticsSeriesRes] = await Promise.all([
        apiGet<{ items: Ad[] }>('/admin/ads?take=50', token),
        apiGet<{ items: any[] }>('/admin/reports', token),
        apiGet<AnalyticsSummary>(`/admin/analytics/summary?${qs.toString()}`, token),
        apiGet<{ items: AnalyticsSeries[] }>(`/admin/analytics/timeseries?${qs.toString()}`, token),
        loadKpi(),
        loadAlerts(),
      ]);
      setAds(adsRes.items || []);
      setReports(reps.items || []);
      setAnalytics(analyticsRes);
      setAnalyticsSeries(analyticsSeriesRes.items || []);
      setStats({
        total: adsRes.items.length,
        pending: adsRes.items.filter((a) => a.status === 'PENDING_REVIEW').length,
        reported: reps.items.length,
      });
    } catch (e) {
      notifyError(e, 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [token]);

  useEffect(() => {
    if (!token) return undefined;
    const socket = io(API_BASE, { auth: { token } });
    const onKpi = (payload: AdminKpi) => setKpi(payload);
    const onAlert = (payload: AdminAlert) => {
      setAlerts((prev) => [payload, ...prev].slice(0, 5));
    };
    socket.on('admin:kpi', onKpi);
    socket.on('admin:alert:new', onAlert);
    return () => {
      socket.off('admin:kpi', onKpi);
      socket.off('admin:alert:new', onAlert);
      socket.disconnect();
    };
  }, [token]);

  const derived = useMemo(() => {
    const total = ads.length;
    const pending = ads.filter((a) => a.status === 'PENDING_REVIEW').length;
    const published = ads.filter((a) => a.status === 'PUBLISHED').length;
    const suspended = ads.filter((a) => a.status === 'SUSPENDED').length;
    const rejected = ads.filter((a) => a.status === 'REJECTED').length;
    const totalViews = ads.reduce((acc, a) => acc + (a.views || 0), 0);
    const avgViews = total ? Math.round(totalViews / total) : 0;

    const badgeCounts: Record<string, number> = {};
    const cityCounts: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};

    ads.forEach((a) => {
      (a.badges || []).forEach((b) => {
        badgeCounts[b] = (badgeCounts[b] || 0) + 1;
      });
      const city = a.city || 'N/A';
      const cat = a.categorySlug || 'unknown';
      cityCounts[city] = (cityCounts[city] || 0) + 1;
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    const sortCounts = (obj: Record<string, number>) =>
      Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const recentAds = [...ads]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6);
    const recentReports = [...reports]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6);

    return {
      total,
      pending,
      published,
      suspended,
      rejected,
      totalViews,
      avgViews,
      topCities: sortCounts(cityCounts),
      topCategories: sortCounts(categoryCounts),
      topBadges: sortCounts(badgeCounts),
      recentAds,
      recentReports,
    };
  }, [ads, reports]);

  return (
    <AdminPage
      title="Admin Dashboard"
      subtitle="KPIs temps réel (dernieres 50 annonces)"
      actions={<button className="btn" onClick={load} disabled={loading}>{loading ? 'Chargement…' : 'Rafraîchir'}</button>}
    >
      <AdminSection title="Vue d’ensemble" subtitle="Activite annonces + signalements.">
        {!stats ? <div className="small">Chargement…</div> : (
          <div className="adminKpiGrid">
            <div className="panel pad kpiCard adminKpiCard teal">
              <div className="adminKpiTop">
                <div className="kicker">Total annonces</div>
                <span className="iconBubble sun"><IconTag /></span>
              </div>
              <div className="kpiValue">{kpi?.ads.total ?? derived.total}</div>
              <div className="kpiMeta">Vues moyennes: {derived.avgViews}</div>
            </div>
            <div className="panel pad kpiCard adminKpiCard sun">
              <div className="adminKpiTop">
                <div className="kicker">En attente</div>
                <span className="iconBubble indigo"><IconClock /></span>
              </div>
              <div className="kpiValue">{kpi?.ads.pending ?? derived.pending}</div>
              <div className="kpiMeta">A valider</div>
            </div>
            <div className="panel pad kpiCard adminKpiCard indigo">
              <div className="adminKpiTop">
                <div className="kicker">Publiees</div>
                <span className="iconBubble teal"><IconCheck /></span>
              </div>
              <div className="kpiValue">{derived.published}</div>
              <div className="kpiMeta">Actives</div>
            </div>
            <div className="panel pad kpiCard adminKpiCard rose">
              <div className="adminKpiTop">
                <div className="kicker">Signalements</div>
                <span className="iconBubble rose"><IconFlag /></span>
              </div>
              <div className="kpiValue">{kpi?.ads.reported ?? stats.reported}</div>
              <div className="kpiMeta">Fraude & abuse</div>
            </div>
            <div className="panel pad kpiCard adminKpiCard slate">
              <div className="adminKpiTop">
                <div className="kicker">Utilisateurs</div>
                <span className="iconBubble slate"><IconUsers /></span>
              </div>
              <div className="kpiValue">{kpi?.users.total ?? 0}</div>
              <div className="kpiMeta">Comptes actifs</div>
            </div>
            <div className="panel pad kpiCard adminKpiCard teal">
              <div className="adminKpiTop">
                <div className="kicker">Alertes ouvertes</div>
                <span className="iconBubble teal"><IconBolt /></span>
              </div>
              <div className="kpiValue">{kpi?.alerts.open ?? 0}</div>
              <div className="kpiMeta">A traiter</div>
            </div>
          </div>
        )}
        {!stats ? null : (
          <div className="adminMiniGrid">
            <div className="panel pad adminMiniCard">
              <div className="kicker">Suspendues</div>
              <div className="kpiValue">{derived.suspended}</div>
              <div className="kpiMeta">Sous moderation</div>
            </div>
            <div className="panel pad adminMiniCard">
              <div className="kicker">Rejetees</div>
              <div className="kpiValue">{derived.rejected}</div>
              <div className="kpiMeta">Non conforme</div>
            </div>
            <div className="panel pad adminMiniCard">
              <div className="kicker">Tickets ouverts</div>
              <div className="kpiValue">{kpi?.tickets.open ?? 0}</div>
              <div className="kpiMeta">Support</div>
            </div>
          </div>
        )}
        {kpi ? (
          <div className="adminPaymentsGrid">
            <div className="panel pad adminMiniCard">
              <div className="adminKpiTop">
                <div className="kicker">Paiements en attente</div>
                <span className="iconBubble sun"><IconClock /></span>
              </div>
              <div className="kpiValue">{kpi.payments.pending}</div>
              <div className="kpiMeta">A verifier</div>
            </div>
            <div className="panel pad adminMiniCard">
              <div className="adminKpiTop">
                <div className="kicker">Paiements echoues</div>
                <span className="iconBubble rose"><IconFlag /></span>
              </div>
              <div className="kpiValue">{kpi.payments.failed}</div>
              <div className="kpiMeta">Surveillance</div>
            </div>
            <div className="panel pad adminMiniCard">
              <div className="adminKpiTop">
                <div className="kicker">Chargebacks</div>
                <span className="iconBubble indigo"><IconArrows /></span>
              </div>
              <div className="kpiValue">{kpi.payments.refunded}</div>
              <div className="kpiMeta">A traiter</div>
            </div>
            <div className="panel pad adminMiniCard">
              <div className="adminKpiTop">
                <div className="kicker">Revenus aujourd’hui</div>
                <span className="iconBubble lime"><IconDollar /></span>
              </div>
              <div className="kpiValue">{kpi.payments.todayAmount}</div>
              <div className="kpiMeta">{kpi.payments.todayCount} transactions</div>
            </div>
          </div>
        ) : null}
        {kpi?.updatedAt ? <div className="adminUpdate">Mis a jour: {new Date(kpi.updatedAt).toLocaleTimeString()}</div> : null}
      </AdminSection>

      <AdminSection title="Analytics rapide" subtitle="Résumé 7 derniers jours.">
        {!analytics ? <div className="small">Chargement…</div> : (
          <div style={{ display: 'grid', gap: 12 }}>
            <div className="adminMiniGrid">
              <div className="panel pad adminMiniCard">
                <div className="kicker">Total événements</div>
                <div className="kpiValue">{analytics.total}</div>
                <div className="kpiMeta">Toutes sources</div>
              </div>
            <div className="panel pad adminMiniCard">
              <div className="kicker">Utilisateurs actifs</div>
              <div className="kpiValue">{(analytics as any).activeNow ?? analytics.activeUsers}</div>
              <div className="kpiMeta">Connectés (15 min)</div>
            </div>
              <div className="panel pad adminMiniCard">
                <div className="kicker">Top événement</div>
                <div className="kpiValue">{analytics.items?.[0]?.count || 0}</div>
                <div className="kpiMeta">{analytics.items?.[0]?.name || '—'}</div>
              </div>
              <div className="panel pad adminMiniCard">
                <div className="kicker">Top 5 events</div>
                <div className="adminList">
                  {(analytics.items || []).slice(0, 5).map((item) => (
                    <div key={item.name} className="adminListItem">
                      <div>{item.name}</div>
                      <div className="small">{item.count}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="panel pad">
              <div className="kicker">Évolution</div>
              <AnalyticsChart items={analyticsSeries} />
            </div>
          </div>
        )}
      </AdminSection>

      <AdminSection title="Alertes recentes" subtitle="Fraude / paiement / chargeback">
        {alerts.length === 0 ? <div className="small">Aucune alerte ouverte.</div> : (
          <div className="adminAlertList">
            {alerts.map((a) => (
              <div key={a.id} className={`panel pad adminAlertCard ${toneForSeverity(a.severity)}`}>
                <div className="adminAlertMain">
                  <div className="adminAlertTitle">{a.title}</div>
                  <div className="adminAlertMeta">
                    <span className={`badge ${toneForSeverity(a.severity)}`}>{a.severity || 'medium'}</span>
                    <span className="badge neutral">{a.type}</span>
                    <span>{new Date(a.createdAt).toLocaleString('fr-FR')}</span>
                  </div>
                  {a.message ? <div className="small">{a.message}</div> : null}
                </div>
                <div className="adminAlertActions">
                  <a className="btn" href="/admin/alerts">Voir</a>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminSection>

      <AdminSection title="Distribution" subtitle="Top villes, categories et badges.">
        {!stats ? <div className="small">Chargement…</div> : (
          <div className="adminTripleGrid">
            <div className="panel pad">
              <div className="kicker">Top villes</div>
              <div className="adminList">
                {derived.topCities.length === 0 ? <div className="small">Aucune donnee.</div> : derived.topCities.map(([k, v]) => (
                  <div key={k} className="adminListItem">
                    <div>{k}</div>
                    <div className="small">{v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="panel pad">
              <div className="kicker">Top categories</div>
              <div className="adminList">
                {derived.topCategories.length === 0 ? <div className="small">Aucune donnee.</div> : derived.topCategories.map(([k, v]) => (
                  <div key={k} className="adminListItem">
                    <div>{k}</div>
                    <div className="small">{v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="panel pad">
              <div className="kicker">Badges</div>
              <div className="adminList">
                {derived.topBadges.length === 0 ? <div className="small">Aucun badge.</div> : derived.topBadges.map(([k, v]) => (
                  <div key={k} className="adminListItem">
                    <div>{k}</div>
                    <div className="small">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </AdminSection>

      <AdminSection title="Activite recente" subtitle="Dernieres annonces et signalements.">
        {!stats ? <div className="small">Chargement…</div> : (
          <div className="adminActivityGrid">
            <div className="panel pad">
              <div className="kicker">Dernieres annonces</div>
              {derived.recentAds.length === 0 ? <div className="small">Aucune annonce.</div> : (
                <div className="adminList">
                  {derived.recentAds.map((a) => (
                    <div key={a.id} className="panel pad adminRowCard">
                      <div>
                        <div style={{ fontWeight: 700 }}>{a.title}</div>
                        <div className="small">{a.city}, {a.country} · {new Date(a.createdAt).toLocaleString()}</div>
                      </div>
                      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                        <span className={`badge ${toneForStatus(a.status)}`}>{formatStatus(a.status)}</span>
                        <a className="btn" href={`/admin/ads/view/${a.id}`}>Ouvrir</a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="panel pad">
              <div className="kicker">Derniers signalements</div>
              {derived.recentReports.length === 0 ? <div className="small">Aucun signalement.</div> : (
                <div className="adminList">
                  {derived.recentReports.map((r) => (
                    <div key={r.id} className="panel pad adminRowCard">
                      <div>
                        <div style={{ fontWeight: 700 }}>{r.type}</div>
                        {r.message ? <div className="small">{r.message}</div> : null}
                        <div className="small">{new Date(r.createdAt).toLocaleString()}</div>
                      </div>
                      <a className="btn" href={`/admin/ads/view/${r.adId}`}>Voir annonce</a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </AdminSection>

      <AdminSection title="Raccourcis">
        <div className="adminQuickGrid">
          <a className="btn" href="/admin/ads/list">Annonces</a>
          <a className="btn" href="/admin/ads/pending">En attente</a>
          <a className="btn" href="/admin/moderation/reports">Signalements</a>
          <a className="btn" href="/admin/analytics/overview">Analytics</a>
          <a className="btn" href="/admin/categories/tree">Categories</a>
          <a className="btn" href="/admin/payments/transactions">Transactions</a>
          <a className="btn" href="/admin/monetization/credit-packs">Credit packs</a>
          <a className="btn" href="/admin/support/tickets">Support</a>
          <a className="btn" href="/admin/alerts">Alertes</a>
        </div>
      </AdminSection>
    </AdminPage>
  );
};

function AnalyticsChart({ items }: { items: AnalyticsSeries[] }) {
  if (!items.length) return <div className="small">Aucune donnée.</div>;
  const total = items.reduce((sum, item) => sum + item.count, 0);
  const rangeDays = (new Date(items[items.length - 1].bucket).getTime() - new Date(items[0].bucket).getTime()) / (24 * 60 * 60 * 1000);
  const smooth = rangeDays > 21;
  const displayItems = smooth ? buildWeeklySeries(items) : items;
  const max = seriesMax(displayItems);
  const peak = displayItems.reduce((best, item) => (item.count > best.count ? item : best), displayItems[0]);
  const peakThreshold = max * 0.7;
  const mode: 'day' | 'week' = smooth ? 'week' : 'day';
  return (
    <div className="adminChart">
      <div className="adminChartBars">
        {displayItems.map((item) => (
          <div
            key={item.bucket}
            className={`adminChartBar${item.count >= peakThreshold ? ' isPeak' : ''}`}
          >
            <span style={{ height: `${Math.max(4, Math.round((item.count / max) * 100))}%` }} />
            <em className="adminChartTooltip">{formatBucketLabel(item.bucket, mode)} · {item.count}</em>
          </div>
        ))}
      </div>
      <div className="adminChartAxis">
        <span>{toShortDate(displayItems[0].bucket)}</span>
        <span>{toShortDate(displayItems[Math.floor(displayItems.length / 2)].bucket)}</span>
        <span>{toShortDate(displayItems[displayItems.length - 1].bucket)}</span>
      </div>
      <div className="adminChartLegend">
        <span>Total: {total}</span>
        <span>Pic: {peak.count} ({toShortDate(peak.bucket)})</span>
        <span>Mode: {smooth ? 'Semaine' : 'Jour'}</span>
      </div>
    </div>
  );
}

export const AnalyticsOverview = () => {
  const { token } = useAdminAuth();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [series, setSeries] = useState<AnalyticsSeries[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    from: toDateInputValue(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
    to: toDateInputValue(new Date()),
    source: '',
    event: '',
  });

  const fetchOverview = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filters.from) qs.set('from', filters.from);
      if (filters.to) qs.set('to', filters.to);
      if (filters.source) qs.set('source', filters.source);
      if (filters.event) qs.set('name', filters.event);
      const [summaryRes, seriesRes] = await Promise.all([
        apiGet<AnalyticsSummary>(`/admin/analytics/summary?${qs.toString()}`, token),
        apiGet<{ items: AnalyticsSeries[] }>(`/admin/analytics/timeseries?${qs.toString()}`, token),
      ]);
      setSummary(summaryRes);
      setSeries(seriesRes.items || []);
    } catch (e) {
      notifyError(e, 'Chargement analytics impossible');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [token]);

  return (
    <AdminPage
      title="Analytics"
      subtitle="Vue synthétique des événements clés."
      actions={<button className="btn" onClick={fetchOverview} disabled={loading}>{loading ? 'Chargement…' : 'Rafraîchir'}</button>}
    >
      <AdminSection title="Filtres">
        <div className="grid cols-4">
          <label className="flex flex-col gap-3">
            <span className="label">Du</span>
            <input className="input" type="date" value={filters.from} onChange={(e) => setFilters((s) => ({ ...s, from: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-3">
            <span className="label">Au</span>
            <input className="input" type="date" value={filters.to} onChange={(e) => setFilters((s) => ({ ...s, to: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-3">
            <span className="label">Source</span>
            <select className="input" value={filters.source} onChange={(e) => setFilters((s) => ({ ...s, source: e.target.value }))}>
              <option value="">Toutes</option>
              <option value="web">Web</option>
              <option value="admin">Admin</option>
              <option value="mobile">Mobile</option>
              <option value="api">API</option>
            </select>
          </label>
          <label className="flex flex-col gap-3">
            <span className="label">Événement</span>
            <input className="input" placeholder="page.view" value={filters.event} onChange={(e) => setFilters((s) => ({ ...s, event: e.target.value }))} />
          </label>
        </div>
        <div style={{ height: 12 }} />
        <button className="btn primary" onClick={fetchOverview} disabled={loading}>Appliquer</button>
      </AdminSection>

      <AdminSection title="Cartes clés" subtitle="Total, utilisateurs actifs et top événements.">
        {!summary ? <div className="small">Chargement…</div> : (
          <div className="adminKpiGrid">
            <div className="panel pad kpiCard adminKpiCard teal">
              <div className="adminKpiTop">
                <div className="kicker">Total events</div>
                <span className="iconBubble teal"><IconBolt /></span>
              </div>
              <div className="kpiValue">{summary.total}</div>
              <div className="kpiMeta">Sur la période</div>
            </div>
            <div className="panel pad kpiCard adminKpiCard indigo">
              <div className="adminKpiTop">
                <div className="kicker">Utilisateurs actifs</div>
                <span className="iconBubble indigo"><IconUsers /></span>
              </div>
              <div className="kpiValue">{(summary as any).activeNow ?? summary.activeUsers}</div>
              <div className="kpiMeta">Connectés (15 min)</div>
            </div>
            <div className="panel pad kpiCard adminKpiCard sun">
              <div className="adminKpiTop">
                <div className="kicker">Visiteurs actifs</div>
                <span className="iconBubble sun"><IconUser /></span>
              </div>
              <div className="kpiValue">{summary.activeAnonymous}</div>
              <div className="kpiMeta">Anonymes</div>
            </div>
            <div className="panel pad adminMiniCard">
              <div className="kicker">Top events</div>
              <div className="adminList">
                {summary.items.slice(0, 4).map((item) => (
                  <div key={item.name} className="adminListItem">
                    <div>{item.name}</div>
                    <div className="small">{item.count}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </AdminSection>

      <AdminSection title="Tendance" subtitle="Événements dans le temps.">
        <AnalyticsChart items={series} />
      </AdminSection>
    </AdminPage>
  );
};

export const AnalyticsEvents = () => {
  const { token } = useAdminAuth();
  const [items, setItems] = useState<any[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    name: '',
    source: '',
    from: '',
    to: '',
  });

  const fetchEvents = async (reset: boolean) => {
    if (!token) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filters.name) qs.set('name', filters.name);
      if (filters.source) qs.set('source', filters.source);
      if (filters.from) qs.set('from', filters.from);
      if (filters.to) qs.set('to', filters.to);
      if (!reset && nextCursor) qs.set('cursor', nextCursor);
      qs.set('take', '50');
      const res = await apiGet<{ items: any[]; nextCursor: string | null }>(`/admin/analytics/events?${qs.toString()}`, token);
      setItems((prev) => (reset ? res.items : [...prev, ...(res.items || [])]));
      setNextCursor(res.nextCursor || null);
    } catch (e) {
      notifyError(e, 'Chargement events impossible');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents(true);
  }, [token]);

  return (
    <AdminPage
      title="Analytics — événements"
      subtitle="Historique détaillé des événements."
      actions={<button className="btn" onClick={() => fetchEvents(true)} disabled={loading}>{loading ? 'Chargement…' : 'Rafraîchir'}</button>}
    >
      <AdminSection title="Filtres">
        <div className="grid cols-4">
          <label className="flex flex-col gap-3">
            <span className="label">Nom</span>
            <input className="input" placeholder="page.view" value={filters.name} onChange={(e) => setFilters((s) => ({ ...s, name: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-3">
            <span className="label">Source</span>
            <select className="input" value={filters.source} onChange={(e) => setFilters((s) => ({ ...s, source: e.target.value }))}>
              <option value="">Toutes</option>
              <option value="web">Web</option>
              <option value="admin">Admin</option>
              <option value="mobile">Mobile</option>
              <option value="api">API</option>
            </select>
          </label>
          <label className="flex flex-col gap-3">
            <span className="label">Du</span>
            <input className="input" type="date" value={filters.from} onChange={(e) => setFilters((s) => ({ ...s, from: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-3">
            <span className="label">Au</span>
            <input className="input" type="date" value={filters.to} onChange={(e) => setFilters((s) => ({ ...s, to: e.target.value }))} />
          </label>
        </div>
        <div style={{ height: 12 }} />
        <button className="btn primary" onClick={() => fetchEvents(true)} disabled={loading}>Appliquer</button>
      </AdminSection>

      <AdminSection title="Tableau">
        {items.length === 0 ? <div className="small">Aucun événement.</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table compact">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Event</th>
                  <th>Source</th>
                  <th>User</th>
                  <th>Meta</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td>{new Date(row.createdAt).toLocaleString('fr-FR')}</td>
                    <td style={{ fontWeight: 700 }}>{row.name}</td>
                    <td>{row.source || '-'}</td>
                    <td>{row.user?.username || row.userId || row.anonymousId || '-'}</td>
                    <td className="small" style={{ maxWidth: 320 }}>
                      {row.meta ? JSON.stringify(row.meta) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {nextCursor ? (
          <div style={{ marginTop: 12 }}>
            <button className="btn" onClick={() => fetchEvents(false)} disabled={loading}>
              {loading ? 'Chargement…' : 'Charger plus'}
            </button>
          </div>
        ) : null}
      </AdminSection>
    </AdminPage>
  );
};

function AdsCard({ a }: { a: Ad }) {
  return (
    <div className="panel pad" style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 900 }}>{a.title}</div>
          <div className="small">{a.city}, {a.country} — {a.categorySlug}</div>
          <div className="small" style={{ opacity: 0.75 }}>{new Date(a.createdAt).toLocaleString()} · vues: {a.views}</div>
          {a.moderation?.reason ? <div className="small" style={{ opacity: 0.85 }}>Motif: {a.moderation.reason}</div> : null}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {(a.badges || []).map((b) => <span key={b} className="badge">{b}</span>)}
          <span className={`badge ${toneForStatus(a.status)}`}>{formatStatus(a.status)}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <a className="btn" href={`/admin/ads/view/${a.id}`}>Ouvrir</a>
        <a className="btn ghost" href={`/ad/${a.id}`} target="_blank" rel="noreferrer">Voir public</a>
      </div>
    </div>
  );
}

export const Ads = () => {
  const { token } = useAdminAuth();
  const [items, setItems] = useState<Ad[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [categorySlug, setCategorySlug] = useState('');

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (status) p.set('status', status);
    if (country) p.set('country', country);
    if (city) p.set('city', city);
    if (categorySlug) p.set('categorySlug', categorySlug);
    p.set('take', '20');
    return p.toString();
  }, [q, status, country, city, categorySlug]);

  async function load(reset: boolean) {
    setLoading(true);
    try {
      const url = `/admin/ads?${query}${!reset && nextCursor ? `&cursor=${encodeURIComponent(nextCursor)}` : ''}`;
      const res = await apiGet<{ items: Ad[]; nextCursor: string | null }>(url, token);
      setItems(reset ? res.items : [...items, ...res.items]);
      setNextCursor(res.nextCursor);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, token]);

  return (
    <AdminPage title="Annonces" subtitle="Liste + filtres + pagination">
      <AdminSection
        title="Filtres"
        subtitle="Recherche par statut, catégorie et localisation."
        actions={<button className="btn" onClick={() => load(true)} disabled={loading}>{loading ? 'Chargement…' : 'Rafraîchir'}</button>}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 10 }}>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Recherche (titre/desc)" />
          <input className="input" value={categorySlug} onChange={(e) => setCategorySlug(e.target.value)} placeholder="categorySlug" />
          <input className="input" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="country" />
          <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="city" />
          <Select className="input" value={status} onChange={setStatus} ariaLabel="Statut">
            <option value="">Tous statuts</option>
            <option value="PENDING_REVIEW">{formatStatus('PENDING_REVIEW')}</option>
            <option value="PUBLISHED">{formatStatus('PUBLISHED')}</option>
            <option value="REJECTED">{formatStatus('REJECTED')}</option>
            <option value="SUSPENDED">{formatStatus('SUSPENDED')}</option>
            <option value="DELETED">{formatStatus('DELETED')}</option>
          </Select>
        </div>
      </AdminSection>

      <AdminSection
        title="Résultats"
        subtitle={loading ? 'Chargement en cours…' : items.length ? `${items.length} annonces` : 'Aucun résultat.'}
        actions={nextCursor ? (
          <button className="btn" disabled={loading} onClick={() => load(false)}>{loading ? 'Chargement…' : 'Charger plus'}</button>
        ) : null}
      >
        {items.length === 0 && !loading ? <div className="small">Aucun résultat.</div> : null}
        <div style={{ display: 'grid', gap: 10 }}>
          {items.map((a) => <AdsCard key={a.id} a={a} />)}
        </div>
        {nextCursor ? null : <div className="small" style={{ opacity: 0.7, marginTop: 12 }}>Fin de liste.</div>}
      </AdminSection>
    </AdminPage>
  );
};

export const AdsPending = () => {
  const { token } = useAdminAuth();
  const [items, setItems] = useState<Ad[] | null>(null);

  useEffect(() => {
    (async () => {
      const res = await apiGet<{ items: Ad[] }>(`/admin/ads?status=PENDING_REVIEW&take=50`, token);
      setItems(res.items);
    })();
  }, [token]);

  return (
    <AdminPage title="Annonces en attente" subtitle="Approve / Reject / Suspend">
      <AdminSection title="File de validation">
        {!items ? <div className="small">Chargement…</div> : items.length ? (
          <div style={{ display: 'grid', gap: 10 }}>{items.map((a) => <AdsCard key={a.id} a={a} />)}</div>
        ) : <div className="small">Aucune annonce en attente.</div>}
      </AdminSection>
    </AdminPage>
  );
};

export const AdsReported = () => {
  const { token } = useAdminAuth();
  const [reports, setReports] = useState<any[] | null>(null);

  useEffect(() => {
    (async () => {
      const r = await apiGet<{ items: any[] }>('/admin/reports', token);
      setReports(r.items);
    })();
  }, [token]);

  return (
    <AdminPage title="Annonces signalées" subtitle="Signalements">
      <AdminSection title="Derniers signalements">
        {!reports ? <div className="small">Chargement…</div> : reports.length === 0 ? <div className="small">Aucun signalement.</div> : (
          <div style={{ display: 'grid', gap: 10 }}>
            {reports.map((r) => (
              <div key={r.id} className="panel pad" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 900 }}>{r.type}</div>
                  {r.message ? <div className="small" style={{ opacity: 0.85 }}>{r.message}</div> : null}
                  <div className="small" style={{ opacity: 0.7 }}>{new Date(r.createdAt).toLocaleString()}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <a className="btn" href={`/admin/ads/view/${r.adId}`}>Ouvrir annonce</a>
                  <a className="btn ghost" href={`/ad/${r.adId}`} target="_blank" rel="noreferrer">Public</a>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminSection>
    </AdminPage>
  );
};

export const AdView = () => {
  const { token } = useAdminAuth();
  const id = window.location.pathname.split('/').pop() || '';
  const [data, setData] = useState<AdDetailResponse | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [acting, setActing] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<AdDetailResponse>(`/admin/ads/${id}`, token);
      setData(res);
    } catch (err) {
      setError(err);
      notifyError(err, 'Erreur de chargement de l’annonce.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id, token]);

  async function act(action: 'approve' | 'reject' | 'suspend') {
    const path = `/admin/ads/${id}/${action}`;
    setActing(true);
    try {
      const res = await apiPost<AdDetail>(path, action === 'approve' ? {} : { reason }, token);
      setData((prev) => (prev ? { ...prev, item: res } : { item: res, user: null, reports: [] }));
      notifySuccess('Action enregistrée.');
    } catch (err) {
      notifyError(err, 'Action impossible.');
    } finally {
      setActing(false);
    }
  }

  const ad = data?.item;
  const reports = data?.reports || [];
  const owner = data?.user || null;

  return (
    <AdminPage
      title={ad?.title || 'Détail annonce'}
      subtitle={`ID: ${id}`}
      actions={
        <>
          <button className="btn" onClick={load} disabled={loading}>Rafraîchir</button>
          {ad ? <a className="btn ghost" href={`/ad/${ad.id}`} target="_blank" rel="noreferrer">Voir public</a> : null}
        </>
      }
    >
      {loading || error ? (
        <AdminSection title="Statut">
          {loading ? <div className="small">Chargement…</div> : null}
          {error ? <div className="small" style={{ color: 'var(--red)' }}>Erreur: {String(error?.error || error?.message || error)}</div> : null}
        </AdminSection>
      ) : null}
      {!loading && ad ? (
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '2fr 1fr' }}>
          <div style={{ display: 'grid', gap: 12 }}>
            <AdminSection title="Résumé">
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 20 }}>{ad.title}</div>
                  <div className="small">{ad.city}, {ad.country} — {ad.categorySlug}</div>
                </div>
                <div className="row" style={{ flexWrap: 'wrap' }}>
                  <span className={`badge ${toneForStatus(ad.status)}`}>{formatStatus(ad.status)}</span>
                  {(ad.badges || []).map((b) => <span key={b} className="badge">{b}</span>)}
                </div>
              </div>
              <div style={{ height: 10 }} />
              <div className="small">{ad.description}</div>
              <div style={{ height: 10 }} />
              <div className="small">Vues: <b>{ad.views ?? 0}</b> · Créée: <b>{new Date(ad.createdAt).toLocaleString()}</b></div>
              {ad.updatedAt ? <div className="small">MAJ: <b>{new Date(ad.updatedAt).toLocaleString()}</b></div> : null}
            </AdminSection>

            <AdminSection title="Modération">
              {ad.moderation ? (
                <div className="small">
                  <div>État: <b>{formatStatus(ad.moderation.state || ad.status)}</b></div>
                  {ad.moderation.reason ? <div>Raison: {ad.moderation.reason}</div> : null}
                  {ad.moderation.reviewedAt ? <div>Review: {new Date(ad.moderation.reviewedAt).toLocaleString()}</div> : null}
                  {ad.moderation.reviewedBy ? <div>Par: {ad.moderation.reviewedBy}</div> : null}
                </div>
              ) : (
                <div className="small">Aucune décision enregistrée.</div>
              )}
            </AdminSection>

            <AdminSection title="Médias">
              {!ad.media || ad.media.length === 0 ? (
                <div className="small">Aucun média.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10 }}>
                  {ad.media.map((m) => {
                    const src = m.url.startsWith('http') ? m.url : `${API_BASE}${m.url}`;
                    return m.type === 'VIDEO' ? (
                      <video key={m.id} src={src} controls style={{ width: '100%', borderRadius: 12 }} />
                    ) : (
                      <img key={m.id} src={src} alt={m.id} style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 12 }} />
                    );
                  })}
                </div>
              )}
            </AdminSection>

            <AdminSection title="Données dynamiques">
              <pre className="small" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{JSON.stringify(ad.dynamic || {}, null, 2)}</pre>
            </AdminSection>

            <AdminSection title="Signalements">
              {reports.length === 0 ? <div className="small">Aucun signalement.</div> : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {reports.map((r) => (
                    <div key={r.id} className="panel pad" style={{ padding: 10 }}>
                      <div style={{ fontWeight: 700 }}>{r.type}</div>
                      {r.message ? <div className="small">{r.message}</div> : null}
                      <div className="small" style={{ opacity: 0.7 }}>{new Date(r.createdAt).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </AdminSection>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            <AdminSection title="Annonceur">
              {owner ? (
                <div className="small">
                  <div><b>{owner.username}</b> ({owner.role})</div>
                  <div>ID: {owner.id}</div>
                  {owner.email ? <div>Email: {owner.email}</div> : null}
                  {owner.phone ? <div>Tél: {owner.phone}</div> : null}
                  <div>{owner.city || '-'}, {owner.country || '-'}</div>
                  <div style={{ height: 6 }} />
                  <a className="btn" href={`/profile/${owner.username}`} target="_blank" rel="noreferrer">Profil public</a>
                </div>
              ) : <div className="small">Utilisateur inconnu.</div>}
            </AdminSection>

            <AdminSection title="Boosts actifs">
              {(ad.activeBoosts || []).length === 0 ? <div className="small">Aucun boost actif.</div> : (
                <div className="small">
                  {ad.activeBoosts?.map((b) => (
                    <div key={b.id}>{b.type} · {new Date(b.startAt).toLocaleString()} → {new Date(b.endAt).toLocaleString()}</div>
                  ))}
                </div>
              )}
            </AdminSection>

            <AdminSection title="Actions">
              <div className="small">Motif (reject/suspend)</div>
              <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: contenu interdit" />
              <div style={{ height: 10 }} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn primary" onClick={() => act('approve')} disabled={acting}>Approve</button>
                <button className="btn" onClick={() => act('reject')} disabled={acting}>Reject</button>
                <button className="btn" onClick={() => act('suspend')} disabled={acting}>Suspend</button>
              </div>
            </AdminSection>
          </div>
        </div>
      ) : null}
    </AdminPage>
  );
};

export const CategoriesTree = () => {
  const { token } = useAdminAuth();
  const [items, setItems] = useState<Category[] | null>(null);

  useEffect(() => {
    (async () => {
      const res = await apiGet<{ items: Category[] }>('/admin/categories', token);
      setItems(res.items);
    })();
  }, [token]);

  const byParent = useMemo(() => {
    const map: Record<string, Category[]> = {};
    (items || []).forEach((c) => {
      const k = c.parentId || 'root';
      map[k] = map[k] || [];
      map[k].push(c);
    });
    Object.values(map).forEach((arr) => arr.sort((a, b) => (a.position || 0) - (b.position || 0)));
    return map;
  }, [items]);

  const byId = useMemo(() => new Map((items || []).map((c) => [c.id, c])), [items]);
  const flatItems = useMemo(() => {
    const out: { cat: Category; depth: number }[] = [];
    const walk = (parent: string | null, depth: number) => {
      const key = parent || 'root';
      (byParent[key] || []).forEach((c) => {
        out.push({ cat: c, depth });
        walk(c.id, depth + 1);
      });
    };
    walk(null, 0);
    return out;
  }, [byParent]);

  return (
    <AdminPage
      title="Catégories"
      subtitle="Tree + accès au builder form_steps/form_fields"
      actions={<a className="btn primary" href="/admin/categories/create">Créer catégorie</a>}
    >
      <AdminSection title="Arborescence">
        {!items ? (
          <div className="small">Chargement…</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
            {flatItems.map(({ cat, depth }) => {
              const parentName = cat.parentId ? byId.get(cat.parentId)?.name : null;
              return (
                <div
                  key={cat.id}
                  className="panel pad"
                  style={{
                    aspectRatio: '1 / 1',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 10,
                    borderColor: cat.color || undefined,
                    background: cat.gradient || (cat.color ? `linear-gradient(135deg, ${cat.color}1a, transparent)` : undefined),
                  }}
                >
                  <div>
                    <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 12,
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: 18,
                          fontWeight: 700,
                          color: cat.color || 'var(--text)',
                          background: cat.gradient || (cat.color ? `${cat.color}26` : 'var(--panel2)'),
                          border: `1px solid ${cat.color || 'rgba(15, 23, 42, 0.12)'}`,
                        }}
                      >
                        {cat.icon || '📌'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 900 }}>{cat.name}</div>
                        <div className="small" style={{ opacity: 0.7 }}>{cat.slug}</div>
                      </div>
                    </div>
                    <div style={{ height: 8 }} />
                    <div className="small">
                      {parentName ? `Parent: ${parentName}` : 'Catégorie principale'}
                    </div>
                    <div className="small">Niveau: {depth + 1}</div>
                    <div className="small">pos: {cat.position} · active: {String(cat.isActive ?? true)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <a className="btn" href={`/admin/categories/edit/${cat.id}`}>Éditer</a>
                    <a className="btn ghost" href={`/admin/categories/form-steps/${cat.id}`}>Form steps</a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </AdminSection>
    </AdminPage>
  );
};

export const CategoryCreate = () => {
  const { token } = useAdminAuth();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [position, setPosition] = useState(0);
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState('#2563eb');
  const [gradient, setGradient] = useState('');
  const [cats, setCats] = useState<Category[]>([]);

  useEffect(() => {
    (async () => {
      const res = await apiGet<{ items: Category[] }>('/admin/categories', token);
      setCats(res.items);
    })();
  }, [token]);

  return (
    <AdminPage title="Créer catégorie">
      <AdminSection title="Nouvelle catégorie">
        <div className="small">Nom</div>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        <div style={{ height: 10 }} />
        <div className="small">Slug</div>
        <input className="input" value={slug} onChange={(e) => setSlug(e.target.value)} />
        <div style={{ height: 10 }} />
        <div className="small">Icône (emoji ou texte)</div>
        <input className="input" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="📌" />
        <div style={{ height: 10 }} />
        <div className="grid cols-2" style={{ gap: 10 }}>
          <div>
            <div className="small">Couleur</div>
            <input className="input" type="color" value={color} onChange={(e) => setColor(e.target.value)} />
          </div>
          <div>
            <div className="small">Gradient (optionnel)</div>
            <input className="input" value={gradient} onChange={(e) => setGradient(e.target.value)} placeholder="linear-gradient(135deg, #22d3ee, #2563eb)" />
          </div>
        </div>
        <div style={{ height: 10 }} />
        <div className="panel pad" style={{ display: 'flex', gap: 10, alignItems: 'center', borderColor: color || undefined, background: gradient || (color ? `linear-gradient(135deg, ${color}1a, transparent)` : undefined) }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              display: 'grid',
              placeItems: 'center',
              fontSize: 18,
              fontWeight: 700,
              color: color || 'var(--text)',
              background: gradient || (color ? `${color}26` : 'var(--panel2)'),
              border: `1px solid ${color || 'rgba(15, 23, 42, 0.12)'}`,
            }}
          >
            {icon || '📌'}
          </div>
          <div>
            <div style={{ fontWeight: 900 }}>{name || 'Nom de la catégorie'}</div>
            <div className="small">{slug || 'slug-exemple'}</div>
          </div>
        </div>
        <div style={{ height: 10 }} />
        <div className="small">Parent</div>
        <Select className="input" value={parentId || ''} onChange={(value) => setParentId(value || null)} ariaLabel="Parent">
          <option value="">(root)</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <div style={{ height: 10 }} />
        <div className="small">Position</div>
        <input className="input" type="number" value={position} onChange={(e) => setPosition(parseInt(e.target.value || '0', 10))} />
        <div style={{ height: 14 }} />
        <button className="btn primary" onClick={async () => {
          const created = await apiPost<{ item: Category } | Category>('/admin/categories', {
            name,
            slug,
            parentId,
            position,
            icon: icon || null,
            color: color || null,
            gradient: gradient || null,
          }, token);
          const item = (created as any).item || (created as Category);
          window.location.href = `/admin/categories/edit/${item.id}`;
        }}>Créer</button>
      </AdminSection>
    </AdminPage>
  );
};

export const CategoryEdit = () => {
  const { token } = useAdminAuth();
  const id = window.location.pathname.split('/').pop() || '';
  const [cat, setCat] = useState<Category | null>(null);

  useEffect(() => {
    (async () => {
      const res = await apiGet<{ items: Category[] }>('/admin/categories', token);
      setCat(res.items.find((c) => c.id === id) || null);
    })();
  }, [id, token]);

  if (!cat) return <AdminPage title="Éditer catégorie" subtitle="Chargement…" />;

  return (
    <AdminPage title="Éditer catégorie" subtitle={cat.slug}>
      <AdminSection title="Détails">
        <div className="small">Nom</div>
        <input className="input" value={cat.name} onChange={(e) => setCat({ ...cat, name: e.target.value })} />
        <div style={{ height: 10 }} />
        <div className="small">Icône (emoji ou texte)</div>
        <input className="input" value={cat.icon || ''} onChange={(e) => setCat({ ...cat, icon: e.target.value })} placeholder="📌" />
        <div style={{ height: 10 }} />
        <div className="grid cols-2" style={{ gap: 10 }}>
          <div>
            <div className="small">Couleur</div>
            <input className="input" type="color" value={cat.color || '#2563eb'} onChange={(e) => setCat({ ...cat, color: e.target.value })} />
          </div>
          <div>
            <div className="small">Gradient (optionnel)</div>
            <input className="input" value={cat.gradient || ''} onChange={(e) => setCat({ ...cat, gradient: e.target.value })} placeholder="linear-gradient(135deg, #22d3ee, #2563eb)" />
          </div>
        </div>
        <div style={{ height: 10 }} />
        <div className="panel pad" style={{ display: 'flex', gap: 10, alignItems: 'center', borderColor: cat.color || undefined, background: cat.gradient || (cat.color ? `linear-gradient(135deg, ${cat.color}1a, transparent)` : undefined) }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              display: 'grid',
              placeItems: 'center',
              fontSize: 18,
              fontWeight: 700,
              color: cat.color || 'var(--text)',
              background: cat.gradient || (cat.color ? `${cat.color}26` : 'var(--panel2)'),
              border: `1px solid ${cat.color || 'rgba(15, 23, 42, 0.12)'}`,
            }}
          >
            {cat.icon || '📌'}
          </div>
          <div>
            <div style={{ fontWeight: 900 }}>{cat.name}</div>
            <div className="small">{cat.slug}</div>
          </div>
        </div>
        <div style={{ height: 10 }} />
        <div className="small">Position</div>
        <input className="input" type="number" value={cat.position} onChange={(e) => setCat({ ...cat, position: parseInt(e.target.value || '0', 10) })} />
        <div style={{ height: 10 }} />
        <div className="small">Active</div>
        <Select className="input" value={String(cat.isActive ?? true)} onChange={(value) => setCat({ ...cat, isActive: value === 'true' })} ariaLabel="Active">
          <option value="true">true</option>
          <option value="false">false</option>
        </Select>
      </AdminSection>
      <AdminSection title="Actions">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn primary" onClick={async () => {
            try {
              const updated = await apiPut<{ item: Category } | Category>(`/admin/categories/${cat.id}`, {
                name: cat.name,
                position: cat.position,
                isActive: cat.isActive,
                icon: cat.icon || null,
                color: cat.color || null,
                gradient: cat.gradient || null,
              }, token);
              const item = (updated as any).item || (updated as Category);
              setCat(item);
              notifySuccess('Catégorie mise à jour.');
            } catch (err) {
              notifyError(err, 'Mise à jour impossible.');
            }
          }}>Enregistrer</button>
          <a className="btn" href={`/admin/categories/form-steps/${cat.id}`}>Configurer form steps</a>
          <button className="btn ghost" onClick={async () => {
            if (!confirm('Supprimer cette catégorie ?')) return;
            try {
              await apiDelete(`/admin/categories/${cat.id}`, token);
              notifySuccess('Catégorie supprimée.');
              window.location.href = '/admin/categories/tree';
            } catch (err) {
              notifyError(err, 'Suppression impossible.');
            }
          }}>Supprimer</button>
        </div>
      </AdminSection>
    </AdminPage>
  );
};

export const FormSteps = () => {
  const { token } = useAdminAuth();
  const categoryId = window.location.pathname.split('/').pop() || '';
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [form, setForm] = useState({ name: '', label: '', order: 0, flow: '' });

  async function refresh() {
    try {
      const res = await apiGet<{ items: Step[] }>(`/admin/categories/${categoryId}/steps`, token);
      setSteps(res.items);
    } catch (err) {
      notifyError(err, 'Erreur de chargement des étapes.');
      setSteps([]);
    }
  }

  useEffect(() => { refresh(); }, [categoryId, token]);

  return (
    <AdminPage title="Form Steps" subtitle={`categoryId=${categoryId}`}>
      <AdminSection title="Ajouter un step">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px 160px', gap: 10 }}>
          <input className="input" placeholder="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          <input className="input" type="number" placeholder="order" value={form.order} onChange={(e) => setForm({ ...form, order: parseInt(e.target.value || '0', 10) })} />
          <input className="input" placeholder="flow (optional)" value={form.flow} onChange={(e) => setForm({ ...form, flow: e.target.value })} />
        </div>
        <div style={{ height: 10 }} />
        <button className="btn primary" onClick={async () => {
          try {
            await apiPost(`/admin/categories/${categoryId}/steps`, { ...form, flow: form.flow || null }, token);
            setForm({ name: '', label: '', order: 0, flow: '' });
            await refresh();
            notifySuccess('Étape ajoutée.');
          } catch (err) {
            notifyError(err, 'Ajout impossible.');
          }
        }}>Ajouter step</button>
      </AdminSection>

      <AdminSection title="Steps existants">
        {!steps ? <div className="small">Chargement…</div> : (
          <div style={{ display: 'grid', gap: 10 }}>
            {steps.map((s) => (
              <div key={s.id} className="panel pad" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 900 }}>{s.label} <span className="small" style={{ opacity: 0.7 }}>({s.name})</span></div>
                  <div className="small">order: {s.order} · flow: {s.flow || '-'}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <a className="btn" href={`/admin/categories/form-fields/${s.id}`}>Champs</a>
                  <button className="btn ghost" onClick={async () => {
                    try {
                      await apiDelete(`/admin/steps/${s.id}`, token);
                      await refresh();
                      notifySuccess('Étape supprimée.');
                    } catch (err) {
                      notifyError(err, 'Suppression impossible.');
                    }
                  }}>Supprimer</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminSection>
    </AdminPage>
  );
};

export const FormFields = () => {
  const { token } = useAdminAuth();
  const stepId = window.location.pathname.split('/').pop() || '';
  const [fields, setFields] = useState<Field[] | null>(null);
  const [form, setForm] = useState({ name: '', label: '', type: 'text', unit: '', values: '', rules: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: '', label: '', type: 'text', unit: '', values: '', rules: '', info: '', disabled: false, default_checked: false });
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    try {
      const res = await apiGet<{ items: Field[] }>(`/admin/steps/${stepId}/fields`, token);
      setFields(res.items);
    } catch (err) {
      notifyError(err, 'Erreur de chargement des champs.');
      setFields([]);
    }
  }

  useEffect(() => { refresh(); }, [stepId, token]);

  const startEdit = (f: Field) => {
    setEditingId(f.id);
    setEditError(null);
    setDraft({
      name: f.name || '',
      label: f.label || '',
      type: f.type || 'text',
      unit: f.unit || '',
      values: f.values ? JSON.stringify(f.values) : '',
      rules: f.rules ? JSON.stringify(f.rules) : '',
      info: f.info ? JSON.stringify(f.info) : '',
      disabled: Boolean(f.disabled),
      default_checked: Boolean(f.default_checked),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError(null);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    setEditError(null);
    try {
      const values = draft.values ? JSON.parse(draft.values) : null;
      const rules = draft.rules ? JSON.parse(draft.rules) : null;
      const info = draft.info ? JSON.parse(draft.info) : null;
      await apiPut(`/admin/fields/${editingId}`, {
        name: draft.name,
        label: draft.label,
        type: draft.type,
        unit: draft.unit || null,
        values,
        rules,
        info,
        disabled: Boolean(draft.disabled),
        default_checked: Boolean(draft.default_checked),
      }, token);
      await refresh();
      setEditingId(null);
      notifySuccess('Champ mis à jour.');
    } catch (err: any) {
      const message = err?.error || err?.message || 'Erreur de mise à jour.';
      setEditError(message);
      notifyError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminPage title="Form Fields" subtitle={`stepId=${stepId}`}>
      <AdminSection title="Ajouter un champ">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 160px 140px', gap: 10 }}>
          <input className="input" placeholder="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          <Select className="input" value={form.type} onChange={(value) => setForm({ ...form, type: value })} ariaLabel="Type">
            <option value="text">text</option>
            <option value="textarea">textarea</option>
            <option value="number">number</option>
            <option value="select">select</option>
            <option value="multiselect">multiselect</option>
            <option value="checkbox">checkbox</option>
            <option value="radio">radio</option>
            <option value="date">date</option>
          </Select>
          <input className="input" placeholder="unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
        </div>
        <div style={{ height: 10 }} />
        <div className="small">values (JSON array) — ex: ["A","B"]</div>
        <input className="input" value={form.values} onChange={(e) => setForm({ ...form, values: e.target.value })} />
        <div style={{ height: 10 }} />
        <div className="small">rules (JSON) — ex: {'{"required":true,"min":18}'}</div>
        <input className="input" value={form.rules} onChange={(e) => setForm({ ...form, rules: e.target.value })} />
        <div style={{ height: 10 }} />
        <button className="btn primary" onClick={async () => {
          try {
            const values = form.values ? JSON.parse(form.values) : null;
            const rules = form.rules ? JSON.parse(form.rules) : null;
            await apiPost(`/admin/steps/${stepId}/fields`, { name: form.name, label: form.label, type: form.type, unit: form.unit || null, values, rules }, token);
            setForm({ name: '', label: '', type: 'text', unit: '', values: '', rules: '' });
            await refresh();
            notifySuccess('Champ ajouté.');
          } catch (err) {
            notifyError(err, 'Ajout impossible.');
          }
        }}>Ajouter champ</button>
      </AdminSection>

      <AdminSection title="Champs existants">
        {!fields ? <div className="small">Chargement…</div> : (
          <div style={{ display: 'grid', gap: 10 }}>
            {fields.map((f) => (
              <div key={f.id} className="panel pad" style={{ display: 'grid', gap: 10 }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 900 }}>{f.label} <span className="small" style={{ opacity: 0.7 }}>({f.name})</span></div>
                    <div className="small">type: {f.type || '-'} · unit: {f.unit || '-'} </div>
                  </div>
                  <div className="row" style={{ flexWrap: 'wrap' }}>
                    <button className="btn" onClick={() => (editingId === f.id ? cancelEdit() : startEdit(f))}>
                      {editingId === f.id ? 'Fermer' : 'Éditer'}
                    </button>
                    <button className="btn ghost" onClick={async () => {
                      try {
                        await apiDelete(`/admin/fields/${f.id}`, token);
                        await refresh();
                        notifySuccess('Champ supprimé.');
                      } catch (err) {
                        notifyError(err, 'Suppression impossible.');
                      }
                    }}>Supprimer</button>
                  </div>
                </div>

                {editingId === f.id ? (
                  <div className="panel pad" style={{ padding: 12, background: 'var(--panel2)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 160px 140px', gap: 10 }}>
                      <input className="input" placeholder="name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                      <input className="input" placeholder="label" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
                      <Select className="input" value={draft.type} onChange={(value) => setDraft({ ...draft, type: value })} ariaLabel="Type">
                        <option value="text">text</option>
                        <option value="textarea">textarea</option>
                        <option value="number">number</option>
                        <option value="select">select</option>
                        <option value="multiselect">multiselect</option>
                        <option value="checkbox">checkbox</option>
                        <option value="radio">radio</option>
                        <option value="date">date</option>
                      </Select>
                      <input className="input" placeholder="unit" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} />
                    </div>
                    <div style={{ height: 10 }} />
                    <div className="small">values (JSON array) — ex: ["A","B"]</div>
                    <textarea className="input" rows={2} value={draft.values} onChange={(e) => setDraft({ ...draft, values: e.target.value })} />
                    <div style={{ height: 10 }} />
                    <div className="small">rules (JSON) — ex: {'{"required":true,"min":18}'}</div>
                    <textarea className="input" rows={2} value={draft.rules} onChange={(e) => setDraft({ ...draft, rules: e.target.value })} />
                    <div style={{ height: 10 }} />
                    <div className="small">info (JSON) — ex: ["hint","note"]</div>
                    <textarea className="input" rows={2} value={draft.info} onChange={(e) => setDraft({ ...draft, info: e.target.value })} />
                    <div style={{ height: 10 }} />
                    <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
                      <Checkbox
                        className="compact"
                        checked={draft.disabled}
                        onChange={(next) => setDraft({ ...draft, disabled: next })}
                        label="Désactivé"
                      />
                      <Checkbox
                        className="compact"
                        checked={draft.default_checked}
                        onChange={(next) => setDraft({ ...draft, default_checked: next })}
                        label="Coché par défaut"
                      />
                    </div>
                    {editError ? <div className="small" style={{ color: 'var(--red)', marginTop: 8 }}>{editError}</div> : null}
                    <div style={{ height: 10 }} />
                    <div className="row" style={{ gap: 8 }}>
                      <button className="btn primary" disabled={saving} onClick={saveEdit}>
                        {saving ? 'Enregistrement…' : 'Enregistrer'}
                      </button>
                      <button className="btn ghost" onClick={cancelEdit}>Annuler</button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </AdminSection>
    </AdminPage>
  );
};

// --------------------
// Monetization (Step 1.2)
// --------------------

export const CreditPacks = () => {
  const { token } = useAdminAuth();
  const [items, setItems] = useState<CreditPack[] | null>(null);
  const [form, setForm] = useState({ name: '', credits: 5, price: 2000, currency: 'XAF', country: 'CM', position: 10, isActive: true });

  async function refresh() {
    try {
      const res = await apiGet<{ items: CreditPack[] }>(`/admin/credit-packs`, token);
      setItems(res.items);
    } catch (err) {
      notifyError(err, 'Erreur de chargement des packs.');
      setItems([]);
    }
  }
  useEffect(() => { refresh(); }, [token]);

  return (
    <AdminPage title="Crédits — Packs" subtitle="CRUD packs (Step 1.2)">
      <AdminSection title="Créer un pack">
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 120px 140px 100px 90px 90px', gap: 10 }}>
          <input className="input" placeholder="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" type="number" placeholder="credits" value={form.credits} onChange={(e) => setForm({ ...form, credits: parseInt(e.target.value || '0', 10) })} />
          <input className="input" type="number" placeholder="price" value={form.price} onChange={(e) => setForm({ ...form, price: parseInt(e.target.value || '0', 10) })} />
          <input className="input" placeholder="currency" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
          <input className="input" placeholder="country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })} />
          <input className="input" type="number" placeholder="position" value={form.position} onChange={(e) => setForm({ ...form, position: parseInt(e.target.value || '0', 10) })} />
        </div>
        <div style={{ height: 10 }} />
        <button className="btn primary" onClick={async () => {
          try {
            await apiPost(`/admin/credit-packs`, { ...form, country: form.country || null }, token);
            setForm({ name: '', credits: 5, price: 2000, currency: 'XAF', country: 'CM', position: 10, isActive: true });
            await refresh();
            notifySuccess('Pack ajouté.');
          } catch (err) {
            notifyError(err, 'Ajout impossible.');
          }
        }}>Ajouter pack</button>
      </AdminSection>

      <AdminSection title="Packs existants">
        {!items ? <div className="small">Chargement…</div> : (
          <div style={{ display: 'grid', gap: 10 }}>
            {items.map((p) => (
              <div key={p.id} className="panel pad" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 900 }}>{p.name} <span className="small" style={{ opacity: 0.7 }}>({p.country || 'ALL'})</span></div>
                  <div className="small">{p.credits} crédits · {p.price} {p.currency} · pos {p.position} · {p.isActive ? 'active' : 'off'}</div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn" onClick={async () => {
                    try {
                      await apiPut(`/admin/credit-packs/${p.id}`, { isActive: !p.isActive }, token);
                      await refresh();
                      notifySuccess('Pack mis à jour.');
                    } catch (err) {
                      notifyError(err, 'Mise à jour impossible.');
                    }
                  }}>{p.isActive ? 'Désactiver' : 'Activer'}</button>
                  <button className="btn ghost" onClick={async () => {
                    try {
                      await apiDelete(`/admin/credit-packs/${p.id}`, token);
                      await refresh();
                      notifySuccess('Pack supprimé.');
                    } catch (err) {
                      notifyError(err, 'Suppression impossible.');
                    }
                  }}>Supprimer</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminSection>
    </AdminPage>
  );
};

export const PricingRules = () => {
  const { token } = useAdminAuth();
  const [items, setItems] = useState<PricingRule[] | null>(null);
  const [form, setForm] = useState({ action: 'PUBLISH_AD', creditsCost: 5, currency: 'XAF', country: 'CM', categorySlug: '', priority: 10, isActive: true });
  async function refresh() {
    try {
      const res = await apiGet<{ items: PricingRule[] }>(`/admin/pricing-rules`, token);
      setItems(res.items);
    } catch (err) {
      notifyError(err, 'Erreur de chargement des règles.');
      setItems([]);
    }
  }
  useEffect(() => { refresh(); }, [token]);

  return (
    <AdminPage title="Pricing (crédits)" subtitle="Coûts par action (Step 1.2)">
      <AdminSection title="Créer une règle">
        <div style={{ display: 'grid', gridTemplateColumns: '160px 120px 90px 90px 1fr 90px', gap: 10 }}>
          <Select className="input" value={form.action} onChange={(value) => setForm({ ...form, action: value })} ariaLabel="Action">
            <option value="PUBLISH_AD">{formatAction('PUBLISH_AD')}</option>
            <option value="RENEW_AD">{formatAction('RENEW_AD')}</option>
          </Select>
          <input className="input" type="number" value={form.creditsCost} onChange={(e) => setForm({ ...form, creditsCost: parseInt(e.target.value || '0', 10) })} />
          <input className="input" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
          <input className="input" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })} placeholder="country" />
          <input className="input" value={form.categorySlug} onChange={(e) => setForm({ ...form, categorySlug: e.target.value })} placeholder="categorySlug (optional)" />
          <input className="input" type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value || '0', 10) })} />
        </div>
        <div style={{ height: 10 }} />
        <button className="btn primary" onClick={async () => {
          try {
            await apiPost(`/admin/pricing-rules`, { ...form, country: form.country || null, categorySlug: form.categorySlug || null }, token);
            setForm({ action: 'PUBLISH_AD', creditsCost: 5, currency: 'XAF', country: 'CM', categorySlug: '', priority: 10, isActive: true });
            await refresh();
            notifySuccess('Règle ajoutée.');
          } catch (err) {
            notifyError(err, 'Ajout impossible.');
          }
        }}>Ajouter règle</button>
      </AdminSection>

      <AdminSection title="Règles actives">
        {!items ? <div className="small">Chargement…</div> : (
          <div style={{ display: 'grid', gap: 10 }}>
            {items.map((r) => (
              <div key={r.id} className="panel pad" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 900 }}>{formatAction(r.action)} — {r.creditsCost} crédits</div>
                  <div className="small">{r.country || 'ALL'} · {r.categorySlug || 'ALL'} · priority {r.priority} · {r.isActive ? 'active' : 'off'}</div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn" onClick={async () => {
                    try {
                      await apiPut(`/admin/pricing-rules/${r.id}`, { isActive: !r.isActive }, token);
                      await refresh();
                      notifySuccess('Règle mise à jour.');
                    } catch (err) {
                      notifyError(err, 'Mise à jour impossible.');
                    }
                  }}>{r.isActive ? 'Off' : 'On'}</button>
                  <button className="btn ghost" onClick={async () => {
                    try {
                      await apiDelete(`/admin/pricing-rules/${r.id}`, token);
                      await refresh();
                      notifySuccess('Règle supprimée.');
                    } catch (err) {
                      notifyError(err, 'Suppression impossible.');
                    }
                  }}>Supprimer</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminSection>
    </AdminPage>
  );
};

export const QuotaRules = () => {
  const { token } = useAdminAuth();
  const [items, setItems] = useState<QuotaRule[] | null>(null);
  const [form, setForm] = useState({ action: 'PUBLISH_AD', maxPerDay: 3, country: 'CM', categorySlug: '', role: 'user', priority: 10, isActive: true });
  async function refresh() {
    try {
      const res = await apiGet<{ items: QuotaRule[] }>(`/admin/quota-rules`, token);
      setItems(res.items);
    } catch (err) {
      notifyError(err, 'Erreur de chargement des quotas.');
      setItems([]);
    }
  }
  useEffect(() => { refresh(); }, [token]);

  return (
    <AdminPage title="Quotas" subtitle="Limites par jour (Step 1.2)">
      <AdminSection title="Créer un quota">
        <div style={{ display: 'grid', gridTemplateColumns: '160px 120px 90px 1fr 120px 90px', gap: 10 }}>
          <Select className="input" value={form.action} onChange={(value) => setForm({ ...form, action: value })} ariaLabel="Action">
            <option value="PUBLISH_AD">{formatAction('PUBLISH_AD')}</option>
          </Select>
          <input className="input" type="number" value={form.maxPerDay} onChange={(e) => setForm({ ...form, maxPerDay: parseInt(e.target.value || '0', 10) })} />
          <input className="input" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })} placeholder="country" />
          <input className="input" value={form.categorySlug} onChange={(e) => setForm({ ...form, categorySlug: e.target.value })} placeholder="categorySlug (optional)" />
          <Select className="input" value={form.role} onChange={(value) => setForm({ ...form, role: value })} ariaLabel="Role">
            <option value="user">user</option>
            <option value="admin">admin</option>
            <option value="moderator">moderator</option>
          </Select>
          <input className="input" type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value || '0', 10) })} />
        </div>
        <div style={{ height: 10 }} />
        <button className="btn primary" onClick={async () => {
          try {
            await apiPost(`/admin/quota-rules`, { ...form, country: form.country || null, categorySlug: form.categorySlug || null, role: form.role || null }, token);
            setForm({ action: 'PUBLISH_AD', maxPerDay: 3, country: 'CM', categorySlug: '', role: 'user', priority: 10, isActive: true });
            await refresh();
            notifySuccess('Quota ajouté.');
          } catch (err) {
            notifyError(err, 'Ajout impossible.');
          }
        }}>Ajouter quota</button>
      </AdminSection>

      <AdminSection title="Quotas actifs">
        {!items ? <div className="small">Chargement…</div> : (
          <div style={{ display: 'grid', gap: 10 }}>
            {items.map((q) => (
              <div key={q.id} className="panel pad" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 900 }}>{formatAction(q.action)} — max {q.maxPerDay}/jour</div>
                  <div className="small">{q.role || 'ALL'} · {q.country || 'ALL'} · {q.categorySlug || 'ALL'} · priority {q.priority} · {q.isActive ? 'active' : 'off'}</div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn" onClick={async () => {
                    try {
                      await apiPut(`/admin/quota-rules/${q.id}`, { isActive: !q.isActive }, token);
                      await refresh();
                      notifySuccess('Quota mis à jour.');
                    } catch (err) {
                      notifyError(err, 'Mise à jour impossible.');
                    }
                  }}>{q.isActive ? 'Off' : 'On'}</button>
                  <button className="btn ghost" onClick={async () => {
                    try {
                      await apiDelete(`/admin/quota-rules/${q.id}`, token);
                      await refresh();
                      notifySuccess('Quota supprimé.');
                    } catch (err) {
                      notifyError(err, 'Suppression impossible.');
                    }
                  }}>Supprimer</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminSection>
    </AdminPage>
  );
};

// --- users ---
export const Users = () => {
  const { token } = useAdminAuth();
  const [items, setItems] = useState<UserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [country, setCountry] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        take: String(pageSize),
        offset: String(page * pageSize),
      });
      if (search.trim()) params.set('search', search.trim());
      if (role) params.set('role', role);
      if (country.trim()) params.set('country', country.trim().toUpperCase());
      const res = await apiGet<{ items: UserListItem[]; total: number }>(`/admin/users?${params.toString()}`, token);
      setItems(res.items || []);
      setTotal(res.total || 0);
    } catch (err) {
      setError(err);
      notifyError(err, 'Erreur de chargement des utilisateurs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token, page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <AdminPage
      title="Utilisateurs"
      subtitle="Liste, vérifications et crédits."
      actions={<button className="btn" onClick={load}>Rafraîchir</button>}
    >
      <AdminSection title="Filtres">
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 180px 120px 120px', gap: 10 }}>
          <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher (username, email, tel...)" />
          <Select className="input" value={role} onChange={setRole} ariaLabel="Rôle">
            <option value="">Tous les rôles</option>
            <option value="user">user</option>
            <option value="moderator">moderator</option>
            <option value="admin">admin</option>
          </Select>
          <input className="input" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Pays (CM)" />
          <button
            className="btn primary"
            onClick={() => {
              setPage(0);
              load();
            }}
          >
            Filtrer
          </button>
        </div>
      </AdminSection>

      <AdminSection title="Liste">
        {loading ? <div className="small">Chargement…</div> : null}
        {error ? <div className="small" style={{ color: 'var(--red)' }}>Erreur de chargement.</div> : null}
        {items.length === 0 ? (
          <div className="small">Aucun utilisateur.</div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {items.map((u) => (
              <div
                key={u.id}
                className="panel pad"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.4fr 1.2fr 0.8fr 0.9fr 0.7fr 0.7fr 0.6fr',
                  gap: 12,
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 900 }}>{u.username}</div>
                  <div className="small">{[u.firstName, u.lastName].filter(Boolean).join(' ') || '—'}</div>
                </div>
                <div className="small">
                  <div>{u.email || '—'}</div>
                  <div>{u.phone || '—'}</div>
                </div>
                <div>
                  <span className={`badge ${u.role === 'admin' ? 'danger' : u.role === 'moderator' ? 'warn' : 'neutral'}`}>{u.role}</span>
                  {u.security?.isShadowBanned ? <span className="badge danger" style={{ marginLeft: 6 }}>Shadow</span> : null}
                </div>
                <div className="small">{u.city}, {u.country}</div>
                <div className="small">{u._count?.ads ?? 0} annonces</div>
                <div className="small">{u.creditWallet?.balance ?? 0} crédits</div>
                <div>
                  <a className="btn" href={`/admin/users/view/${u.id}`}>Voir</a>
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ height: 12 }} />
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="btn" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Précédent</button>
          <div className="small">Page {page + 1} / {totalPages}</div>
          <button className="btn" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Suivant</button>
        </div>
      </AdminSection>
    </AdminPage>
  );
};

export const UserView = () => {
  const { id } = useParams();
  const { token } = useAdminAuth();
  const [item, setItem] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [shadowReason, setShadowReason] = useState('');
  const [creditAmount, setCreditAmount] = useState(0);
  const [creditReason, setCreditReason] = useState('ADMIN_ADJUST');
  const [form, setForm] = useState({
    role: 'user',
    username: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    city: '',
    country: 'CM',
    emailVerified: false,
    phoneVerified: false,
    allowMessages: true,
    allowCalls: true,
    showEmail: false,
    showPhone: false,
  });

  const load = async () => {
    if (!token || !id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<{ item: UserDetail }>(`/admin/users/${id}`, token);
      setItem(res.item);
      setForm({
        role: res.item.role || 'user',
        username: res.item.username || '',
        firstName: res.item.firstName || '',
        lastName: res.item.lastName || '',
        email: res.item.email || '',
        phone: res.item.phone || '',
        city: res.item.city || '',
        country: res.item.country || 'CM',
        emailVerified: Boolean(res.item.emailVerified),
        phoneVerified: Boolean(res.item.phoneVerified),
        allowMessages: Boolean(res.item.allowMessages),
        allowCalls: Boolean(res.item.allowCalls),
        showEmail: Boolean(res.item.showEmail),
        showPhone: Boolean(res.item.showPhone),
      });
      setShadowReason(res.item.security?.shadowReason || '');
    } catch (err) {
      setError(err);
      notifyError(err, 'Utilisateur introuvable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token, id]);

  const save = async () => {
    if (!token || !id) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiPut<{ item: UserDetail }>(`/admin/users/${id}`, form, token);
      setItem((prev) => (prev ? { ...prev, ...res.item } : res.item));
      notifySuccess('Profil mis à jour.');
    } catch (err) {
      setError(err);
      notifyError(err, 'Mise à jour impossible.');
    } finally {
      setSaving(false);
    }
  };

  const adjustCredits = async () => {
    if (!token || !id || !creditAmount) return;
    setAdjusting(true);
    try {
      await apiPost(`/admin/users/${id}/credits/adjust`, { amount: creditAmount, reason: creditReason }, token);
      notifySuccess('Crédits ajustés.');
      setCreditAmount(0);
      setCreditReason('ADMIN_ADJUST');
      load();
    } catch (err) {
      notifyError(err, 'Ajustement impossible.');
    } finally {
      setAdjusting(false);
    }
  };

  const toggleShadowban = async () => {
    if (!token || !id || !item) return;
    const next = !item.security?.isShadowBanned;
    try {
      const res = await apiPost<{ item: { isShadowBanned: boolean; shadowReason?: string | null } }>(
        `/admin/security-advanced/users/${id}/shadowban`,
        { isShadowBanned: next, reason: shadowReason },
        token
      );
      setItem((prev) => (prev ? { ...prev, security: res.item } : prev));
      notifySuccess(next ? 'Utilisateur shadowbanné.' : 'Shadowban levé.');
    } catch (err) {
      notifyError(err, 'Action impossible.');
    }
  };

  return (
    <AdminPage title="Détail utilisateur" subtitle="Profil, status et crédits.">
      {loading ? <div className="small">Chargement…</div> : null}
      {error ? <div className="small" style={{ color: 'var(--red)' }}>Erreur: {String(error?.error || error?.message || error)}</div> : null}
      {!item ? null : (
        <>
          <AdminSection title="Résumé">
            <div className="panel pad" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 900 }}>{item.username}</div>
                <div className="small">{[item.firstName, item.lastName].filter(Boolean).join(' ') || '—'}</div>
                <div className="small">{item.email || '—'}</div>
                <div className="small">{item.phone || '—'}</div>
              </div>
              <div>
                <div className="small">Rôle</div>
                <div style={{ fontWeight: 800 }}>{item.role}</div>
                <div className="small">Inscrit le {new Date(item.createdAt).toLocaleDateString('fr-FR')}</div>
              </div>
              <div>
                <div className="small">Crédits</div>
                <div style={{ fontWeight: 800 }}>{item.creditWallet?.balance ?? 0}</div>
                <div className="small">{item._count?.ads ?? 0} annonces</div>
              </div>
            </div>
          </AdminSection>

          <AdminSection title="Profil">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              <div>
                <div className="small">Username</div>
                <input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
              </div>
              <div>
                <div className="small">Prénom</div>
                <input className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              </div>
              <div>
                <div className="small">Nom</div>
                <input className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </div>
              <div>
                <div className="small">Email</div>
                <input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <div className="small">Téléphone</div>
                <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <div className="small">Ville</div>
                <input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <div>
                <div className="small">Pays</div>
                <input className="input" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
              </div>
              <div>
                <div className="small">Rôle</div>
                <Select className="input" value={form.role} onChange={(value) => setForm({ ...form, role: value })} ariaLabel="Rôle">
                  <option value="user">user</option>
                  <option value="moderator">moderator</option>
                  <option value="admin">admin</option>
                </Select>
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <Checkbox
                  className="compact"
                  checked={form.emailVerified}
                  onChange={(next) => setForm({ ...form, emailVerified: next })}
                  label="Email vérifié"
                />
                <Checkbox
                  className="compact"
                  checked={form.phoneVerified}
                  onChange={(next) => setForm({ ...form, phoneVerified: next })}
                  label="Téléphone vérifié"
                />
                <Checkbox
                  className="compact"
                  checked={form.allowMessages}
                  onChange={(next) => setForm({ ...form, allowMessages: next })}
                  label="Messages autorisés"
                />
                <Checkbox
                  className="compact"
                  checked={form.allowCalls}
                  onChange={(next) => setForm({ ...form, allowCalls: next })}
                  label="Appels autorisés"
                />
                <Checkbox
                  className="compact"
                  checked={form.showEmail}
                  onChange={(next) => setForm({ ...form, showEmail: next })}
                  label="Email public"
                />
                <Checkbox
                  className="compact"
                  checked={form.showPhone}
                  onChange={(next) => setForm({ ...form, showPhone: next })}
                  label="Téléphone public"
                />
              </div>
            </div>
            <div style={{ height: 12 }} />
            <button className="btn primary" onClick={save} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
          </AdminSection>

          <AdminSection title="Crédits">
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 160px', gap: 10 }}>
              <input className="input" type="number" value={creditAmount} onChange={(e) => setCreditAmount(parseInt(e.target.value || '0', 10))} />
              <input className="input" value={creditReason} onChange={(e) => setCreditReason(e.target.value)} placeholder="Reason" />
              <button className="btn" onClick={adjustCredits} disabled={adjusting || !creditAmount}>
                {adjusting ? 'Ajustement…' : 'Ajuster'}
              </button>
            </div>
          </AdminSection>

          <AdminSection title="Shadowban">
            <div className="small">Statut: {item.security?.isShadowBanned ? 'Actif' : 'Aucun'}</div>
            <div style={{ height: 8 }} />
            <input className="input" value={shadowReason} onChange={(e) => setShadowReason(e.target.value)} placeholder="Raison (optionnelle)" />
            <div style={{ height: 8 }} />
            <button className="btn" onClick={toggleShadowban}>
              {item.security?.isShadowBanned ? 'Lever le shadowban' : 'Activer shadowban'}
            </button>
          </AdminSection>

          <AdminSection title="Dernières annonces">
            {item.ads && item.ads.length ? (
              <div style={{ display: 'grid', gap: 10 }}>
                {item.ads.map((ad) => (
                  <div key={ad.id} className="panel pad" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{ad.title}</div>
                      <div className="small">{ad.categorySlug} · {ad.city}, {ad.country}</div>
                    </div>
                    <div className="row" style={{ gap: 8 }}>
                      <span className={`badge ${toneForStatus(ad.status)}`}>{formatStatus(ad.status)}</span>
                      <a className="btn" href={`/admin/ads/view/${ad.id}`}>Voir</a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="small">Aucune annonce récente.</div>
            )}
          </AdminSection>
        </>
      )}
    </AdminPage>
  );
};

// --- placeholders for not-yet-implemented sections ---
export const Transactions = () => <TransactionsPage />;
export const Reconciliation = () => <ReconciliationPage />;
export const Revenue = () => <RevenuePage />;
export const Refunds = () => <RefundsPage />;
export const JobsHealth = () => <JobsHealthPage />;
type Subscription = {
  id: string;
  plan: 'MONTHLY' | 'YEARLY';
  status: string;
  startAt: string;
  endAt: string;
  createdAt: string;
  user?: { id: string; username: string; email?: string | null; country?: string; city?: string; role?: string };
};

type ProOffer = { id: string; plan: 'MONTHLY' | 'YEARLY'; name: string; creditsCost: number; durationDays: number; country?: string | null; currency: string; position: number; isActive: boolean };

export const Subscriptions = () => {
  const { token } = useAdminAuth();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [offers, setOffers] = useState<ProOffer[]>([]);
  const [tab, setTab] = useState<'subs'|'offers'>('subs');
  const [error, setError] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const reload = () => {
    if (!token) return;
    setError(null);
    Promise.all([
      apiGet<{ items: Subscription[] }>('/admin/subscriptions', token),
      apiGet<{ items: ProOffer[] }>('/admin/pro-offers', token),
    ])
      .then(([s, o]) => { setSubs(s.items || []); setOffers(o.items || []); })
      .catch((err) => {
        setError(err);
        notifyError(err, 'Erreur de chargement des abonnements.');
      });
  };

  useEffect(() => { reload(); }, [token]);

  async function cancelSub(id: string) {
    setLoading(true);
    setError(null);
    try {
      await apiPost(`/admin/subscriptions/${id}/cancel`, {}, token);
      notifySuccess('Souscription annulée.');
      reload();
    } catch (e) {
      setError(e);
      notifyError(e, 'Annulation impossible.');
    } finally {
      setLoading(false);
    }
  }

  async function saveOffer(offer: Partial<ProOffer> & { id: string }) {
    setLoading(true);
    setError(null);
    try {
      await apiPut(`/admin/pro-offers/${offer.id}`, offer, token);
      notifySuccess('Offre PRO mise à jour.');
      reload();
    } catch (e) {
      setError(e);
      notifyError(e, 'Mise à jour impossible.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminPage title="Abonnements" subtitle="Step 3: PRO (offres + souscriptions)." actions={<button className="btn" onClick={reload}>Rafraîchir</button>}>
      <AdminSection title="Vue">
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className={`btn ${tab==='subs'?'primary':''}`} onClick={() => setTab('subs')}>Souscriptions</button>
          <button className={`btn ${tab==='offers'?'primary':''}`} onClick={() => setTab('offers')}>Offres PRO</button>
        </div>
        {error ? <div className="small" style={{ color: 'var(--red)', marginTop: 10 }}><b>Erreur:</b> {String(error?.error || error?.message || error)}</div> : null}
      </AdminSection>

      <AdminSection title={tab === 'subs' ? 'Souscriptions' : 'Offres PRO'}>
        {tab === 'subs' ? (
          <div style={{ display: 'grid', gap: 10 }}>
            {subs.length === 0 ? <div className="small">Aucune souscription.</div> : null}
            {subs.map((s) => (
              <div key={s.id} className="panel pad" style={{ borderStyle: 'dashed' }}>
                <div style={{ fontWeight: 900 }}>{s.user?.username || s.user?.email || s.user?.id}</div>
                <div className="small">Plan: {s.plan} · Statut: {formatStatus(s.status)} · Fin: {new Date(s.endAt).toLocaleString('fr-FR')}</div>
                <div style={{ height: 8 }} />
                <button className="btn" disabled={loading || s.status !== 'ACTIVE'} onClick={() => cancelSub(s.id)}>
                  Annuler
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {offers.length === 0 ? <div className="small">Aucune offre.</div> : null}
            {offers.map((o) => (
              <div key={o.id} className="panel pad" style={{ borderStyle: 'dashed' }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 900 }}>{o.name}</div>
                    <div className="small">{o.plan} · {o.durationDays} jours · {o.creditsCost} crédits</div>
                  </div>
                  <Checkbox
                    className="compact"
                    checked={o.isActive}
                    onChange={(next) => saveOffer({ ...o, isActive: next })}
                    label="Actif"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminSection>
    </AdminPage>
  );
};
export const BoostTypes = () => <AdminPage title="Boost Types" subtitle="Gestion des types de boosts." />;

type AdminBoost = {
  id: string;
  type: string;
  startAt: string;
  endAt: string;
  ad: { id: string; title: string; city: string; country: string; categorySlug: string };
  user: { id: string; username: string; email?: string | null };
};

export const ActiveBoosts = () => {
  const { token } = useAdminAuth();
  const [items, setItems] = useState<AdminBoost[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const reload = async () => {
    setErr(null);
    try {
      const r = await apiGet<{ items: AdminBoost[] }>('/admin/boosts/active', token);
      setItems(r.items);
    } catch (e: any) {
      setErr(e?.error || 'Failed');
    }
  };

  useEffect(() => { void reload(); }, [token]);

  return (
    <AdminPage title="Boosts actifs" subtitle="Liste des boosts en cours + annulation." actions={<button className="btn" onClick={reload}>Rafraîchir</button>}>
      <AdminSection title="Liste" subtitle="Endpoint: /admin/boosts/active (staff)">
        {err ? <div className="small" style={{ color: 'var(--red)' }}>{err}</div> : null}
        {!items ? <div className="small">Chargement…</div> : null}
        {items && items.length === 0 ? <div className="small">Aucun boost actif.</div> : null}
        {items ? (
          <div style={{ display: 'grid', gap: 10 }}>
            {items.map((b) => (
              <div key={b.id} className="panel pad" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 900 }}>{b.type} — {b.ad.title}</div>
                  <div className="small">{b.ad.city}, {b.ad.country} · {b.ad.categorySlug}</div>
                  <div className="small">Par: {b.user.username}{b.user.email ? ` (${b.user.email})` : ''}</div>
                  <div className="small" style={{ opacity: 0.75 }}>Fin: {new Date(b.endAt).toLocaleString('fr-FR')}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <a className="btn" href={`/admin/ads/view/${b.ad.id}`}>Voir annonce</a>
                  <button className="btn ghost" onClick={async () => { await apiPost(`/admin/boosts/${b.id}/cancel`, {}, token); await reload(); }}>Annuler</button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </AdminSection>
    </AdminPage>
  );
};

export const Messages = () => {
  const { token } = useAdminAuth();
  const [items, setItems] = useState<ConversationPreview[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [showArchived, setShowArchived] = useState(false);
  const socketRef = React.useRef<any>(null);
  const joinedRef = React.useRef<Set<string>>(new Set());

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const query = showArchived ? '?archived=1' : '';
      const [me, convs] = await Promise.all([
        apiGet<any>('/me', token),
        apiGet<{ items: ConversationPreview[] }>(`/conversations${query}`, token),
      ]);
      setMeId(me?.id || null);
      setItems(convs.items || []);
    } catch (e) {
      setError(e);
      notifyError(e, 'Impossible de charger les conversations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [token, showArchived]);

  useEffect(() => {
    if (!token || !meId) return undefined;
    const socket = io(API_BASE, { auth: { token } });
    socketRef.current = socket;

    const onMessage = (msg: ChatMessage) => {
      setItems((prev) =>
        prev.map((c) => {
          if (c.id !== msg.conversationId) return c;
          const inc = msg.senderId && meId && msg.senderId !== meId ? 1 : 0;
          return {
            ...c,
            lastMessage: msg,
            lastMessageAt: msg.createdAt,
            unreadCount: (c.unreadCount || 0) + inc,
          };
        })
      );
    };

    socket.on('message:new', onMessage);
    return () => {
      socket.off('message:new', onMessage);
      socket.disconnect();
      socketRef.current = null;
      joinedRef.current.clear();
    };
  }, [token, meId]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    items.forEach((c) => {
      if (joinedRef.current.has(c.id)) return;
      socket.emit('conversation:join', { conversationId: c.id });
      joinedRef.current.add(c.id);
    });
  }, [items]);

  const toggleArchive = async (conv: ConversationPreview) => {
    if (!token) return;
    try {
      const archive = !conv.archivedAt;
      const res = await apiPost<{ archivedAt: string | null }>(`/conversations/${conv.id}/archive`, { archive }, token);
      setItems((prev) => {
        if ((archive && !showArchived) || (!archive && showArchived)) {
          return prev.filter((c) => c.id !== conv.id);
        }
        return prev.map((c) => (c.id === conv.id ? { ...c, archivedAt: res.archivedAt } : c));
      });
      notifySuccess(archive ? 'Conversation archivée.' : 'Conversation restaurée.');
    } catch (e) {
      notifyError(e, 'Action impossible.');
    }
  };

  const togglePin = async (conv: ConversationPreview) => {
    if (!token) return;
    try {
      const pin = !conv.pinnedAt;
      const res = await apiPost<{ pinnedAt: string | null }>(`/conversations/${conv.id}/pin`, { pin }, token);
      setItems((prev) => prev.map((c) => (c.id === conv.id ? { ...c, pinnedAt: res.pinnedAt } : c)));
      notifySuccess(pin ? 'Conversation épinglée.' : 'Épinglage retiré.');
    } catch (e) {
      notifyError(e, "Impossible d'épingler.");
    }
  };

  return (
    <AdminPage title="Messages" subtitle="Conversations en temps réel">
      <AdminSection
        title="Conversations"
        subtitle="Derniers échanges, non lus et statut"
        actions={(
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className={`btn ${showArchived ? 'ghost' : ''}`} onClick={() => setShowArchived(false)}>Actifs</button>
            <button className={`btn ${showArchived ? '' : 'ghost'}`} onClick={() => setShowArchived(true)}>Archivés</button>
            <button className="btn" onClick={load}>Rafraîchir</button>
          </div>
        )}
      >
        {error ? <div className="small" style={{ color: 'var(--red)' }}>{String(error?.error || error?.message || error)}</div> : null}
        {loading ? <div className="small">Chargement...</div> : null}
        {!loading && items.length === 0 ? <div className="small">Aucune conversation.</div> : null}
        {items.length ? (
          <div className="grid cols-2" style={{ gap: 12 }}>
            {items.map((c) => {
              const other = c.members?.[0];
              const preview = getChatPreview(c.lastMessage) || 'Pas encore de message.';
              const muted = isChatMutedUntil(c.mutedUntil);
              return (
                <a key={c.id} className="panel pad" href={`/admin/messages/thread/${c.id}`} style={{ display: 'grid', gap: 6 }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontWeight: 900, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span>{other?.username || 'Utilisateur'}</span>
                      {c.pinnedAt ? <span className="badge">Épinglé</span> : null}
                      {muted ? <span className="badge neutral">Muet</span> : null}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn ghost"
                        style={{ padding: '6px 10px', fontSize: 12 }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          togglePin(c);
                        }}
                      >
                        {c.pinnedAt ? 'Désépingler' : 'Épingler'}
                      </button>
                      <button
                        className="btn ghost"
                        style={{ padding: '6px 10px', fontSize: 12 }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleArchive(c);
                        }}
                      >
                        {showArchived ? 'Restaurer' : 'Archiver'}
                      </button>
                    </div>
                  </div>
                  {c.ad ? (
                    <div className="small" style={{ opacity: 0.85 }}>
                      Annonce: {c.ad.title || c.ad.id}
                    </div>
                  ) : null}
                  <div className="small" style={{ opacity: 0.85 }}>{preview}</div>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="small">{c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleString('fr-FR') : '—'}</div>
                    {c.unreadCount ? <span className="badge warn">{c.unreadCount} non lus</span> : <span className="small">Tout est lu</span>}
                  </div>
                </a>
              );
            })}
          </div>
        ) : null}
      </AdminSection>
    </AdminPage>
  );
};

export const MessageThread = () => {
  const { token } = useAdminAuth();
  const { id } = useParams();
  const [conversation, setConversation] = useState<ConversationPreview | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [value, setValue] = useState('');
  const [typing, setTyping] = useState<string | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [mutedUntil, setMutedUntil] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const endRef = React.useRef<HTMLDivElement | null>(null);
  const socketRef = React.useRef<any>(null);
  const typingTimeout = React.useRef<number | null>(null);
  const typingActive = React.useRef(false);

  const other = conversation?.members?.[0];
  const muted = isChatMutedUntil(mutedUntil);

  const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {
    if (endRef.current) endRef.current.scrollIntoView({ behavior, block: 'end' });
  };

  const loadThread = async () => {
    if (!token || !id) return;
    try {
      const [me, convs, archivedConvs, res, blocks] = await Promise.all([
        apiGet<any>('/me', token),
        apiGet<{ items: ConversationPreview[] }>('/conversations', token),
        apiGet<{ items: ConversationPreview[] }>('/conversations?archived=1', token),
        apiGet<{ items: ChatMessage[] }>(`/conversations/${id}/messages?limit=60`, token),
        apiGet<{ items: { blocked: { id: string } }[] }>('/chat/blocks', token),
      ]);
      setMeId(me?.id || null);
      const allConvs = [...(convs.items || []), ...(archivedConvs.items || [])];
      const conv = allConvs.find((c) => c.id === id) || null;
      setConversation(conv);
      setMutedUntil(conv?.mutedUntil || null);
      setMessages(res.items || []);
      const blockIds = (blocks.items || [])
        .map((b) => b.blocked?.id)
        .filter((value): value is string => Boolean(value));
      const isBlocked = conv?.members?.some((m) => blockIds.includes(m.id)) || false;
      setBlocked(isBlocked);
      const last = res.items?.[res.items.length - 1];
      if (last?.id) {
        apiPost(`/conversations/${id}/read`, { messageId: last.id }, token).catch(() => {});
      }
      scrollToBottom();
    } catch (e) {
      notifyError(e, 'Impossible de charger la conversation.');
    }
  };

  useEffect(() => {
    void loadThread();
  }, [token, id]);

  useEffect(() => {
    if (!token || !id) return undefined;
    const socket = io(API_BASE, { auth: { token } });
    socketRef.current = socket;
    socket.emit('conversation:join', { conversationId: id });
    socket.on('message:new', (msg: ChatMessage) => {
      if (msg?.conversationId !== id) return;
      setMessages((prev) => [...prev, msg]);
      apiPost(`/conversations/${id}/read`, { messageId: msg.id }, token).catch(() => {});
      scrollToBottom('smooth');
    });
    socket.on('typing', (payload: any) => {
      if (payload?.conversationId !== id) return;
      setTyping(payload?.isTyping ? payload?.userId : null);
    });
    socket.on('message:read', (payload: any) => {
      if (payload?.conversationId !== id) return;
      if (!payload?.messageId || !payload?.userId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === payload.messageId
            ? {
              ...m,
              reads: (m.reads || []).some((r) => r.userId === payload.userId)
                ? m.reads
                : [...(m.reads || []), { userId: payload.userId, readAt: payload.readAt }],
            }
            : m
        )
      );
    });
    socket.on('message:reaction', (payload: any) => {
      if (!payload?.messageId || !payload?.emoji || !payload?.userId) return;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== payload.messageId) return m;
          const current = m.reactions || [];
          if (payload.action === 'removed') {
            return {
              ...m,
              reactions: current.filter((r) => !(r.userId === payload.userId && r.emoji === payload.emoji)),
            };
          }
          return {
            ...m,
            reactions: [...current, { emoji: payload.emoji, userId: payload.userId }],
          };
        })
      );
    });
    return () => {
      socket.disconnect();
      socketRef.current = null;
      if (typingTimeout.current) window.clearTimeout(typingTimeout.current);
    };
  }, [token, id]);

  const uploadFile = async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_BASE}/media/upload`, {
      method: 'POST',
      body: form,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) {
      let err: any = { status: res.status };
      try { err = { ...err, ...(await res.json()) }; } catch {}
      throw err;
    }
    return res.json();
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const spaceLeft = MAX_CHAT_ATTACHMENTS - attachments.length;
    if (spaceLeft <= 0) {
      notifyInfo(`Maximum ${MAX_CHAT_ATTACHMENTS} pièces jointes.`);
      return;
    }
    const nextFiles = Array.from(files).slice(0, spaceLeft);
    setUploading(true);
    try {
      const uploaded: ChatAttachment[] = [];
      for (const file of nextFiles) {
        const data = await uploadFile(file);
        uploaded.push({
          url: data.url,
          mime: data.mime,
          size: data.size,
          type: data.mime && String(data.mime).startsWith('image/') ? 'image' : 'file',
        });
      }
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (e) {
      notifyError(e, 'Erreur upload.');
    } finally {
      setUploading(false);
    }
  };

  const sendTyping = (active: boolean) => {
    const socket = socketRef.current;
    if (!socket || !id) return;
    socket.emit(active ? 'typing:start' : 'typing:stop', { conversationId: id });
  };

  const handleTyping = (next: string) => {
    setValue(next);
    if (!next && typingActive.current) {
      typingActive.current = false;
      sendTyping(false);
      return;
    }
    if (!typingActive.current && next) {
      typingActive.current = true;
      sendTyping(true);
    }
    if (typingTimeout.current) window.clearTimeout(typingTimeout.current);
    typingTimeout.current = window.setTimeout(() => {
      typingActive.current = false;
      sendTyping(false);
    }, 1200);
  };

  const sendPayload = async (payload: { body?: string; attachments?: ChatAttachment[]; type?: string; meta?: any }) => {
    if (!id || !token) return;
    if (blocked) {
      notifyError('Utilisateur bloqué.');
      return;
    }
    const socket = socketRef.current;
    const outgoing = { conversationId: id, ...payload };
    if (socket && socket.connected) {
      socket.emit('message:send', outgoing, (ack: any) => {
        if (!ack?.ok) notifyError(ack?.error || 'Erreur envoi.');
      });
      return;
    }
    try {
      await apiPost(`/conversations/${id}/messages`, payload, token);
    } catch (e) {
      notifyError(e, 'Impossible d\'envoyer le message.');
    }
  };

  const sendMessage = async () => {
    if (!id || !token) return;
    const body = value.trim();
    if (!body && attachments.length === 0) return;
    setValue('');
    sendTyping(false);
    typingActive.current = false;
    if (typingTimeout.current) window.clearTimeout(typingTimeout.current);
    const isVoice = !body && attachments.length > 0 && attachments.every((att) => isChatAudioAttachment(att));
    const type = isVoice ? 'voice' : 'text';
    const payload = { body, attachments, type };
    setAttachments([]);
    await sendPayload(payload);
  };

  const sendSticker = async (emoji: string) => {
    if (!emoji) return;
    await sendPayload({ body: emoji, type: 'sticker' });
  };

  const sendCallInvite = async () => {
    if (!id) return;
    const roomId = `lodix-${id}-${Date.now()}`;
    const url = `https://meet.jit.si/${roomId}`;
    await sendPayload({ body: 'Appel audio', type: 'call', meta: { provider: 'jitsi', roomId, url } });
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!token || !meId) return;
    try {
      const res = await apiPost<{ action: string; emoji: string; messageId: string }>(`/messages/${messageId}/reactions`, { emoji }, token);
      if (!res?.action) return;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== res.messageId) return m;
          const current = m.reactions || [];
          if (res.action === 'removed') {
            return { ...m, reactions: current.filter((r) => !(r.userId === meId && r.emoji === res.emoji)) };
          }
          return { ...m, reactions: [...current, { emoji: res.emoji, userId: meId }] };
        })
      );
    } catch (e) {
      notifyError(e, 'Réaction impossible.');
    }
  };

  const reportMessage = async (messageId: string) => {
    const reason = window.prompt('Raison du signalement (optionnel)') || '';
    try {
      await apiPost('/chat/report', { messageId, reason }, token);
      notifySuccess('Message signalé.');
    } catch (e) {
      notifyError(e, 'Signalement impossible.');
    }
  };

  const toggleBlock = async () => {
    if (!other?.id || !token) return;
    try {
      if (blocked) {
        await apiDelete(`/chat/block/${other.id}`, token);
        setBlocked(false);
        notifySuccess('Utilisateur débloqué.');
      } else {
        const reason = window.prompt('Raison du blocage (optionnel)') || '';
        await apiPost('/chat/block', { userId: other.id, reason }, token);
        setBlocked(true);
        notifySuccess('Utilisateur bloqué.');
      }
    } catch (e) {
      notifyError(e, 'Action impossible.');
    }
  };

  const toggleMute = async () => {
    if (!id || !token) return;
    try {
      if (muted) {
        const res = await apiPost<{ mutedUntil: string | null }>(`/conversations/${id}/mute`, { mute: false }, token);
        setMutedUntil(res.mutedUntil || null);
        notifySuccess('Notifications réactivées.');
      } else {
        const res = await apiPost<{ mutedUntil: string | null }>(`/conversations/${id}/mute`, { mute: true, durationMinutes: 7 * 24 * 60 }, token);
        setMutedUntil(res.mutedUntil || null);
        notifySuccess('Conversation mise en sourdine (7 jours).');
      }
    } catch (e) {
      notifyError(e, 'Impossible de mettre en sourdine.');
    }
  };

  const toggleArchive = async () => {
    if (!id || !token) return;
    try {
      const archive = !conversation?.archivedAt;
      const res = await apiPost<{ archivedAt: string | null }>(`/conversations/${id}/archive`, { archive }, token);
      setConversation((prev) => (prev ? { ...prev, archivedAt: res.archivedAt } : prev));
      notifySuccess(archive ? 'Conversation archivée.' : 'Conversation restaurée.');
    } catch (e) {
      notifyError(e, "Impossible d'archiver.");
    }
  };

  const togglePin = async () => {
    if (!id || !token) return;
    try {
      const pin = !conversation?.pinnedAt;
      const res = await apiPost<{ pinnedAt: string | null }>(`/conversations/${id}/pin`, { pin }, token);
      setConversation((prev) => (prev ? { ...prev, pinnedAt: res.pinnedAt } : prev));
      notifySuccess(pin ? 'Conversation épinglée.' : 'Épinglage retiré.');
    } catch (e) {
      notifyError(e, "Impossible d'épingler.");
    }
  };

  const handleSearch = async (queryArg?: string) => {
    if (!id || !token) return;
    const query = (typeof queryArg === 'string' ? queryArg : searchQuery).trim();
    setSearching(true);
    try {
      const q = query ? `&q=${encodeURIComponent(query)}` : '';
      const res = await apiGet<{ items: ChatMessage[] }>(`/conversations/${id}/messages?limit=60${q}`, token);
      setMessages(res.items || []);
      if (!query) {
        const last = res.items?.[res.items.length - 1];
        if (last?.id) {
          apiPost(`/conversations/${id}/read`, { messageId: last.id }, token).catch(() => {});
        }
      }
    } catch (e) {
      notifyError(e, 'Recherche impossible.');
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = async () => {
    setSearchQuery('');
    await handleSearch('');
  };

  const warningLabels: Record<string, string> = {
    CONTAINS_LINKS: 'Contient des liens',
    SENSITIVE_KEYWORDS: 'Contenu sensible',
    SPAM_SUSPECT: 'Message suspect',
  };

  return (
    <AdminPage title="Conversation" subtitle={other?.username || 'Messagerie'}>
      <AdminSection
        title="Fil de discussion"
        subtitle={typing ? 'En train d\'écrire...' : 'Messages en temps réel'}
        actions={(
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button className="btn ghost" onClick={sendCallInvite}>Appeler</button>
            <button className="btn ghost" onClick={togglePin}>{conversation?.pinnedAt ? 'Désépingler' : 'Épingler'}</button>
            <button className="btn ghost" onClick={toggleArchive}>{conversation?.archivedAt ? 'Restaurer' : 'Archiver'}</button>
            <button className="btn ghost" onClick={toggleMute}>{muted ? 'Réactiver' : 'Sourdine 7j'}</button>
            <button className="btn ghost" onClick={toggleBlock}>{blocked ? 'Débloquer' : 'Bloquer'}</button>
          </div>
        )}
      >
        {conversation?.ad ? (
          <div className="small" style={{ marginBottom: 8 }}>
            Annonce: <a href={`/admin/ads/view/${conversation.ad.id}`}>{conversation.ad.title || conversation.ad.id}</a>
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
          <input
            className="input"
            style={{ minWidth: 220 }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher dans la conversation"
          />
          <button className="btn ghost" onClick={() => handleSearch()} disabled={searching}>
            {searching ? 'Recherche...' : 'Rechercher'}
          </button>
          {searchQuery ? (
            <button className="btn ghost" onClick={clearSearch}>Effacer</button>
          ) : null}
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          {messages.map((m) => {
            const mine = meId && m.senderId === meId;
            const readByOther = mine && m.reads?.some((r) => r.userId !== meId);
            const messageType = m.type || 'text';
            const bubbleStyle: React.CSSProperties = {
              maxWidth: '70%',
              padding: 14,
              borderRadius: 16,
              border: mine ? '1px solid rgba(0,0,0,.05)' : '1px solid rgba(0,0,0,.12)',
              background: mine ? 'linear-gradient(120deg, var(--accent), var(--accent2))' : 'rgba(255,255,255,.92)',
              color: mine ? '#fff' : 'var(--text)',
            };
            const attachmentList = m.attachments || [];
            const reactionGroups = groupChatReactions(m.reactions || [], meId);
            const warningList = (m.warning || '')
              .split(',')
              .map((w) => w.trim())
              .filter(Boolean)
              .map((w) => warningLabels[w] || w);
            const callUrl = m.meta?.url || m.meta?.link;
            return (
              <div key={m.id} style={{ display: 'grid', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                  <div style={bubbleStyle}>
                    <div className="small" style={{ color: mine ? 'rgba(255,255,255,.8)' : 'var(--muted)' }}>
                      {m.sender?.username || m.senderId}
                    </div>
                    {warningList.length ? (
                      <div className="small" style={{ marginTop: 6, color: mine ? 'rgba(255,255,255,.8)' : 'var(--muted)' }}>
                        {warningList.join(' · ')}
                      </div>
                    ) : null}
                    {messageType === 'sticker' ? (
                      <div style={{ marginTop: 8, fontSize: 32 }}>{m.body}</div>
                    ) : null}
                    {messageType !== 'sticker' && m.body ? (
                      <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{m.body}</div>
                    ) : null}
                    {messageType === 'call' ? (
                      <div className="panel pad" style={{ marginTop: 10, background: 'rgba(255,255,255,.15)' }}>
                        <div style={{ fontWeight: 700 }}>Invitation à un appel audio</div>
                        <div className="small" style={{ marginTop: 4 }}>Clique pour rejoindre.</div>
                        {callUrl ? (
                          <a className="btn ghost" style={{ marginTop: 8 }} href={callUrl} target="_blank" rel="noreferrer">
                            Rejoindre
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                    {attachmentList.length ? (
                      <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                        {attachmentList.map((att, idx) => {
                          const url = resolveChatMediaUrl(att.url);
                          if (isChatAudioAttachment(att)) {
                            return (
                              <audio key={`${att.url}-${idx}`} controls style={{ width: '100%' }}>
                                <source src={url} />
                              </audio>
                            );
                          }
                          if (isChatImageAttachment(att)) {
                            return (
                              <img
                                key={`${att.url}-${idx}`}
                                src={url}
                                alt={att.type || 'attachment'}
                                style={{ width: '100%', borderRadius: 12, maxHeight: 240, objectFit: 'cover' }}
                              />
                            );
                          }
                          return (
                            <a key={`${att.url}-${idx}`} href={url} target="_blank" rel="noreferrer" className="small">
                              {att.url}
                            </a>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
                {reactionGroups.length ? (
                  <div style={{ display: 'flex', gap: 6, justifyContent: mine ? 'flex-end' : 'flex-start', flexWrap: 'wrap' }}>
                    {reactionGroups.map((r) => (
                      <button
                        key={`${m.id}-${r.emoji}`}
                        className={`btn ${r.reacted ? 'primary' : 'ghost'}`}
                        style={{ padding: '4px 8px', fontSize: 12 }}
                        onClick={() => handleReaction(m.id, r.emoji)}
                      >
                        {r.emoji} {r.count}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div style={{ display: 'flex', gap: 6, justifyContent: mine ? 'flex-end' : 'flex-start', flexWrap: 'wrap' }}>
                  {ADMIN_REACTIONS.map((emoji) => (
                    <button
                      key={`${m.id}-${emoji}`}
                      className="btn ghost"
                      style={{ padding: '4px 8px', fontSize: 12 }}
                      onClick={() => handleReaction(m.id, emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <div className="row" style={{ justifyContent: mine ? 'flex-end' : 'flex-start', gap: 10 }}>
                  <div className="small" style={{ opacity: 0.7 }}>{new Date(m.createdAt).toLocaleString('fr-FR')}</div>
                  {mine ? <div className="small">{readByOther ? 'Lu' : 'Envoyé'}</div> : null}
                  {!mine ? (
                    <button className="btn ghost" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => reportMessage(m.id)}>
                      Signaler
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        {attachments.length ? (
          <div className="panel pad" style={{ marginTop: 12 }}>
            <div className="small">Pièces jointes ({attachments.length}/{MAX_CHAT_ATTACHMENTS})</div>
            <div className="grid cols-4" style={{ gap: 10, marginTop: 10 }}>
              {attachments.map((att, idx) => {
                const url = resolveChatMediaUrl(att.url);
                return (
                  <div key={`${att.url}-${idx}`} style={{ position: 'relative' }}>
                    {isChatImageAttachment(att) ? (
                      <img src={url} alt="attachment" style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 10 }} />
                    ) : (
                      <div className="panel pad" style={{ height: 120, display: 'grid', placeItems: 'center' }}>
                        <div className="small">Fichier</div>
                      </div>
                    )}
                    <button
                      className="btn ghost"
                      style={{ position: 'absolute', top: 6, right: 6, padding: '6px 10px', fontSize: 12 }}
                      onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      Retirer
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
          <label className="btn ghost">
            Ajouter un fichier
            <input type="file" multiple style={{ display: 'none' }} onChange={(e) => handleFiles(e.target.files)} />
          </label>
          {uploading ? <div className="small">Téléchargement...</div> : null}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
          <div className="small">Stickers</div>
          {ADMIN_STICKERS.map((emoji) => (
            <button
              key={`admin-sticker-${emoji}`}
              className="btn ghost"
              style={{ padding: '4px 8px', fontSize: 16 }}
              onClick={() => sendSticker(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input
            className="input"
            value={value}
            onChange={(e) => handleTyping(e.target.value)}
            placeholder={blocked ? 'Utilisateur bloqué.' : 'Écrire un message...'}
            disabled={blocked || uploading}
          />
          <button className="btn primary" onClick={sendMessage} disabled={blocked || uploading}>Envoyer</button>
        </div>
      </AdminSection>
    </AdminPage>
  );
};

export const Alerts = () => {
  const { token } = useAdminAuth();
  const [items, setItems] = useState<AdminAlert[]>([]);
  const [status, setStatus] = useState('OPEN');
  const [type, setType] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (status) q.set('status', status);
      if (type) q.set('type', type);
      const res = await apiGet<{ items: AdminAlert[] }>(`/admin/alerts?${q.toString()}`, token);
      setItems(res.items || []);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [token, status, type]);

  const ackAlert = async (id: string) => {
    if (!token) return;
    await apiPost(`/admin/alerts/${id}/ack`, {}, token);
    load();
  };

  const resolveAlert = async (id: string) => {
    if (!token) return;
    await apiPost(`/admin/alerts/${id}/resolve`, {}, token);
    load();
  };

  return (
    <AdminPage
      title="Alertes"
      subtitle="Fraude / paiement / chargeback."
      actions={<button className="btn" onClick={load} disabled={loading}>{loading ? 'Chargement…' : 'Rafraîchir'}</button>}
    >
      <AdminSection title="Filtres">
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div className="small">Statut</div>
            <Select className="input" value={status} onChange={setStatus} ariaLabel="Statut">
              <option value="">Tous</option>
              <option value="OPEN">Ouvert</option>
              <option value="ACK">Ack</option>
              <option value="RESOLVED">Résolu</option>
            </Select>
          </div>
          <div>
            <div className="small">Type</div>
            <Select className="input" value={type} onChange={setType} ariaLabel="Type">
              <option value="">Tous</option>
              <option value="FRAUD">Fraude</option>
              <option value="PAYMENT">Paiement</option>
              <option value="CHARGEBACK">Chargeback</option>
            </Select>
          </div>
        </div>
      </AdminSection>

      <AdminSection title="Alertes">
        {error ? <div className="small">Erreur: {String(error?.error || error?.message || error)}</div> : null}
        {items.length === 0 ? <div className="small">Aucune alerte.</div> : (
          <div style={{ display: 'grid', gap: 10 }}>
            {items.map((a) => (
              <div key={a.id} className="panel pad">
                <div className="row" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 900 }}>{a.title}</div>
                    <div className="small">{a.type} · {a.status} · {new Date(a.createdAt).toLocaleString('fr-FR')}</div>
                    {a.message ? <div className="small">{a.message}</div> : null}
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    {a.status === 'OPEN' ? <button className="btn ghost" onClick={() => ackAlert(a.id)}>Ack</button> : null}
                    {a.status !== 'RESOLVED' ? <button className="btn" onClick={() => resolveAlert(a.id)}>Résoudre</button> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminSection>
    </AdminPage>
  );
};

export const SupportTickets = () => {
  const { token, admin } = useAdminAuth();
  const [items, setItems] = useState<SupportTicket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SupportTicket | null>(null);
  const [status, setStatus] = useState('OPEN');
  const [priority, setPriority] = useState('');
  const [message, setMessage] = useState('');
  const [internalNote, setInternalNote] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (status) q.set('status', status);
      if (priority) q.set('priority', priority);
      const res = await apiGet<{ items: SupportTicket[] }>(`/admin/support/tickets?${q.toString()}`, token);
      setItems(res.items || []);
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: string) => {
    if (!token) return;
    const res = await apiGet<{ item: SupportTicket }>(`/admin/support/tickets/${id}`, token);
    setDetail(res.item);
  };

  useEffect(() => {
    load();
  }, [token, status, priority]);

  useEffect(() => {
    if (!selectedId) return;
    loadDetail(selectedId);
  }, [selectedId]);

  const assignToMe = async () => {
    if (!token || !detail) return;
    await apiPost(`/admin/support/tickets/${detail.id}/assign`, { assigneeId: admin?.id || null }, token);
    loadDetail(detail.id);
    load();
  };

  const updateStatus = async (next: string) => {
    if (!token || !detail) return;
    await apiPost(`/admin/support/tickets/${detail.id}/status`, { status: next }, token);
    loadDetail(detail.id);
    load();
  };

  const sendReply = async () => {
    if (!token || !detail || !message.trim()) return;
    await apiPost(`/admin/support/tickets/${detail.id}/messages`, { message, isInternal: internalNote }, token);
    setMessage('');
    loadDetail(detail.id);
    load();
  };

  return (
    <AdminPage
      title="Support"
      subtitle="Tickets utilisateurs."
      actions={<button className="btn" onClick={load} disabled={loading}>{loading ? 'Chargement…' : 'Rafraîchir'}</button>}
    >
      <AdminSection title="Filtres">
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div className="small">Statut</div>
            <Select className="input" value={status} onChange={setStatus} ariaLabel="Statut">
              <option value="">Tous</option>
              <option value="OPEN">Ouvert</option>
              <option value="PENDING">En attente</option>
              <option value="CLOSED">Clos</option>
            </Select>
          </div>
          <div>
            <div className="small">Priorité</div>
            <Select className="input" value={priority} onChange={setPriority} ariaLabel="Priorité">
              <option value="">Toutes</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </Select>
          </div>
        </div>
      </AdminSection>

      <AdminSection title="Tickets">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 12 }}>
          <div className="panel pad" style={{ display: 'grid', gap: 8, maxHeight: 520, overflow: 'auto' }}>
            {items.length === 0 ? <div className="small">Aucun ticket.</div> : items.map((t) => (
              <button
                key={t.id}
                className="panel pad"
                style={{ textAlign: 'left', borderStyle: selectedId === t.id ? 'solid' : 'dashed' }}
                onClick={() => setSelectedId(t.id)}
              >
                <div style={{ fontWeight: 900 }}>{t.subject}</div>
                <div className="small">{t.user?.username || t.user?.email || t.user?.id}</div>
                <div className="small">{t.status} · {t.priority}</div>
              </button>
            ))}
          </div>
          <div className="panel pad">
            {!detail ? <div className="small">Sélectionnez un ticket.</div> : (
              <div style={{ display: 'grid', gap: 12 }}>
                <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 900 }}>{detail.subject}</div>
                    <div className="small">{detail.status} · {detail.priority}</div>
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <button className="btn ghost" onClick={assignToMe}>Assigner à moi</button>
                    <button className="btn" onClick={() => updateStatus('CLOSED')}>Clôturer</button>
                  </div>
                </div>
                <div style={{ display: 'grid', gap: 8, maxHeight: 320, overflow: 'auto' }}>
                  {(detail.messages || []).map((m) => (
                    <div key={m.id} className="panel pad" style={{ padding: 10, background: m.isInternal ? 'rgba(0,0,0,.04)' : undefined }}>
                      <div className="small">{m.sender?.username || m.sender?.id} · {new Date(m.createdAt).toLocaleString('fr-FR')}</div>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{m.body}</div>
                    </div>
                  ))}
                </div>
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <Checkbox className="compact" checked={internalNote} onChange={setInternalNote} label="Note interne" />
                  <Select className="input" value={detail.status} onChange={(value) => updateStatus(value)} ariaLabel="Status">
                    <option value="OPEN">Ouvert</option>
                    <option value="PENDING">En attente</option>
                    <option value="CLOSED">Clos</option>
                  </Select>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <input className="input" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Réponse..." />
                  <button className="btn primary" onClick={sendReply}>Envoyer</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </AdminSection>
    </AdminPage>
  );
};

export const Roles = () => {
  const { token } = useAdminAuth();
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [perms, setPerms] = useState<AdminPermission[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [permSelection, setPermSelection] = useState<string[]>([]);
  const [newRole, setNewRole] = useState({ name: '', description: '' });
  const [assignUserId, setAssignUserId] = useState('');
  const [assignRoles, setAssignRoles] = useState<string[]>([]);

  const load = async () => {
    if (!token) return;
    const [r, p] = await Promise.all([
      apiGet<{ items: AdminRole[] }>('/admin/rbac/roles', token),
      apiGet<{ items: AdminPermission[] }>('/admin/rbac/permissions', token),
    ]);
    setRoles(r.items || []);
    setPerms(p.items || []);
  };

  useEffect(() => {
    load();
  }, [token]);

  useEffect(() => {
    const role = roles.find((r) => r.id === selectedRoleId);
    if (!role) {
      setPermSelection([]);
      return;
    }
    setPermSelection((role.permissions || []).map((p) => p.permission.id));
  }, [selectedRoleId, roles]);

  const createRole = async () => {
    if (!token || !newRole.name.trim()) return;
    await apiPost('/admin/rbac/roles', newRole, token);
    setNewRole({ name: '', description: '' });
    load();
  };

  const savePermissions = async () => {
    if (!token || !selectedRoleId) return;
    await apiPut(`/admin/rbac/roles/${selectedRoleId}/permissions`, { permissionIds: permSelection }, token);
    load();
  };

  const updateAssign = async () => {
    if (!token || !assignUserId.trim()) return;
    await apiPut(`/admin/rbac/users/${assignUserId}/roles`, { roleIds: assignRoles }, token);
    setAssignUserId('');
    setAssignRoles([]);
  };

  return (
    <AdminPage title="Rôles" subtitle="Gestion des rôles (RBAC).">
      <AdminSection title="Créer un rôle">
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <input className="input" placeholder="Nom" value={newRole.name} onChange={(e) => setNewRole({ ...newRole, name: e.target.value })} />
          <input className="input" placeholder="Description" value={newRole.description} onChange={(e) => setNewRole({ ...newRole, description: e.target.value })} />
          <button className="btn primary" onClick={createRole}>Créer</button>
        </div>
      </AdminSection>

      <AdminSection title="Rôles existants">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 12 }}>
          <div className="panel pad" style={{ display: 'grid', gap: 8 }}>
            {roles.map((r) => (
              <button
                key={r.id}
                className="panel pad"
                style={{ textAlign: 'left', borderStyle: selectedRoleId === r.id ? 'solid' : 'dashed' }}
                onClick={() => setSelectedRoleId(r.id)}
              >
                <div style={{ fontWeight: 900 }}>{r.name}</div>
                <div className="small">{r.description || '—'} · {r._count?.users || 0} users</div>
              </button>
            ))}
          </div>
          <div className="panel pad">
            {!selectedRoleId ? <div className="small">Sélectionnez un rôle.</div> : (
              <div style={{ display: 'grid', gap: 10 }}>
                <div className="small">Permissions</div>
                <div className="grid cols-2">
                  {perms.map((p) => (
                    <Checkbox
                      key={p.id}
                      checked={permSelection.includes(p.id)}
                      onChange={(next) => {
                        setPermSelection((prev) => next ? [...prev, p.id] : prev.filter((id) => id !== p.id));
                      }}
                      label={p.key}
                    />
                  ))}
                </div>
                <button className="btn primary" onClick={savePermissions}>Enregistrer</button>
              </div>
            )}
          </div>
        </div>
      </AdminSection>

      <AdminSection title="Assigner des rôles">
        <div className="panel pad" style={{ display: 'grid', gap: 10 }}>
          <input className="input" placeholder="User ID" value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)} />
          <div className="row wrap" style={{ gap: 8 }}>
            {roles.map((r) => (
              <Checkbox
                key={`assign-${r.id}`}
                className="compact"
                checked={assignRoles.includes(r.id)}
                onChange={(next) => {
                  setAssignRoles((prev) => next ? [...prev, r.id] : prev.filter((id) => id !== r.id));
                }}
                label={r.name}
              />
            ))}
          </div>
          <button className="btn primary" onClick={updateAssign}>Assigner</button>
        </div>
      </AdminSection>
    </AdminPage>
  );
};

export const Permissions = () => {
  const { token } = useAdminAuth();
  const [items, setItems] = useState<AdminPermission[]>([]);
  const [form, setForm] = useState({ key: '', description: '' });

  const load = async () => {
    if (!token) return;
    const res = await apiGet<{ items: AdminPermission[] }>('/admin/rbac/permissions', token);
    setItems(res.items || []);
  };

  useEffect(() => {
    load();
  }, [token]);

  const createPerm = async () => {
    if (!token || !form.key.trim()) return;
    await apiPost('/admin/rbac/permissions', form, token);
    setForm({ key: '', description: '' });
    load();
  };

  return (
    <AdminPage title="Permissions" subtitle="Gestion des permissions (RBAC).">
      <AdminSection title="Créer une permission">
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <input className="input" placeholder="clé (ex: admin.support.manage)" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} />
          <input className="input" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <button className="btn primary" onClick={createPerm}>Créer</button>
        </div>
      </AdminSection>
      <AdminSection title="Liste">
        <div style={{ display: 'grid', gap: 8 }}>
          {items.map((p) => (
            <div key={p.id} className="panel pad">
              <div style={{ fontWeight: 900 }}>{p.key}</div>
              <div className="small">{p.description || '—'}</div>
            </div>
          ))}
        </div>
      </AdminSection>
    </AdminPage>
  );
};

export const AuditLogs = () => {
  const { token } = useAdminAuth();
  const [items, setItems] = useState<AdminAuditLog[]>([]);
  const [action, setAction] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (action) q.set('action', action);
      const res = await apiGet<{ items: AdminAuditLog[] }>(`/admin/audit-logs?${q.toString()}`, token);
      setItems(res.items || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [token, action]);

  return (
    <AdminPage title="Audit Logs" subtitle="Historique des actions." actions={<button className="btn" onClick={load} disabled={loading}>{loading ? 'Chargement…' : 'Rafraîchir'}</button>}>
      <AdminSection title="Filtres">
        <input className="input" placeholder="Filtrer par action (ex: ad.approve)" value={action} onChange={(e) => setAction(e.target.value)} />
      </AdminSection>
      <AdminSection title="Logs">
        {items.length === 0 ? <div className="small">Aucun log.</div> : (
          <div style={{ display: 'grid', gap: 8 }}>
            {items.map((l) => (
              <div key={l.id} className="panel pad">
                <div style={{ fontWeight: 900 }}>{l.action}</div>
                <div className="small">{l.actor?.username || l.actor?.email || 'system'} · {new Date(l.createdAt).toLocaleString('fr-FR')}</div>
                {l.entityType ? <div className="small">{l.entityType} · {l.entityId}</div> : null}
              </div>
            ))}
          </div>
        )}
      </AdminSection>
    </AdminPage>
  );
};

export const BoostPricing = () => <AdminPage title="Boost Pricing" subtitle="Tarifs des boosts." />;
export const BoostRules = () => <AdminPage title="Boost Rules" subtitle="Règles des boosts." />;
export const Pages = () => <AdminPage title="Pages CMS" subtitle="Gestion des pages." />;
export const Faq = () => <AdminPage title="FAQ" subtitle="Gestion de la FAQ." />;
export const Emails = () => <AdminPage title="Templates emails" subtitle="Gestion des templates emails." />;
export const Countries = () => <AdminPage title="Pays" subtitle="Gestion des pays." />;
export const Cities = () => <AdminPage title="Villes" subtitle="Gestion des villes." />;
export const Currencies = () => <AdminPage title="Devises" subtitle="Gestion des devises." />;
export const Reports = () => <AdminPage title="Signalements" subtitle="Signalements d’annonces." />;
export const Keywords = () => <AdminPage title="Mots interdits" subtitle="Gestion des mots interdits." />;
export const AiRules = () => <AdminPage title="Règles IA" subtitle="Règles de modération automatisée." />;
export const Settings = () => <AdminPage title="Settings" subtitle="Paramètres de l’application." />;


// ---- Exports: Moderation & Security (4.10/4.11) ----
export const ModerationQueue = () => <ModerationQueuePage />;
export const ModerationCaseDetail = () => <ModerationCaseDetailPage />;
export const ModerationStats = () => <ModerationStatsPage />;

export const SecurityBlacklist = () => <BlacklistPage />;
export const SecurityShadowban = () => <ShadowbanPage />;
export const SecurityUserIntel = () => <UserIntelPage />;
