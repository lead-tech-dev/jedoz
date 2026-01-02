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

export function IconTag(props: IconProps) {
  return (
    <Svg className={props.className}>
      <path d="M20 10.5L12.5 3H4v8.5L11.5 19a2 2 0 0 0 2.8 0l5.7-5.7a2 2 0 0 0 0-2.8z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </Svg>
  );
}

export function IconChat(props: IconProps) {
  return (
    <Svg className={props.className}>
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
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

export function IconStar(props: IconProps) {
  return (
    <Svg className={props.className}>
      <path d="M12 3l3 6 6 .9-4.5 4.3 1.1 6.3L12 17l-5.6 3.5 1.1-6.3L3 9.9 9 9z" />
    </Svg>
  );
}

export function IconHelp(props: IconProps) {
  return (
    <Svg className={props.className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 1 1 4.5 1.5c-.7.7-1.5 1-1.5 2" />
      <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <Svg className={props.className}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </Svg>
  );
}

export function IconFilter(props: IconProps) {
  return (
    <Svg className={props.className}>
      <path d="M4 5h16l-6 7v6l-4 2v-8z" />
    </Svg>
  );
}

export function IconSort(props: IconProps) {
  return (
    <Svg className={props.className}>
      <path d="M11 5h7" />
      <path d="M11 10h5" />
      <path d="M11 15h3" />
      <path d="M7 5v14" />
      <path d="M4 16l3 3 3-3" />
    </Svg>
  );
}

export function IconSpark(props: IconProps) {
  return (
    <Svg className={props.className}>
      <path d="M12 3l2.2 4.5L19 9l-4.8 1.5L12 15l-2.2-4.5L5 9l4.8-1.5z" />
    </Svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <Svg className={props.className}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </Svg>
  );
}

export function IconUser(props: IconProps) {
  return (
    <Svg className={props.className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </Svg>
  );
}

export function IconPin(props: IconProps) {
  return (
    <Svg className={props.className}>
      <path d="M12 21s-6-5.3-6-10a6 6 0 1 1 12 0c0 4.7-6 10-6 10z" />
      <circle cx="12" cy="11" r="2" />
    </Svg>
  );
}
