const ACTION_LABELS_FR: Record<string, string> = {
  PUBLISH_AD: 'Publication d’annonce',
  AD_PUBLISH: 'Publication d’annonce',
  RENEW_AD: 'Renouvellement d’annonce',
  BOOST_VIP: 'Boost VIP',
  BOOST_URGENT: 'Boost Urgent',
  BOOST_TOP: 'Boost Top',
  BOOST_HOME: 'Boost Accueil',
  PRO_SUBSCRIBE: 'Abonnement PRO',
  PACK_PURCHASE: 'Achat de pack de crédits',
};

const ACTION_LABELS_EN: Record<string, string> = {
  PUBLISH_AD: 'Ad publishing',
  AD_PUBLISH: 'Ad publishing',
  RENEW_AD: 'Ad renewal',
  BOOST_VIP: 'VIP boost',
  BOOST_URGENT: 'Urgent boost',
  BOOST_TOP: 'Top boost',
  BOOST_HOME: 'Homepage boost',
  PRO_SUBSCRIBE: 'PRO subscription',
  PACK_PURCHASE: 'Credit pack purchase',
};

export function formatAction(action?: string | null, tx?: (fr: string, en: string) => string) {
  if (!action) return tx ? tx('—', '—') : '—';
  const raw = String(action);
  const key = raw.toUpperCase();
  if (key.startsWith('CREDIT_PACK')) {
    return tx ? tx('Achat de pack de crédits', 'Credit pack purchase') : 'Achat de pack de crédits';
  }
  if (tx) {
    const fr = ACTION_LABELS_FR[key] || String(action);
    const en = ACTION_LABELS_EN[key] || String(action);
    return tx(fr, en);
  }
  return ACTION_LABELS_FR[key] || String(action);
}
