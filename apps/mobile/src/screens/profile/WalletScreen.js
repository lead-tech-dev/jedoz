import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Screen } from '../../components/Screen';
import { Section } from '../../components/Section';
import { Button } from '../../components/Button';
import { ListRow } from '../../components/ListRow';
import { EmptyState } from '../../components/EmptyState';
import { apiFetch } from '../../lib/api';
import { currencyFmt } from '../../lib/helpers';
import { colors } from '../../lib/theme';
import { useI18n } from '../../lib/i18n';

export function WalletScreen({ navigation }) {
  const { tx, lang } = useI18n();
  const [wallet, setWallet] = React.useState(null);
  const [txs, setTxs] = React.useState([]);
  const [packs, setPacks] = React.useState([]);
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US';

  const load = React.useCallback(async () => {
    try {
      const [walletRes, packsRes] = await Promise.all([
        apiFetch('/credits/wallet'),
        apiFetch('/credits/packs')
      ]);
      setWallet(walletRes.wallet);
      setTxs(walletRes.txs || []);
      setPacks(packsRes.items || []);
    } catch {
      setWallet(null);
      setTxs([]);
      setPacks([]);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen scroll>
      <View style={styles.hero}>
        <Text style={styles.title}>{tx('Portefeuille', 'Wallet')}</Text>
        <Text style={styles.balance}>{wallet?.balance ?? 0} {tx('crédits', 'credits')}</Text>
      </View>

      <Section title={tx('Packs de crédits', 'Credit packs')} subtitle={tx('Achetez des crédits pour publier et booster', 'Buy credits to publish and boost')}>
        {packs.length === 0 ? (
          <EmptyState title={tx('Aucun pack', 'No packs')} subtitle={tx('Créez des packs de crédits dans l’admin.', 'Create credit packs in admin.')} />
        ) : (
          packs.map((pack) => (
            <ListRow
              key={pack.id}
              title={`${pack.name} - ${pack.credits} ${tx('crédits', 'credits')}`}
              subtitle={currencyFmt(pack.price, pack.currency)}
              right={<Button title={tx('Acheter', 'Buy')} onPress={() => navigation.navigate('PaymentStatus', { packId: pack.id })} />}
            />
          ))
        )}
      </Section>

      <Section title={tx('Transactions', 'Transactions')} subtitle={tx('25 derniers mouvements', 'Last 25 movements')}>
        {txs.length === 0 ? (
          <EmptyState title={tx('Aucune transaction', 'No transactions')} subtitle={tx('Votre historique apparaîtra ici.', 'Your history will appear here.')} />
        ) : (
          txs.map((tx) => (
            <ListRow
              key={tx.id}
              title={`${tx.type} - ${tx.reason}`}
              subtitle={new Date(tx.createdAt).toLocaleString(locale)}
              right={<Text style={{ color: colors.muted }}>{tx.amount}</Text>}
            />
          ))
        )}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginTop: 8,
    marginBottom: 16
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800'
  },
  balance: {
    color: colors.accent2,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 6
  }
});
