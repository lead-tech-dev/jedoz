const STATUS_LABELS_FR: Record<string, string> = {
  DRAFT: 'Brouillon',
  PENDING_REVIEW: 'En attente de validation',
  PUBLISHED: 'Publiée',
  REJECTED: 'Rejetée',
  SUSPENDED: 'Suspendue',
  EXPIRED: 'Expirée',
  DELETED: 'Supprimée',
  ACTIVE: 'Actif',
  INACTIVE: 'Inactif',
  CANCELED: 'Annulé',
  CANCELLED: 'Annulé',
  PENDING: 'En attente',
  INITIATED: 'Initialisé',
  SUCCESS: 'Réussi',
  FAILED: 'Échoué',
  REFUNDED: 'Remboursé',
  PARTIALLY_REFUNDED: 'Partiellement remboursé',
  OPEN: 'Ouvert',
  ESCALATED: 'Escaladé',
  CLOSED: 'Fermé',
  APPROVED: 'Approuvée',
  FLAGGED: 'Signalé',
  BLOCKED: 'Bloqué',
  SENT: 'Envoyé',
  PROCESSING: 'En cours',
  PAID: 'Payé',
};

const STATUS_LABELS_EN: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING_REVIEW: 'Pending review',
  PUBLISHED: 'Published',
  REJECTED: 'Rejected',
  SUSPENDED: 'Suspended',
  EXPIRED: 'Expired',
  DELETED: 'Deleted',
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  CANCELED: 'Canceled',
  CANCELLED: 'Canceled',
  PENDING: 'Pending',
  INITIATED: 'Initiated',
  SUCCESS: 'Success',
  FAILED: 'Failed',
  REFUNDED: 'Refunded',
  PARTIALLY_REFUNDED: 'Partially refunded',
  OPEN: 'Open',
  ESCALATED: 'Escalated',
  CLOSED: 'Closed',
  APPROVED: 'Approved',
  FLAGGED: 'Flagged',
  BLOCKED: 'Blocked',
  SENT: 'Sent',
  PROCESSING: 'Processing',
  PAID: 'Paid',
};

export function formatStatus(status?: string | null, tx?: (fr: string, en: string) => string) {
  if (!status) return tx ? tx('—', '—') : '—';
  const key = String(status).toUpperCase();
  if (tx) {
    const fr = STATUS_LABELS_FR[key] || String(status);
    const en = STATUS_LABELS_EN[key] || String(status);
    return tx(fr, en);
  }
  return STATUS_LABELS_FR[key] || String(status);
}
