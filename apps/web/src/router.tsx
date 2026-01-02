import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { PublicLayout } from './layouts/PublicLayout';
import { DashboardLayout } from './layouts/DashboardLayout';
import { apiFetch, getToken, setToken, trackEvent } from './lib/api';
import * as P from './pages';
import { useI18n } from './lib/i18n';

function TrackPageView() {
  const location = useLocation();
  React.useEffect(() => {
    void trackEvent('page.view', {
      path: location.pathname,
      search: location.search,
      hash: location.hash,
    }, 'web');
  }, [location.key]);
  return null;
}

function RequireAuth({ children }: { children: React.ReactElement }) {
  const { tx } = useI18n();
  const location = useLocation();
  const [state, setState] = React.useState<'checking' | 'authed' | 'unauth'>(() => (getToken() ? 'checking' : 'unauth'));

  React.useEffect(() => {
    const token = getToken();
    if (!token) {
      setState('unauth');
      return;
    }
    let active = true;
    setState('checking');
    apiFetch('/me')
      .then(() => {
        if (active) setState('authed');
      })
      .catch((err: any) => {
        if (!active) return;
        if (err?.status === 401 || err?.status === 403) setToken(null);
        setState('unauth');
      });
    return () => {
      active = false;
    };
  }, [location.key]);

  if (state === 'unauth') {
    const next = encodeURIComponent(`${location.pathname}${location.search}${location.hash}`);
    return <Navigate to={`/auth/login?next=${next}`} replace />;
  }
  if (state === 'checking') {
    return <div className="small">{tx('Chargement…', 'Loading…')}</div>;
  }
  return children;
}

export default function App() {
  return (
    <>
      <TrackPageView />
      <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<P.Home />} />
        <Route path="/18-plus" element={<P.AgeGate />} />
        <Route path="/countries" element={<P.Countries />} />
        <Route path="/cities/:country" element={<P.Cities />} />
        <Route path="/city/:country/:citySlug" element={<P.CitySeo />} />
        <Route path="/categories" element={<P.Categories />} />
        <Route path="/category/:slug" element={<P.Category />} />
        <Route path="/category/:slug/:subSlug" element={<P.SubCategory />} />
        <Route path="/search" element={<P.Search />} />
        <Route path="/ad/:id" element={<P.AdDetail />} />
        <Route path="/profile/:username" element={<P.PublicProfile />} />
        <Route path="/become-pro" element={<P.BecomePro />} />
        <Route path="/packs" element={<P.Packs />} />
        <Route path="/payment/success" element={<P.PaymentSuccess />} />
        <Route path="/payment/cancel" element={<P.PaymentCancel />} />
        <Route path="/boosts" element={<P.Boosts />} />
        <Route path="/help" element={<P.Help />} />
        <Route path="/security" element={<P.Security />} />
        <Route path="/faq" element={<P.FAQ />} />
        <Route path="/contact" element={<P.Contact />} />
        <Route path="/report" element={<P.Report />} />
        <Route path="/legal" element={<P.Legal />} />
        <Route path="/legal/terms" element={<P.Terms />} />
        <Route path="/legal/privacy" element={<P.Privacy />} />
        <Route path="/legal/cookies" element={<P.Cookies />} />
        <Route path="/legal/moderation-charter" element={<P.ModerationCharter />} />
        <Route path="/legal/legal-notice" element={<P.LegalNotice />} />
        <Route path="/auth/login" element={<P.Login />} />
        <Route path="/auth/register" element={<P.Register />} />
        <Route path="/auth/forgot-password" element={<P.ForgotPassword />} />
        <Route path="/auth/reset-password/:token" element={<P.ResetPassword />} />
        <Route path="/auth/verify-email/:token" element={<P.VerifyEmail />} />
        <Route path="/auth/verify-phone" element={<P.VerifyPhone />} />
        <Route path="/auth/complete-profile" element={<P.CompleteProfile />} />
      </Route>

      <Route path="/dashboard" element={<RequireAuth><DashboardLayout /></RequireAuth>}>
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<P.D_Overview />} />
        <Route path="profile" element={<P.D_Profile />} />
        <Route path="ads/list" element={<P.D_AdsList />} />
        <Route path="ads/create" element={<P.D_AdsCreate />} />
        <Route path="ads/edit/:id" element={<P.D_AdsEdit />} />
        <Route path="ads/preview/:id" element={<P.D_AdsPreview />} />
        <Route path="ads/stats/:id" element={<P.D_AdsStats />} />
        <Route path="favorites" element={<P.D_Favorites />} />
        <Route path="messages/threads" element={<P.D_Threads />} />
        <Route path="messages/thread/:id" element={<P.D_Thread />} />
        <Route path="support" element={<P.D_Support />} />
        <Route path="wallet/credits" element={<P.D_Credits />} />
        <Route path="wallet/transactions" element={<P.D_Transactions />} />
        <Route path="wallet/invoices" element={<P.D_Invoices />} />
        <Route path="subscriptions/pro" element={<P.D_Pro />} />
        <Route path="subscriptions/history" element={<P.D_SubHistory />} />
        <Route path="boosts/active" element={<P.D_BoostsActive />} />
        <Route path="boosts/buy/:adId" element={<P.D_BoostBuy />} />
        <Route path="notifications" element={<P.D_Notifications />} />
        <Route path="reports" element={<P.D_Reports />} />
        <Route path="settings" element={<P.D_Settings />} />
      </Route>

      <Route path="*" element={<P.NotFound />} />
      </Routes>
    </>
  );
}
