import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius } from '../lib/theme';

export function EmptyState({ title, subtitle, action }) {
  return (
    <View style={styles.box}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {action ? <View style={{ marginTop: 12 }}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
    backgroundColor: colors.panel
  },
  title: {
    color: colors.text,
    fontWeight: '700'
  },
  subtitle: {
    color: colors.muted,
    marginTop: 6
  }
});
