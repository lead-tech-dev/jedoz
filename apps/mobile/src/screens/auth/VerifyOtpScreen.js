import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Screen } from '../../components/Screen';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { colors } from '../../lib/theme';
import { useI18n } from '../../lib/i18n';
import { notifyInfo } from '../../lib/toast';

export function VerifyOtpScreen({ navigation }) {
  const { t } = useI18n();
  const [code, setCode] = React.useState('');
  const onVerify = () => {
    if (!code) {
      notifyInfo(t('auth.resetDesc'));
      return;
    }
    navigation.navigate('ResetPassword', { token: code });
  };

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.title}>{t('auth.verifyTitle')}</Text>
        <Text style={styles.subtitle}>{t('auth.verifySubtitle')}</Text>
      </View>
      <Input label={t('auth.otpCode')} value={code} onChangeText={setCode} placeholder="123456" keyboardType="number-pad" />
      <Text style={styles.notice}>{t('auth.resetDesc')}</Text>
      <Button title={t('auth.resetButton')} onPress={onVerify} style={{ marginTop: 12 }} />
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
