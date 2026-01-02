import React from 'react';
import { PageTitle } from './_common';
import { useI18n } from '../../lib/i18n';

export function Boosts() {
  const { tx } = useI18n();
  return (
    <div className="panel pad">
      <PageTitle title={tx('Boosts', 'Boosts')} subtitle={tx('VIP / URGENT / TOP / HOMEPAGE (configurable par pays).', 'VIP / URGENT / TOP / HOMEPAGE (configurable per country).')} />
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <span className="badge vip">{tx('VIP', 'VIP')}</span>
        <span className="badge urgent">{tx('URGENT', 'URGENT')}</span>
        <span className="badge top">{tx('TOP', 'TOP')}</span>
        <span className="badge premium">{tx('ACCUEIL', 'HOMEPAGE')}</span>
      </div>
    </div>
  );
}
