import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AppShell } from '@repo/ui';
import { PublicFooter, PublicHeaderRight, buildPublicNav } from './publicChrome';
import { useI18n } from '../lib/i18n';
import { AgeGate } from '../pages/public/AgeGate';

export function PublicLayout() {
  const { t } = useI18n();
  const location = useLocation();
  const [ageOk, setAgeOk] = React.useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('age_gate_ok') === 'true';
  });

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => setAgeOk(localStorage.getItem('age_gate_ok') === 'true');
    handler();
    window.addEventListener('age-gate-accepted', handler);
    return () => window.removeEventListener('age-gate-accepted', handler);
  }, [location.key]);

  const showAgeGate = !ageOk && location.pathname !== '/18-plus';
  return (
    <>
      <AppShell
        brand="JEDOZ"
        brandHref="/"
        variant="public"
        nav={buildPublicNav(t)}
        right={<PublicHeaderRight showLogout={false} />}
        footer={<PublicFooter />}
      >
        <Outlet />
      </AppShell>
      {showAgeGate ? <AgeGate onAccept={() => setAgeOk(true)} /> : null}
    </>
  );
}
