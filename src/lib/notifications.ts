import notifee, { AndroidImportance } from '@notifee/react-native';

export const SYSTEM_NOTIFICATION_CHANNEL_ID = 'system-updates';

export async function requestSystemNotificationPermission() {
  return notifee.requestPermission();
}

export async function ensureSystemNotificationChannel() {
  return notifee.createChannel({
    id: SYSTEM_NOTIFICATION_CHANNEL_ID,
    name: 'System updates',
    importance: AndroidImportance.HIGH,
  });
}

export async function showSystemNotification(title: string, body: string) {
  const channelId = await ensureSystemNotificationChannel();

  return notifee.displayNotification({
    title,
    body,
    android: {
      channelId,
      pressAction: {
        id: 'open-app',
      },
    },
  });
}
