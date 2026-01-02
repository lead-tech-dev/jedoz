export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';
const ANALYTICS_ANON_KEY = 'admin_anon_id';

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

async function request<T>(method: string, path: string, token?: string | null, body?: any): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-Id': createRequestId(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw data;
  return data as T;
}

export const apiGet = <T,>(path: string, token?: string | null) => request<T>('GET', path, token);
export const apiPost = <T,>(path: string, body: any, token?: string | null) => request<T>('POST', path, token, body);
export const apiPut = <T,>(path: string, body: any, token?: string | null) => request<T>('PUT', path, token, body);
export const apiDelete = <T,>(path: string, token?: string | null) => request<T>('DELETE', path, token);

export async function trackEvent(name: string, meta?: any, source = 'admin') {
  try {
    await request('POST', '/analytics/events', null, {
      name,
      source,
      anonymousId: getAnonymousId(),
      meta: meta || undefined,
    });
  } catch {
    // ignore analytics errors
  }
}
