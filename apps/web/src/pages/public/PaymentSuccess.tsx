import React from 'react';
import { PageTitle } from './_common';
import { apiFetch } from '../../lib/api';
import { formatStatus } from '../../lib/status';
import { useI18n } from '../../lib/i18n';

export function PaymentSuccess() {
  const { tx } = useI18n();
  const params = new URLSearchParams(window.location.search);
  const intentId = params.get('intentId') || '';

  const [status, setStatus] = React.useState<'PENDING'|'SUCCESS'|'FAILED'|'CANCELLED'>('PENDING');

  React.useEffect(() => {
    let t: any;
    const run = async () => {
      if (!intentId) return;
      try {
        const r = await apiFetch<{ status: string }>(`/payments/${intentId}/status`);
        setStatus(r.status as any);
        if (r.status === 'PENDING') t = setTimeout(run, 2000);
      } catch {
        // ignore
      }
    };
    run();
    return () => t && clearTimeout(t);
  }, [intentId]);

  return (
    <>
      <PageTitle title={tx('Paiement confirmé', 'Payment confirmed')} />
      <div className="panel p-6">
        <div className="text-2xl font-semibold mb-2">{tx('Merci !', 'Thank you!')}</div>
        <div className="opacity-80 mb-4">
          {tx('Statut', 'Status')} : <b>{formatStatus(status, tx)}</b>
        </div>
        <div className="flex gap-3 flex-wrap">
          <a className="btn primary" href="/dashboard/wallet/credits">{tx('Voir mes crédits', 'View my credits')}</a>
          <a className="btn" href="/">{tx("Retour à l'accueil", 'Back to home')}</a>
        </div>
      </div>
    </>
  );
}
