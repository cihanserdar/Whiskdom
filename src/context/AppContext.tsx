import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { createContext, ReactNode, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { signOut as authSignOut, ensureUserProfileExists } from '../services/auth';
import { scheduleExpiryNotifications } from '../services/notificationService';
import { supabase } from '../services/supabase';

export interface Nutrients {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  brand?: string;
  quantity: string;
  expiryDate: string;
  imageUrl?: string;
  category?: string;
  nutrients?: Nutrients;
  barcode?: string;
}

export interface CartItem {
  id: string;
  name: string;
  quantity: string;
  checked: boolean;
  category: 'Manav' | 'Süt Ürünleri' | 'Kiler & Kuru Gıda' | 'Et & Şarküteri' | 'Diğer';
}

export interface UserPreferences {
  diets: string[];
  allergens: string[];
}

export interface UserProfile {
  name: string;
  email: string;
  title: string;
  activeTitle: string;
  avatarUrl: string;
}

export interface WasteStats {
  savedCount: number;
  wastedCount: number;
}

export interface CreatorProfileData {
  name: string;
  badge: string;
  recipeCount: number;
  xp: number;
}

export interface Recipe {
  id: string;
  title: string;
  description?: string;
  category?: string;
  mainIngredient: string;
  ingredients: string[];
  ingredientsWithQuantities?: string[];
  cookingTime?: string;
  instructions?: string[];
  isAI?: boolean;
  isUserCreated?: boolean;
  isSubmitted?: boolean;
  diets?: string[];
  allergens?: string[];
  is_approved?: boolean;
  user_id?: string;
  creatorProfile?: CreatorProfileData;
  [key: string]: unknown;
}

export interface MealPlanItem {
  recipeId: string;
  recipeTitle: string;
}

export type WeeklyMealPlan = {
  [day: string]: {
    breakfast?: MealPlanItem;
    lunch?: MealPlanItem;
    dinner?: MealPlanItem;
  };
};

export interface AppContextType {
  inventory: InventoryItem[];
  cart: CartItem[];
  recipes: Recipe[];
  favorites: string[];
  history: string[];
  wasteStats: WasteStats;
  userPreferences: UserPreferences;
  userProfile: UserProfile;
  expiryThreshold: number;
  loading: boolean;
  user: User | null;
  setExpiryThreshold: (days: number) => void;
  setUserPreferences: (prefs: UserPreferences) => void;
  setUserProfile: (profile: UserProfile) => void;
  setInventory: (items: InventoryItem[]) => void;
  addInventoryItem: (item: InventoryItem) => void;
  addItem: (item: InventoryItem) => void;
  deleteItem: (id: string) => void;
  addMultipleInventoryItems: (items: InventoryItem[]) => void;
  updateInventoryItem: (updatedItem: InventoryItem) => void;
  updateItem: (updatedItem: InventoryItem) => void;
  addToCart: (items: string[], quantity?: string) => void;
  updateCartItemQuantity: (id: string, quantity: string) => void;
  toggleCartItem: (id: string) => void;
  toggleAllCartItems: (status: boolean) => void;
  toggleCategoryCartItems: (category: CartItem['category'], status: boolean) => void;
  clearCheckedCartItems: () => void;
  logout: () => void;
  toggleFavorite: (recipeId: string) => void;
  toggleHistory: (recipeId: string, ingredientsCount?: number) => void;
  getExpiringItemsByRange: (rangeDays: number) => InventoryItem[];
  getExpiredItems: () => InventoryItem[];
  isPasswordRecovery: boolean;
  setIsPasswordRecovery: (status: boolean) => void;
  fetchRecipesFromSupabase: () => Promise<void>;
  addRecipeToSupabase: (recipe: Recipe) => Promise<void>;
  deleteRecipe: (id: string) => Promise<void>;
  mealPlan: WeeklyMealPlan;
  assignRecipeToMealPlan: (day: string, mealType: 'breakfast' | 'lunch' | 'dinner', recipeId: string, recipeTitle: string) => Promise<void>;
  removeRecipeFromMealPlan: (day: string, mealType: 'breakfast' | 'lunch' | 'dinner') => Promise<void>;
}

export const AppContext = createContext<AppContextType>({} as AppContextType);

const CART_STORAGE_KEY = '@whiskdom_cart_v2';
const FAVORITES_STORAGE_KEY = '@whiskdom_favorites';
const HISTORY_STORAGE_KEY = '@whiskdom_history';
const THRESHOLD_STORAGE_KEY = '@whiskdom_threshold';
const MEAL_PLAN_STORAGE_KEY = '@whiskdom_meal_plan_v1';

export const toTitleCase = (str: string): string => {
  if (!str) return '';
  return str
    .toLocaleLowerCase('tr-TR')
    .split(' ')
    .map(word => word.charAt(0).toLocaleUpperCase('tr-TR') + word.slice(1))
    .join(' ');
};

const detectCategory = (itemName: string): CartItem['category'] => {
  const name = itemName.toLowerCase();
  if (name.includes('domates') || name.includes('soğan') || name.includes('patates') || name.includes('biber') || name.includes('maydanoz') || name.includes('havuç') || name.includes('elma') || name.includes('limon') || name.includes('sebze')) return 'Manav';
  if (name.includes('süt') || name.includes('yoğurt') || name.includes('peynir') || name.includes('kaşar') || name.includes('tereyağı') || name.includes('krema')) return 'Süt Ürünleri';
  if (name.includes('kıyma') || name.includes('et') || name.includes('tavuk') || name.includes('sucuk') || name.includes('sosis') || name.includes('pastırma') || name.includes('balık')) return 'Et & Şarküteri';
  if (name.includes('un') || name.includes('pirinç') || name.includes('makarna') || name.includes('salça') || name.includes('şeker') || name.includes('tuz') || name.includes('yağ') || name.includes('zeytinyağı') || name.includes('bakliyat') || name.includes('mercimek') || name.includes('ceviz') || name.includes('yulaf')) return 'Kiler & Kuru Gıda';
  return 'Diğer';
};

const parseTRDate = (dateStr: string): Date => {
  const parts = dateStr.split('-');
  if (parts.length === 3) return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
  return new Date(dateStr);
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [inventory, setInventoryState] = useState<InventoryItem[]>([]);
  const [recipes, setRecipesState] = useState<Recipe[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [wasteStats, setWasteStats] = useState<WasteStats>({ savedCount: 0, wastedCount: 0 });
  const [expiryThreshold, setExpiryThresholdState] = useState<number>(0);
  const [userPreferences, setUserPreferencesState] = useState<UserPreferences>({ diets: [], allergens: [] });
  const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(false);
  const [userProfile, setUserProfileState] = useState<UserProfile>({
    name: 'Şef Kullanıcı',
    email: '',
    title: 'Çırak Şef 🍳',
    activeTitle: 'Çırak Şef 🍳',
    avatarUrl: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
  });

  const [mealPlan, setMealPlan] = useState<WeeklyMealPlan>({
    Pazartesi: {},
    Salı: {},
    Çarşamba: {},
    Perşembe: {},
    Cuma: {},
    Cumartesi: {},
    Pazar: {},
  });
  
  useEffect(() => {
    let mounted = true;

    const handleUrl = async (url: string | null) => {
      if (!url) return;

      if (url.includes('type=recovery')) {
        const hashIndex = url.indexOf('#');
        const queryIndex = url.indexOf('?');
        const paramsString = hashIndex !== -1 
          ? url.substring(hashIndex + 1) 
          : (queryIndex !== -1 ? url.substring(queryIndex + 1) : '');

        const params = new URLSearchParams(paramsString);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (!error && mounted) {
            setIsPasswordRecovery(true);
          }
        } else {
          if (mounted) setIsPasswordRecovery(true);
        }
      }
    };

    Linking.getInitialURL().then((url) => handleUrl(url));

    const linkingSubscription = Linking.addEventListener('url', (event) => {
      if (event?.url) {
        handleUrl(event.url);
      }
    });

    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (mounted) {
          if (session?.user) {
            setUser(session.user);
            await fetchUserData(session.user);
          } else {
            setUser(null);
            setLoading(false);
          }
        }
      } catch (err: unknown) {
        if (mounted) setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (mounted) {
        if (event === 'PASSWORD_RECOVERY') {
          setIsPasswordRecovery(true);
        }

        if (session?.user) {
          setUser(session.user);
          await fetchUserData(session.user);
        } else {
          setUser(null);
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      linkingSubscription.remove();
      subscription.unsubscribe();
    };
  }, []);

  const fetchRecipesFromSupabase = async () => {
    try {
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const formattedRecipes: Recipe[] = data.map((r: Record<string, unknown>) => {
          let parsedIngredients: string[] = [];
          let parsedQuantities: string[] = [];

          const rawIngredients = r.ingredients;
          if (Array.isArray(rawIngredients)) {
            parsedIngredients = rawIngredients.map((ing: unknown) =>
              typeof ing === 'string' ? ing : (ing as Record<string, string>)?.name || ''
            );
            
            parsedQuantities = rawIngredients.map((ing: unknown) => {
              if (typeof ing === 'string') return ing;
              const itemObj = ing as Record<string, string>;
              if (itemObj?.quantity && itemObj?.name && itemObj.quantity.toLowerCase().includes(itemObj.name.toLowerCase())) {
                return itemObj.quantity;
              }
              return itemObj?.quantity ? `${itemObj.quantity} ${itemObj.name || ''}`.trim() : (itemObj?.name || '');
            });
          }

          return {
            id: String(r.id),
            title: String(r.title || ''),
            description: r.description ? String(r.description) : undefined,
            category: String(r.category || 'Ana Yemek'),
            mainIngredient: parsedIngredients[0] || 'Genel',
            ingredients: parsedIngredients,
            ingredientsWithQuantities: parsedQuantities,
            cookingTime: String(r.cook_time || r.prep_time || '20 Dk'),
            instructions: Array.isArray(r.instructions) ? r.instructions.map(String) : [],
            isAI: Boolean(r.is_ai),
            isUserCreated: Boolean(r.is_user_created),
            isSubmitted: Boolean(r.is_submitted),
            diets: Array.isArray(r.diets) ? r.diets.map(String) : [],
            allergens: Array.isArray(r.allergens) ? r.allergens.map(String) : [],
            is_approved: Boolean(r.is_approved),
            user_id: r.user_id ? String(r.user_id) : undefined,
            creatorProfile: {
              name: String(r.creator_name || 'Topluluk Şefi'),
              badge: String(r.creator_title || '🌟 Gurme Şef'),
              recipeCount: 3,
              xp: 1420
            }
          };
        });

        setRecipesState(formattedRecipes);
      }
    } catch (err: unknown) {
      // Sessizce geçilir
    }
  };

  const addRecipeToSupabase = async (recipe: Recipe) => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const { data: profileData } = await supabase
        .from('profiles')
        .select('name, title')
        .eq('id', authUser.id)
        .single();

      const creatorName = profileData?.name || 'Topluluk Şefi';
      const creatorTitle = profileData?.title || '🌟 Gurme Şef';

      const { error } = await supabase
        .from('recipes')
        .insert([{
          user_id: authUser.id,
          creator_name: creatorName,
          creator_title: creatorTitle,
          title: recipe.title,
          description: recipe.description || '',
          category: recipe.category || 'Ana Yemek',
          cook_time: recipe.cookingTime || '20 Dk',
          prep_time: recipe.cookingTime || '20 Dk',
          ingredients: (recipe.ingredientsWithQuantities || []).map((item, idx) => ({
            name: recipe.ingredients[idx] || item,
            quantity: item
          })),
          instructions: recipe.instructions || [],
          diets: recipe.diets || [],
          allergens: recipe.allergens || [],
          is_user_created: recipe.isUserCreated ?? true,
          is_submitted: recipe.isSubmitted || false,
          is_ai: recipe.isAI ?? false,
        }]);

      if (error) {
        Alert.alert("Hata", `Tarif eklenirken hata oluştu: ${error.message}`);
        return;
      }

      await fetchRecipesFromSupabase();
    } catch (err: unknown) {
      // Sessizce geçilir
    }
  };

  const deleteRecipe = async (id: string) => {
    try {
      const { error } = await supabase.from('recipes').delete().eq('id', id);
      if (error) {
        Alert.alert("Hata", "Tarif silinemedi: " + error.message);
        return;
      }
      setRecipesState(prev => prev.filter(recipe => recipe.id !== id));
      Alert.alert("Silindi", "Tarif başarıyla kaldırıldı.");
    } catch (err: unknown) {
      // Sessizce geçilir
    }
  };

  const fetchUserData = async (currentUser: User) => {
    setLoading(true);
    try {
      await ensureUserProfileExists(currentUser);
      await fetchRecipesFromSupabase();

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      if (profileData) {
        setUserProfileState({
          name: profileData.name || 'Şef Kullanıcı',
          email: profileData.email || currentUser.email || '',
          title: profileData.title || 'Çırak Şef 🍳',
          activeTitle: profileData.active_title || profileData.title || 'Çırak Şef 🍳',
          avatarUrl: profileData.avatar_url || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
        });
        setUserPreferencesState({
          diets: profileData.diets || [],
          allergens: profileData.allergens || [],
        });
      }

      const { data: inventoryData } = await supabase
        .from('inventory')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (inventoryData) {
        const formatted: InventoryItem[] = inventoryData.map((item: Record<string, unknown>) => ({
          id: String(item.id),
          name: String(item.name || ''),
          brand: item.brand ? String(item.brand) : undefined,
          quantity: String(item.quantity || ''),
          expiryDate: String(item.expiry_date || ''),
          imageUrl: item.image_url ? String(item.image_url) : undefined,
          category: item.category ? String(item.category) : undefined,
        }));
        setInventoryState(formatted);
        safeScheduleNotifications(formatted);
      }

      const { data: statsData } = await supabase
        .from('waste_stats')
        .select('*')
        .eq('user_id', currentUser.id)
        .single();

      if (statsData) {
        setWasteStats({
          savedCount: Number(statsData.saved_count || 0),
          wastedCount: Number(statsData.wasted_count || 0),
        });
      }

      const storedCart = await AsyncStorage.getItem(CART_STORAGE_KEY);
      if (storedCart) setCart(JSON.parse(storedCart));

      const storedMealPlan = await AsyncStorage.getItem(MEAL_PLAN_STORAGE_KEY);
      if (storedMealPlan) setMealPlan(JSON.parse(storedMealPlan));

      const storedFavs = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
      if (storedFavs) setFavorites(JSON.parse(storedFavs));

      const storedHist = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
      if (storedHist) setHistory(JSON.parse(storedHist));

      const storedThreshold = await AsyncStorage.getItem(THRESHOLD_STORAGE_KEY);
      if (storedThreshold) setExpiryThresholdState(Number(storedThreshold));

    } catch (error: unknown) {
      // Sessizce geçilir
    } finally {
      setLoading(false);
    }
  };

  const safeScheduleNotifications = (items: InventoryItem[]) => {
    try {
      scheduleExpiryNotifications(items);
    } catch (e: unknown) {
      // Sessizce geçilir
    }
  };

  const addInventoryItem = async (item: InventoryItem) => {
    if (!user) return;
    const formattedItem = {
      user_id: user.id,
      name: toTitleCase(item.name),
      brand: item.brand ? toTitleCase(item.brand) : 'Genel',
      quantity: item.quantity,
      expiry_date: item.expiryDate,
      image_url: item.imageUrl,
      category: item.category,
    };

    const { data, error } = await supabase
      .from('inventory')
      .insert([formattedItem])
      .select()
      .single();

    if (!error && data) {
      const newItem: InventoryItem = {
        id: String(data.id),
        name: String(data.name),
        brand: data.brand ? String(data.brand) : undefined,
        quantity: String(data.quantity),
        expiryDate: String(data.expiry_date),
        imageUrl: data.image_url ? String(data.image_url) : undefined,
        category: data.category ? String(data.category) : undefined,
      };
      const updated = [newItem, ...inventory];
      setInventoryState(updated);
      safeScheduleNotifications(updated);
    }
  };

  const deleteItem = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from('inventory').delete().eq('id', id);
    if (!error) {
      const updated = inventory.filter(item => item.id !== id);
      setInventoryState(updated);
      safeScheduleNotifications(updated);
    }
  };

  const updateInventoryItem = async (updatedItem: InventoryItem) => {
    if (!user) return;
    const { error } = await supabase
      .from('inventory')
      .update({
        name: toTitleCase(updatedItem.name),
        brand: updatedItem.brand ? toTitleCase(updatedItem.brand) : 'Genel',
        quantity: updatedItem.quantity,
        expiry_date: updatedItem.expiryDate,
        image_url: updatedItem.imageUrl,
        category: updatedItem.category,
      })
      .eq('id', updatedItem.id);

    if (!error) {
      const updatedList = inventory.map(item => item.id === updatedItem.id ? updatedItem : item);
      setInventoryState(updatedList);
      safeScheduleNotifications(updatedList);
    }
  };

  const addMultipleInventoryItems = async (newItems: InventoryItem[]) => {
    if (!user || !user.id || newItems.length === 0) {
      Alert.alert("Hata", "Oturum bilgisi doğrulaması başarısız oldu. Lütfen tekrar giriş yapın.");
      return;
    }

    const formattedRows = newItems.map(item => ({
      user_id: user.id,
      name: toTitleCase(item.name || 'Bilinmeyen Ürün'),
      brand: item.brand ? toTitleCase(item.brand) : 'Genel',
      quantity: item.quantity || '1 Adet',
      expiry_date: item.expiryDate || '15-10-2026',
      image_url: item.imageUrl || '',
      category: item.category || detectCategory(item.name || ''),
    }));

    const { data, error } = await supabase
      .from('inventory')
      .insert(formattedRows)
      .select();

    if (error) {
      Alert.alert("Hata ❌", `Ürünler eklenirken veritabanı hatası oluştu: ${error.message}`);
      return;
    }

    if (data && data.length > 0) {
      const insertedItems: InventoryItem[] = data.map((d: Record<string, unknown>) => ({
        id: String(d.id),
        name: String(d.name || ''),
        brand: d.brand ? String(d.brand) : undefined,
        quantity: String(d.quantity || ''),
        expiryDate: String(d.expiry_date || ''),
        imageUrl: d.image_url ? String(d.image_url) : undefined,
        category: d.category ? String(d.category) : undefined,
      }));

      setInventoryState((prevInventory) => {
        const existingIds = new Set(prevInventory.map(item => item.id));
        const filteredNewItems = insertedItems.filter(item => !existingIds.has(item.id));
        
        const updatedList = [...filteredNewItems, ...prevInventory];
        safeScheduleNotifications(updatedList);
        return updatedList;
      });
    }
  };

  const setUserProfile = async (profile: UserProfile) => {
    if (!user) return;
    setUserProfileState(profile);

    await supabase.from('profiles').update({
      name: profile.name,
      title: profile.title,
      active_title: profile.activeTitle,
      avatar_url: profile.avatarUrl,
    }).eq('id', user.id);
  };

  const setUserPreferences = async (prefs: UserPreferences) => {
    if (!user) return;
    setUserPreferencesState(prefs);

    await supabase.from('profiles').update({
      diets: prefs.diets,
      allergens: prefs.allergens,
    }).eq('id', user.id);
  };

  const setInventory = async (items: InventoryItem[]) => setInventoryState(items);

  const setExpiryThreshold = async (days: number) => {
    setExpiryThresholdState(days);
    await AsyncStorage.setItem(THRESHOLD_STORAGE_KEY, days.toString());
  };

  const addToCart = async (newIngredients: string[], defaultQuantity: string = '1 Adet / Paket') => {
    const newCartItems: CartItem[] = newIngredients.map((ing) => ({
      id: Date.now().toString() + Math.random().toString(),
      name: toTitleCase(ing),
      quantity: defaultQuantity,
      checked: false,
      category: detectCategory(ing),
    }));
    const updated = [...cart, ...newCartItems];
    setCart(updated);
    await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(updated));
  };

  const updateCartItemQuantity = async (id: string, newQuantity: string) => {
    const updated = cart.map(item => item.id === id ? { ...item, quantity: newQuantity } : item);
    setCart(updated);
    await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(updated));
  };

  const toggleCartItem = async (id: string) => {
    const updated = cart.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item));
    setCart(updated);
    await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(updated));
  };

  const toggleAllCartItems = async (status: boolean) => {
    const updated = cart.map(item => ({ ...item, checked: status }));
    setCart(updated);
    await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(updated));
  };

  const toggleCategoryCartItems = async (category: CartItem['category'], status: boolean) => {
    const updated = cart.map(item => item.category === category ? { ...item, checked: status } : item);
    setCart(updated);
    await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(updated));
  };

  const clearCheckedCartItems = async () => {
    const updated = cart.filter((item) => !item.checked);
    setCart(updated);
    await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(updated));
  };

  const assignRecipeToMealPlan = async (day: string, mealType: 'breakfast' | 'lunch' | 'dinner', recipeId: string, recipeTitle: string) => {
    const updated = {
      ...mealPlan,
      [day]: {
        ...mealPlan[day],
        [mealType]: { recipeId, recipeTitle }
      }
    };
    setMealPlan(updated);
    await AsyncStorage.setItem(MEAL_PLAN_STORAGE_KEY, JSON.stringify(updated));
  };

  const removeRecipeFromMealPlan = async (day: string, mealType: 'breakfast' | 'lunch' | 'dinner') => {
    const dayPlan = { ...mealPlan[day] };
    delete dayPlan[mealType];

    const updated = {
      ...mealPlan,
      [day]: dayPlan
    };
    setMealPlan(updated);
    await AsyncStorage.setItem(MEAL_PLAN_STORAGE_KEY, JSON.stringify(updated));
  };

  const logout = async () => {
    await authSignOut();
    setUser(null);
    setInventoryState([]);
    setCart([]);
    setFavorites([]);
    setHistory([]);
    setWasteStats({ savedCount: 0, wastedCount: 0 });
    setIsPasswordRecovery(false);
    Alert.alert("Çıkış Yapıldı", "Hesabınızdan güvenle çıkış yaptınız.");
  };

  const toggleFavorite = async (recipeId: string) => {
    let updated: string[];
    if (favorites.includes(recipeId)) {
      updated = favorites.filter(id => id !== recipeId);
    } else {
      updated = [recipeId, ...favorites];
    }
    setFavorites(updated);
    await AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(updated));
  };

  const toggleHistory = async (recipeId: string, ingredientsCount: number = 3) => {
    let updated: string[];
    let newStats = { ...wasteStats };

    if (history.includes(recipeId)) {
      updated = history.filter(id => id !== recipeId);
      newStats.savedCount = Math.max(0, newStats.savedCount - ingredientsCount);
    } else {
      updated = [recipeId, ...history];
      newStats.savedCount += ingredientsCount;
    }

    setHistory(updated);
    setWasteStats(newStats);
    await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));

    if (user) {
      await supabase.from('waste_stats').update({
        saved_count: newStats.savedCount,
        wasted_count: newStats.wastedCount,
      }).eq('user_id', user.id);
    }
  };

  const getExpiredItems = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return inventory.filter((item) => {
      if (!item.expiryDate) return false;
      const expDate = parseTRDate(item.expiryDate);
      expDate.setHours(0, 0, 0, 0);
      const diffTime = expDate.getTime() - today.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) < 0;
    });
  };

  const getExpiringItemsByRange = (rangeDays: number) => {
    if (rangeDays === 0) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return inventory.filter((item) => {
      if (!item.expiryDate) return false;
      const expDate = parseTRDate(item.expiryDate);
      expDate.setHours(0, 0, 0, 0);
      const diffTime = expDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) return false;

      if (rangeDays === 3) return diffDays >= 0 && diffDays <= 3;
      if (rangeDays === 7) return diffDays >= 4 && diffDays <= 7;
      if (rangeDays === 14) return diffDays >= 8 && diffDays <= 14;
      return false;
    });
  };

  return (
    <AppContext.Provider 
      value={{ 
        inventory, 
        recipes,
        cart, 
        favorites,
        history,
        wasteStats,
        userPreferences,
        userProfile,
        expiryThreshold,
        loading,
        user,
        isPasswordRecovery,
        setIsPasswordRecovery,
        setExpiryThreshold,
        setUserPreferences,
        setUserProfile,
        setInventory,
        addInventoryItem, 
        addItem: addInventoryItem,
        deleteItem,
        addMultipleInventoryItems,
        updateInventoryItem,
        updateItem: updateInventoryItem,
        addToCart, 
        updateCartItemQuantity,
        toggleCartItem, 
        toggleAllCartItems,
        toggleCategoryCartItems,
        clearCheckedCartItems,
        logout,
        toggleFavorite,
        toggleHistory,
        getExpiringItemsByRange,
        getExpiredItems,
        fetchRecipesFromSupabase,
        addRecipeToSupabase,
        deleteRecipe,
        mealPlan,
        assignRecipeToMealPlan,
        removeRecipeFromMealPlan
      }}
    >
      {children}
    </AppContext.Provider>
  );
};