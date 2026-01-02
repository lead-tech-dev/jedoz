import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AdminLayout } from './layouts/AdminLayout';
import * as P from './pages';
import { trackEvent } from './lib/api';

function TrackPageView() {
  const location = useLocation();
  React.useEffect(() => {
    void trackEvent('page.view', {
      path: location.pathname,
      search: location.search,
      hash: location.hash,
    }, 'admin');
  }, [location.key]);
  return null;
}

export default function App() {
  return (
    <>
      <TrackPageView />
      <Routes>
        <Route path="/admin/login" element={<P.Login />} />
        <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<P.Dashboard />} />
        <Route path="analytics/overview" element={<P.AnalyticsOverview />} />
        <Route path="analytics/events" element={<P.AnalyticsEvents />} />
        <Route path="users/list" element={<P.Users />} />
          <Route path="users/view/:id" element={<P.UserView />} />
          <Route path="ads/list" element={<P.Ads />} />
          <Route path="ads/pending" element={<P.AdsPending />} />
          <Route path="ads/reported" element={<P.AdsReported />} />
          <Route path="ads/view/:id" element={<P.AdView />} />
          <Route path="messages/threads" element={<P.Messages />} />
          <Route path="messages/thread/:id" element={<P.MessageThread />} />
          <Route path="alerts" element={<P.Alerts />} />
          <Route path="support/tickets" element={<P.SupportTickets />} />
          <Route path="categories/tree" element={<P.CategoriesTree />} />
          <Route path="categories/create" element={<P.CategoryCreate />} />
          <Route path="categories/edit/:id" element={<P.CategoryEdit />} />
          <Route path="categories/form-steps/:categoryId" element={<P.FormSteps />} />
          <Route path="categories/form-fields/:stepId" element={<P.FormFields />} />
          <Route path="payments/transactions" element={<P.Transactions />} />
          <Route path="payments/reconciliation" element={<P.Reconciliation />} />
          <Route path="payments/revenue" element={<P.Revenue />} />
          <Route path="payments/jobs" element={<P.JobsHealth />} />
          <Route path="monetization/credit-packs" element={<P.CreditPacks />} />
          <Route path="monetization/pricing" element={<P.PricingRules />} />
          <Route path="monetization/quotas" element={<P.QuotaRules />} />
          <Route path="payments/subscriptions" element={<P.Subscriptions />} />
          <Route path="payments/refunds" element={<P.Refunds />} />
          <Route path="boosts/types" element={<P.BoostTypes />} />
          <Route path="boosts/active" element={<P.ActiveBoosts />} />
          <Route path="boosts/pricing" element={<P.BoostPricing />} />
          <Route path="boosts/rules" element={<P.BoostRules />} />
          <Route path="content/pages" element={<P.Pages />} />
          <Route path="content/faq" element={<P.Faq />} />
          <Route path="content/emails" element={<P.Emails />} />
          <Route path="locations/countries" element={<P.Countries />} />
          <Route path="locations/cities" element={<P.Cities />} />
          <Route path="locations/currencies" element={<P.Currencies />} />
          <Route path="moderation/reports" element={<P.Reports />} />
          <Route path="moderation/keywords" element={<P.Keywords />} />
          <Route path="moderation/ai-rules" element={<P.AiRules />} />
          <Route path="roles" element={<P.Roles />} />
          <Route path="permissions" element={<P.Permissions />} />
          <Route path="audit-logs" element={<P.AuditLogs />} />
          <Route path="settings" element={<P.Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/admin/login" replace />} />
      </Routes>
    </>
  );
}
