import React from 'react';
import { View, Text, StyleSheet, BackHandler, Platform } from 'react-native';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { colors } from '../../lib/theme';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../lib/i18n';

export function AgeGateScreen() {
  const { tx } = useI18n();
  const { acceptAgeGate } = useAuth();
  return (
    <Screen>
      <View style={styles.card}>
        <Text style={styles.title}>{tx('18+ uniquement', '18+ Only')}</Text>
        <Text style={styles.subtitle}>
          {tx('Cette application contient du contenu adulte. Confirmez que vous avez 18+ pour continuer.', 'This app contains adult content. Confirm you are 18+ to continue.')}
        </Text>
        <Button title={tx("J'ai 18+", 'I am 18+')} onPress={acceptAgeGate} style={{ marginTop: 16 }} />
        <Button
          title={tx('Quitter', 'Exit')}
          variant="ghost"
          onPress={() => {
            if (Platform.OS === 'android') BackHandler.exitApp();
          }}
          style={{ marginTop: 10 }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 80,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800'
  },
  subtitle: {
    color: colors.muted,
    marginTop: 8
  }
});
