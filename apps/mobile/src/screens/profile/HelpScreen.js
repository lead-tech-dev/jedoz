import React from 'react';
import { Text, StyleSheet, Linking } from 'react-native';
import { Screen } from '../../components/Screen';
import { Section } from '../../components/Section';
import { Button } from '../../components/Button';
import { colors } from '../../lib/theme';
import { useI18n } from '../../lib/i18n';

export function HelpScreen() {
  const { tx } = useI18n();
  return (
    <Screen scroll>
      <Text style={styles.title}>{tx('Aide & Légal', 'Help & Legal')}</Text>
      <Section title={tx('Sécurité', 'Safety')}>
        <Text style={styles.text}>{tx('Rencontrez uniquement dans des lieux publics sûrs et signalez tout abus.', 'Only meet in safe public places and report abusive behavior.')}</Text>
      </Section>
      <Section title={tx('Support', 'Support')}>
        <Text style={styles.text}>{tx('Email', 'Email')}: support@mjdating.app</Text>
        <Button title={tx('Contacter le support', 'Contact support')} variant="secondary" onPress={() => Linking.openURL('mailto:support@mjdating.app')} style={{ marginTop: 10 }} />
      </Section>
      <Section title={tx('Légal', 'Legal')}>
        <Text style={styles.text}>{tx('Les CGU et la politique de confidentialité sont disponibles sur l’app web.', 'Terms of use and privacy policy are available on the web app.')}</Text>
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
  text: {
    color: colors.muted
  }
});
