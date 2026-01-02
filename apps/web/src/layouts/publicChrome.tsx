import React from 'react';
import { ThemeToggle } from '@repo/ui';
import { IconGrid, IconHelp, IconPlus, IconStar, IconUser, IconWallet } from '../components/Icons';
import { apiFetch, getToken, setToken } from '../lib/api';
import { useI18n } from '../lib/i18n';

export function buildPublicNav(t: (key: string) => string) {
  return [
    { label: t('nav.categories'), href: '/categories', icon: <IconGrid />, tone: 'teal' },
    { label: t('nav.packs'), href: '/packs', icon: <IconWallet />, tone: 'sun' },
    { label: t('nav.becomePro'), href: '/become-pro', icon: <IconStar />, tone: 'indigo' },
    { label: t('nav.help'), href: '/help', icon: <IconHelp />, tone: 'rose' },
  ];
}

export function PublicHeaderRight(props: { showLogout?: boolean }) {
  const { lang, setLang, t } = useI18n();
  const showLogout = props.showLogout ?? false;
  const [authed, setAuthed] = React.useState(!!getToken());
  const [userName, setUserName] = React.useState<string | null>(null);
  const loginNext = encodeURIComponent('/dashboard/overview');
  const depositNext = encodeURIComponent('/dashboard/ads/create');

  const loadMe = React.useCallback(() => {
    if (!authed) {
      setUserName(null);
      return;
    }
    apiFetch<{ username?: string; firstName?: string | null; lastName?: string | null }>('/me')
      .then((res) => {
        const fullName = [res.firstName, res.lastName].filter(Boolean).join(' ').trim();
        setUserName(fullName || res.username || null);
      })
      .catch((err: any) => {
        if (err?.status === 401 || err?.status === 403) {
          setToken(null);
          setAuthed(false);
        }
        setUserName(null);
      });
  }, [authed]);

  React.useEffect(() => {
    const onStorage = () => setAuthed(!!getToken());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  React.useEffect(() => {
    loadMe();
  }, [loadMe]);

  React.useEffect(() => {
    const onProfileUpdated = () => loadMe();
    window.addEventListener('profile-updated', onProfileUpdated);
    return () => window.removeEventListener('profile-updated', onProfileUpdated);
  }, [loadMe]);

  return (
    <>
      <div className="row" style={{ gap: 8 }}>
        <ThemeToggle lightLabel={t('theme.light')} darkLabel={t('theme.dark')} />
        <button
          className="btn ghost"
          onClick={() => setLang('fr')}
          style={{ opacity: lang === 'fr' ? 1 : 0.6 }}
        >
          {t('lang.fr')}
        </button>
        <button
          className="btn ghost"
          onClick={() => setLang('en')}
          style={{ opacity: lang === 'en' ? 1 : 0.6 }}
        >
          {t('lang.en')}
        </button>
      </div>
      {authed ? (
        <>
          <a className="btn" href="/dashboard/overview"><IconUser /> {userName ?? t('header.account')}</a>
          {showLogout ? (
            <button
              className="btn ghost"
              onClick={() => {
                setToken(null);
                setAuthed(false);
                setUserName(null);
                window.location.href = '/';
              }}
            >
              {t('header.logout')}
            </button>
          ) : null}
        </>
      ) : (
        <a className="btn" href={`/auth/login?next=${loginNext}`}><IconUser /> {t('header.login')}</a>
      )}
      <a className="btn primary" href={authed ? '/dashboard/ads/create' : `/auth/login?next=${depositNext}`}><IconPlus /> {t('header.deposit')}</a>
    </>
  );
}

export function PublicFooter() {
  const { t } = useI18n();
  return (
    <div className="footerGrid">
      <div>
        <div className="brand" style={{ marginBottom: 8 }}>JEDOZ</div>
        <div className="small" style={{ maxWidth: 360 }}>
          {t('footer.brandDesc')}
        </div>
        <div style={{ height: 10 }} />
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <a className="badge top" href="/packs">{t('footer.packs')}</a>
          <a className="badge vip" href="/boosts">{t('footer.boost')}</a>
          <a className="badge premium" href="/become-pro">{t('footer.pro')}</a>
        </div>
      </div>
      <div>
        <h4>{t('footer.product')}</h4>
        <a href="/categories">{t('footer.categories')}</a><br />
        <a href="/search">{t('footer.search')}</a><br />
        <a href="/dashboard/ads/create">{t('footer.postAd')}</a><br />
        <a href="/become-pro">{t('footer.becomePro')}</a>
      </div>
      <div>
        <h4>{t('footer.security')}</h4>
        <a href="/help">{t('footer.tips')}</a><br />
        <a href="/report">{t('footer.report')}</a><br />
        <a href="/legal/moderation-charter">{t('footer.moderation')}</a>
      </div>
      <div>
        <h4>{t('footer.legal')}</h4>
        <a href="/legal/terms">{t('footer.terms')}</a><br />
        <a href="/legal/privacy">{t('footer.privacy')}</a><br />
        <a href="/legal/cookies">{t('footer.cookies')}</a><br />
        <div className="small" style={{ marginTop: 10 }}>{t('footer.rights', { year: new Date().getFullYear() })}</div>
      </div>
    </div>
  );
}
