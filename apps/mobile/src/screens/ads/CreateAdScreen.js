import React from 'react';
import { View, Text, StyleSheet, Image, Pressable } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Screen } from '../../components/Screen';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Section } from '../../components/Section';
import { colors } from '../../lib/theme';
import { presignUpload, uploadToPresignedUrl, confirmUpload } from '../../lib/s3';
import { apiFetch } from '../../lib/api';
import { notifyError, notifySuccess } from '../../lib/toast';
import { useI18n } from '../../lib/i18n';

function buildFileName(uri) {
  const parts = uri.split('/');
  return parts[parts.length - 1] || `upload_${Date.now()}.jpg`;
}

export function CreateAdScreen({ navigation }) {
  const { tx } = useI18n();
  const [form, setForm] = React.useState({
    title: '',
    description: '',
    city: '',
    country: 'CM',
    categorySlug: '',
    badges: []
  });
  const [media, setMedia] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [location, setLocation] = React.useState(null);
  const [ageConfirmed, setAgeConfirmed] = React.useState(false);

  const update = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const pickMedia = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.8
    });
    if (res.canceled) return;
    const assets = res.assets || [];
    const next = assets.map((asset) => ({
      uri: asset.uri,
      mimeType: asset.mimeType || 'image/jpeg',
      fileName: asset.fileName || buildFileName(asset.uri),
      size: asset.fileSize || asset.size || 0,
      type: asset.type || 'image'
    }));
    setMedia((prev) => [...prev, ...next]);
  };

  const useCurrentLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const pos = await Location.getCurrentPositionAsync({});
    setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
  };

  const uploadMedia = async () => {
    const uploaded = [];
    for (const item of media) {
      if (item.uploadedUrl) {
        uploaded.push(item);
        continue;
      }
      const presign = await presignUpload({
        fileName: item.fileName,
        mime: item.mimeType,
        size: item.size
      });
      await uploadToPresignedUrl({
        uploadUrl: presign.uploadUrl,
        fileUri: item.uri,
        mime: item.mimeType
      });
      if (presign.mediaId) await confirmUpload(presign.mediaId);
      uploaded.push({ ...item, uploadedUrl: presign.fileUrl });
    }
    setMedia(uploaded);
    return uploaded;
  };

  const submit = async () => {
    setError(null);
    if (!ageConfirmed) {
      const msg = tx('Vous devez confirmer avoir 18+ pour publier.', 'You must confirm you are 18+ to publish.');
      setError(msg);
      notifyError(null, msg);
      return;
    }
    setLoading(true);
    try {
      const uploaded = await uploadMedia();
      const payload = {
        title: form.title,
        description: form.description,
        city: form.city,
        country: form.country,
        categorySlug: form.categorySlug,
        badges: form.badges,
        ageConfirmed: true,
        dynamic: location ? { location } : {},
        media: uploaded
          .filter((m) => m.uploadedUrl)
          .map((m) => ({
            type: m.type || 'image',
            url: m.uploadedUrl,
            mime: m.mimeType,
            size: m.size
          }))
      };
      const ad = await apiFetch('/ads', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      notifySuccess(tx('Annonce créée.', 'Listing created.'));
      navigation.navigate('AdDetail', { id: ad.id });
    } catch (e) {
      setError(e?.error || e?.message || tx('Création impossible.', 'Failed to create listing'));
      notifyError(e, tx('Création impossible.', 'Failed to create listing'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <Text style={styles.title}>{tx('Créer une annonce', 'Create listing')}</Text>
      <Section title={tx('Infos principales', 'Main info')} subtitle={tx('Décrivez votre annonce', 'Describe your listing')}>
        <Input label={tx('Titre', 'Title')} value={form.title} onChangeText={update('title')} placeholder={tx('Annonce premium', 'Premium listing')} />
        <Input label={tx('Description', 'Description')} value={form.description} onChangeText={update('description')} placeholder={tx('Décrivez le service', 'Describe the service')} multiline />
      </Section>

      <Section title={tx('Localisation', 'Location')}>
        <Input label={tx('Ville', 'City')} value={form.city} onChangeText={update('city')} placeholder="Douala" />
        <Input label={tx('Pays', 'Country')} value={form.country} onChangeText={update('country')} placeholder="CM" />
        <Button title={location ? tx('Position définie', 'Location set') : tx('Utiliser ma position', 'Use current location')} variant="secondary" onPress={useCurrentLocation} />
      </Section>

      <Section title={tx('Catégorie', 'Category')}>
        <Input label={tx('Slug catégorie', 'Category slug')} value={form.categorySlug} onChangeText={update('categorySlug')} placeholder="escort" />
      </Section>

      <Section title={tx('Médias', 'Media')}>
        <View style={styles.mediaGrid}>
          {media.map((m) => (
            <View key={m.uri} style={styles.mediaItem}>
              <Image source={{ uri: m.uri }} style={styles.mediaImage} />
            </View>
          ))}
          <Pressable style={styles.mediaAdd} onPress={pickMedia}>
            <Text style={styles.mediaAddText}>+</Text>
          </Pressable>
        </View>
      </Section>

      {error ? <Text style={styles.error}>{String(error)}</Text> : null}
      <Pressable style={styles.ageRow} onPress={() => setAgeConfirmed((prev) => !prev)}>
        <View style={[styles.ageBox, ageConfirmed && styles.ageBoxChecked]} />
        <Text style={styles.ageText}>{tx('Je confirme avoir 18+ pour publier.', 'I confirm I am 18+ to publish.')}</Text>
      </Pressable>
      <Button title={loading ? tx('Publication...', 'Publishing...') : tx('Publier', 'Publish')} onPress={submit} disabled={loading || !ageConfirmed} style={{ marginTop: 16 }} />
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
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  mediaItem: {
    width: 92,
    height: 92,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line
  },
  mediaImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover'
  },
  mediaAdd: {
    width: 92,
    height: 92,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panelAlt,
    alignItems: 'center',
    justifyContent: 'center'
  },
  mediaAddText: {
    color: colors.muted,
    fontSize: 28,
    fontWeight: '700'
  },
  error: {
    color: colors.danger,
    marginTop: 10
  },
  ageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12
  },
  ageBox: {
    width: 18,
    height: 18,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel
  },
  ageBoxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent
  },
  ageText: {
    color: colors.text,
    fontSize: 13
  }
});
