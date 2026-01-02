import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { SplashScreen } from '../screens/onboarding/SplashScreen';
import { AgeGateScreen } from '../screens/onboarding/AgeGateScreen';
import { PermissionsScreen } from '../screens/onboarding/PermissionsScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { ForgotScreen } from '../screens/auth/ForgotScreen';
import { VerifyOtpScreen } from '../screens/auth/VerifyOtpScreen';
import { ResetPasswordScreen } from '../screens/auth/ResetPasswordScreen';
import { MainTabs } from './MainTabs';
import { AdDetailScreen } from '../screens/ads/AdDetailScreen';
import { CreateAdScreen } from '../screens/ads/CreateAdScreen';
import { EditAdScreen } from '../screens/ads/EditAdScreen';
import { ChatScreen } from '../screens/ads/ChatScreen';
import { PaymentStatusScreen } from '../screens/payments/PaymentStatusScreen';
import { BoostScreen } from '../screens/payments/BoostScreen';
import { MyAdsScreen } from '../screens/profile/MyAdsScreen';
import { ProScreen } from '../screens/profile/ProScreen';
import { SettingsScreen } from '../screens/profile/SettingsScreen';
import { HelpScreen } from '../screens/profile/HelpScreen';
import { useI18n } from '../lib/i18n';
import { colors } from '../lib/theme';

const Stack = createNativeStackNavigator();

export function RootNavigator() {
  const { tx } = useI18n();
  const { loading, token, onboardingDone, ageGateOk } = useAuth();

  if (loading) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Splash" component={SplashScreen} />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      {!ageGateOk ? (
        <Stack.Screen name="AgeGate" component={AgeGateScreen} />
      ) : null}
      {ageGateOk && !onboardingDone ? (
        <Stack.Screen name="Permissions" component={PermissionsScreen} />
      ) : null}
      {ageGateOk && onboardingDone && !token ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="Forgot" component={ForgotScreen} />
          <Stack.Screen name="VerifyOtp" component={VerifyOtpScreen} />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        </>
      ) : null}
      {ageGateOk && onboardingDone && token ? (
        <Stack.Screen name="Main" component={MainTabs} />
      ) : null}

      <Stack.Group
        screenOptions={{
          presentation: 'modal',
          headerShown: true,
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text
        }}
      >
        <Stack.Screen name="AdDetail" component={AdDetailScreen} options={{ title: tx('Annonce', 'Ad') }} />
        <Stack.Screen name="CreateAd" component={CreateAdScreen} options={{ title: tx('Créer une annonce', 'Create listing') }} />
        <Stack.Screen name="EditAd" component={EditAdScreen} options={{ title: tx('Modifier une annonce', 'Edit listing') }} />
        <Stack.Screen name="Chat" component={ChatScreen} options={{ title: tx('Chat', 'Chat') }} />
        <Stack.Screen name="PaymentStatus" component={PaymentStatusScreen} options={{ title: tx('Paiement', 'Payment') }} />
        <Stack.Screen name="Boost" component={BoostScreen} options={{ title: tx('Boost', 'Boost') }} />
        <Stack.Screen name="MyAds" component={MyAdsScreen} options={{ title: tx('Mes annonces', 'My ads') }} />
        <Stack.Screen name="Pro" component={ProScreen} options={{ title: tx('PRO', 'PRO') }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: tx('Paramètres', 'Settings') }} />
        <Stack.Screen name="Help" component={HelpScreen} options={{ title: tx('Aide', 'Help') }} />
      </Stack.Group>
    </Stack.Navigator>
  );
}
