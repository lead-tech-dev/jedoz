import React from 'react';
import { FlatList, Image, View, StyleSheet } from 'react-native';
import { colors, radius } from '../lib/theme';

export function Gallery({ items }) {
  if (!items || items.length === 0) {
    return <View style={styles.empty} />;
  }
  return (
    <FlatList
      horizontal
      data={items}
      keyExtractor={(item) => item.id || item.url}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <Image source={{ uri: item.url }} style={styles.image} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 12
  },
  image: {
    width: 240,
    height: 180,
    borderRadius: radius.lg,
    backgroundColor: colors.panelAlt,
    resizeMode: 'cover'
  },
  empty: {
    width: '100%',
    height: 180,
    borderRadius: radius.lg,
    backgroundColor: colors.panelAlt
  }
});
