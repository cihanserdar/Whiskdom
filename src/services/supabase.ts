import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

// Supabase API Erişim Bilgileri
const SUPABASE_URL = 'https://duqkweoohdcghgpophfp.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_eapbLpirmLn-57Zck4fpZA_UYIloe85';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});