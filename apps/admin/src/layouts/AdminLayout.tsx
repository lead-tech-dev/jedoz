import React from 'react';
import { Outlet } from 'react-router-dom';
import { AppShell, ThemeToggle } from '@repo/ui';
import {
  IconArrows,
  IconBolt,
  IconChart,
  IconCheck,
  IconClock,
  IconChat,
  IconDollar,
  IconFlag,
  IconGrid,
  IconGauge,
  IconHome,
  IconTag,
  IconUndo,
  IconUser,
  IconUsers,
  IconWallet,
} from '../components/Icons';
import { useAdminAuth } from '../lib/auth';

export function AdminLayout() {
  const { admin, logout } = useAdminAuth();
  const displayName = admin
    ? [admin.firstName, admin.lastName].filter(Boolean).join(' ') || admin.username || admin.email
    : 'Admin';
  return (
    <AppShell
      brand="JEDOZ"
      brandHref="/admin/dashboard"
      variant="admin"
      nav={[
        { label: 'Dashboard', href: '/admin/dashboard', icon: <IconHome />, tone: 'slate' },
        { label: 'Analytics', href: '/admin/analytics/overview', icon: <IconChart />, tone: 'indigo' },
        { label: 'Annonces', href: '/admin/ads/list', icon: <IconTag />, tone: 'sun' },
        { label: 'En attente', href: '/admin/ads/pending', icon: <IconClock />, tone: 'indigo' },
        { label: 'Signalées', href: '/admin/ads/reported', icon: <IconFlag />, tone: 'rose' },
        { label: 'Utilisateurs', href: '/admin/users/list', icon: <IconUsers />, tone: 'teal' },
        { label: 'Messages', href: '/admin/messages/threads', icon: <IconChat />, tone: 'indigo' },
        { label: 'Alertes', href: '/admin/alerts', icon: <IconFlag />, tone: 'rose' },
        { label: 'Support', href: '/admin/support/tickets', icon: <IconChat />, tone: 'teal' },
        { label: 'Catégories', href: '/admin/categories/tree', icon: <IconGrid />, tone: 'sky' },
        { label: 'Abonnements', href: '/admin/payments/subscriptions', icon: <IconCheck />, tone: 'teal' },
        { label: 'Crédits (packs)', href: '/admin/monetization/credit-packs', icon: <IconWallet />, tone: 'lime' },
        { label: 'Pricing', href: '/admin/monetization/pricing', icon: <IconDollar />, tone: 'sun' },
        { label: 'Quotas', href: '/admin/monetization/quotas', icon: <IconGauge />, tone: 'indigo' },
        { label: 'Boosts actifs', href: '/admin/boosts/active', icon: <IconBolt />, tone: 'sun' },
        { label: 'Transactions', href: '/admin/payments/transactions', icon: <IconArrows />, tone: 'teal' },
        { label: 'Reconciliation', href: '/admin/payments/reconciliation', icon: <IconCheck />, tone: 'lime' },
        { label: 'Revenus', href: '/admin/payments/revenue', icon: <IconChart />, tone: 'sun' },
        { label: 'Refunds', href: '/admin/payments/refunds', icon: <IconUndo />, tone: 'rose' },
        { label: 'Jobs & Queue', href: '/admin/payments/jobs', icon: <IconBolt />, tone: 'indigo' },
        { label: 'Audit Logs', href: '/admin/audit-logs', icon: <IconArrows />, tone: 'slate' },
        { label: 'Rôles', href: '/admin/roles', icon: <IconUsers />, tone: 'indigo' },
        { label: 'Permissions', href: '/admin/permissions', icon: <IconCheck />, tone: 'sun' }
      ]}
      right={(
        <div className="row">
          <ThemeToggle lightLabel="Mode clair" darkLabel="Mode sombre" />
          <div className="pill" style={{ padding: '8px 12px' }}>
            <span className="iconBubble slate"><IconUser /></span>
            <div>
              <div style={{ fontWeight: 700 }}>{displayName}</div>
              <div className="small">{admin?.role || 'admin'}</div>
            </div>
          </div>
          <button
            className="btn"
            onClick={() => {
              logout();
              window.location.href = '/admin/login';
            }}
          >
            Déconnexion
          </button>
        </div>
      )}
      footer={<span>Admin — actions loggées (audit)</span>}
    >
      <Outlet />
    </AppShell>
  );
}
