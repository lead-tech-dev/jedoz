import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Screen } from '../../components/Screen';
import { colors } from '../../lib/theme';
import { useI18n } from '../../lib/i18n';

export function SplashScreen() {
  const { tx } = useI18n();
  return (
    <Screen>
      <View style={styles.center}>
        <Text style={styles.title}>JEDOZ</Text>
        <Text style={styles.subtitle}>{tx('Chargement...', 'Loading experience...')}</Text>
        <ActivityIndicator color={colors.accent} style={{ marginTop: 16 }} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800'
  },
  subtitle: {
    color: colors.muted
  }
});
