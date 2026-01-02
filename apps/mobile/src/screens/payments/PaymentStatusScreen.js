import React from 'react';
import { View, Text, StyleSheet, Linking } from 'react-native';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Section } from '../../components/Section';
import { apiFetch } from '../../lib/api';
import { colors } from '../../lib/theme';
import { notifyError, notifyInfo } from '../../lib/toast';
import { normalizeCameroonPhone } from '../../lib/phone';
import { useI18n } from '../../lib/i18n';

const providers = ['MTN', 'ORANGE', 'STRIPE'];

function makeIdempotencyKey(prefix) {
  if (global?.crypto?.randomUUID) {
    return `${prefix}_${global.crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function PaymentStatusScreen({ route }) {
  const { tx } = useI18n();
  const [provider, setProvider] = React.useState('MTN');
  const [intentId, setIntentId] = React.useState(route.params?.intentId || null);
  const [status, setStatus] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [redirectUrl, setRedirectUrl] = React.useState(route.params?.redirectUrl || null);
  const [phone, setPhone] = React.useState('');

  React.useEffect(() => {
    if (intentId) {
      apiFetch(`/payments/${intentId}/status`).then((res) => {
        setStatus(res.status || res.intent?.status || 'UNKNOWN');
      }).catch((err) => {
        notifyError(err, tx('Impossible de vérifier le paiement.', 'Unable to verify payment.'));
      });
    }
  }, [intentId]);

  const startPayment = async () => {
    const { packId, offerId, adId } = route.params || {};
    let productType = null;
    let productRefId = null;
    if (packId) {
      productType = 'CREDIT_PACK';
      productRefId = packId;
    } else if (offerId) {
      productType = 'PRO_SUBSCRIPTION';
      productRefId = offerId;
    } else if (adId) {
      productType = 'BOOST';
      productRefId = adId;
    }
    if (!productType) return;
    setLoading(true);
    try {
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
          productType,
          productRefId,
          phone: normalizedPhone,
          idempotencyKey: makeIdempotencyKey('pay'),
        })
      });
      setIntentId(res.intentId);
      const url = res.checkoutUrl || res.paymentUrl || res.redirectUrl || null;
      setRedirectUrl(url);
      if (url) {
        Linking.openURL(url);
      }
      notifyInfo(res.instructions || tx('Paiement en attente.', 'Payment pending.'));
    } catch (err) {
      notifyError(err, tx('Paiement impossible.', 'Payment failed.'));
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async () => {
    if (!intentId) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/payments/${intentId}/status`);
      setStatus(res.status || res.intent?.status || 'UNKNOWN');
    } catch (e) {
      setStatus(e?.error || 'ERROR');
      notifyError(e, tx('Paiement impossible.', 'Payment failed.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <Text style={styles.title}>{tx('Paiement', 'Payment')}</Text>
      <Section title={tx('Fournisseur', 'Provider')}>
        <View style={styles.providerRow}>
          {providers.map((p) => (
            <Button key={p} title={p} variant={provider === p ? 'primary' : 'secondary'} onPress={() => setProvider(p)} />
          ))}
        </View>
      </Section>
      {(provider === 'MTN' || provider === 'ORANGE') ? (
        <Section title={tx('Téléphone', 'Phone')}>
          <Input value={phone} onChangeText={setPhone} placeholder={tx('2376xxxxxxx', '2376xxxxxxx')} keyboardType="phone-pad" />
        </Section>
      ) : null}

      <Section title={tx('Statut', 'Status')}>
        <Text style={styles.status}>{status || tx('Aucun paiement démarré', 'No payment started')}</Text>
        {intentId ? <Text style={styles.meta}>{tx('Intent', 'Intent')}: {intentId}</Text> : null}
        {redirectUrl ? <Text style={styles.meta}>{tx('Redirection', 'Redirect')}: {redirectUrl}</Text> : null}
      </Section>

      <View style={styles.actions}>
        <Button title={loading ? tx('Traitement...', 'Processing...') : tx('Démarrer le paiement', 'Start payment')} onPress={startPayment} disabled={loading} />
        <Button title={tx('Vérifier le statut', 'Check status')} variant="secondary" onPress={checkStatus} />
      </View>
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
  providerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  status: {
    color: colors.text,
    fontWeight: '700'
  },
  meta: {
    color: colors.muted,
    marginTop: 4
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16
  }
});
