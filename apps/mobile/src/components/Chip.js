import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { colors, radius } from '../lib/theme';

export function Chip({ label, selected, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.selected]}>
      <Text style={[styles.text, selected && styles.textSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.chip
  },
  text: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600'
  },
  selected: {
    borderColor: 'rgba(51,199,196,0.6)',
    backgroundColor: 'rgba(51,199,196,0.18)'
  },
  textSelected: {
    color: colors.text
  }
});
