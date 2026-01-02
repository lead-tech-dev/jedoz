import React from 'react';
import { PageTitle } from './_common';
import { useI18n } from '../../lib/i18n';

export function Legal() {
  const { tx } = useI18n();
  return (
    <div className="panel pad">
      <PageTitle title={tx('Légal', 'Legal')} subtitle={tx('Informations juridiques et documents officiels.', 'Legal information and official documents.')} />
      <div className="grid cols-2" style={{ marginTop: 12 }}>
        <div className="panel pad">
          <div className="h2">{tx('Conditions générales', 'Terms of service')}</div>
          <div className="small">{tx('Règles d’utilisation et obligations des utilisateurs.', 'Usage rules and user obligations.')}</div>
          <div style={{ height: 10 }} />
          <a className="btn" href="/legal/terms">{tx('Voir les CGU', 'View terms')}</a>
        </div>
        <div className="panel pad">
          <div className="h2">{tx('Confidentialité', 'Privacy')}</div>
          <div className="small">{tx('Protection des données personnelles et droits des utilisateurs.', 'Personal data protection and user rights.')}</div>
          <div style={{ height: 10 }} />
          <a className="btn" href="/legal/privacy">{tx('Voir la politique', 'View policy')}</a>
        </div>
        <div className="panel pad">
          <div className="h2">{tx('Cookies', 'Cookies')}</div>
          <div className="small">{tx('Fonctionnement des cookies et paramètres de consentement.', 'Cookie usage and consent preferences.')}</div>
          <div style={{ height: 10 }} />
          <a className="btn" href="/legal/cookies">{tx('Voir les cookies', 'View cookies')}</a>
        </div>
        <div className="panel pad">
          <div className="h2">{tx('Charte de modération', 'Moderation charter')}</div>
          <div className="small">{tx('Règles de publication et critères de modération.', 'Publishing rules and moderation criteria.')}</div>
          <div style={{ height: 10 }} />
          <a className="btn" href="/legal/moderation-charter">{tx('Voir la charte', 'View charter')}</a>
        </div>
        <div className="panel pad">
          <div className="h2">{tx('Mentions légales', 'Legal notice')}</div>
          <div className="small">{tx('Informations sur l’éditeur et l’hébergeur.', 'Information about the publisher and hosting provider.')}</div>
          <div style={{ height: 10 }} />
          <a className="btn" href="/legal/legal-notice">{tx('Voir les mentions', 'View notice')}</a>
        </div>
      </div>
    </div>
  );
}

export function Terms() {
  const { tx } = useI18n();
  return (
    <div className="panel pad">
      <PageTitle title={tx('CGU', 'Terms')} subtitle={tx('Conditions générales d’utilisation.', 'Terms of service.')} />
      <div className="panel pad">
        <div className="h2">{tx('1. Utilisation de la plateforme', '1. Platform usage')}</div>
        <div className="small">{tx('Les annonces doivent être conformes à la loi et aux règles de la plateforme.', 'Listings must comply with the law and platform rules.')}</div>
        <div style={{ height: 10 }} />
        <div className="h2">{tx('2. Comptes et responsabilité', '2. Accounts and responsibility')}</div>
        <div className="small">{tx('Chaque utilisateur est responsable de ses publications et de ses échanges.', 'Each user is responsible for their listings and communications.')}</div>
        <div style={{ height: 10 }} />
        <div className="h2">{tx('3. Contenus interdits', '3. Prohibited content')}</div>
        <div className="small">{tx('Tout contenu frauduleux, violent ou illégal est supprimé.', 'Any fraudulent, violent, or illegal content is removed.')}</div>
        <div style={{ height: 10 }} />
        <div className="h2">{tx('4. Sanctions', '4. Enforcement')}</div>
        <div className="small">{tx('Les comptes enfreignant les règles peuvent être suspendus.', 'Accounts breaking the rules may be suspended.')}</div>
      </div>
    </div>
  );
}

export function Privacy() {
  const { tx } = useI18n();
  return (
    <div className="panel pad">
      <PageTitle title={tx('Confidentialité', 'Privacy')} subtitle={tx('Protection des données personnelles.', 'Personal data protection.')} />
      <div className="panel pad">
        <div className="h2">{tx('Données collectées', 'Data collected')}</div>
        <div className="small">{tx('Nous collectons les informations nécessaires à la création de compte et aux échanges.', 'We collect information needed for account creation and messaging.')}</div>
        <div style={{ height: 10 }} />
        <div className="h2">{tx('Utilisation', 'Usage')}</div>
        <div className="small">{tx('Les données servent à la sécurité, la modération et l’amélioration du service.', 'Data is used for security, moderation, and service improvement.')}</div>
        <div style={{ height: 10 }} />
        <div className="h2">{tx('Vos droits', 'Your rights')}</div>
        <div className="small">{tx('Vous pouvez demander l’accès, la modification ou la suppression de vos données.', 'You can request access, correction, or deletion of your data.')}</div>
      </div>
    </div>
  );
}

export function Cookies() {
  const { tx } = useI18n();
  return (
    <div className="panel pad">
      <PageTitle title={tx('Cookies', 'Cookies')} subtitle={tx('Gestion des cookies.', 'Cookie management.')} />
      <div className="panel pad">
        <div className="h2">{tx('Pourquoi des cookies ?', 'Why cookies?')}</div>
        <div className="small">{tx('Ils permettent de mémoriser vos préférences et sécuriser la session.', 'They help remember preferences and secure sessions.')}</div>
        <div style={{ height: 10 }} />
        <div className="h2">{tx('Types de cookies', 'Cookie types')}</div>
        <div className="small">{tx('Cookies essentiels, statistiques et performance.', 'Essential, analytics, and performance cookies.')}</div>
        <div style={{ height: 10 }} />
        <div className="h2">{tx('Contrôle', 'Control')}</div>
        <div className="small">{tx('Vous pouvez gérer vos préférences depuis votre navigateur.', 'You can manage preferences in your browser.')}</div>
      </div>
    </div>
  );
}

export function ModerationCharter() {
  const { tx } = useI18n();
  return (
    <div className="panel pad">
      <PageTitle title={tx('Charte de modération', 'Moderation charter')} subtitle={tx('Règles de publication.', 'Publishing rules.')} />
      <div className="panel pad">
        <div className="h2">{tx('Contenus acceptés', 'Accepted content')}</div>
        <div className="small">{tx('Les annonces doivent être honnêtes, respectueuses et conformes.', 'Listings must be honest, respectful, and compliant.')}</div>
        <div style={{ height: 10 }} />
        <div className="h2">{tx('Contenus interdits', 'Prohibited content')}</div>
        <div className="small">{tx('Mineurs, exploitation, violence, arnaques et spam.', 'Minors, exploitation, violence, scams, and spam.')}</div>
        <div style={{ height: 10 }} />
        <div className="h2">{tx('Processus', 'Process')}</div>
        <div className="small">{tx('Les annonces peuvent être modérées avant publication.', 'Listings may be reviewed before publication.')}</div>
      </div>
    </div>
  );
}

export function LegalNotice() {
  const { tx } = useI18n();
  return (
    <div className="panel pad">
      <PageTitle title={tx('Mentions légales', 'Legal notice')} subtitle={tx('Informations sur l’éditeur.', 'Publisher information.')} />
      <div className="panel pad">
        <div className="h2">{tx('Éditeur', 'Publisher')}</div>
        <div className="small">{tx('JEDOZ — Cameroun.', 'JEDOZ — Cameroon.')}</div>
        <div style={{ height: 10 }} />
        <div className="h2">{tx('Hébergement', 'Hosting')}</div>
        <div className="small">{tx('Hébergeur conforme aux exigences légales.', 'Hosting compliant with legal requirements.')}</div>
        <div style={{ height: 10 }} />
        <div className="h2">{tx('Contact', 'Contact')}</div>
        <div className="small">{tx('Pour toute demande légale, contactez le support.', 'For legal requests, contact support.')}</div>
      </div>
    </div>
  );
}
