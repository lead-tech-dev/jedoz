const ACTION_LABELS: Record<string, string> = {
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

export function formatAction(action?: string | null) {
  if (!action) return '—';
  const key = String(action).toUpperCase();
  return ACTION_LABELS[key] || String(action);
}
