import AsyncStorage from '@react-native-async-storage/async-storage';

// 📦 Paket Limitleri Tanımı (Geleceğe yatırım esnek yapı)
export const TIER_LIMITS = {
  free: { aiRecipeLimit: 3, receiptLimit: 2 },
  pro: { aiRecipeLimit: 20, receiptLimit: 15 },       // Şimdiki aktif tek ek paket
  premium: { aiRecipeLimit: 999, receiptLimit: 999 }  // Gelecekteki sınırsız paket
};

const QUOTA_STORAGE_KEY = '@whiskdom_user_quota_v1';

interface QuotaData {
  tier: 'free' | 'pro' | 'premium';
  aiRecipeUsed: number;
  receiptUsed: number;
  lastResetDate: string; // YYYY-MM-DD formatında son sıfırlanma günü
}

// Bugünün tarihini YYYY-MM-DD olarak al
const getTodayString = () => {
  return new Date().toISOString().split('T')[0];
};

// 1️⃣ Kota Verilerini Çek veya Günün Tarihine Göre Sıfırla
export async function getUserQuota(): Promise<QuotaData> {
  try {
    const stored = await AsyncStorage.getItem(QUOTA_STORAGE_KEY);
    const today = getTodayString();

    if (stored) {
      const data: QuotaData = JSON.parse(stored);
      // Eğer gün değiştiyse sayaçları sıfırla ve yeni günü kaydet
      if (data.lastResetDate !== today) {
        const resetData: QuotaData = {
          ...data,
          aiRecipeUsed: 0,
          receiptUsed: 0,
          lastResetDate: today,
        };
        await AsyncStorage.setItem(QUOTA_STORAGE_KEY, JSON.stringify(resetData));
        return resetData;
      }
      return data;
    } else {
      // İlk kez çalışıyorsa varsayılan 'free' olarak başlat
      const initialData: QuotaData = {
        tier: 'free',
        aiRecipeUsed: 0,
        receiptUsed: 0,
        lastResetDate: today,
      };
      await AsyncStorage.setItem(QUOTA_STORAGE_KEY, JSON.stringify(initialData));
      return initialData;
    }
  } catch (error) {
    console.error("Kota okunurken hata:", error);
    return { tier: 'free', aiRecipeUsed: 0, receiptUsed: 0, lastResetDate: getTodayString() };
  }
}

// 2️⃣ Hak Kontrolü (İstek Atılmadan Önce Çağrılır)
export async function checkQuota(type: 'aiRecipe' | 'receipt'): Promise<{ allowed: boolean; remaining: number; resetTimeText: string }> {
  const quota = await getUserQuota();
  const limits = TIER_LIMITS[quota.tier];

  const used = type === 'aiRecipe' ? quota.aiRecipeUsed : quota.receiptUsed;
  const limit = type === 'aiRecipe' ? limits.aiRecipeLimit : limits.receiptLimit;

  const remaining = Math.max(0, limit - used);
  const allowed = remaining > 0;

  // Gece yarısına kalan süreyi hesapla (Canlı geri sayım için)
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const diffMs = tomorrow.getTime() - now.getTime();
  
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

  const resetTimeText = `${String(hours).padStart(2, '0')} Saat ${String(minutes).padStart(2, '0')} Dakika ${String(seconds).padStart(2, '0')} Saniye`;

  return { allowed, remaining, resetTimeText };
}

// 3️⃣ Hak Tüketme / Düşürme (YALNIZCA İstek BAŞARILI Olunca Çağrılır!)
export async function consumeQuota(type: 'aiRecipe' | 'receipt'): Promise<void> {
  try {
    const quota = await getUserQuota();
    const updated: QuotaData = {
      ...quota,
      aiRecipeUsed: type === 'aiRecipe' ? quota.aiRecipeUsed + 1 : quota.aiRecipeUsed,
      receiptUsed: type === 'receipt' ? quota.receiptUsed + 1 : quota.receiptUsed,
    };
    await AsyncStorage.setItem(QUOTA_STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error("Kota düşürülürken hata:", error);
  }
}