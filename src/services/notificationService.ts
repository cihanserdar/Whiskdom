import Constants, { ExecutionEnvironment } from 'expo-constants';
import { InventoryItem } from '../context/AppContext';

// Uygulamanın Expo Go'da çalışıp çalışmadığını kontrol et
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Expo Go ortamında çökmemesi için modülü güvenli şekilde yükle
let Notifications: typeof import('expo-notifications') | null = null;

if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
    Notifications?.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch (error) {
    // Kritik handler hatası sessizce geçilir veya hata yakalama mekanizmasına bağlanabilir
  }
}

// SKT Bildirimlerini Planlama
export const scheduleExpiryNotifications = async (inventoryItems: InventoryItem[]) => {
  if (isExpoGo || !Notifications) {
    return;
  }

  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;

    await Notifications.cancelAllScheduledNotificationsAsync();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const item of inventoryItems) {
      if (!item.expiryDate) continue;

      const parts = item.expiryDate.split('-');
      if (parts.length !== 3) continue;

      const expDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      expDate.setHours(9, 0, 0, 0);

      const diffTime = expDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 2 || diffDays === 1) {
        const triggerSeconds = Math.max(5, Math.floor((expDate.getTime() - Date.now()) / 1000));

        await Notifications.scheduleNotificationAsync({
          content: {
            title: '⚠️ Ürün SKT Yaklaşıyor!',
            body: `'${item.name}' ürününün son kullanma tarihine az kaldı. Ziyan etmeden pişirmeye ne dersin?`,
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: triggerSeconds > 0 ? triggerSeconds : 5,
          },
        });
      }
    }
  } catch (error) {
    // Bildirim planlama hatası
  }
};

// Rozet ve Unvan Kazanma Bildirimi
export const sendBadgeUnlockedNotification = async (badgeName: string, titleName: string) => {
  if (isExpoGo || !Notifications) {
    return;
  }

  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;

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
  } catch (error) {
    // Rozet bildirim hatası
  }
};