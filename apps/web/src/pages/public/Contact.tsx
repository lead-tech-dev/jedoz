import React from 'react';
import { PageTitle } from './_common';
import { useI18n } from '../../lib/i18n';

export function Contact() {
  const { tx } = useI18n();
  return (
    <div className="panel pad">
      <PageTitle title={tx('Contact', 'Contact')} subtitle={tx('Une question ? Écrivez-nous.', 'Have a question? Write to us.')} />
      <div className="label">{tx('Email', 'Email')}</div>
      <input className="input" placeholder={tx('votre@email.com', 'your@email.com')} />
      <div style={{ height: 10 }} />
      <div className="label">{tx('Message', 'Message')}</div>
      <textarea className="input" rows={6} placeholder={tx('Décrivez votre demande en détail.', 'Describe your request in detail.')} />
      <div style={{ height: 10 }} />
      <button className="btn primary">{tx('Envoyer', 'Send')}</button>
    </div>
  );
}
