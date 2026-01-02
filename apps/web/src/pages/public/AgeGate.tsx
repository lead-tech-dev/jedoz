import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PageTitle } from './_common';
import { useI18n } from '../../lib/i18n';

export function AgeGate({ onAccept }: { onAccept?: () => void }) {
  const { tx } = useI18n();
  const nav = useNavigate();
  const location = useLocation();
  const next = React.useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('next') || '/';
  }, [location.search]);

  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const accept = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('age_gate_ok', 'true');
      window.dispatchEvent(new Event('age-gate-accepted'));
    }
    if (onAccept) onAccept();
    nav(next);
  };
  return (
    <div className="ageGateOverlay">
      <div className="ageGateBackdrop" />
      <div className="panel pad ageGateCard">
        <PageTitle title={tx('Accès réservé aux adultes', 'Adults only')} subtitle={tx('Vous devez avoir 18+ pour continuer.', 'You must be 18+ to continue.')} />
        <div className="row wrap">
          <button className="btn primary" type="button" onClick={accept}>{tx('J’ai 18+ (Entrer)', 'I am 18+ (Enter)')}</button>
          <a className="btn" href="/legal/terms">{tx('Lire les conditions', 'Read terms')}</a>
        </div>
      </div>
    </div>
  );
}
