import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Screen } from '../../components/Screen';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { colors } from '../../lib/theme';
import { useI18n } from '../../lib/i18n';
import { resetPassword } from '../../lib/api';
import { notifyError, notifySuccess } from '../../lib/toast';

export function ResetPasswordScreen({ navigation, route }) {
  const { t } = useI18n();
  const [token, setToken] = React.useState(route?.params?.token || '');
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState(false);

  const onSubmit = async () => {
    if (!token || !password) return;
    if (password !== confirm) {
      notifyError(t('auth.resetMismatch'));
      return;
    }
    setLoading(true);
    try {
      await resetPassword({ token, password });
      setDone(true);
      notifySuccess(t('auth.resetSuccess'));
      navigation.navigate('Login');
    } catch (e) {
      notifyError(e, t('auth.resetFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.title}>{t('auth.resetTitle')}</Text>
        <Text style={styles.subtitle}>{t('auth.resetDesc')}</Text>
      </View>
      <Input label={t('auth.otpCode')} value={token} onChangeText={setToken} placeholder="123456" />
      <Input label={t('auth.newPassword')} value={password} onChangeText={setPassword} placeholder="******" secureTextEntry style={{ marginTop: 12 }} />
      <Input label={t('auth.confirmPassword')} value={confirm} onChangeText={setConfirm} placeholder="******" secureTextEntry style={{ marginTop: 12 }} />
      {done ? <Text style={styles.notice}>{t('auth.resetSuccess')}</Text> : null}
      <Button title={loading ? t('auth.loginLoading') : t('auth.resetButton')} onPress={onSubmit} style={{ marginTop: 12 }} disabled={loading} />
      <Button title={t('auth.backToLogin')} variant="ghost" onPress={() => navigation.navigate('Login')} style={{ marginTop: 6 }} />
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
  notice: {
    color: colors.accent,
    marginTop: 10
  }
});
