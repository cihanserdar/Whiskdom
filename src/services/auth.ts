import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

// Sayfaya dönüldüğünde web tarayıcısını otomatik kapatır

export const signInWithGoogle = async () => {
  try {
    // Expo Router'a temiz kök adres iletiyoruz
    const redirectUrl = Linking.createURL('');

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
      },
    });

    if (error) throw error;
    if (!data?.url) return;

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

    if (result.type === 'success' && result.url) {
      // URL'den gelen parametreleri ayrıştır
      const urlToParse = result.url.replace('#', '?');
      const parsed = Linking.parse(urlToParse);
      
      const accessToken = parsed.queryParams?.access_token as string;
      const refreshToken = parsed.queryParams?.refresh_token as string;

      if (accessToken && refreshToken) {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
      }
    }
  } catch (error: any) {
    console.error('Google Giriş Hatası:', error);
    throw error;
  }
};

// E-posta ile Giriş Yap
export const signInWithEmail = async (email: string, pass: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: pass,
  });
  if (error) throw error;

  if (data?.user) {
    await ensureUserProfileExists(data.user);
  }

  return data;
};

// E-posta ve İsim ile Kaydol
export const signUpWithEmail = async (email: string, pass: string, fullName?: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password: pass,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });
  if (error) throw error;

  if (data?.user) {
    await ensureUserProfileExists(data.user);
  }

  return data;
};


export const sendPasswordResetEmail = async (email: string) => {
  // Yönlendirmeyi açıkça recovery tipinde yapıyoruz
  const redirectUrl = Linking.createURL('reset-password');

  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectUrl,
  });
  if (error) throw error;
  return data;
};

// Çıkış Yap
export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) console.error('Çıkış hatası:', error);
};

// Profil Yoksa Oluştur
export const ensureUserProfileExists = async (user: any) => {
  if (!user) return;

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profile) {
      await supabase.from('profiles').insert([
        {
          id: user.id,
          name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Şef Kullanıcı',
          email: user.email,
          avatar_url: user.user_metadata?.avatar_url || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
          title: 'Çırak Şef 🍳',
          active_title: 'Çırak Şef 🍳',
        },
      ]);

      await supabase.from('waste_stats').insert([
        {
          user_id: user.id,
          saved_count: 0,
          wasted_count: 0,
        },
      ]);
    }
  } catch (error) {
    console.error('Profil kontrol hatası:', error);
  }
};