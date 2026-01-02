import React from 'react';
import '../styles/index.scss';

type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'lodix_theme';

function readStoredTheme(): ThemeMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {}
  return null;
}

function getPreferredTheme(): ThemeMode {
  const stored = readStoredTheme();
  if (stored) return stored;
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

function applyTheme(theme: ThemeMode) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
}

export function ThemeToggle(props: {
  lightLabel?: string;
  darkLabel?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const lightLabel = props.lightLabel ?? 'Light mode';
  const darkLabel = props.darkLabel ?? 'Dark mode';
  const [theme, setTheme] = React.useState<ThemeMode>(() => getPreferredTheme());

  React.useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {}
  }, [theme]);

  React.useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      if (event.newValue === 'light' || event.newValue === 'dark') {
        setTheme(event.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const label = theme === 'dark' ? darkLabel : lightLabel;
  const nextLabel = theme === 'dark' ? lightLabel : darkLabel;
  const nextTheme: ThemeMode = theme === 'dark' ? 'light' : 'dark';

  return (
    <button
      className={`btn ghost${props.className ? ` ${props.className}` : ''}`}
      style={props.style}
      onClick={() => setTheme(nextTheme)}
      aria-label={nextLabel}
      title={nextLabel}
      type="button"
    >
      {label}
    </button>
  );
}
