import React from 'react';
import { apiFetch } from '../../lib/api';
import { IconChat, IconPlus, IconStar, IconTag, IconWallet } from '../../components/Icons';
import { Ad, CreditTx, ConversationPreview, ProState, Wallet } from './types';
import { tone } from './utils';
import { notifyError } from '../../lib/toast';
import { formatStatus } from '../../lib/status';
import { formatAction } from '../../lib/actions';
import { useI18n } from '../../lib/i18n';

export function D_Overview() {
  const { lang, tx } = useI18n();
  const [wallet, setWallet] = React.useState<Wallet | null>(null);
  const [txs, setTxs] = React.useState<CreditTx[]>([]);
  const [ads, setAds] = React.useState<Ad[]>([]);
  const [pro, setPro] = React.useState<ProState | null>(null);
  const [conversations, setConversations] = React.useState<ConversationPreview[]>([]);
  const [error, setError] = React.useState<any>(null);

  React.useEffect(() => {
    let alive = true;
    Promise.allSettled([
      apiFetch<{ wallet: Wallet; txs: CreditTx[] }>('/credits/wallet'),
      apiFetch<{ items: Ad[] }>('/ads/mine'),
      apiFetch<ProState>('/pro/me'),
      apiFetch<{ items: ConversationPreview[] }>('/conversations'),
    ])
      .then((results) => {
        if (!alive) return;
        const [walletRes, adsRes, proRes, convRes] = results;
        if (walletRes.status === 'fulfilled') {
          setWallet(walletRes.value.wallet);
          setTxs(walletRes.value.txs || []);
        }
        if (adsRes.status === 'fulfilled') setAds(adsRes.value.items || []);
        if (proRes.status === 'fulfilled') setPro(proRes.value || null);
        if (convRes.status === 'fulfilled') setConversations(convRes.value.items || []);
        const anyRejected = results.some((r) => r.status === 'rejected');
        if (anyRejected) {
          setError({ error: 'PARTIAL' });
          notifyError(tx('Certaines données sont indisponibles.', 'Some data is unavailable.'));
        }
      })
      .catch((err) => {
        setError(err);
        notifyError(err, tx('Erreur de chargement du dashboard.', 'Unable to load dashboard.'));
      });
    return () => { alive = false; };
  }, [tx]);

  const balance = wallet?.balance ?? 0;
  const adsTotal = ads.length;
  const adsPending = ads.filter((a) => a.status === 'PENDING_REVIEW').length;
  const adsPublished = ads.filter((a) => a.status === 'PUBLISHED').length;
  const unreadTotal = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  const recentAds = ads.slice(0, 3);
  const recentTxs = txs.slice(0, 3);
  const recentConvs = conversations.slice(0, 3);

  return (
    <div className="panel pad">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <h1 className="h1">{tx('Dashboard', 'Dashboard')}</h1>
          <div className="small">{tx('Vue rapide de ton activité et de tes actions clés.', 'Quick view of your activity and key actions.')}</div>
        </div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <a className="btn primary" href="/dashboard/ads/create"><IconPlus /> {tx('Déposer une annonce', 'Post an ad')}</a>
          <a className="btn" href="/dashboard/messages/threads"><IconChat /> {tx('Messages', 'Messages')}</a>
          <a className="btn" href="/dashboard/wallet/credits"><IconWallet /> {tx('Recharger mes crédits', 'Top up credits')}</a>
          <a className="btn ghost" href="/dashboard/subscriptions/pro"><IconStar /> {tx('Passer PRO', 'Go PRO')}</a>
        </div>
      </div>

      {error ? <div className="small" style={{ marginTop: 8 }}>{tx('Connecte-toi pour voir tes données.', 'Log in to see your data.')}</div> : null}

      <div className="grid cols-3" style={{ marginTop: 16 }}>
        <div className="panel pad kpiCard teal">
          <div className="kpiTitle">
            <span className="iconBubble teal"><IconWallet /></span>
            {tx('Solde crédits', 'Credit balance')}
          </div>
          <div className="kpiValue">{balance}</div>
          <div className="kpiMeta">{tx('Transactions récentes', 'Recent transactions')}: {txs.length}</div>
        </div>
        <div className="panel pad kpiCard sun">
          <div className="kpiTitle">
            <span className="iconBubble sun"><IconTag /></span>
            {tx('Annonces', 'Listings')}
          </div>
          <div className="kpiValue">{adsTotal}</div>
          <div className="kpiMeta">{adsPublished} {tx('publiées', 'published')} · {adsPending} {tx('en revue', 'in review')}</div>
        </div>
        <div className="panel pad kpiCard indigo">
          <div className="kpiTitle">
            <span className="iconBubble indigo"><IconChat /></span>
            {tx('Messages', 'Messages')}
          </div>
          <div className="kpiValue">{conversations.length}</div>
          <div className="kpiMeta">{unreadTotal} {tx('non lus', 'unread')}</div>
        </div>
      </div>

      <div className="grid cols-2" style={{ marginTop: 18 }}>
        <div className="panel pad">
          <div className="row" style={{ gap: 10 }}>
            <span className="iconBubble rose"><IconStar /></span>
            <div className="h2">{tx('Statut PRO', 'PRO status')}</div>
          </div>
          <div className="small" style={{ marginTop: 6 }}>
            {pro?.active ? (
              <>✅ {tx('PRO actif', 'PRO active')} — {tx('plan', 'plan')} <b>{pro.active.plan}</b> {tx('jusqu\'au', 'until')} <b>{new Date(pro.active.endAt).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB')}</b>.</>
            ) : (
              <>{tx('Tu es en compte standard.', 'You are on a standard account.')}</>
            )}
          </div>
          <div style={{ marginTop: 12 }}>
            <a className="btn" href="/dashboard/subscriptions/pro">{tx('Gérer mon abonnement', 'Manage subscription')}</a>
          </div>
        </div>
        <div className="panel pad">
          <div className="row" style={{ gap: 10 }}>
            <span className="iconBubble indigo"><IconChat /></span>
            <div className="h2">{tx('Derniers messages', 'Latest messages')}</div>
          </div>
          <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
            {recentConvs.length === 0 ? <div className="small">{tx('Aucune conversation.', 'No conversations.')}</div> : null}
            {recentConvs.map((c) => (
              <a key={c.id} className="panel pad" href={`/dashboard/messages/thread/${c.id}`}>
                <div style={{ fontWeight: 800 }}>{c.members?.[0]?.username || tx('Utilisateur', 'User')}</div>
                <div className="small" style={{ marginTop: 4 }}>{c.lastMessage?.body || tx('Pièce jointe', 'Attachment')}</div>
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="grid cols-2" style={{ marginTop: 18 }}>
        <div className="panel pad">
          <div className="row" style={{ gap: 10 }}>
            <span className="iconBubble sun"><IconTag /></span>
            <div className="h2">{tx('Annonces récentes', 'Recent listings')}</div>
          </div>
          <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
            {recentAds.length === 0 ? <div className="small">{tx('Aucune annonce.', 'No listings.')}</div> : null}
            {recentAds.map((a) => (
              <div key={a.id} className="panel pad" style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{a.title}</div>
                  <div className="small">{a.city}, {a.country} — {a.categorySlug}</div>
                </div>
                <span className={`badge ${tone(a.status)}`}>{formatStatus(a.status, tx)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="panel pad">
          <div className="row" style={{ gap: 10 }}>
            <span className="iconBubble teal"><IconWallet /></span>
            <div className="h2">{tx('Dernières transactions', 'Latest transactions')}</div>
          </div>
          <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
            {recentTxs.length === 0 ? <div className="small">{tx('Aucune transaction.', 'No transactions.')}</div> : null}
            {recentTxs.map((t) => (
              <div key={t.id} className="panel pad" style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 800 }}>
                    {t.meta?.packName
                      ? tx(`Achat pack ${t.meta.packName}`, `Pack purchase ${t.meta.packName}`)
                      : formatAction(t.reason, tx)}
                  </div>
                  <div className="small">{new Date(t.createdAt).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB')}</div>
                </div>
                <div style={{ fontWeight: 900 }}>{t.type === 'DEBIT' ? '-' : '+'}{t.amount}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function D_Notifications(){
  const { tx } = useI18n();
  return <div className="panel pad"><h1 className="h1">{tx('Notifications', 'Notifications')}</h1><div className="small">{tx('Aucune notification pour le moment.', 'No notifications yet.')}</div></div>;
}
export function D_Reports(){
  const { tx } = useI18n();
  return <div className="panel pad"><h1 className="h1">{tx('Mes signalements', 'My reports')}</h1><div className="small">{tx('Aucun signalement pour le moment.', 'No reports yet.')}</div></div>;
}
export function D_Settings(){
  const { tx } = useI18n();
  return <div className="panel pad"><h1 className="h1">{tx('Paramètres', 'Settings')}</h1><div className="small">{tx('Sécurité, suppression compte.', 'Security, account deletion.')}</div></div>;
}
