import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Screen } from '../../components/Screen';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { colors } from '../../lib/theme';
import { useI18n } from '../../lib/i18n';
import { requestPasswordReset } from '../../lib/api';
import { notifyError, notifySuccess } from '../../lib/toast';

export function ForgotScreen({ navigation }) {
  const { t, tx } = useI18n();
  const [identifier, setIdentifier] = React.useState('');
  const [sent, setSent] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [resetToken, setResetToken] = React.useState(null);

  const onSubmit = async () => {
    setLoading(true);
    try {
      const res = await requestPasswordReset(identifier);
      setSent(true);
      setResetToken(res?.resetToken || null);
      notifySuccess(t('auth.resetSent'));
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
        <Text style={styles.subtitle}>{t('auth.resetSubtitle')}</Text>
      </View>
      <Input label={t('auth.resetLabel')} value={identifier} onChangeText={setIdentifier} placeholder="john@mail.com" />
      {sent ? <Text style={styles.notice}>{t('auth.resetSent')}</Text> : null}
      {resetToken ? <Text style={styles.notice}>{tx('Code de réinitialisation', 'Reset code')}: {resetToken}</Text> : null}
      <Button title={loading ? t('auth.loginLoading') : t('auth.sendOtp')} onPress={onSubmit} style={{ marginTop: 12 }} disabled={loading} />
      <Button title={t('auth.verifyCode')} variant="secondary" onPress={() => navigation.navigate('ResetPassword', resetToken ? { token: resetToken } : undefined)} style={{ marginTop: 10 }} />
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
