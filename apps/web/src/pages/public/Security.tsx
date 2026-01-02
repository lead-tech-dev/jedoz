import React from 'react';
import { PageTitle } from './_common';
import { useI18n } from '../../lib/i18n';

export function Security() {
  const { tx } = useI18n();
  return (
    <div className="panel pad">
      <PageTitle title={tx('Sécurité', 'Safety')} subtitle={tx('Conseils pour rester en sécurité lors des échanges.', 'Tips to stay safe while chatting.')} />
      <div className="grid cols-2" style={{ marginTop: 12 }}>
        <div className="panel pad">
          <div className="h2">{tx('Rencontres en personne', 'In-person meetings')}</div>
          <ul className="small" style={{ marginTop: 8, paddingLeft: 18 }}>
            <li>{tx('Rencontrez-vous dans un lieu public la première fois.', 'Meet in a public place the first time.')}</li>
            <li>{tx('Prévenez un proche de votre rendez-vous.', 'Let a friend know about your meeting.')}</li>
            <li>{tx('Évitez de partager votre adresse trop tôt.', 'Avoid sharing your address too early.')}</li>
          </ul>
        </div>
        <div className="panel pad">
          <div className="h2">{tx('Transactions & paiements', 'Transactions & payments')}</div>
          <ul className="small" style={{ marginTop: 8, paddingLeft: 18 }}>
            <li>{tx('Refusez les demandes de paiement anticipé douteuses.', 'Decline suspicious upfront payment requests.')}</li>
            <li>{tx('Ne partagez jamais vos codes ou mots de passe.', 'Never share your codes or passwords.')}</li>
            <li>{tx('Signalez tout comportement suspect.', 'Report any suspicious behavior.')}</li>
          </ul>
        </div>
        <div className="panel pad">
          <div className="h2">{tx('Respect & confidentialité', 'Respect & privacy')}</div>
          <ul className="small" style={{ marginTop: 8, paddingLeft: 18 }}>
            <li>{tx('Respectez les limites et les conditions annoncées.', 'Respect boundaries and stated conditions.')}</li>
            <li>{tx('Ne diffusez pas d’informations personnelles sans consentement.', 'Do not share personal info without consent.')}</li>
            <li>{tx('Bloquez les utilisateurs abusifs.', 'Block abusive users.')}</li>
          </ul>
        </div>
        <div className="panel pad">
          <div className="h2">{tx('Besoin d’aide ?', 'Need help?')}</div>
          <div className="small">
            {tx('Si un contenu vous semble inapproprié, utilisez la page de signalement.', 'If content looks inappropriate, use the report page.')}
          </div>
          <div style={{ height: 10 }} />
          <div className="row">
            <a className="btn" href="/report">{tx('Signaler', 'Report')}</a>
            <a className="btn ghost" href="/help">{tx('Conseils & aide', 'Tips & help')}</a>
          </div>
        </div>
      </div>
    </div>
  );
}
