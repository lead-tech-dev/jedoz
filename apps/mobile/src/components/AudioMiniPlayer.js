import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { colors, radius } from '../lib/theme';
import { useI18n } from '../lib/i18n';

function formatTime(ms) {
  if (!ms || Number.isNaN(ms)) return '0:00';
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function AudioMiniPlayer() {
  const { tx } = useI18n();
  const [barWidth, setBarWidth] = React.useState(0);
  const { url, playing, position, duration, title, toggle, stop, seek } = useAudioPlayer();

  if (!url) return null;

  const progress = duration ? Math.min(100, Math.max(0, (position / duration) * 100)) : 0;
  const label = title || tx('Lecture audio', 'Audio player');

  const handleSeek = (event) => {
    if (!barWidth || !duration) return;
    const x = event?.nativeEvent?.locationX || 0;
    const ratio = Math.min(Math.max(x / barWidth, 0), 1);
    seek(ratio);
  };

  return (
    <View pointerEvents="box-none" style={styles.container}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>{label}</Text>
          <Pressable onPress={stop}>
            <Text style={styles.close}>×</Text>
          </Pressable>
        </View>
        <View style={styles.row}>
          <Pressable style={styles.button} onPress={() => toggle(url, { title: label })}>
            <Text style={styles.buttonText}>{playing ? tx('Pause', 'Pause') : tx('Lire', 'Play')}</Text>
          </Pressable>
          <Text style={styles.meta}>{formatTime(position)} / {formatTime(duration)}</Text>
        </View>
        <Pressable
          style={styles.track}
          onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
          onPressIn={handleSeek}
        >
          <View style={[styles.fill, { width: `${progress}%` }]} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 86
  },
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: 10,
    backgroundColor: colors.panel
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  title: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 12
  },
  close: {
    color: colors.muted,
    fontSize: 18,
    fontWeight: '700'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8
  },
  button: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel
  },
  buttonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700'
  },
  meta: {
    color: colors.muted,
    fontSize: 11
  },
  track: {
    height: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden'
  },
  fill: {
    height: '100%',
    backgroundColor: colors.accent
  }
});
