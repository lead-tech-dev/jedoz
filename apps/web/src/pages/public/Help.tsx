import React from 'react';
import { PageTitle } from './_common';
import { useI18n } from '../../lib/i18n';

export function Help() {
  const { tx } = useI18n();
  return (
    <div className="panel pad">
      <PageTitle title={tx('Conseils & aide', 'Tips & help')} subtitle={tx('Guides, sécurité et assistance.', 'Guides, safety, and support.')} />
      <div className="grid cols-2" style={{ marginTop: 12 }}>
        <div className="panel pad">
          <div className="h2">{tx('Démarrer', 'Get started')}</div>
          <div className="small">{tx('Créez votre compte, complétez votre profil et publiez votre première annonce.', 'Create your account, complete your profile, and publish your first ad.')}</div>
          <div style={{ height: 10 }} />
          <div className="row">
            <a className="btn" href="/auth/register">{tx('Créer un compte', 'Create account')}</a>
            <a className="btn ghost" href="/dashboard/ads/create">{tx('Déposer une annonce', 'Post an ad')}</a>
          </div>
        </div>
        <div className="panel pad">
          <div className="h2">{tx('Sécurité', 'Safety')}</div>
          <div className="small">{tx('Bonnes pratiques pour les rencontres et les échanges.', 'Best practices for meetups and messaging.')}</div>
          <div style={{ height: 10 }} />
          <a className="btn" href="/security">{tx('Voir la page Sécurité', 'Open Safety page')}</a>
        </div>
        <div className="panel pad">
          <div className="h2">{tx('Questions fréquentes', 'Frequently asked')}</div>
          <div className="small">{tx('Retrouvez les réponses aux questions les plus courantes.', 'Find answers to the most common questions.')}</div>
          <div style={{ height: 10 }} />
          <a className="btn" href="/faq">{tx('Consulter la FAQ', 'View FAQ')}</a>
        </div>
        <div className="panel pad">
          <div className="h2">{tx('Signaler', 'Report')}</div>
          <div className="small">{tx('Signalez un contenu abusif ou un comportement inapproprié.', 'Report abusive content or inappropriate behavior.')}</div>
          <div style={{ height: 10 }} />
          <a className="btn" href="/report">{tx('Signaler', 'Report')}</a>
        </div>
      </div>
      <div style={{ height: 12 }} />
      <div className="panel pad">
        <div className="h2">{tx('Besoin d’assistance ?', 'Need help?')}</div>
        <div className="small">{tx('Contactez-nous pour toute question ou demande spécifique.', 'Contact us for any question or specific request.')}</div>
        <div style={{ height: 10 }} />
        <a className="btn" href="/contact">{tx('Contact', 'Contact')}</a>
      </div>
    </div>
  );
}
