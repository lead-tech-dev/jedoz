import React from 'react';
import { Pressable, Text, StyleSheet, View } from 'react-native';
import { colors, radius } from '../lib/theme';

export function Button({ title, onPress, variant = 'primary', icon, disabled, style, textStyle }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style
      ]}
    >
      <View style={styles.row}>
        {icon ? <View style={styles.icon}>{icon}</View> : null}
        <Text style={[styles.text, styles[`text_${variant}`], textStyle]}>{title}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  icon: {
    width: 18,
    alignItems: 'center'
  },
  primary: {
    backgroundColor: colors.accent
  },
  secondary: {
    backgroundColor: colors.panelAlt,
    borderColor: colors.line
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: colors.line
  },
  danger: {
    backgroundColor: colors.danger
  },
  disabled: {
    opacity: 0.5
  },
  pressed: {
    transform: [{ translateY: 1 }]
  },
  text: {
    fontWeight: '700',
    color: colors.text
  },
  text_primary: {
    color: '#041314'
  },
  text_secondary: {
    color: colors.text
  },
  text_ghost: {
    color: colors.text
  },
  text_danger: {
    color: '#fff'
  }
});
