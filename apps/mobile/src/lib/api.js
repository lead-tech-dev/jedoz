import Constants from 'expo-constants';
import { getItem, setItem, STORAGE_KEYS } from './storage';

export const API_BASE = Constants?.expoConfig?.extra?.apiUrl || 'http://localhost:3001';

export async function apiFetch(path, options = {}, tokenOverride) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const headers = new Headers(options.headers || {});
  const body = options.body;
  if (body && !(body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (!headers.has('X-Client')) headers.set('X-Client', 'mobile');
  if (!headers.has('X-Request-Id')) headers.set('X-Request-Id', createRequestId());
  const token = tokenOverride || (await getItem(STORAGE_KEYS.token));
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    let err = { status: res.status };
    try {
      const json = await res.json();
      err = { ...err, ...json };
    } catch {
      const text = await res.text().catch(() => '');
      if (text) err = { ...err, message: text };
    }
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

function createRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function getAnonymousId() {
  let id = await getItem(STORAGE_KEYS.analyticsAnon);
  if (!id) {
    id = `anon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await setItem(STORAGE_KEYS.analyticsAnon, id);
  }
  return id;
}

export async function trackEvent(name, meta, source = 'mobile') {
  try {
    const anonymousId = await getAnonymousId();
    await apiFetch('/analytics/events', {
      method: 'POST',
      body: JSON.stringify({
        name,
        source,
        anonymousId,
        meta: meta || undefined,
      })
    });
  } catch {
    // ignore analytics errors
  }
}

export async function getMe() {
  return apiFetch('/me');
}

export async function login({ identifier, password }) {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ emailOrPhone: identifier, password })
  });
}

export async function register(payload) {
  return apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function requestPasswordReset(identifier) {
  return apiFetch('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ emailOrPhone: identifier })
  });
}

export async function resetPassword(payload) {
  return apiFetch('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}
