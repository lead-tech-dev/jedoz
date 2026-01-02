import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { Screen } from '../../components/Screen';
import { Section } from '../../components/Section';
import { Button } from '../../components/Button';
import { colors } from '../../lib/theme';
import { useI18n } from '../../lib/i18n';

export function SettingsScreen() {
  const { lang, setLang, t } = useI18n();
  const [notif, setNotif] = React.useState(true);
  const [privacy, setPrivacy] = React.useState(false);

  return (
    <Screen scroll>
      <Text style={styles.title}>{t('settings.title')}</Text>
      <Section title={t('settings.notifications')}>
        <View style={styles.row}>
          <Text style={styles.label}>{t('settings.push')}</Text>
          <Switch value={notif} onValueChange={setNotif} />
        </View>
      </Section>
      <Section title={t('settings.privacy')}>
        <View style={styles.row}>
          <Text style={styles.label}>{t('settings.hideStatus')}</Text>
          <Switch value={privacy} onValueChange={setPrivacy} />
        </View>
      </Section>
      <Section title={t('settings.language')}>
        <View style={styles.langRow}>
          <Button
            title={t('settings.french')}
            variant={lang === 'fr' ? 'primary' : 'secondary'}
            onPress={() => setLang('fr')}
            style={styles.langButton}
          />
          <Button
            title={t('settings.english')}
            variant={lang === 'en' ? 'primary' : 'secondary'}
            onPress={() => setLang('en')}
            style={styles.langButton}
          />
        </View>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 16
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel
  },
  label: {
    color: colors.text
  },
  langRow: {
    flexDirection: 'row',
    gap: 12
  },
  langButton: {
    flex: 1
  }
});
