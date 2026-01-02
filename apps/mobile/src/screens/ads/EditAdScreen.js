import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { Screen } from '../../components/Screen';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { apiFetch } from '../../lib/api';
import { colors } from '../../lib/theme';
import { notifyError, notifySuccess } from '../../lib/toast';
import { useI18n } from '../../lib/i18n';

export function EditAdScreen({ route, navigation }) {
  const { tx } = useI18n();
  const { id } = route.params || {};
  const [form, setForm] = React.useState({ title: '', description: '', city: '', country: '', categorySlug: '' });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        const ad = await apiFetch(`/ads/${id}`);
        setForm({
          title: ad.title || '',
          description: ad.description || '',
          city: ad.city || '',
          country: ad.country || '',
          categorySlug: ad.categorySlug || ''
        });
      } catch {}
    };
    load();
  }, [id]);

  const update = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    setError(null);
    setLoading(true);
    try {
      await apiFetch(`/ads/${id}`, { method: 'PUT', body: JSON.stringify(form) });
      notifySuccess(tx('Annonce mise à jour.', 'Listing updated.'));
      navigation.navigate('AdDetail', { id });
    } catch (e) {
      setError(e?.error || e?.message || tx('Mise à jour impossible.', 'Failed to update listing'));
      notifyError(e, tx('Mise à jour impossible.', 'Failed to update listing'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <Text style={styles.title}>{tx('Modifier une annonce', 'Edit listing')}</Text>
      <Input label={tx('Titre', 'Title')} value={form.title} onChangeText={update('title')} />
      <Input label={tx('Description', 'Description')} value={form.description} onChangeText={update('description')} multiline />
      <Input label={tx('Ville', 'City')} value={form.city} onChangeText={update('city')} />
      <Input label={tx('Pays', 'Country')} value={form.country} onChangeText={update('country')} />
      <Input label={tx('Catégorie', 'Category')} value={form.categorySlug} onChangeText={update('categorySlug')} />
      {error ? <Text style={styles.error}>{String(error)}</Text> : null}
      <Button title={loading ? tx('Enregistrement...', 'Saving...') : tx('Enregistrer', 'Save changes')} onPress={save} disabled={loading} style={{ marginTop: 12 }} />
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
  error: {
    color: colors.danger,
    marginTop: 10
  }
});
