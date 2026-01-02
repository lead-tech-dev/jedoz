const STATUS_LABELS: Record<string, string> = {
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

export function formatStatus(status?: string | null) {
  if (!status) return '—';
  const key = String(status).toUpperCase();
  return STATUS_LABELS[key] || String(status);
}
