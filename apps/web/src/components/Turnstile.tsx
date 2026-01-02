import React from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: Record<string, any>) => string | number;
      remove?: (widgetId: string | number) => void;
      reset?: (widgetId: string | number) => void;
    };
  }
}

export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
export const turnstileEnabled = Boolean(TURNSTILE_SITE_KEY);

let turnstileScriptPromise: Promise<void> | null = null;

function loadTurnstileScript() {
  if (turnstileScriptPromise) return turnstileScriptPromise;
  turnstileScriptPromise = new Promise((resolve, reject) => {
    if (typeof document === 'undefined') return resolve();
    if (document.querySelector('script[data-turnstile]')) return resolve();
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.setAttribute('data-turnstile', 'true');
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('TURNSTILE_LOAD_FAILED'));
    document.head.appendChild(script);
  });
  return turnstileScriptPromise;
}

export function Turnstile(props: {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  action?: string;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const widgetIdRef = React.useRef<string | number | null>(null);
  const siteKey = TURNSTILE_SITE_KEY;

  React.useEffect(() => {
    if (!siteKey) return undefined;
    let active = true;
    loadTurnstileScript()
      .then(() => {
        if (!active || !ref.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          action: props.action,
          callback: (token: string) => props.onVerify(token),
          'expired-callback': () => props.onExpire?.(),
          'error-callback': () => props.onError?.(),
        });
      })
      .catch(() => {
        props.onError?.();
      });
    return () => {
      active = false;
      if (widgetIdRef.current && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
  }, [siteKey, props.action, props.onVerify, props.onExpire, props.onError]);

  if (!siteKey) return null;
  return <div ref={ref} className={props.className} />;
}
