import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../lib/theme';

export function Section({ title, subtitle, action, children, style }) {
  return (
    <View style={[styles.section, style]}>
      {(title || action) ? (
        <View style={styles.head}>
          <View>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700'
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12
  }
});
