import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors, radius, shadow } from '../lib/theme';

export function Card({ title, subtitle, price, image, badges, footer }) {
  return (
    <View style={styles.card}>
      <View style={styles.media}>
        {image ? (
          <Image source={{ uri: image }} style={styles.image} />
        ) : (
          <View style={styles.placeholder} />
        )}
        {badges ? <View style={styles.badges}>{badges}</View> : null}
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        {price ? <Text style={styles.price}>{price}</Text> : null}
      </View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
    ...shadow.soft
  },
  media: {
    height: 140,
    backgroundColor: colors.panelAlt
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover'
  },
  placeholder: {
    flex: 1,
    backgroundColor: '#1e2430'
  },
  badges: {
    position: 'absolute',
    right: 12,
    top: 12,
    flexDirection: 'row',
    gap: 6
  },
  body: {
    padding: 12,
    gap: 4
  },
  title: {
    color: colors.text,
    fontWeight: '700'
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12
  },
  price: {
    color: colors.accent2,
    fontWeight: '700'
  },
  footer: {
    borderTopWidth: 1,
    borderColor: colors.line,
    padding: 10
  }
});
