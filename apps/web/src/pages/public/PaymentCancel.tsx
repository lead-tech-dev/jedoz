import React from 'react';
import { PageTitle } from './_common';
import { useI18n } from '../../lib/i18n';

export function PaymentCancel() {
  const { tx } = useI18n();
  return (
    <>
      <PageTitle title={tx('Paiement annulé', 'Payment cancelled')} />
      <div className="panel p-6">
        <div className="text-2xl font-semibold mb-2">{tx('Paiement annulé', 'Payment cancelled')}</div>
        <div className="opacity-80 mb-4">{tx('Tu peux réessayer à tout moment.', 'You can try again at any time.')}</div>
        <div className="flex gap-3 flex-wrap">
          <a className="btn primary" href="/packs">{tx('Revenir aux packs', 'Back to packs')}</a>
          <a className="btn" href="/">{tx("Retour à l'accueil", 'Back to home')}</a>
        </div>
      </div>
    </>
  );
}
