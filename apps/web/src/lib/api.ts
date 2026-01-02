export const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
const ANALYTICS_ANON_KEY = 'jedolo_anon_id';

function getAnonymousId(): string | null {
  try {
    let id = localStorage.getItem(ANALYTICS_ANON_KEY);
    if (!id) {
      const cryptoApi = (globalThis as any)?.crypto;
      id = cryptoApi?.randomUUID ? cryptoApi.randomUUID() : `anon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(ANALYTICS_ANON_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

function createRequestId(): string {
  const cryptoApi = (globalThis as any)?.crypto;
  return cryptoApi?.randomUUID ? cryptoApi.randomUUID() : `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getToken(): string | null {
  try { return localStorage.getItem('token'); } catch { return null; }
}

export function setToken(token: string | null) {
  try {
    if (!token) localStorage.removeItem('token');
    else localStorage.setItem('token', token);
  } catch {}
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const token = getToken();
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) headers.set('Content-Type', 'application/json');
  if (!headers.has('X-Request-Id')) headers.set('X-Request-Id', createRequestId());
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    let err: any = { status: res.status };
    try { err = { ...err, ...(await res.json()) }; } catch {}
    throw err;
  }
  return (await res.json()) as T;
}

export async function trackEvent(name: string, meta?: any, source = 'web') {
  try {
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    headers.set('X-Request-Id', createRequestId());
    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    await fetch(`${API_BASE}/analytics/events`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name,
        source,
        anonymousId: getAnonymousId(),
        meta: meta || undefined,
      }),
    });
  } catch {
    // ignore analytics errors
  }
}
