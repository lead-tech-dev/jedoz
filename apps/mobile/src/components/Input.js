import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { colors, radius } from '../lib/theme';

export function Input({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType, autoCapitalize = 'none', multiline, style, inputStyle }) {
  return (
    <View style={[styles.wrap, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        style={[styles.input, multiline && styles.multiline, inputStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  input: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  multiline: {
    minHeight: 110,
    textAlignVertical: 'top'
  }
});
