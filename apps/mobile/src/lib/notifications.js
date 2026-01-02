import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { getItem, setItem, STORAGE_KEYS } from './storage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false
  })
});

export async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) return null;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT
    });
  }
  const existing = await getItem(STORAGE_KEYS.pushToken);
  if (existing) return existing;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    return null;
  }
  const token = (await Notifications.getExpoPushTokenAsync()).data;
  await setItem(STORAGE_KEYS.pushToken, token);
  return token;
}

export function subscribeToNotifications(onReceive, onResponse) {
  const sub1 = Notifications.addNotificationReceivedListener((notification) => {
    if (onReceive) onReceive(notification);
  });
  const sub2 = Notifications.addNotificationResponseReceivedListener((response) => {
    if (onResponse) onResponse(response);
  });
  return () => {
    sub1.remove();
    sub2.remove();
  };
}
