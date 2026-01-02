import React from 'react';
import '../styles/index.scss';

export type BadgeKind = 'vip' | 'urgent' | 'top' | 'premium';

export function Badge({ kind, children }: { kind: BadgeKind; children: React.ReactNode }) {
  return <span className={`badge ${kind}`}>{children}</span>;
}
