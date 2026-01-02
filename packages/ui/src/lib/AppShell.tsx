import React from 'react';
import '../styles/index.scss';

export function AppShell(props: {
  brandHref?: string;
  brand?: string;
  nav?: { label: string; href: string; icon?: React.ReactNode; tone?: string }[];
  headerNav?: { label: string; href: string; icon?: React.ReactNode; tone?: string }[];
  sidebarNav?: { label: string; href: string; icon?: React.ReactNode; tone?: string }[];
  right?: React.ReactNode;
  variant?: 'public' | 'dashboard' | 'admin';
  children: React.ReactNode;
  footer?: React.ReactNode;
  sidebarFooter?: React.ReactNode;
  }) {
  const variant = props.variant ?? 'public';
  const nav = props.nav ?? [];
  const isDashboard = variant === 'dashboard' || variant === 'admin';
  const headerNav = props.headerNav ?? (!isDashboard ? nav : []);
  const sidebarNav = props.sidebarNav ?? nav;
  return (
    <div className={`shell ${variant}`}>
      <div className="header">
        <div className="container" style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="row">
            <a href={props.brandHref ?? '/'} className="brand">{props.brand ?? 'JEDOZ'}</a>
            {headerNav.length ? (
              <div className="nav">
                {headerNav.map((n) => (
                  <a key={n.href} href={n.href}>
                    {n.icon ? <span className={`iconBubble${n.tone ? ` ${n.tone}` : ''}`}>{n.icon}</span> : null}
                    <span className="navLabel">{n.label}</span>
                  </a>
                ))}
              </div>
            ) : null}
          </div>
          <div className="row">{props.right}</div>
        </div>
      </div>
      <main className="container page" style={{ paddingTop: 18 }}>
        {isDashboard ? (
          <div className="dashLayout">
            <aside className="sidebar">
              <div className="sidebarCard">
                <div className="sidebarTitle">Menu</div>
                <div className="sideNav">
                  {sidebarNav.map((n) => (
                    <a key={n.href} href={n.href}>
                      {n.icon ? <span className={`iconBubble${n.tone ? ` ${n.tone}` : ''}`}>{n.icon}</span> : null}
                      <span className="navLabel">{n.label}</span>
                    </a>
                  ))}
                </div>
                {props.sidebarFooter ? <div className="sidebarFooter">{props.sidebarFooter}</div> : null}
              </div>
            </aside>
            <div className="dashContent">{props.children}</div>
          </div>
        ) : (
          props.children
        )}
      </main>
      <div className="footer">
        <div className="container">{props.footer ?? <span>© {new Date().getFullYear()} — Plateforme d’annonces 18+</span>}</div>
      </div>
    </div>
  );
}
