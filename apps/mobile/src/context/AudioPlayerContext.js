import React from 'react';
import { Audio } from 'expo-av';

const AudioPlayerContext = React.createContext({
  url: null,
  playing: false,
  position: 0,
  duration: 0,
  title: '',
  play: async () => {},
  toggle: async () => {},
  pause: async () => {},
  stop: async () => {},
  seek: async () => {}
});

export function AudioPlayerProvider({ children }) {
  const soundRef = React.useRef(null);
  const stopRef = React.useRef(null);
  const [state, setState] = React.useState({
    url: null,
    playing: false,
    position: 0,
    duration: 0,
    title: ''
  });

  const stop = React.useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch {}
      soundRef.current = null;
    }
    setState({ url: null, playing: false, position: 0, duration: 0, title: '' });
  }, []);

  React.useEffect(() => {
    stopRef.current = stop;
  }, [stop]);

  const updateStatus = React.useCallback((status) => {
    if (!status?.isLoaded) return;
    setState((prev) => ({
      ...prev,
      playing: status.isPlaying,
      position: status.positionMillis || 0,
      duration: status.durationMillis || 0
    }));
    if (status.didJustFinish && stopRef.current) {
      stopRef.current();
    }
  }, []);

  const play = React.useCallback(async (url, opts = {}) => {
    if (!url) return;
    if (soundRef.current && state.url === url) {
      if (!state.playing) {
        await soundRef.current.playAsync();
        setState((prev) => ({ ...prev, playing: true, title: opts.title || prev.title }));
      }
      return;
    }
    await stop();
    const { sound } = await Audio.Sound.createAsync(
      { uri: url },
      { shouldPlay: true },
      updateStatus
    );
    soundRef.current = sound;
    setState({ url, playing: true, position: 0, duration: 0, title: opts.title || '' });
  }, [state.url, state.playing, stop, updateStatus]);

  const pause = React.useCallback(async () => {
    if (!soundRef.current) return;
    await soundRef.current.pauseAsync();
    setState((prev) => ({ ...prev, playing: false }));
  }, []);

  const toggle = React.useCallback(async (url, opts = {}) => {
    if (!url) return;
    if (soundRef.current && state.url === url) {
      if (state.playing) {
        await pause();
      } else {
        await soundRef.current.playAsync();
        setState((prev) => ({ ...prev, playing: true, title: opts.title || prev.title }));
      }
      return;
    }
    await play(url, opts);
  }, [pause, play, state.playing, state.url]);

  const seek = React.useCallback(async (value) => {
    if (!soundRef.current || !state.duration) return;
    const target = value <= 1 ? value * state.duration : value;
    await soundRef.current.setPositionAsync(target);
  }, [state.duration]);

  React.useEffect(() => () => {
    stop();
  }, [stop]);

  const value = React.useMemo(
    () => ({
      ...state,
      play,
      toggle,
      pause,
      stop,
      seek
    }),
    [state, play, toggle, pause, stop, seek]
  );

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer() {
  return React.useContext(AudioPlayerContext);
}
