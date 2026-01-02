import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, radius } from '../lib/theme';

export function ListRow({ title, subtitle, right, onPress }) {
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper onPress={onPress} style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel
  },
  title: {
    color: colors.text,
    fontWeight: '600'
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12
  }
});
