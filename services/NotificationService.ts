import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

export class NotificationService {
  private static pushToken: string | null = null;

  static async init(): Promise<void> {
    if (!Device.isDevice) return; // emulador — sin push

    const { status: existing } = await Notifications.getPermissionsAsync();
    const finalStatus = existing !== 'granted'
      ? (await Notifications.requestPermissionsAsync()).status
      : existing;

    if (finalStatus !== 'granted') {
      console.warn('[NOTIF] Permisos denegados');
      return;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('moto_alerts', {
        name:             'Alertas de Moto',
        importance:       Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor:       '#FF6B35',
        sound:            'default',
      });
      await Notifications.setNotificationChannelAsync('moto_status', {
        name:       'Estado de Moto',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound:      null,
      });
    }

    try {
      const tokenData = await Notifications.getExpoPushTokenAsync();
      NotificationService.pushToken = tokenData.data;
    } catch (e) {
      console.warn('[NOTIF] Token push no disponible:', e);
    }
  }

  static async sendLocal(title: string, body: string, channelId = 'moto_alerts'): Promise<void> {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound:    'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: null,
    });
  }

  static getToken(): string | null {
    return NotificationService.pushToken;
  }

  static onReceived(cb: (n: Notifications.Notification) => void): Notifications.Subscription {
    return Notifications.addNotificationReceivedListener(cb);
  }

  static onTapped(cb: (r: Notifications.NotificationResponse) => void): Notifications.Subscription {
    return Notifications.addNotificationResponseReceivedListener(cb);
  }
}
