import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { api } from './api';
import { storage } from './storage';

// Configure foreground presentation behavior
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
  PAYMENTS: 'payments',
  OPERATIONAL_ALERTS: 'operational_alerts',
} as const;

/**
 * Configure Android notification channels for Pharmatrix Customer app
 */
export async function setupAndroidNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNELS.PICKUP_UPDATES, {
      name: 'Pickup Updates',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0E7A60',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
    });

    await Notifications.setNotificationChannelAsync(ANDROID_CHANNELS.PAYMENTS, {
      name: 'Payments & Billing',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563EB',
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
    console.warn('[Notifications] Failed to setup Android channels:', error);
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
    console.log('[Notifications] Push notifications require a physical device.');
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
      console.log('[Notifications] Permission not granted by user.');
      return null;
    }

    // Get Expo push token
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ||
      Constants?.easConfig?.projectId;

    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const pushToken = tokenResponse.data;

    if (pushToken) {
      // Register with Pharmatrix backend
      await api.registerDeviceToken(
        pushToken,
        Platform.OS,
        Device.modelName || `${Device.brand || ''} ${Device.designName || ''}`.trim() || undefined
      );

      // Cache locally for deactivation on logout
      await storage.setItem('expo_push_token', pushToken);
      console.log('[Notifications] Push token successfully registered:', pushToken);
      return pushToken;
    }
  } catch (error) {
    console.warn('[Notifications] Error during push notification registration:', error);
  }

  return null;
}

/**
 * Deactivate push token with the backend upon user logout
 */
export async function deactivatePushNotificationsAsync(): Promise<void> {
  try {
    const pushToken = await storage.getItem('expo_push_token');
    if (pushToken) {
      await api.deactivateDeviceToken(pushToken);
      await storage.removeItem('expo_push_token');
      console.log('[Notifications] Push token successfully deactivated on logout.');
    }
  } catch (error) {
    console.warn('[Notifications] Failed to deactivate push token on logout:', error);
  }
}

export type NotificationTapHandler = (payload: {
  screen?: string;
  pickup_id?: number | string;
  pickup_code?: string;
  [key: string]: any;
}) => void;

/**
 * Setup listeners for receiving notifications and handling user notification taps
 */
export function setupNotificationListeners(
  onNotificationTapped: NotificationTapHandler
): () => void {
  // 1. Handle notification tapped while app is foregrounded / backgrounded
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data = response.notification.request.content.data || {};
      console.log('[Notifications] Notification tapped with data:', data);
      onNotificationTapped(data);
    }
  );

  // 2. Handle notification received in foreground
  const receivedSubscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      const data = notification.request.content.data || {};
      console.log('[Notifications] Notification received in foreground:', data);
    }
  );

  // 3. Handle cold boot from notification tap
  Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) {
      const data = response.notification.request.content.data || {};
      console.log('[Notifications] App cold-started from notification tap:', data);
      onNotificationTapped(data);
    }
  }).catch((err) => {
    console.warn('[Notifications] Error checking last notification response:', err);
  });

  return () => {
    responseSubscription.remove();
    receivedSubscription.remove();
  };
}
