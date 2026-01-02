import React from 'react';

type IconProps = { className?: string };

function Svg({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className ?? 'icon'}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function IconHome(props: IconProps) {
  return (
    <Svg className={props.className}>
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V10" />
      <path d="M9 22V12h6v10" />
    </Svg>
  );
}

export function IconTag(props: IconProps) {
  return (
    <Svg className={props.className}>
      <path d="M20 10.5L12.5 3H4v8.5L11.5 19a2 2 0 0 0 2.8 0l5.7-5.7a2 2 0 0 0 0-2.8z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </Svg>
  );
}

export function IconClock(props: IconProps) {
  return (
    <Svg className={props.className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </Svg>
  );
}

export function IconFlag(props: IconProps) {
  return (
    <Svg className={props.className}>
      <path d="M4 5v16" />
      <path d="M4 5h12l-2 4 2 4H4" />
    </Svg>
  );
}

export function IconUsers(props: IconProps) {
  return (
    <Svg className={props.className}>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="3" />
      <path d="M2 20a7 7 0 0 1 14 0" />
      <path d="M13 20a5 5 0 0 1 9 0" />
    </Svg>
  );
}

export function IconUser(props: IconProps) {
  return (
    <Svg className={props.className}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4 20a8 8 0 0 1 16 0" />
    </Svg>
  );
}

export function IconGrid(props: IconProps) {
  return (
    <Svg className={props.className}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </Svg>
  );
}

export function IconWallet(props: IconProps) {
  return (
    <Svg className={props.className}>
      <path d="M3 7a2 2 0 0 1 2-2h12a3 3 0 0 1 3 3v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M17 12h3" />
    </Svg>
  );
}

export function IconDollar(props: IconProps) {
  return (
    <Svg className={props.className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9h6a2 2 0 0 1 0 4H9a2 2 0 0 0 0 4h6" />
      <path d="M12 7v10" />
    </Svg>
  );
}

export function IconGauge(props: IconProps) {
  return (
    <Svg className={props.className}>
      <path d="M4 14a8 8 0 1 1 16 0" />
      <path d="M12 14l4-4" />
      <path d="M8 14h8" />
    </Svg>
  );
}

export function IconArrows(props: IconProps) {
  return (
    <Svg className={props.className}>
      <path d="M7 7h11" />
      <path d="M15 4l3 3-3 3" />
      <path d="M17 17H6" />
      <path d="M9 14l-3 3 3 3" />
    </Svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <Svg className={props.className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12l3 3 5-6" />
    </Svg>
  );
}

export function IconChart(props: IconProps) {
  return (
    <Svg className={props.className}>
      <path d="M3 3v18h18" />
      <rect x="7" y="13" width="3" height="5" />
      <rect x="12" y="9" width="3" height="9" />
      <rect x="17" y="6" width="3" height="12" />
    </Svg>
  );
}

export function IconUndo(props: IconProps) {
  return (
    <Svg className={props.className}>
      <path d="M9 10H5l3-3" />
      <path d="M5 10a7 7 0 1 0 7-7" />
    </Svg>
  );
}

export function IconBolt(props: IconProps) {
  return (
    <Svg className={props.className}>
      <path d="M13 2L3 14h7l-1 8 10-12h-7z" />
    </Svg>
  );
}

export function IconChat(props: IconProps) {
  return (
    <Svg className={props.className}>
      <path d="M21 12a8 8 0 0 1-8 8H6l-3 3v-7a8 8 0 1 1 18-4z" />
      <path d="M8 11h8" />
      <path d="M8 15h5" />
    </Svg>
  );
}
