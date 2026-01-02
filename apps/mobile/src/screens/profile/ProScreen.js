import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Screen } from '../../components/Screen';
import { Section } from '../../components/Section';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { EmptyState } from '../../components/EmptyState';
import { apiFetch } from '../../lib/api';
import { colors } from '../../lib/theme';
import { useI18n } from '../../lib/i18n';
import { notifyError } from '../../lib/toast';
import { normalizeCameroonPhone } from '../../lib/phone';

const providers = ['MTN', 'ORANGE', 'STRIPE'];

function makeIdempotencyKey(prefix) {
  if (global?.crypto?.randomUUID) {
    return `${prefix}_${global.crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function currencyFmt(amount, currency, locale) {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function ProScreen({ navigation }) {
  const { tx, lang } = useI18n();
  const [offers, setOffers] = React.useState([]);
  const [active, setActive] = React.useState(null);
  const [provider, setProvider] = React.useState('MTN');
  const [phone, setPhone] = React.useState('');
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US';

  const load = React.useCallback(async () => {
    try {
      const [offersRes, meRes] = await Promise.all([
        apiFetch('/pro/offers'),
        apiFetch('/pro/me')
      ]);
      setOffers(offersRes.items || []);
      setActive(meRes.active || null);
    } catch {
      setOffers([]);
      setActive(null);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const startPayment = async (offerId) => {
    let normalizedPhone = null;
    if (provider === 'MTN' || provider === 'ORANGE') {
      normalizedPhone = normalizeCameroonPhone(phone);
      if (!normalizedPhone) {
        notifyError(null, tx('Numéro camerounais invalide.', 'Invalid Cameroon phone number.'));
        return;
      }
    }
    const intent = await apiFetch('/payments/init', {
      method: 'POST',
      body: JSON.stringify({
        provider,
        productType: 'PRO_SUBSCRIPTION',
        productRefId: offerId,
        phone: normalizedPhone,
        idempotencyKey: makeIdempotencyKey('pro'),
      })
    });
    navigation.navigate('PaymentStatus', { intentId: intent.intentId, redirectUrl: intent.checkoutUrl || intent.paymentUrl || intent.redirectUrl });
  };

  return (
    <Screen scroll>
      <Text style={styles.title}>{tx('Abonnement PRO', 'PRO subscription')}</Text>
      {active ? (
        <View style={styles.active}>
          <Text style={styles.activeTitle}>{tx('Plan actif', 'Active plan')}: {active.plan}</Text>
          <Text style={styles.activeSubtitle}>{tx('Expire le', 'Ends at')} {new Date(active.endAt).toLocaleDateString(locale)}</Text>
        </View>
      ) : (
        <Text style={styles.subtitle}>{tx('Aucun abonnement actif.', 'No active subscription.')}</Text>
      )}

      <Section title={tx('Moyen de paiement', 'Payment provider')}>
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

      <Section title={tx('Offres', 'Offers')}>
        {offers.length === 0 ? (
          <EmptyState title={tx('Aucune offre', 'No offers')} subtitle={tx('Créez des offres PRO dans l’admin.', 'Create PRO offers in the admin panel.')} />
        ) : (
          offers.map((offer) => (
            <View key={offer.id} style={styles.offerCard}>
              <Text style={styles.offerTitle}>{offer.name}</Text>
              <Text style={styles.offerSubtitle}>{offer.plan} - {offer.durationDays} {tx('jours', 'days')}</Text>
              <Text style={styles.offerPrice}>
                {offer.price ? currencyFmt(offer.price, offer.currency || 'XAF', locale) : `${offer.creditsCost} ${tx('crédits', 'credits')}`}
              </Text>
              <View style={styles.offerActions}>
                <Button title={tx('Payer', 'Pay')} onPress={() => startPayment(offer.id)} />
              </View>
            </View>
          ))
        )}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 12
  },
  subtitle: {
    color: colors.muted,
    marginBottom: 12
  },
  active: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    marginBottom: 12
  },
  activeTitle: {
    color: colors.text,
    fontWeight: '700'
  },
  activeSubtitle: {
    color: colors.muted,
    marginTop: 4
  },
  providerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  offerCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel
  },
  offerTitle: {
    color: colors.text,
    fontWeight: '700'
  },
  offerSubtitle: {
    color: colors.muted,
    marginTop: 4
  },
  offerActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12
  },
  offerPrice: {
    color: colors.text,
    fontWeight: '700',
    marginTop: 6
  }
});
