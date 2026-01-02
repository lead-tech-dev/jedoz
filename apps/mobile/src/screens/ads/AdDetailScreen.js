import React from 'react';
import { View, Text, StyleSheet, Linking } from 'react-native';
import { Screen } from '../../components/Screen';
import { Gallery } from '../../components/Gallery';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Section } from '../../components/Section';
import { apiFetch } from '../../lib/api';
import { notifyInfo } from '../../lib/toast';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../lib/theme';
import { useI18n } from '../../lib/i18n';

const tone = { VIP: 'accent', URGENT: 'danger', TOP: 'warning', HOME: 'accent' };

export function AdDetailScreen({ route, navigation }) {
  const { tx } = useI18n();
  const { user } = useAuth();
  const { id } = route.params || {};
  const [ad, setAd] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`/ads/${id}`);
        setAd(res);
      } catch {
        setAd(null);
      } finally {
        setLoading(false);
      }
    };
    if (id) load();
  }, [id]);

  if (!ad) {
    return (
      <Screen>
        <Text style={{ color: colors.text }}>{loading ? tx('Chargement...', 'Loading...') : tx('Annonce introuvable', 'Listing not found')}</Text>
      </Screen>
    );
  }

  const phone = ad.dynamic?.phone || ad.dynamic?.contactPhone || null;

  return (
    <Screen scroll>
      <Text style={styles.title}>{ad.title}</Text>
      <Text style={styles.subtitle}>{ad.city} - {ad.country} - {ad.categorySlug}</Text>
      <View style={styles.badges}>
        {(ad.badges || []).map((b) => (
          <Badge key={b} label={b} tone={tone[b] || 'accent'} />
        ))}
      </View>

      <Gallery items={ad.media || []} />

      <Section title={tx('À propos', 'About')}>
        <Text style={styles.body}>{ad.description || tx('Aucune description.', 'No description.')}</Text>
      </Section>

      <Section title={tx('Actions', 'Actions')} subtitle={tx('Contacter ou booster cette annonce', 'Contact or boost this listing')}>
        <View style={styles.actionRow}>
          <Button
            title={tx('Chat', 'Chat')}
            variant="secondary"
            onPress={() => {
              if (user?.id && user.id === ad.userId) {
                notifyInfo(tx('Vous ne pouvez pas vous contacter vous-même.', "You can't contact yourself."));
                return;
              }
              navigation.navigate('Chat', { userId: ad.userId, adId: ad.id });
            }}
          />
          <Button
            title={tx('Appeler', 'Call')}
            variant="secondary"
            onPress={() => phone && Linking.openURL(`tel:${phone}`)}
            disabled={!phone}
          />
          <Button title={tx('Booster', 'Boost')} onPress={() => navigation.navigate('Boost', { adId: ad.id })} />
        </View>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    marginTop: 8
  },
  subtitle: {
    color: colors.muted,
    marginTop: 6,
    marginBottom: 12
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12
  },
  body: {
    color: colors.text,
    lineHeight: 20
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  }
});
