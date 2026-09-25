import { supabase } from './supabase';

// 📦 Paket Limitleri Tanımı (AI Şef: 5, Fiş: 1)
export const TIER_LIMITS = {
  free: { aiRecipeLimit: 5, receiptLimit: 1 },
  pro: { aiRecipeLimit: 20, receiptLimit: 15 },       
  premium: { aiRecipeLimit: 999, receiptLimit: 999 }  
};

// 1️⃣ Hak Kontrolü (İstek Atılmadan Önce Çağrılır - 24 Saatlik Kayan Sayaç)
export async function checkQuota(type: 'aiRecipe' | 'receipt'): Promise<{ allowed: boolean; remaining: number; resetTimeText: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { allowed: false, remaining: 0, resetTimeText: '' };

    const limit = type === 'aiRecipe' ? TIER_LIMITS.free.aiRecipeLimit : TIER_LIMITS.free.receiptLimit;

    // Dinamik anahtar hatasını önlemek için sabit alanlar üzerinden çekiyoruz
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('ai_chef_quota, ai_chef_reset_at, receipt_quota, receipt_reset_at')
      .eq('id', user.id)
      .single();

    if (error || !profile) return { allowed: false, remaining: limit, resetTimeText: '' };

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

    return { allowed, remaining, resetTimeText };
  } catch (error) {
    console.error("Kota okunurken hata:", error);
    return { allowed: false, remaining: 0, resetTimeText: '' };
  }
}

// 2️⃣ Hak Tüketme / Düşürme (YALNIZCA Sunucu Tarafındaki RPC Fonksiyonu İle Güvenli Yapılır)
export async function consumeQuota(type: 'aiRecipe' | 'receipt'): Promise<void> {
  try {
    const featureKey = type === 'aiRecipe' ? 'aiRecipe' : 'receipt';

    // İşlemi doğrudan PostgreSQL tarafındaki güvenli fonksiyona devrediyoruz
    const { error } = await supabase.rpc('consume_quota_safely', {
      feature_type: featureKey
    });

    if (error) {
      console.error("Sunucu tarafı kota düşürme hatası:", error);
    }
  } catch (error) {
    console.error("Kota düşürülürken hata:", error);
  }
}