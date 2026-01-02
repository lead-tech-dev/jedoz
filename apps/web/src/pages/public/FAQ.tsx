import React from 'react';
import { PageTitle } from './_common';
import { useI18n } from '../../lib/i18n';

export function FAQ() {
  const { tx } = useI18n();
  return (
    <div className="panel pad">
      <PageTitle title="FAQ" />
      <div className="small">{tx('Retrouvez ici les réponses aux questions les plus fréquentes.', 'Find answers to the most frequently asked questions.')}</div>
    </div>
  );
}
