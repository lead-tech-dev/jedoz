import React from 'react';
import { useI18n } from '../../lib/i18n';
export function NotFound(){
  const { tx } = useI18n();
  return (
    <div className="panel pad">
      <h1 className="h1">404</h1>
      <div className="small">{tx('Page introuvable.', 'Page not found.')}</div>
      <div style={{height:10}}/>
      <a className="btn" href="/">{tx('Retour accueil', 'Back to home')}</a>
    </div>
  );
}
