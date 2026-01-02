import React from 'react';
import { Select } from '@repo/ui';
import { PageTitle } from './_common';
import { useI18n } from '../../lib/i18n';

export function Report() {
  const { tx } = useI18n();
  const [type, setType] = React.useState('minor');
  return (
    <div className="panel pad">
      <PageTitle title={tx('Signaler', 'Report')} subtitle={tx('Annonce abusive, spam, contenu interdit, arnaque…', 'Abusive ad, spam, prohibited content, scam…')} />
      <div className="label">{tx('Type de signalement', 'Report type')}</div>
      <Select className="input" value={type} onChange={setType} ariaLabel={tx('Type de signalement', 'Report type')}>
        <option value="minor">{tx('Mineur / exploitation', 'Minor / exploitation')}</option>
        <option value="scam">{tx('Arnaque', 'Scam')}</option>
        <option value="violence">{tx('Violence', 'Violence')}</option>
        <option value="spam">{tx('Spam', 'Spam')}</option>
        <option value="other">{tx('Autre', 'Other')}</option>
      </Select>
      <div style={{ height: 10 }} />
      <div className="label">{tx('Annonce concernée (ID ou lien)', 'Related ad (ID or link)')}</div>
      <input className="input" placeholder={tx('Ex: https://... ou 12345', 'e.g. https://... or 12345')} />
      <div style={{ height: 10 }} />
      <div className="label">{tx('Détails', 'Details')}</div>
      <textarea className="input" rows={5} placeholder={tx('Expliquez le problème, ajoutez le contexte si besoin.', 'Explain the issue and add context if needed.')} />
      <div style={{ height: 10 }} />
      <button className="btn primary">{tx('Envoyer le signalement', 'Send report')}</button>
    </div>
  );
}
