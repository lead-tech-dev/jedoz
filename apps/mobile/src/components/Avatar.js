import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { colors, radius } from '../lib/theme';

export function Avatar({ uri, name, size = 48 }) {
  const initials = name ? name.split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase() : 'U';
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={styles.text}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.panelAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line
  },
  text: {
    color: colors.text,
    fontWeight: '700'
  }
});
