import React from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import { Screen } from '../../components/Screen';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Chip } from '../../components/Chip';
import { apiFetch } from '../../lib/api';
import { colors } from '../../lib/theme';
import { buildQuery } from '../../lib/helpers';
import { useI18n } from '../../lib/i18n';

export function SearchScreen({ navigation }) {
  const { tx } = useI18n();
  const [form, setForm] = React.useState({
    q: '',
    city: '',
    country: 'CM',
    categorySlug: '',
    minPrice: '',
    maxPrice: '',
    tags: '',
    sort: 'premium',
    lat: '',
    lng: '',
    radiusKm: ''
  });
  const [suggestions, setSuggestions] = React.useState({ categories: [], cities: [], tags: [] });
  const [suggestOpen, setSuggestOpen] = React.useState(false);
  const [reco, setReco] = React.useState([]);
  const [topCities, setTopCities] = React.useState([]);
  const [themes, setThemes] = React.useState([]);
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  const update = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const runSearch = async (nextForm) => {
    const payload = nextForm || form;
    setLoading(true);
    try {
      const res = await apiFetch(`/ads${buildQuery(payload)}`);
      setItems(res.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    runSearch();
  }, []);

  React.useEffect(() => {
    const term = form.q.trim();
    if (!term) {
      setSuggestions({ categories: [], cities: [], tags: [] });
      setSuggestOpen(false);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const res = await apiFetch(`/search/suggest${buildQuery({ term, limit: 6, country: form.country || 'CM' })}`);
        setSuggestions(res);
        setSuggestOpen(true);
      } catch {
        setSuggestions({ categories: [], cities: [], tags: [] });
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [form.q, form.country]);

  React.useEffect(() => {
    const loadCollections = async () => {
      try {
        const resCities = await apiFetch(`/collections/top-cities${buildQuery({ limit: 6, country: form.country || 'CM' })}`);
        setTopCities(resCities.items || []);
      } catch {
        setTopCities([]);
      }
      try {
        const resThemes = await apiFetch(`/collections/themes${buildQuery({ limit: 6, country: form.country || 'CM' })}`);
        setThemes(resThemes.items || []);
      } catch {
        setThemes([]);
      }
    };
    loadCollections();
  }, [form.country]);

  React.useEffect(() => {
    const loadReco = async () => {
      try {
        const res = await apiFetch(`/ads/recommendations${buildQuery({
          categorySlug: form.categorySlug || undefined,
          city: form.city || undefined,
          tags: form.tags || undefined,
          country: form.country || 'CM',
          limit: 8
        })}`);
        setReco(res.items || []);
      } catch {
        setReco([]);
      }
    };
    loadReco();
  }, [form.categorySlug, form.city, form.tags, form.country]);

  const applySuggestion = (payload) => {
    const nextForm = { ...form };
    if (payload.type === 'category') {
      nextForm.categorySlug = payload.slug;
    } else if (payload.type === 'city') {
      nextForm.city = payload.value;
    } else if (payload.type === 'tag') {
      const nextTags = Array.from(new Set(`${form.tags}`.split(',').map((t) => t.trim()).filter(Boolean).concat(payload.value))).join(', ');
      nextForm.tags = nextTags;
    }
    setForm(nextForm);
    setSuggestOpen(false);
    runSearch(nextForm);
  };

  const useLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const pos = await Location.getCurrentPositionAsync({});
    const nextForm = {
      ...form,
      lat: String(pos.coords.latitude),
      lng: String(pos.coords.longitude),
      radiusKm: form.radiusKm || '10'
    };
    setForm(nextForm);
    runSearch(nextForm);
  };

  return (
    <Screen scroll>
      <Text style={styles.title}>{tx('Recherche & filtres', 'Search & filters')}</Text>
      <Input label={tx('Recherche', 'Query')} value={form.q} onChangeText={update('q')} placeholder={tx('titre, description', 'title, description')} />
      {suggestOpen ? (
        <View style={styles.suggestWrap}>
          {suggestions.categories?.length ? (
            <View style={styles.suggestBlock}>
              <Text style={styles.suggestTitle}>{tx('Catégories', 'Categories')}</Text>
              <View style={styles.chipRow}>
                {suggestions.categories.map((c) => (
                  <Chip key={c.slug} label={c.name} onPress={() => applySuggestion({ type: 'category', slug: c.slug })} />
                ))}
              </View>
            </View>
          ) : null}
          {suggestions.cities?.length ? (
            <View style={styles.suggestBlock}>
              <Text style={styles.suggestTitle}>{tx('Villes', 'Cities')}</Text>
              <View style={styles.chipRow}>
                {suggestions.cities.map((c) => (
                  <Chip key={c} label={c} onPress={() => applySuggestion({ type: 'city', value: c })} />
                ))}
              </View>
            </View>
          ) : null}
          {suggestions.tags?.length ? (
            <View style={styles.suggestBlock}>
              <Text style={styles.suggestTitle}>{tx('Tags', 'Tags')}</Text>
              <View style={styles.chipRow}>
                {suggestions.tags.map((t) => (
                  <Chip key={t} label={`#${t}`} onPress={() => applySuggestion({ type: 'tag', value: t })} />
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
      <Input label={tx('Ville', 'City')} value={form.city} onChangeText={update('city')} placeholder="Douala" />
      <Input label={tx('Pays', 'Country')} value={form.country} onChangeText={update('country')} placeholder="CM" />
      <Input label={tx('Catégorie', 'Category')} value={form.categorySlug} onChangeText={update('categorySlug')} placeholder="escort" />
      <Input label={tx('Tags', 'Tags')} value={form.tags} onChangeText={update('tags')} placeholder={tx('massage, vip', 'massage, vip')} />
      <View style={styles.grid}>
        <Input label={tx('Prix min', 'Min price')} value={form.minPrice} onChangeText={update('minPrice')} placeholder="0" keyboardType="numeric" style={{ flex: 1 }} />
        <Input label={tx('Prix max', 'Max price')} value={form.maxPrice} onChangeText={update('maxPrice')} placeholder="100000" keyboardType="numeric" style={{ flex: 1 }} />
      </View>
      <View style={styles.block}>
        <Text style={styles.label}>{tx('Tri', 'Sort')}</Text>
        <View style={styles.chipRow}>
          <Chip label={tx('Qualité premium', 'Premium quality')} selected={form.sort === 'premium'} onPress={() => update('sort')('premium')} />
          <Chip label={tx('Fraîcheur', 'Freshness')} selected={form.sort === 'fresh'} onPress={() => update('sort')('fresh')} />
          <Chip label={tx('Distance', 'Distance')} selected={form.sort === 'distance'} onPress={() => update('sort')('distance')} />
        </View>
      </View>
      <View style={styles.block}>
        <Text style={styles.label}>{tx('Rayon (km)', 'Radius (km)')}</Text>
        <View style={styles.chipRow}>
          {['', '5', '10', '25', '50'].map((r) => (
            <Chip
              key={r || 'none'}
              label={r ? `${r} km` : tx('Aucun', 'None')}
              selected={form.radiusKm === r}
              onPress={() => update('radiusKm')(r)}
            />
          ))}
        </View>
      </View>
      <View style={styles.actions}>
        <Button title={tx('Utiliser ma position', 'Use my location')} variant="secondary" onPress={useLocation} />
        <Button title={tx('Appliquer', 'Apply')} onPress={runSearch} disabled={loading} />
      </View>
      <View style={styles.actions}>
        <Button title={loading ? tx('Recherche...', 'Searching...') : tx('Rechercher', 'Search')} onPress={runSearch} disabled={loading} />
        <Button title={tx('Ouvrir la carte', 'Open map')} variant="secondary" onPress={() => navigation.navigate('Map', { filters: form })} />
      </View>

      {reco.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{tx('Pour vous', 'Recommended')}</Text>
          <FlatList
            horizontal
            data={reco}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12 }}
            renderItem={({ item }) => (
              <Pressable onPress={() => navigation.navigate('AdDetail', { id: item.id })} style={{ width: 220 }}>
                <Card
                  title={item.title}
                  subtitle={`${item.city} · ${item.categorySlug}`}
                  price={item.price ? `${item.price}` : undefined}
                  image={item.media?.[0]?.url}
                />
              </Pressable>
            )}
          />
        </View>
      ) : null}

      {topCities.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{tx('Top villes', 'Top cities')}</Text>
          <View style={styles.chipRow}>
            {topCities.map((c) => (
              <Chip key={c.city} label={`${c.city} (${c.count})`} onPress={() => { update('city')(c.city); runSearch(); }} />
            ))}
          </View>
        </View>
      ) : null}

      {themes.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{tx('Thèmes', 'Themes')}</Text>
          <View style={styles.chipRow}>
            {themes.map((t) => (
              <Chip key={t.slug} label={`${t.label} (${t.count})`} onPress={() => { update('categorySlug')(t.slug); runSearch(); }} />
            ))}
          </View>
        </View>
      ) : null}

      {items.length === 0 && !loading ? (
        <EmptyState title={tx('Aucun résultat', 'No results')} subtitle={tx('Essayez d’autres filtres ou créez une annonce.', 'Try different filters or create a listing.')} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          contentContainerStyle={{ gap: 14, marginTop: 16 }}
          renderItem={({ item }) => (
            <Pressable onPress={() => navigation.navigate('AdDetail', { id: item.id })}>
              <Card
                title={item.title}
                subtitle={`${item.city} - ${item.categorySlug}`}
                price={item.price ? `${item.price}` : undefined}
                image={item.media?.[0]?.url}
              />
            </Pressable>
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
  suggestWrap: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    padding: 10
  },
  suggestBlock: {
    marginTop: 8
  },
  suggestTitle: {
    color: colors.muted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  grid: {
    flexDirection: 'row',
    gap: 12
  },
  block: {
    marginTop: 12
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10
  },
  section: {
    marginTop: 18,
    gap: 10
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700'
  }
});
