import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { apiFetch } from '../../lib/api';
import { colors } from '../../lib/theme';
import { notifyError, notifySuccess } from '../../lib/toast';
import { normalizeCameroonPhone } from '../../lib/phone';
import { useI18n } from '../../lib/i18n';

const boostTypes = ['VIP', 'URGENT', 'TOP', 'HOME'];
const providers = ['MTN', 'ORANGE', 'STRIPE'];

function makeIdempotencyKey(prefix) {
  if (global?.crypto?.randomUUID) {
    return `${prefix}_${global.crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function BoostScreen({ route, navigation }) {
  const { tx, lang } = useI18n();
  const { adId } = route.params || {};
  if (!adId) {
    return (
      <Screen>
        <Text style={{ color: colors.text }}>{tx('Annonce introuvable.', 'Missing adId.')}</Text>
      </Screen>
    );
  }
  const [type, setType] = React.useState('VIP');
  const [durationHours, setDurationHours] = React.useState('24');
  const [provider, setProvider] = React.useState('MTN');
  const [status, setStatus] = React.useState(null);
  const [phone, setPhone] = React.useState('');
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US';

  const boostWithCredits = async () => {
    try {
      const res = await apiFetch(`/ads/${adId}/boost`, {
        method: 'POST',
        body: JSON.stringify({ type, durationHours: Number(durationHours) })
      });
      const message = tx(`Boost activé jusqu’au ${new Date(res.endAt).toLocaleString(locale)}`, `Boosted until ${new Date(res.endAt).toLocaleString(locale)}`);
      setStatus(message);
      notifySuccess(message);
    } catch (e) {
      setStatus(e?.error || tx('Boost impossible', 'Boost failed'));
      notifyError(e, tx('Boost impossible', 'Boost failed'));
    }
  };

  const boostWithPayment = async () => {
    let normalizedPhone = null;
    if (provider === 'MTN' || provider === 'ORANGE') {
      normalizedPhone = normalizeCameroonPhone(phone);
      if (!normalizedPhone) {
        notifyError(null, tx('Numéro camerounais invalide.', 'Invalid Cameroon phone number.'));
        return;
      }
    }
    const res = await apiFetch('/payments/init', {
      method: 'POST',
      body: JSON.stringify({
        provider,
        productType: 'BOOST',
        productRefId: adId,
        boostType: type,
        durationHours: Number(durationHours),
        phone: normalizedPhone,
        idempotencyKey: makeIdempotencyKey('boost'),
      })
    });
    navigation.navigate('PaymentStatus', { intentId: res.intentId, redirectUrl: res.checkoutUrl || res.paymentUrl || res.redirectUrl });
  };

  return (
    <Screen scroll>
      <Text style={styles.title}>{tx('Booster une annonce', 'Boost listing')}</Text>
      <View style={styles.row}>
        {boostTypes.map((b) => (
          <Button key={b} title={b} variant={type === b ? 'primary' : 'secondary'} onPress={() => setType(b)} />
        ))}
      </View>
      <Input label={tx('Durée (heures)', 'Duration (hours)')} value={durationHours} onChangeText={setDurationHours} keyboardType="number-pad" />

      <Text style={styles.subtitle}>{tx('Payer en crédits', 'Pay with credits')}</Text>
      <Button title={tx('Booster avec crédits', 'Boost with credits')} variant="secondary" onPress={boostWithCredits} />

      <Text style={styles.subtitle}>{tx('Payer par argent', 'Pay with money')}</Text>
      <View style={styles.row}>
        {providers.map((p) => (
          <Button key={p} title={p} variant={provider === p ? 'primary' : 'secondary'} onPress={() => setProvider(p)} />
        ))}
      </View>
      {(provider === 'MTN' || provider === 'ORANGE') ? (
        <Input label={tx('Téléphone', 'Phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      ) : null}
      <Button title={tx('Démarrer le paiement', 'Start payment')} onPress={boostWithPayment} />

      {status ? <Text style={styles.status}>{status}</Text> : null}
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
  subtitle: {
    color: colors.muted,
    marginTop: 18,
    marginBottom: 8
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12
  },
  status: {
    color: colors.accent,
    marginTop: 12
  }
});
