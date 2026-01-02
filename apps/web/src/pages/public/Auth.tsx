import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Checkbox } from '@repo/ui';
import { apiFetch, setToken, trackEvent } from '../../lib/api';
import { notifyError, notifySuccess } from '../../lib/toast';
import { useI18n } from '../../lib/i18n';
import { Turnstile, turnstileEnabled } from '../../components/Turnstile';

function ErrorBox({ error }: { error: any }) {
  const { t, tx } = useI18n();
  if (!error) return null;
  const msg = typeof error === 'string'
    ? error
    : (error?.error || error?.message || tx(`Erreur (${error?.status || '??'})`, `Error (${error?.status || '??'})`));
  return (
    <div className="panel pad" style={{ border: '1px solid rgba(0,0,0,.15)', background: 'rgba(255,0,0,.03)', marginTop: 12 }}>
      <div style={{ fontWeight: 800 }}>{t('auth.errorTitle')}</div>
      <div className="small">{msg}</div>
    </div>
  );
}

export function Login() {
  const { t } = useI18n();
  const nav = useNavigate();
  const [emailOrPhone, setEmailOrPhone] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<any>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const r = await apiFetch<{ token: string }>(`/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ emailOrPhone, password }),
      });
      setToken(r.token);
      void trackEvent('auth.login', { method: emailOrPhone.includes('@') ? 'email' : 'phone' }, 'web');
      notifySuccess(t('auth.loginSuccess'));
      nav('/dashboard/overview');
    } catch (err) {
      notifyError(err, t('auth.loginFailed'));
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="panel pad" onSubmit={onSubmit}>
      <h1 className="h1">{t('auth.loginTitle')}</h1>
      <div className="small">{t('auth.loginSubtitle')}</div>
      <div style={{ height: 14 }} />
      <input className="input" placeholder={t('auth.emailOrPhone')} value={emailOrPhone} onChange={(e) => setEmailOrPhone(e.target.value)} />
      <div style={{ height: 10 }} />
      <input className="input" type="password" placeholder={t('auth.password')} value={password} onChange={(e) => setPassword(e.target.value)} />
      <div style={{ height: 14 }} />
      <button className="btn primary" disabled={loading}>{loading ? t('auth.loginLoading') : t('auth.loginButton')}</button>
      <div style={{ height: 12 }} />
      <a className="small" href="/auth/forgot-password">{t('auth.forgotPassword')}</a>
      <div style={{ height: 8 }} />
      <div className="small">
        {t('auth.noAccount')} <a href="/auth/register">{t('auth.createAccount')}</a>
      </div>
      <ErrorBox error={error} />
    </form>
  );
}

export function Register() {
  const { t, tx } = useI18n();
  const nav = useNavigate();
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [city, setCity] = React.useState('Douala');
  const [country, setCountry] = React.useState('CM');
  const [password, setPassword] = React.useState('');
  const [ageConfirmed, setAgeConfirmed] = React.useState(false);
  const [captchaToken, setCaptchaToken] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<any>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!ageConfirmed) {
      const err = { error: 'AGE_CONFIRM_REQUIRED' };
      setError(err);
      notifyError(err, tx('Vous devez confirmer avoir 18+.', 'You must confirm you are 18+.'));
      return;
    }
    if (turnstileEnabled && !captchaToken) {
      const err = { error: 'CAPTCHA_REQUIRED' };
      setError(err);
      notifyError(err, tx('Veuillez valider le captcha.', 'Please complete the captcha.'));
      return;
    }
    setLoading(true);
    try {
      const r = await apiFetch<{ token: string }>(`/auth/register`, {
        method: 'POST',
        body: JSON.stringify({ email: email || null, phone: phone || null, password, username, city, country, ageConfirmed, captchaToken }),
      });
      setToken(r.token);
      void trackEvent('auth.register', { method: email ? 'email' : 'phone', country }, 'web');
      notifySuccess(t('auth.registerSuccess'));
      nav('/dashboard/overview');
    } catch (err) {
      notifyError(err, t('auth.registerFailed'));
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="panel pad" onSubmit={onSubmit}>
      <h1 className="h1">{t('auth.registerTitle')}</h1>
      <div className="small">{t('auth.registerSubtitle')}</div>
      <div style={{ height: 14 }} />
      <div className="grid cols-2">
        <input className="input" placeholder={t('auth.username')} value={username} onChange={(e) => setUsername(e.target.value)} />
        <input className="input" placeholder={t('auth.city')} value={city} onChange={(e) => setCity(e.target.value)} />
      </div>
      <div style={{ height: 10 }} />
      <div className="grid cols-2">
        <input className="input" placeholder={t('auth.emailOptional')} value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input" placeholder={t('auth.phoneOptional')} value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div style={{ height: 10 }} />
      <div className="grid cols-2">
        <input className="input" placeholder={t('auth.country')} value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} />
        <input className="input" type="password" placeholder={t('auth.password')} value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div style={{ height: 14 }} />
      <Checkbox
        checked={ageConfirmed}
        onChange={setAgeConfirmed}
        label={tx('Je confirme avoir 18+.', 'I confirm I am 18+.')}
        required
      />
      <div style={{ height: 12 }} />
      {turnstileEnabled ? (
        <>
          <Turnstile
            onVerify={(token) => setCaptchaToken(token)}
            onExpire={() => setCaptchaToken('')}
            onError={() => setCaptchaToken('')}
          />
          <div style={{ height: 12 }} />
        </>
      ) : null}
      <button
        className="btn primary"
        disabled={loading || !ageConfirmed || (turnstileEnabled && !captchaToken)}
      >
        {loading ? t('auth.registerLoading') : t('auth.registerButton')}
      </button>
      <div style={{ height: 10 }} />
      <div className="small">
        {t('auth.haveAccount')} <a href="/auth/login">{t('auth.loginLink')}</a>
      </div>
      <ErrorBox error={error} />
    </form>
  );
}

export function ForgotPassword() {
  const { t } = useI18n();
  const [emailOrPhone, setEmailOrPhone] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<any>(null);
  const [sent, setSent] = React.useState(false);
  const [resetUrl, setResetUrl] = React.useState<string | null>(null);
  const [resetToken, setResetToken] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<{ resetUrl?: string; resetToken?: string }>(`/auth/forgot-password`, {
        method: 'POST',
        body: JSON.stringify({ emailOrPhone }),
      });
      setSent(true);
      setResetUrl(res?.resetUrl || null);
      setResetToken(res?.resetToken || null);
      notifySuccess(t('auth.forgotSuccess'));
    } catch (err) {
      notifyError(err, t('auth.resetFailed'));
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="panel pad" onSubmit={onSubmit}>
      <h1 className="h1">{t('auth.forgotTitle')}</h1>
      <div className="small">{t('auth.forgotDesc')}</div>
      <div style={{ height: 14 }} />
      <input className="input" placeholder={t('auth.forgotLabel')} value={emailOrPhone} onChange={(e) => setEmailOrPhone(e.target.value)} />
      <div style={{ height: 12 }} />
      <button className="btn primary" disabled={loading}>
        {loading ? t('auth.loginLoading') : t('auth.forgotButton')}
      </button>
      <div style={{ height: 10 }} />
      <div className="small">{t('auth.forgotHint')}</div>
      {sent ? <div className="small" style={{ marginTop: 8, color: 'var(--green)' }}>{t('auth.forgotSuccess')}</div> : null}
      {resetUrl ? (
        <div className="small" style={{ marginTop: 8 }}>
          <a href={resetUrl}>{resetUrl}</a>
        </div>
      ) : null}
      {resetToken ? <div className="small" style={{ marginTop: 6 }}>{t('auth.resetToken', { token: resetToken })}</div> : null}
      <ErrorBox error={error} />
    </form>
  );
}

export function ResetPassword() {
  const { t } = useI18n();
  const nav = useNavigate();
  const { token } = useParams();
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<any>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError({ error: 'INVALID_TOKEN' });
      return;
    }
    if (password !== confirm) {
      setError(t('auth.resetMismatch'));
      return;
    }
    setLoading(true);
    try {
      await apiFetch(`/auth/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      notifySuccess(t('auth.resetSuccess'));
      nav('/auth/login');
    } catch (err) {
      notifyError(err, t('auth.resetFailed'));
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="panel pad" onSubmit={onSubmit}>
      <h1 className="h1">{t('auth.resetTitle')}</h1>
      <div className="small">{t('auth.resetToken', { token: token || '' })}</div>
      <div style={{ height: 10 }} />
      <div className="small">{t('auth.resetDesc')}</div>
      <div style={{ height: 14 }} />
      <input
        className="input"
        type="password"
        placeholder={t('auth.resetNewPassword')}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <div style={{ height: 10 }} />
      <input
        className="input"
        type="password"
        placeholder={t('auth.resetConfirmPassword')}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />
      <div style={{ height: 14 }} />
      <button className="btn primary" disabled={loading}>
        {loading ? t('auth.loginLoading') : t('auth.resetButton')}
      </button>
      <ErrorBox error={error} />
    </form>
  );
}

export function VerifyEmail() {
  const { t } = useI18n();
  const { token } = useParams();
  return (
    <div className="panel pad">
      <h1 className="h1">{t('auth.verifyEmailTitle')}</h1>
      <div className="small">{t('auth.resetToken', { token: token || '' })}</div>
      <div style={{ height: 10 }} />
      <div className="small">{t('auth.resetDesc')}</div>
    </div>
  );
}

export function VerifyPhone() {
  const { t } = useI18n();
  return (
    <div className="panel pad">
      <h1 className="h1">{t('auth.verifyPhoneTitle')}</h1>
      <div className="small">{t('auth.verifyPhoneDesc')}</div>
    </div>
  );
}

export function CompleteProfile() {
  const { t } = useI18n();
  return (
    <div className="panel pad">
      <h1 className="h1">{t('auth.completeProfileTitle')}</h1>
      <div className="small">{t('auth.completeProfileDesc')}</div>
    </div>
  );
}
