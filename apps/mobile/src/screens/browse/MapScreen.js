import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { Screen } from '../../components/Screen';
import { apiFetch } from '../../lib/api';
import { colors } from '../../lib/theme';
import { fallbackLocation, buildQuery } from '../../lib/helpers';
import { useI18n } from '../../lib/i18n';

const { width } = Dimensions.get('window');

export function MapScreen({ navigation, route }) {
  const { tx } = useI18n();
  const [region, setRegion] = React.useState(null);
  const [items, setItems] = React.useState([]);

  React.useEffect(() => {
    const boot = async () => {
      const filterLat = route?.params?.filters?.lat;
      const filterLng = route?.params?.filters?.lng;
      if (filterLat && filterLng) {
        setRegion({
          latitude: parseFloat(filterLat),
          longitude: parseFloat(filterLng),
          latitudeDelta: 0.18,
          longitudeDelta: 0.18
        });
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({});
        setRegion({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          latitudeDelta: 0.18,
          longitudeDelta: 0.18
        });
      } else {
        setRegion({ latitude: 3.848, longitude: 11.502, latitudeDelta: 0.4, longitudeDelta: 0.4 });
      }
    };
    boot();
  }, [route?.params?.filters?.lat, route?.params?.filters?.lng]);

  React.useEffect(() => {
    const load = async () => {
      const query = buildQuery(route?.params?.filters || {});
      const res = await apiFetch(`/ads${query}`);
      setItems(res.items || []);
    };
    load();
  }, [route?.params?.filters]);

  if (!region) {
    return (
      <Screen>
        <Text style={{ color: colors.text }}>{tx('Chargement de la carte...', 'Loading map...')}</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.title}>{tx('Vue carte', 'Map view')}</Text>
      <View style={styles.mapWrap}>
        <MapView style={styles.map} initialRegion={region}>
        {items.map((ad) => {
          const loc = fallbackLocation(ad, { latitude: region.latitude, longitude: region.longitude });
          return (
            <Marker
              key={ad.id}
              coordinate={{ latitude: loc.latitude, longitude: loc.longitude }}
              title={ad.title}
              description={ad.city}
              onPress={() => navigation.navigate('AdDetail', { id: ad.id })}
            />
          );
        })}
        </MapView>
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerText}>{tx('Touchez un marqueur pour ouvrir l’annonce.', 'Tap a marker to open the listing.')}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 12
  },
  mapWrap: {
    width: width - 36,
    height: 420,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line
  },
  map: {
    width: '100%',
    height: '100%'
  },
  footer: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel
  },
  footerText: {
    color: colors.muted
  }
});
