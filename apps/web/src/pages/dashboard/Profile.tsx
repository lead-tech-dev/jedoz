import React from 'react';
import { Checkbox } from '@repo/ui';
import { apiFetch } from '../../lib/api';
import { notifyError, notifySuccess } from '../../lib/toast';
import { useI18n } from '../../lib/i18n';

type MeProfile = {
  id: string;
  username: string;
  firstName?: string | null;
  lastName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  website?: string | null;
  whatsapp?: string | null;
  instagram?: string | null;
  telegram?: string | null;
  language?: string | null;
  notificationsEmail?: boolean | null;
  notificationsPush?: boolean | null;
  notificationsSms?: boolean | null;
  emailVerified?: boolean | null;
  phoneVerified?: boolean | null;
  showEmail?: boolean | null;
  showPhone?: boolean | null;
  allowMessages?: boolean | null;
  allowCalls?: boolean | null;
  email?: string | null;
  phone?: string | null;
  city: string;
  country: string;
  role?: string;
};

export function D_Profile() {
  const { tx } = useI18n();
  const [form, setForm] = React.useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    phone: '',
    city: '',
    country: '',
    bio: '',
    avatarUrl: '',
    coverUrl: '',
    website: '',
    whatsapp: '',
    instagram: '',
    telegram: '',
    language: 'fr',
  });
  const [prefs, setPrefs] = React.useState({
    notificationsEmail: true,
    notificationsPush: true,
    notificationsSms: false,
    showEmail: false,
    showPhone: false,
    allowMessages: true,
    allowCalls: true,
  });
  const [verification, setVerification] = React.useState({
    emailVerified: false,
    phoneVerified: false,
  });
  const [verifying, setVerifying] = React.useState<'email' | 'phone' | null>(null);
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<any>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    apiFetch<MeProfile>('/me')
      .then((me) => {
        if (!alive) return;
        setForm({
          firstName: me.firstName || '',
          lastName: me.lastName || '',
          username: me.username || '',
          email: me.email || '',
          phone: me.phone || '',
          city: me.city || '',
          country: me.country || '',
          bio: me.bio || '',
          avatarUrl: me.avatarUrl || '',
          coverUrl: me.coverUrl || '',
          website: me.website || '',
          whatsapp: me.whatsapp || '',
          instagram: me.instagram || '',
          telegram: me.telegram || '',
          language: me.language || 'fr',
        });
        setPrefs({
          notificationsEmail: me.notificationsEmail ?? true,
          notificationsPush: me.notificationsPush ?? true,
          notificationsSms: me.notificationsSms ?? false,
          showEmail: me.showEmail ?? false,
          showPhone: me.showPhone ?? false,
          allowMessages: me.allowMessages ?? true,
          allowCalls: me.allowCalls ?? true,
        });
        setVerification({
          emailVerified: me.emailVerified ?? false,
          phoneVerified: me.phoneVerified ?? false,
        });
        setLoading(false);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err);
        notifyError(err, tx('Impossible de charger le profil.', 'Unable to load profile.'));
        setLoading(false);
      });
    return () => { alive = false; };
  }, []);

  const updateField = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const updateTextarea = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const updateSelect = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const updatePref = (key: keyof typeof prefs) => (next: boolean) => {
    setPrefs((prev) => ({ ...prev, [key]: next }));
  };

  const verifyEmail = async () => {
    if (!form.email || verification.emailVerified) return;
    setVerifying('email');
    setError(null);
    setSuccess(null);
    try {
      const res = await apiFetch<{ emailVerified: boolean }>('/me/verify-email', { method: 'POST' });
      setVerification((prev) => ({ ...prev, emailVerified: res.emailVerified }));
      setSuccess(tx('Email vérifié.', 'Email verified.'));
      notifySuccess(tx('Email vérifié.', 'Email verified.'));
    } catch (err) {
      setError(err);
      notifyError(err, tx('Vérification email impossible.', 'Email verification failed.'));
    } finally {
      setVerifying(null);
    }
  };

  const verifyPhone = async () => {
    if (!form.phone || verification.phoneVerified) return;
    setVerifying('phone');
    setError(null);
    setSuccess(null);
    try {
      const res = await apiFetch<{ phoneVerified: boolean }>('/me/verify-phone', { method: 'POST' });
      setVerification((prev) => ({ ...prev, phoneVerified: res.phoneVerified }));
      setSuccess(tx('Téléphone vérifié.', 'Phone verified.'));
      notifySuccess(tx('Téléphone vérifié.', 'Phone verified.'));
    } catch (err) {
      setError(err);
      notifyError(err, tx('Vérification téléphone impossible.', 'Phone verification failed.'));
    } finally {
      setVerifying(null);
    }
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: Record<string, any> = {
        ...form,
        ...prefs,
      };
      if (password && password === confirmPassword) {
        payload.password = password;
      }
      await apiFetch('/me', { method: 'PUT', body: JSON.stringify(payload) });
      setSuccess(tx('Profil mis à jour.', 'Profile updated.'));
      notifySuccess(tx('Profil mis à jour.', 'Profile updated.'));
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err);
      notifyError(err, tx('Impossible de mettre à jour le profil.', 'Unable to update profile.'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="pageLoading">
        <div className="panel pad">{tx('Chargement…', 'Loading…')}</div>
      </div>
    );
  }

  return (
    <div className="panel pad">
      <h1 className="h1">{tx('Mon profil', 'My profile')}</h1>
      {error ? <div className="small" style={{ color: 'var(--red)' }}>{tx('Erreur', 'Error')}: {String(error?.error || error?.message || error)}</div> : null}
      {success ? <div className="small" style={{ color: 'var(--green)' }}>{success}</div> : null}

      <form onSubmit={onSubmit} style={{ marginTop: 12 }}>
        <div className="h2">{tx('Informations publiques', 'Public info')}</div>
        <div className="grid cols-2" style={{ gap: 12, marginTop: 10 }}>
          <div>
            <div className="small">{tx('Prénom', 'First name')}</div>
            <input className="input" value={form.firstName} onChange={updateField('firstName')} />
          </div>
          <div>
            <div className="small">{tx('Nom', 'Last name')}</div>
            <input className="input" value={form.lastName} onChange={updateField('lastName')} />
          </div>
          <div>
            <div className="small">{tx('Pseudo', 'Username')}</div>
            <input className="input" value={form.username} onChange={updateField('username')} />
          </div>
          <div>
            <div className="small">{tx('Ville', 'City')}</div>
            <input className="input" value={form.city} onChange={updateField('city')} />
          </div>
          <div>
            <div className="small">{tx('Pays', 'Country')}</div>
            <input className="input" value={form.country} onChange={updateField('country')} />
          </div>
          <div>
            <div className="small">{tx('Site web', 'Website')}</div>
            <input className="input" value={form.website} onChange={updateField('website')} />
          </div>
        </div>

        <div style={{ height: 12 }} />
        <div>
          <div className="small">{tx('Bio', 'Bio')}</div>
          <textarea className="input" rows={4} value={form.bio} onChange={updateTextarea('bio')} />
        </div>

        <div style={{ height: 12 }} />
        <div className="h2">{tx('Liens & réseaux', 'Links & socials')}</div>
        <div className="grid cols-3" style={{ gap: 12, marginTop: 10 }}>
          <div>
            <div className="small">{tx('WhatsApp', 'WhatsApp')}</div>
            <input className="input" value={form.whatsapp} onChange={updateField('whatsapp')} />
          </div>
          <div>
            <div className="small">{tx('Instagram', 'Instagram')}</div>
            <input className="input" value={form.instagram} onChange={updateField('instagram')} />
          </div>
          <div>
            <div className="small">{tx('Telegram', 'Telegram')}</div>
            <input className="input" value={form.telegram} onChange={updateField('telegram')} />
          </div>
        </div>

        <div style={{ height: 12 }} />
        <div className="h2">{tx('Coordonnées', 'Contact details')}</div>
        <div className="grid cols-2" style={{ gap: 12, marginTop: 10 }}>
          <div>
            <div className="small">{tx('Email', 'Email')}</div>
            <input className="input" value={form.email} onChange={updateField('email')} />
            <button className="btn ghost" type="button" onClick={verifyEmail} disabled={verifying === 'email' || verification.emailVerified} style={{ marginTop: 6 }}>
              {verification.emailVerified ? tx('Email vérifié', 'Email verified') : verifying === 'email' ? tx('Vérification…', 'Verifying…') : tx('Vérifier email', 'Verify email')}
            </button>
          </div>
          <div>
            <div className="small">{tx('Téléphone', 'Phone')}</div>
            <input className="input" value={form.phone} onChange={updateField('phone')} />
            <button className="btn ghost" type="button" onClick={verifyPhone} disabled={verifying === 'phone' || verification.phoneVerified} style={{ marginTop: 6 }}>
              {verification.phoneVerified ? tx('Téléphone vérifié', 'Phone verified') : verifying === 'phone' ? tx('Vérification…', 'Verifying…') : tx('Vérifier téléphone', 'Verify phone')}
            </button>
          </div>
        </div>

        <div style={{ height: 12 }} />
        <div className="h2">{tx('Préférences', 'Preferences')}</div>
        <div className="grid cols-3" style={{ gap: 12, marginTop: 10 }}>
          <Checkbox
            label={tx('Notifications email', 'Email notifications')}
            checked={prefs.notificationsEmail}
            onChange={updatePref('notificationsEmail')}
          />
          <Checkbox
            label={tx('Notifications push', 'Push notifications')}
            checked={prefs.notificationsPush}
            onChange={updatePref('notificationsPush')}
          />
          <Checkbox
            label={tx('Notifications SMS', 'SMS notifications')}
            checked={prefs.notificationsSms}
            onChange={updatePref('notificationsSms')}
          />
          <Checkbox
            label={tx('Afficher email', 'Show email')}
            checked={prefs.showEmail}
            onChange={updatePref('showEmail')}
          />
          <Checkbox
            label={tx('Afficher téléphone', 'Show phone')}
            checked={prefs.showPhone}
            onChange={updatePref('showPhone')}
          />
          <Checkbox
            label={tx('Autoriser les messages', 'Allow messages')}
            checked={prefs.allowMessages}
            onChange={updatePref('allowMessages')}
          />
          <Checkbox
            label={tx('Autoriser les appels', 'Allow calls')}
            checked={prefs.allowCalls}
            onChange={updatePref('allowCalls')}
          />
        </div>

        <div className="divider" />

        <div className="h2">{tx('Sécurité', 'Security')}</div>
        <div className="grid cols-2" style={{ gap: 12, marginTop: 10 }}>
          <div>
            <div className="small">{tx('Nouveau mot de passe', 'New password')}</div>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={tx('Nouveau mot de passe', 'New password')} />
          </div>
          <div>
            <div className="small">{tx('Confirmer', 'Confirm')}</div>
            <input className="input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={tx('Confirmer le mot de passe', 'Confirm password')} />
          </div>
        </div>

        <div style={{ height: 12 }} />
        <button className="btn primary" type="submit" disabled={saving}>
          {saving ? tx('Mise à jour…', 'Updating…') : tx('Enregistrer les modifications', 'Save changes')}
        </button>
      </form>
    </div>
  );
}
