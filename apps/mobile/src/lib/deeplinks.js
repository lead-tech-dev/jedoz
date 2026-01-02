import * as Linking from 'expo-linking';
import Constants from 'expo-constants';

const scheme = Constants?.expoConfig?.extra?.appScheme || 'mjdating';
const prefix = Linking.createURL('/');

export const linking = {
  prefixes: [prefix, `${scheme}://`],
  config: {
    screens: {
      Main: {
        screens: {
          Home: 'home',
          Search: 'search',
          Map: 'map',
          Wallet: 'wallet',
          Profile: 'profile'
        }
      },
      AdDetail: 'ad/:id',
      PaymentStatus: 'payment/:intentId',
      Chat: 'chat/:userId',
      ResetPassword: 'auth/reset-password/:token'
    }
  }
};

export function buildAdLink(adId) {
  return Linking.createURL(`/ad/${adId}`);
}
