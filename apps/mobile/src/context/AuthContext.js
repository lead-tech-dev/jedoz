import React from 'react';
import { getItem, setItem, removeItem, STORAGE_KEYS } from '../lib/storage';
import { apiFetch, login as apiLogin, register as apiRegister, getMe, trackEvent } from '../lib/api';

const AuthContext = React.createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = React.useState({
    loading: true,
    token: null,
    user: null,
    onboardingDone: false,
    ageGateOk: false
  });

  React.useEffect(() => {
    let mounted = true;
    const boot = async () => {
      const token = await getItem(STORAGE_KEYS.token);
      const onboarding = await getItem(STORAGE_KEYS.onboarding);
      const ageGate = await getItem(STORAGE_KEYS.ageGate);
      let user = null;
      if (token) {
        try {
          user = await getMe();
        } catch {
          await removeItem(STORAGE_KEYS.token);
        }
      }
      if (mounted) {
        setState({
          loading: false,
          token: token || null,
          user,
          onboardingDone: onboarding === 'true',
          ageGateOk: ageGate === 'true'
        });
      }
    };
    boot();
    return () => { mounted = false; };
  }, []);

  const login = async ({ identifier, password }) => {
    const data = await apiLogin({ identifier, password });
    if (!data?.token) throw new Error('INVALID_RESPONSE');
    await setItem(STORAGE_KEYS.token, data.token);
    const user = await getMe();
    setState((s) => ({ ...s, token: data.token, user }));
    void trackEvent('auth.login', { method: identifier?.includes('@') ? 'email' : 'phone' }, 'mobile');
    return user;
  };

  const register = async (payload) => {
    const data = await apiRegister(payload);
    if (!data?.token) throw new Error('INVALID_RESPONSE');
    await setItem(STORAGE_KEYS.token, data.token);
    const user = await getMe();
    setState((s) => ({ ...s, token: data.token, user }));
    void trackEvent('auth.register', { country: payload?.country || null }, 'mobile');
    return user;
  };

  const logout = async () => {
    await removeItem(STORAGE_KEYS.token);
    setState((s) => ({ ...s, token: null, user: null }));
    void trackEvent('auth.logout', null, 'mobile');
  };

  const refreshMe = async () => {
    const user = await getMe();
    setState((s) => ({ ...s, user }));
    return user;
  };

  const completeOnboarding = async () => {
    await setItem(STORAGE_KEYS.onboarding, 'true');
    setState((s) => ({ ...s, onboardingDone: true }));
  };

  const acceptAgeGate = async () => {
    await setItem(STORAGE_KEYS.ageGate, 'true');
    setState((s) => ({ ...s, ageGateOk: true }));
  };

  const value = {
    ...state,
    login,
    register,
    logout,
    refreshMe,
    completeOnboarding,
    acceptAgeGate,
    apiFetch
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('AuthContext missing');
  return ctx;
}
