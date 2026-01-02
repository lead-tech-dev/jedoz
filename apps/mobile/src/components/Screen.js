import React from 'react';
import { SafeAreaView, View, ScrollView, StyleSheet, Platform, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../lib/theme';

export function Screen({ children, scroll = false, style, contentStyle, header }) {
  return (
    <SafeAreaView style={[styles.safe, style]}>
      <LinearGradient
        colors={[colors.bg, colors.panelAlt]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />
      {header}
      {scroll ? (
        <ScrollView contentContainerStyle={[styles.scrollContent, contentStyle]}>
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.body, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: (Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0) + 8
  },
  body: {
    flex: 1,
    paddingHorizontal: 18,
    paddingBottom: 20
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 30
  },
  glowTop: {
    position: 'absolute',
    top: -120,
    left: -40,
    width: 220,
    height: 220,
    borderRadius: 140,
    backgroundColor: 'rgba(51,199,196,0.18)'
  },
  glowBottom: {
    position: 'absolute',
    bottom: -160,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 160,
    backgroundColor: 'rgba(241,91,122,0.12)'
  }
});
