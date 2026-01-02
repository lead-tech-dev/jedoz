import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { Section } from '../../components/Section';
import { colors } from '../../lib/theme';
import { registerForPushNotificationsAsync } from '../../lib/notifications';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../lib/i18n';

export function PermissionsScreen() {
  const { tx } = useI18n();
  const { completeOnboarding } = useAuth();
  const [locStatus, setLocStatus] = React.useState('unknown');
  const [pushStatus, setPushStatus] = React.useState('unknown');
  const statusLabel = (status) => {
    if (status === 'granted') return tx('autorisé', 'granted');
    if (status === 'denied') return tx('refusé', 'denied');
    if (status === 'undetermined') return tx('indéterminé', 'undetermined');
    return tx('inconnu', 'unknown');
  };

  const askLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setLocStatus(status);
  };

  const askPush = async () => {
    const token = await registerForPushNotificationsAsync();
    setPushStatus(token ? 'granted' : 'denied');
  };

  return (
    <Screen scroll>
      <View style={styles.hero}>
        <Text style={styles.title}>{tx('Bienvenue', 'Welcome aboard')}</Text>
        <Text style={styles.subtitle}>{tx('Nous avons besoin de quelques autorisations pour personnaliser votre expérience.', 'We need a couple of permissions to personalize your experience.')}</Text>
      </View>

      <Section title={tx('Localisation', 'Location')} subtitle={`${tx('Statut', 'Status')}: ${statusLabel(locStatus)}`}>
        <Text style={styles.text}>{tx('Utilisé pour afficher les annonces proches et la carte.', 'Used to show nearby listings and map results.')}</Text>
        <Button title={tx('Activer la localisation', 'Enable Location')} onPress={askLocation} />
      </Section>

      <Section title={tx('Notifications', 'Notifications')} subtitle={`${tx('Statut', 'Status')}: ${statusLabel(pushStatus)}`}>
        <Text style={styles.text}>{tx('Recevez des mises à jour sur les messages et paiements.', 'Get updates about messages and payments.')}</Text>
        <Button title={tx('Activer les notifications', 'Enable Notifications')} onPress={askPush} />
      </Section>

      <Button title={tx('Continuer', 'Continue')} onPress={completeOnboarding} style={{ marginTop: 24 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  text: {
    color: colors.muted
  }
});
