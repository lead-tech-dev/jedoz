import React from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { Screen } from '../../components/Screen';
import { Input } from '../../components/Input';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Section } from '../../components/Section';
import { Chip } from '../../components/Chip';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { apiFetch } from '../../lib/api';
import { colors } from '../../lib/theme';
import { buildQuery } from '../../lib/helpers';
import { useI18n } from '../../lib/i18n';

const boostTone = { VIP: 'accent', URGENT: 'danger', TOP: 'warning', HOME: 'accent' };

export function HomeScreen({ navigation }) {
  const { tx } = useI18n();
  const [query, setQuery] = React.useState('');
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [filter, setFilter] = React.useState({ city: '', categorySlug: '' });

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const queryString = buildQuery({ q: query, city: filter.city, categorySlug: filter.categorySlug });
      const res = await apiFetch(`/ads${queryString}`);
      setItems(res.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [query, filter.city, filter.categorySlug]);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen scroll>
      <View style={styles.hero}>
        <Text style={styles.title}>{tx('Découvrir des annonces', 'Discover listings')}</Text>
        <Text style={styles.subtitle}>{tx('Annonces récentes, visibilité boostée.', 'Fresh ads, boosted visibility.')}</Text>
      </View>

      <Input label={tx('Recherche', 'Search')} value={query} onChangeText={setQuery} placeholder={tx('Ville, titre, catégorie', 'City, title, category')} />
      <View style={styles.filterRow}>
        {['VIP', 'URGENT', 'TOP', 'HOME'].map((b) => (
          <Chip key={b} label={b} selected={filter.categorySlug === b} onPress={() => setFilter((f) => ({ ...f, categorySlug: f.categorySlug === b ? '' : b }))} />
        ))}
        <Button title={tx('Filtres', 'Filters')} variant="ghost" onPress={() => navigation.navigate('Search')} />
      </View>

      <Section
        title={tx('Dernières annonces', 'Latest')}
        subtitle={loading ? tx('Chargement...', 'Loading...') : tx(`${items.length} résultats`, `${items.length} results`)}
        action={<Button title={tx('Créer', 'Create')} variant="secondary" onPress={() => navigation.navigate('CreateAd')} />}
      >
        {items.length === 0 && !loading ? (
          <EmptyState
            title={tx('Aucune annonce pour le moment', 'No listings yet')}
            subtitle={tx('Essayez d’élargir les filtres ou créez la première annonce.', 'Try widening filters or create the first ad.')}
            action={<Button title={tx('Créer une annonce', 'Create listing')} onPress={() => navigation.navigate('CreateAd')} />}
          />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            contentContainerStyle={{ gap: 14 }}
            renderItem={({ item }) => (
              <Pressable onPress={() => navigation.navigate('AdDetail', { id: item.id })}>
                <Card
                  title={item.title}
                  subtitle={`${item.city} - ${item.categorySlug}`}
                  price={item.price ? `${item.price}` : undefined}
                  image={item.media?.[0]?.url}
                  badges={(item.badges || []).slice(0, 1).map((b) => (
                    <Badge key={b} label={b} tone={boostTone[b] || 'accent'} />
                  ))}
                />
              </Pressable>
            )}
          />
        )}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginTop: 6,
    marginBottom: 18
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800'
  },
  subtitle: {
    color: colors.muted,
    marginTop: 6
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 16
  }
});
