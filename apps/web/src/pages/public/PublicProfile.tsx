import React from 'react';
import { useParams } from 'react-router-dom';
import { PageTitle } from './_common';
import { useI18n } from '../../lib/i18n';

export function PublicProfile() {
  const { tx } = useI18n();
  const { username } = useParams();
  return (
    <>
      <PageTitle title={`${tx('Profil', 'Profile')}: ${username}`} subtitle={tx('Page annonceur public.', 'Public advertiser page.')} />
      <div className="panel pad" style={{ marginBottom: 12 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="h2">{username}</div>
            <div className="small">{tx('Badge', 'Badge')}: PRO {tx('(optionnel)', '(optional)')}</div>
          </div>
          <div className="row">
            <button className="btn primary">{tx('WhatsApp', 'WhatsApp')}</button>
            <button className="btn">{tx('Appeler', 'Call')}</button>
          </div>
        </div>
      </div>
      <div className="panel pad">
        <div className="small">{tx("Aucune annonce pour l'instant.", 'No listings yet.')}</div>
      </div>
    </>
  );
}
