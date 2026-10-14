import { supabase } from './supabase';

// 📦 Paket Limitleri Tanımı
export const TIER_LIMITS = {
  free: { aiRecipeLimit: 5, receiptLimit: 1 },
  pro: { aiRecipeLimit: 15, receiptLimit: 3 },      
  premium: { aiRecipeLimit: 999, receiptLimit: 999 }  
};

// 1️⃣ Hak Kontrolü (Güncellenmiş Hali)
export async function checkQuota(type: 'aiRecipe' | 'receipt'): Promise<{ allowed: boolean; remaining: number; limit: number; resetTimeText: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { allowed: false, remaining: 0, limit: 5, resetTimeText: '' };

    // Kullanıcının profilinden hem tier hem de kotaları çekiyoruz
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('tier, ai_chef_quota, ai_chef_reset_at, receipt_quota, receipt_reset_at')
      .eq('id', user.id)
      .single();

    if (error || !profile) return { allowed: false, remaining: 0, limit: 5, resetTimeText: '' };

    // Kullanıcının tier değerine göre doğru üst limiti belirliyoruz
    const userTier = (profile.tier && TIER_LIMITS[profile.tier as keyof typeof TIER_LIMITS]) ? profile.tier : 'free';
    const limits = TIER_LIMITS[userTier as keyof typeof TIER_LIMITS];
    const limit = type === 'aiRecipe' ? limits.aiRecipeLimit : limits.receiptLimit;

    let currentQuota = type === 'aiRecipe' ? (profile.ai_chef_quota ?? limit) : (profile.receipt_quota ?? limit);
    let resetAt = type === 'aiRecipe' ? profile.ai_chef_reset_at : profile.receipt_reset_at;
    const now = new Date();

    // ⏱️ Kayan Sayaç Kontrolü: 24 saatlik süre dolduysa hakları otomatik yenile
    if (resetAt && new Date(resetAt) <= now) {
      const updatePayload = type === 'aiRecipe' 
        ? { ai_chef_quota: limit, ai_chef_reset_at: null }
        : { receipt_quota: limit, receipt_reset_at: null };

      await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', user.id);
      
      currentQuota = limit;
      resetAt = null;
    }

    const remaining = Math.max(0, currentQuota);
    const allowed = remaining > 0;

    // Kalan süreyi canlı hesapla
    let resetTimeText = '';
    if (resetAt) {
      const diffMs = new Date(resetAt).getTime() - now.getTime();
      const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

      resetTimeText = `${String(hours).padStart(2, '0')} Saat ${String(minutes).padStart(2, '0')} Dakika ${String(seconds).padStart(2, '0')} Saniye`;
    }

    // Artık 'limit' değerini de dışarıya dönüyoruz!
    return { allowed, remaining, limit, resetTimeText };
  } catch {
    return { allowed: false, remaining: 0, limit: 5, resetTimeText: '' };
  }
}

// 2️⃣ Hak Tüketme / Düşürme (YALNIZCA Sunucu Tarafındaki RPC Fonksiyonu İle Güvenli Yapılır)
export async function consumeQuota(type: 'aiRecipe' | 'receipt'): Promise<void> {
  try {
    const featureKey = type === 'aiRecipe' ? 'aiRecipe' : 'receipt';

    // İşlemi doğrudan PostgreSQL tarafındaki güvenli fonksiyona devrediyoruz
    await supabase.rpc('consume_quota_safely', {
      feature_type: featureKey
    });
  } catch {
    // Hata durumunda sessizce geçilir
  }
}