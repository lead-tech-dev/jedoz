import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomeScreen } from '../screens/browse/HomeScreen';
import { SearchScreen } from '../screens/browse/SearchScreen';
import { MapScreen } from '../screens/browse/MapScreen';
import { ConversationsScreen } from '../screens/ads/ConversationsScreen';
import { WalletScreen } from '../screens/profile/WalletScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { colors } from '../lib/theme';
import { useI18n } from '../lib/i18n';

const Tab = createBottomTabNavigator();

export function MainTabs() {
  const { t } = useI18n();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.line },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: t('tabs.home') }} />
      <Tab.Screen name="Search" component={SearchScreen} options={{ title: t('tabs.search') }} />
      <Tab.Screen name="Map" component={MapScreen} options={{ title: t('tabs.map') }} />
      <Tab.Screen name="Messages" component={ConversationsScreen} options={{ title: t('tabs.messages') }} />
      <Tab.Screen name="Wallet" component={WalletScreen} options={{ title: t('tabs.wallet') }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: t('tabs.profile') }} />
    </Tab.Navigator>
  );
}
