import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import api from './api';
import storage from './storage';

// Configure foreground presentation behavior for driver
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const ANDROID_CHANNELS = {
  PICKUP_UPDATES: 'pickup_updates',
  OPERATIONAL_ALERTS: 'operational_alerts',
} as const;

/**
 * Configure Android notification channels for Pharmatrix Driver app
 */
export async function setupAndroidNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNELS.PICKUP_UPDATES, {
      name: 'Route & Pickup Updates',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0E7A60',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
    });

    await Notifications.setNotificationChannelAsync(ANDROID_CHANNELS.OPERATIONAL_ALERTS, {
      name: 'Operational Alerts',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#F59E0B',
      sound: 'default',
      enableVibrate: false,
      showBadge: false,
    });
  } catch (error) {
    console.warn('[Driver Notifications] Failed to setup Android channels:', error);
  }
}

/**
 * Request notification permissions and register the Expo push token with the backend
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  await setupAndroidNotificationChannels();

  if (Platform.OS === 'web') {
    return null;
  }

  if (!Device.isDevice) {
    console.log('[Driver Notifications] Push notifications require a physical device.');
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Driver Notifications] Permission not granted by user.');
      return null;
    }

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ||
      Constants?.easConfig?.projectId;

    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const pushToken = tokenResponse.data;

    if (pushToken) {
      await api.registerDeviceToken(
        pushToken,
        Platform.OS,
        Device.modelName || `${Device.brand || ''} ${Device.designName || ''}`.trim() || undefined
      );

      await storage.setItem('expo_push_token', pushToken);
      console.log('[Driver Notifications] Push token successfully registered:', pushToken);
      return pushToken;
    }
  } catch (error) {
    console.warn('[Driver Notifications] Error during push notification registration:', error);
  }

  return null;
}

/**
 * Deactivate push token with the backend upon driver logout
 */
export async function deactivatePushNotificationsAsync(): Promise<void> {
  try {
    const pushToken = await storage.getItem('expo_push_token');
    if (pushToken) {
      await api.deactivateDeviceToken(pushToken);
      await storage.removeItem('expo_push_token');
      console.log('[Driver Notifications] Push token successfully deactivated on logout.');
    }
  } catch (error) {
    console.warn('[Driver Notifications] Failed to deactivate push token on logout:', error);
  }
}

export type DriverNotificationTapHandler = (payload: {
  screen?: string;
  route_id?: number | string;
  pickup_id?: number | string;
  [key: string]: any;
}) => void;

/**
 * Setup listeners for receiving notifications and handling user notification taps
 */
export function setupNotificationListeners(
  onNotificationTapped: DriverNotificationTapHandler
): () => void {
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data = response.notification.request.content.data || {};
      console.log('[Driver Notifications] Notification tapped with data:', data);
      onNotificationTapped(data);
    }
  );

  const receivedSubscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      const data = notification.request.content.data || {};
      console.log('[Driver Notifications] Notification received in foreground:', data);
    }
  );

  Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) {
      const data = response.notification.request.content.data || {};
      console.log('[Driver Notifications] App cold-started from notification tap:', data);
      onNotificationTapped(data);
    }
  }).catch((err) => {
    console.warn('[Driver Notifications] Error checking last notification response:', err);
  });

  return () => {
    responseSubscription.remove();
    receivedSubscription.remove();
  };
}

