import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius } from '../lib/theme';

export function Badge({ label, tone = 'neutral' }) {
  return (
    <View style={[styles.badge, styles[tone]]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'rgba(255,255,255,0.05)'
  },
  text: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase'
  },
  neutral: {},
  accent: {
    borderColor: 'rgba(51,199,196,0.4)',
    backgroundColor: 'rgba(51,199,196,0.14)'
  },
  warning: {
    borderColor: 'rgba(245,158,11,0.4)',
    backgroundColor: 'rgba(245,158,11,0.14)'
  },
  danger: {
    borderColor: 'rgba(239,68,68,0.4)',
    backgroundColor: 'rgba(239,68,68,0.14)'
  }
});
