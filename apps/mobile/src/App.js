import React from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { RootNavigator } from './navigation/RootNavigator';
import { AuthProvider } from './context/AuthContext';
import { linking } from './lib/deeplinks';
import { registerForPushNotificationsAsync, subscribeToNotifications } from './lib/notifications';
import { trackEvent } from './lib/api';
import Toast from 'react-native-toast-message';
import { I18nProvider } from './lib/i18n';
import { AudioPlayerProvider } from './context/AudioPlayerContext';
import { AudioMiniPlayer } from './components/AudioMiniPlayer';

export default function App() {
  const navRef = React.useRef(null);
  const routeNameRef = React.useRef(null);

  React.useEffect(() => {
    registerForPushNotificationsAsync();
    const unsubscribe = subscribeToNotifications(
      null,
      (response) => {
        const data = response?.notification?.request?.content?.data || {};
        const adId = data.adId || data.ad_id;
        const userId = data.userId || data.user_id;
        if (adId && navRef.current) {
          navRef.current.navigate('AdDetail', { id: String(adId) });
        } else if (userId && navRef.current) {
          navRef.current.navigate('Chat', { userId: String(userId) });
        }
      }
    );
    return unsubscribe;
  }, []);

  return (
    <I18nProvider>
      <AuthProvider>
        <AudioPlayerProvider>
          <View style={{ flex: 1 }}>
            <NavigationContainer
              ref={navRef}
              linking={linking}
              onReady={() => {
                routeNameRef.current = navRef.current?.getCurrentRoute?.()?.name || null;
                if (routeNameRef.current) {
                  void trackEvent('screen.view', { screen: routeNameRef.current }, 'mobile');
                }
              }}
              onStateChange={() => {
                const current = navRef.current?.getCurrentRoute?.()?.name || null;
                if (current && current !== routeNameRef.current) {
                  routeNameRef.current = current;
                  void trackEvent('screen.view', { screen: current }, 'mobile');
                }
              }}
            >
              <RootNavigator />
            </NavigationContainer>
            <AudioMiniPlayer />
            <Toast />
          </View>
        </AudioPlayerProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
