import React from 'react';
import { FlatList, View, Text, StyleSheet } from 'react-native';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Button } from '../../components/Button';
import { apiFetch } from '../../lib/api';
import { colors } from '../../lib/theme';
import { useI18n } from '../../lib/i18n';

export function MyAdsScreen({ navigation }) {
  const { tx } = useI18n();
  const [items, setItems] = React.useState([]);

  React.useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch('/ads/mine');
        setItems(res.items || []);
      } catch {
        setItems([]);
      }
    };
    load();
  }, []);

  return (
    <Screen scroll>
      <Text style={styles.title}>{tx('Mes annonces', 'My listings')}</Text>
      {items.length === 0 ? (
        <EmptyState title={tx('Aucune annonce', 'No listings yet')} subtitle={tx('Publiez votre première annonce depuis l’accueil.', 'Publish your first listing from the home tab.')} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          contentContainerStyle={{ gap: 14 }}
          renderItem={({ item }) => (
            <Card
              title={item.title}
              subtitle={`${item.city} - ${item.status}`}
              image={item.media?.[0]?.url}
              footer={(
                <View style={styles.footerRow}>
                  <Button title={tx('Voir', 'View')} variant="secondary" onPress={() => navigation.navigate('AdDetail', { id: item.id })} />
                  <Button title={tx('Éditer', 'Edit')} onPress={() => navigation.navigate('EditAd', { id: item.id })} />
                </View>
              )}
            />
          )}
        />
      )}
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
  footerRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end'
  }
});
