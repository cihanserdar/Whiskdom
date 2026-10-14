import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { InventoryItem } from '../context/AppContext';

const NOTIFIED_EXPIRY_DATE_KEY = '@whiskdom_last_expiry_notification_date';
const MAX_TOTAL_NOTIFICATIONS = 3;

// Uygulamanın Expo Go'da çalışıp çalışmadığını kontrol et
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Expo Go ortamında çökmemesi için modülü güvenli şekilde yapılandır
if (!isExpoGo) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch (error) {
    // Kritik handler hatası sessizce geçilir
  }
}

// Bugün zaten bildirim gönderilip gönderilmediğini kontrol et
const hasAlreadyNotifiedToday = async (): Promise<boolean> => {
  try {
    const lastDate = await AsyncStorage.getItem(NOTIFIED_EXPIRY_DATE_KEY);
    const todayStr = new Date().toDateString();
    return lastDate === todayStr;
  } catch (error: unknown) {
    return false;
  }
};

const markExpiryNotifiedToday = async (): Promise<void> => {
  try {
    const todayStr = new Date().toDateString();
    await AsyncStorage.setItem(NOTIFIED_EXPIRY_DATE_KEY, todayStr);
  } catch (error: unknown) {
    // Sessizce geçilir
  }
};

// SKT Bildirimlerini Planlama (Toplu/Tekil mantık ve max 3 sınırıyla)
export const scheduleExpiryNotifications = async (inventoryItems: InventoryItem[]): Promise<void> => {
  if (isExpoGo || !Notifications) {
    return;
  }

  try {
    if (await hasAlreadyNotifiedToday()) {
      return;
    }

    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;

    // Eski zamanlanmış bildirimleri temizle
    await Notifications.cancelAllScheduledNotificationsAsync();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiringItems: InventoryItem[] = [];

    for (const item of inventoryItems) {
      if (!item.expiryDate) continue;

      const parts = item.expiryDate.split('-');
      if (parts.length !== 3) continue;

      const expDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      expDate.setHours(9, 0, 0, 0);

      const diffTime = expDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 2 || diffDays === 1 || diffDays === 0) {
        expiringItems.push(item);
      }
    }

    if (expiringItems.length === 0) return;

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    if (scheduled.length >= MAX_TOTAL_NOTIFICATIONS) {
      return;
    }

    const notificationTitle = '⚠️ Ürün SKT Yaklaşıyor!';
    let notificationBody = '';

    if (expiringItems.length === 1) {
      notificationBody = `'${expiringItems[0].name}' ürününün son kullanma tarihine az kaldı. Ziyan etmeden pişirmeye ne dersin?`;
    } else {
      notificationBody = `Tarihi yaklaşan ${expiringItems.length} adet ürünün var. Dolabını gözden geçirip ziyanı önlemeye ne dersin? 🌱`;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: notificationTitle,
        body: notificationBody,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 5,
      },
    });

    await markExpiryNotifiedToday();
  } catch (error: unknown) {
    // Bildirim planlama hatası
  }
};

// Rozet ve Unvan Kazanma Bildirimi
export const sendBadgeUnlockedNotification = async (badgeName: string, titleName: string): Promise<void> => {
  if (isExpoGo || !Notifications) {
    return;
  }

  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    if (scheduled.length >= MAX_TOTAL_NOTIFICATIONS) {
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Yeni Rozet & Unvan Kazandınız! 🏆🎉',
        body: `Tebrikler! '${badgeName}' rozetini açtınız. Yeni unvanınız: ${titleName}`,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
      },
    });
  } catch (error: unknown) {
    // Rozet bildirim hatası
  }
};