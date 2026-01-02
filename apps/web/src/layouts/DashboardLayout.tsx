import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AppShell } from '@repo/ui';
import { setToken } from '../lib/api';
import { IconChat, IconHelp, IconHome, IconStar, IconTag, IconUser, IconWallet } from '../components/Icons';
import { PublicFooter, PublicHeaderRight, buildPublicNav } from './publicChrome';
import { useI18n } from '../lib/i18n';
import { AgeGate } from '../pages/public/AgeGate';

export function DashboardLayout() {
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
  return (
    <>
      <AppShell
        brand="JEDOZ"
        brandHref="/"
        variant="dashboard"
        nav={[
          { label: t('nav.dashboard'), href: '/dashboard/overview', icon: <IconHome />, tone: 'teal' },
          { label: t('nav.profile'), href: '/dashboard/profile', icon: <IconUser />, tone: 'sky' },
          { label: t('nav.ads'), href: '/dashboard/ads/list', icon: <IconTag />, tone: 'sun' },
          { label: t('nav.messages'), href: '/dashboard/messages/threads', icon: <IconChat />, tone: 'indigo' },
          { label: t('nav.support'), href: '/dashboard/support', icon: <IconHelp />, tone: 'teal' },
          { label: t('nav.credits'), href: '/dashboard/wallet/credits', icon: <IconWallet />, tone: 'lime' },
          { label: t('nav.pro'), href: '/dashboard/subscriptions/pro', icon: <IconStar />, tone: 'rose' }
        ]}
        headerNav={buildPublicNav(t)}
        right={<PublicHeaderRight showLogout={false} />}
        footer={<PublicFooter />}
        sidebarFooter={
          <button
            className="btn ghost"
            onClick={() => {
              setToken(null);
              window.location.href = '/';
            }}
          >
            {t('header.logout')}
          </button>
        }
      >
        <Outlet />
      </AppShell>
      {!ageOk ? <AgeGate onAccept={() => setAgeOk(true)} /> : null}
    </>
  );
}
