import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Screen } from '../../components/Screen';
import { Avatar } from '../../components/Avatar';
import { Section } from '../../components/Section';
import { ListRow } from '../../components/ListRow';
import { Button } from '../../components/Button';
import { colors } from '../../lib/theme';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../lib/i18n';

export function ProfileScreen({ navigation }) {
  const { tx } = useI18n();
  const { user, logout, refreshMe } = useAuth();

  React.useEffect(() => {
    refreshMe().catch(() => {});
  }, []);

  return (
    <Screen scroll>
      <View style={styles.hero}>
        <Avatar name={user?.username || tx('Utilisateur', 'User')} size={56} />
        <View>
          <Text style={styles.title}>{user?.username || tx('Utilisateur', 'User')}</Text>
          <Text style={styles.subtitle}>{user?.city || '-'} - {user?.country || '-'}</Text>
        </View>
      </View>

      <Section title={tx('Compte', 'Account')}>
        <ListRow title={tx('Mes annonces', 'My listings')} subtitle={tx('Gérer vos annonces', 'Manage your listings')} onPress={() => navigation.navigate('MyAds')} right={<Text style={styles.arrow}>&gt;</Text>} />
        <ListRow title={tx('Abonnement PRO', 'PRO subscription')} subtitle={tx('Mettre à niveau ou gérer', 'Upgrade or manage')} onPress={() => navigation.navigate('Pro')} right={<Text style={styles.arrow}>&gt;</Text>} />
        <ListRow title={tx('Paramètres', 'Settings')} subtitle={tx('Notifications, sécurité', 'Notifications, security')} onPress={() => navigation.navigate('Settings')} right={<Text style={styles.arrow}>&gt;</Text>} />
        <ListRow title={tx('Aide', 'Help')} subtitle={tx('Support & légal', 'Support & legal')} onPress={() => navigation.navigate('Help')} right={<Text style={styles.arrow}>&gt;</Text>} />
      </Section>

      <Button title={tx('Déconnexion', 'Logout')} variant="ghost" onPress={logout} style={{ marginTop: 16 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 16
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700'
  },
  subtitle: {
    color: colors.muted,
    marginTop: 4
  },
  arrow: {
    color: colors.muted,
    fontSize: 18
  }
});
