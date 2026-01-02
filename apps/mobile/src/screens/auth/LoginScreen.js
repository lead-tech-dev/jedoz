import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Screen } from '../../components/Screen';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { colors } from '../../lib/theme';
import { useAuth } from '../../context/AuthContext';
import { notifyError, notifySuccess } from '../../lib/toast';
import { useI18n } from '../../lib/i18n';

export function LoginScreen({ navigation }) {
  const { t } = useI18n();
  const { login } = useAuth();
  const [identifier, setIdentifier] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  const onSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      await login({ identifier, password });
      notifySuccess(t('auth.loginSuccess'));
    } catch (e) {
      setError(e?.error || e?.message || t('auth.loginFailed'));
      notifyError(e, t('auth.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.title}>{t('auth.loginTitle')}</Text>
        <Text style={styles.subtitle}>{t('auth.loginSubtitle')}</Text>
      </View>
      <Input label={t('auth.loginLabel')} value={identifier} onChangeText={setIdentifier} placeholder="john@mail.com" />
      <Input label={t('auth.password')} value={password} onChangeText={setPassword} placeholder="******" secureTextEntry />
      {error ? <Text style={styles.error}>{String(error)}</Text> : null}
      <Button title={loading ? t('auth.loginLoading') : t('auth.loginButton')} onPress={onSubmit} disabled={loading} style={{ marginTop: 12 }} />
      <View style={styles.linkRow}>
        <Text style={styles.linkText}>
          {t('auth.noAccount')}{' '}
          <Text style={styles.link} onPress={() => navigation.navigate('Register')}>{t('auth.createAccount')}</Text>
        </Text>
      </View>
      <Button title={t('auth.forgotPassword')} variant="ghost" onPress={() => navigation.navigate('Forgot')} style={{ marginTop: 6 }} />
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
  }
});
