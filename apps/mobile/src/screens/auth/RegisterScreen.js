import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Screen } from '../../components/Screen';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { colors } from '../../lib/theme';
import { useAuth } from '../../context/AuthContext';
import { notifyError, notifySuccess } from '../../lib/toast';
import { useI18n } from '../../lib/i18n';

export function RegisterScreen({ navigation }) {
  const { t, tx } = useI18n();
  const { register } = useAuth();
  const [form, setForm] = React.useState({
    username: '',
    email: '',
    phone: '',
    password: '',
    city: '',
    country: 'CM'
  });
  const [error, setError] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [ageConfirmed, setAgeConfirmed] = React.useState(false);

  const update = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = async () => {
    setError(null);
    if (!ageConfirmed) {
      const msg = tx('Vous devez confirmer avoir 18+.', 'You must confirm you are 18+.');
      setError(msg);
      notifyError(null, msg);
      return;
    }
    setLoading(true);
    try {
      await register({
        username: form.username,
        email: form.email || null,
        phone: form.phone || null,
        password: form.password,
        city: form.city,
        country: form.country,
        ageConfirmed: true
      });
      notifySuccess(t('auth.registerSuccess'));
    } catch (e) {
      setError(e?.error || e?.message || t('auth.registerFailed'));
      notifyError(e, t('auth.registerFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.title}>{t('auth.registerTitle')}</Text>
        <Text style={styles.subtitle}>{t('auth.registerSubtitle')}</Text>
      </View>
      <Input label={t('auth.username')} value={form.username} onChangeText={update('username')} placeholder="mjdating" autoCapitalize="none" />
      <Input label={t('auth.email')} value={form.email} onChangeText={update('email')} placeholder="john@mail.com" keyboardType="email-address" />
      <Input label={t('auth.phone')} value={form.phone} onChangeText={update('phone')} placeholder="2376xxxxxx" keyboardType="phone-pad" />
      <Input label={t('auth.password')} value={form.password} onChangeText={update('password')} placeholder="******" secureTextEntry />
      <Input label={t('auth.city')} value={form.city} onChangeText={update('city')} placeholder="Douala" />
      <Input label={t('auth.country')} value={form.country} onChangeText={update('country')} placeholder="CM" autoCapitalize="characters" />
      <Pressable style={styles.ageRow} onPress={() => setAgeConfirmed((prev) => !prev)}>
        <View style={[styles.ageBox, ageConfirmed && styles.ageBoxChecked]} />
        <Text style={styles.ageText}>{tx('Je confirme avoir 18+.', 'I confirm I am 18+.')}</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{String(error)}</Text> : null}
      <Button title={loading ? t('auth.registerLoading') : t('auth.registerButton')} onPress={onSubmit} disabled={loading || !ageConfirmed} style={{ marginTop: 12 }} />
      <View style={styles.linkRow}>
        <Text style={styles.linkText}>
          {t('auth.haveAccount')}{' '}
          <Text style={styles.link} onPress={() => navigation.navigate('Login')}>{t('auth.loginLink')}</Text>
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center'
  },
  hero: {
    marginTop: 12,
    marginBottom: 24
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800'
  },
  subtitle: {
    color: colors.muted,
    marginTop: 8
  },
  error: {
    color: colors.danger,
    marginTop: 10
  },
  linkRow: {
    marginTop: 10
  },
  linkText: {
    color: colors.muted
  },
  link: {
    color: colors.accent,
    fontWeight: '700'
  },
  ageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8
  },
  ageBox: {
    width: 18,
    height: 18,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel
  },
  ageBoxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent
  },
  ageText: {
    color: colors.text,
    fontSize: 13
  }
});
