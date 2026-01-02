import * as SecureStore from 'expo-secure-store';

const memory = new Map();

export async function setItem(key, value) {
  try {
    if (value === null || value === undefined) {
      await SecureStore.deleteItemAsync(key);
      memory.delete(key);
      return;
    }
    await SecureStore.setItemAsync(key, String(value));
    memory.set(key, String(value));
  } catch {
    if (value === null || value === undefined) memory.delete(key);
    else memory.set(key, String(value));
  }
}

export async function getItem(key) {
  try {
    const v = await SecureStore.getItemAsync(key);
    if (v !== null && v !== undefined) return v;
  } catch {}
  return memory.has(key) ? memory.get(key) : null;
}

export async function removeItem(key) {
  return setItem(key, null);
}

export const STORAGE_KEYS = {
  token: 'jedolo_token',
  onboarding: 'jedolo_onboarding',
  ageGate: 'jedolo_age_gate',
  pushToken: 'jedolo_push_token',
  lang: 'jedolo_lang',
  analyticsAnon: 'jedolo_anon_id'
};
