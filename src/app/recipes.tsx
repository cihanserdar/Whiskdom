import { useContext, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { AppContext, Recipe } from '../context/AppContext';
import { AIRecipeResult, formatUserRecipeWithAI, generateRecipeWithAI } from '../services/aiService';
import { checkQuota, consumeQuota } from '../services/quotaService';
import { supabase } from '../services/supabase';

const CATEGORIES = [
  'Tümü',
  'Sizin Tarifleriniz',
  'Topluluk Tarifleri',
  'Whiskdom Özel',
  'Ana Yemek',
  'Çorba',
  'Kahvaltılık',
  'Tatlı',
  'Salata & Meze',
  'Makarna & Pilav',
  'Aperitif',
  'Zeytinyağlı',
  'Deniz Ürünleri',
  'İçecek & Fit'
];

const RECIPE_FORM_CATEGORIES = [
  'Ana Yemek',
  'Çorba',
  'Kahvaltılık',
  'Tatlı',
  'Salata & Meze',
  'Makarna & Pilav',
  'Aperitif',
  'Zeytinyağlı',
  'Deniz Ürünleri',
  'İçecek & Fit'
];

const AI_TARGET_CATEGORIES = [
  '✨ AI Sürprizi (Serbest Mod)',
  '⚡ Hızlı & Pratik (15 dk)',
  'Ana Yemek',
  'Çorba',
  'Kahvaltılık',
  'Tatlı',
  'Salata & Meze',
  'Makarna & Pilav',
  'Aperitif',
  'Zeytinyağlı',
  'Deniz Ürünleri',
  'İçecek & Fit'
];

const AVAILABLE_DIETS = ['Vegan', 'Vejetaryen', 'Ketojenik', 'Glutensiz', 'Laktozsuz', 'Rafine Şekersiz', 'Yüksek Protein', 'Whole Foods', 'Düşük Kalori'];
const AVAILABLE_ALLERGENS = ['Gluten', 'Laktoz / Süt', 'Yumurta', 'Kabuklu Deniz Ürünleri', 'Kuruyemiş', 'Soya', 'Fıstık / Susam'];

interface UserProfileData {
  name: string;
  badge: string;
  recipeCount: number;
  xp: number;
}

export default function RecipesScreen() {
  const { 
    inventory,
    recipes,
    addToCart, 
    favorites,
    history,
    userPreferences,
    setUserPreferences,
    toggleFavorite,
    toggleHistory,
    getExpiringItemsByRange, 
    getExpiredItems, 
    expiryThreshold, 
    setExpiryThreshold,
    fetchRecipesFromSupabase,
    addRecipeToSupabase,
    deleteRecipe,
    mealPlan,                           // 📅 Eklendi
    assignRecipeToMealPlan,   // 📅 Eklendi
    removeRecipeFromMealPlan  // 📅 Eklendi
  } = useContext(AppContext);

  const activeRangeItems = getExpiringItemsByRange(expiryThreshold);
  const expiredItems = getExpiredItems();
  const criticalUrgentItems = getExpiringItemsByRange(3); 

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRecipe, setAiRecipe] = useState<AIRecipeResult | null>(null);

  // 🪟 AI ŞEF KATEGORİ SEÇİM MODALI STATE'LERİ
  const [aiCategoryModalVisible, setAiCategoryModalVisible] = useState(false);
  const [selectedAiCategory, setSelectedAiCategory] = useState<string>('Fit & Sağlıklı');
  const [remainingQuota, setRemainingQuota] = useState<number | null>(null);

  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [prefModalVisible, setPrefModalVisible] = useState(false);
  const [addRecipeModalVisible, setAddRecipeModalVisible] = useState(false);

  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [selectedUserProfile, setSelectedUserProfile] = useState<UserProfileData | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>('Tümü');
  const [collectionFilter, setCollectionFilter] = useState<'all' | 'favorites' | 'history'>('all');
  const [ingredientFilter, setIngredientFilter] = useState<'all' | 'complete' | 'missing'>('all');

  // 📄 SAYFALAMA (PAGINATION) STATE'LERİ
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [recipesPerPage, setRecipesPerPage] = useState<number>(10);

  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [portionCount, setPortionCount] = useState<number>(4);

  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Ana Yemek');
  const [newTime, setNewTime] = useState('25 Dk');
  const [newRawIngredients, setNewRawIngredients] = useState('');
  const [newRawInstructions, setNewRawInstructions] = useState('');
  const [newFormDiets, setNewFormDiets] = useState<string[]>([]);
  const [newFormAllergens, setNewFormAllergens] = useState<string[]>([]);
  const [isSubmittedToLibrary, setIsSubmittedToLibrary] = useState(false);
  const [isFormattingAI, setIsFormattingAI] = useState(false);

  // 📅 PLANA EKLE MODALI & SEÇİMLERİ İÇİN STATE'LER
  const [mealPlanModalVisible, setMealPlanModalVisible] = useState(false);
  const [recipeToPlan, setRecipeToPlan] = useState<Recipe | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>('Pazartesi');
  const [selectedMealType, setSelectedMealType] = useState<'breakfast' | 'lunch' | 'dinner'>('dinner');

  useEffect(() => {
    fetchRecipesFromSupabase();
  }, []);

  // Filtre veya arama değiştiğinde sayfayı 1. kategoriye/sayfaya sıfırla
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, collectionFilter, ingredientFilter, recipesPerPage]);

  // Modal açıldığında kalan kotayı güncelle
  const handleOpenAiModal = async () => {
    const status = await checkQuota('aiRecipe');
    setRemainingQuota(status.remaining);
    setAiCategoryModalVisible(true);
  };

  const calculateIngredientPortion = (ingredientText: string, portions: number): string => {
    const ratio = portions / 4;
    return ingredientText.replace(/(\d+([.,]\d+)?)/g, (match) => {
      const num = parseFloat(match.replace(',', '.'));
      const calculated = Math.round(num * ratio * 10) / 10;
      return calculated.toString();
    });
  };

  const handleAddMissingToCart = (ingredients: string[]) => {
    addToCart(ingredients);
    Alert.alert("Başarılı!", "Eksik malzemeler alışveriş listenize eklendi.");
  };

  const handleGenerateAIRecipe = async (targetCategory: string) => {
    // 1. Önce kota kontrolü yapıyoruz
    const quotaStatus = await checkQuota('aiRecipe');
    
    if (!quotaStatus.allowed) {
      Alert.alert(
        "Günlük Hak Doldu ⏳",
        `AI Şef günlük kullanım hakkınızı tüketti.\nYenilenmesine kalan süre:\n${quotaStatus.resetTimeText}\n\nSınırsız kullanım için Pro pakete geçebilirsiniz!`
      );
      return;
    }

    const allIngredientNames = inventory.map(item => item.name);
    if (allIngredientNames.length === 0) {
      Alert.alert("Uyarı", "Dolabınız boş! Önce envantere ürün ekleyin.");
      return;
    }

    setAiLoading(true);
    
    try {
      const result = await generateRecipeWithAI(allIngredientNames, userPreferences, targetCategory);
      
      setAiLoading(false);

      if (result) {
        setAiRecipe(result);
        // 2. İstek BAŞARILI olduğu an hakkı güvenle düşürüyoruz
        await consumeQuota('aiRecipe');
      } else {
        Alert.alert("Hata", "AI tarif oluştururken bir sorun oluştu. Lütfen tekrar deneyin.");
      }
    } catch (error) {
      setAiLoading(false);
      console.error("AI Üretim Hatası:", error);
    }
  };

  const handleCreateOrUpdateUserRecipe = async () => {
    if (!newTitle.trim() || !newRawIngredients.trim() || !newRawInstructions.trim()) {
      Alert.alert("Eksik Bilgi", "Lütfen tarif başlığını, malzemeleri ve hazırlanış adımlarını doldurun.");
      return;
    }

    setIsFormattingAI(true);
    
    const formattedResult = await formatUserRecipeWithAI({
      title: newTitle,
      category: newCategory,
      cookingTime: newTime,
      servings: '4 Kişilik',
      rawIngredients: newRawIngredients,
      rawInstructions: newRawInstructions
    });
    
    setIsFormattingAI(false);

    if (!formattedResult) {
      Alert.alert("AI Düzenleme Hatası", "AI Şef tarifi düzenleyemedi.");
      return;
    }

    const recipeData: Recipe = {
      id: editingRecipeId || Date.now().toString(),
      title: formattedResult.title || newTitle,
      category: newCategory,
      mainIngredient: formattedResult.mainIngredient || 'Genel',
      ingredients: formattedResult.ingredients || [],
      ingredientsWithQuantities: formattedResult.ingredientsWithQuantities || [],
      cookingTime: formattedResult.cookingTime || newTime,
      instructions: formattedResult.instructions || [],
      isUserCreated: true,
      isAI: false,
      isSubmitted: isSubmittedToLibrary,
    };

    (recipeData as any).diets = newFormDiets;
    (recipeData as any).allergens = newFormAllergens;

    if (editingRecipeId) {
      const { error } = await supabase
        .from('recipes')
        .update({
          title: recipeData.title,
          category: recipeData.category,
          cook_time: recipeData.cookingTime,
          ingredients: recipeData.ingredientsWithQuantities,
          instructions: recipeData.instructions,
          is_submitted: isSubmittedToLibrary,
        })
        .eq('id', editingRecipeId);

      if (error) {
        Alert.alert("Hata", "Tarif güncellenemedi: " + error.message);
      } else {
        Alert.alert("Başarılı", "Tarifiniz güncellendi!");
        fetchRecipesFromSupabase();
      }
    } else {
      await addRecipeToSupabase(recipeData);
      if (isSubmittedToLibrary) {
        Alert.alert("Kütüphaneye Önerildi! 🌟", "Tarifiniz incelemeye gönderildi. Onaylandığında XP kazanacaksınız!");
      } else {
        Alert.alert("Tebrikler! 🎉", "Tarifiniz AI Şef tarafından başarıyla düzenlendi ve eklendi.");
      }
    }

    setAddRecipeModalVisible(false);
    setEditingRecipeId(null);
    setNewTitle('');
    setNewRawIngredients('');
    setNewRawInstructions('');
    setNewFormDiets([]);
    setNewFormAllergens([]);
    setIsSubmittedToLibrary(false);
  };

  const handleDeleteRecipe = async (recipeId: string) => {
    Alert.alert(
      "Tarifi Sil",
      "Bu tarifi silmek istediğinize emin misiniz?",
      [
        { text: "Vazgeç", style: "cancel" },
        { 
          text: "Evet, Sil", 
          style: "destructive", 
          onPress: async () => {
            setSelectedRecipe(null);
            await deleteRecipe(recipeId);
          } 
        }
      ]
    );
  };

  const handleOpenEditModal = (recipe: Recipe) => {
    setEditingRecipeId(recipe.id);
    setNewTitle(recipe.title);
    setNewCategory(recipe.category || 'Ana Yemek');
    setNewTime(recipe.cookingTime || '25 Dk');
    setNewRawIngredients(recipe.ingredientsWithQuantities?.join('\n') || recipe.ingredients.join('\n'));
    setNewRawInstructions(recipe.instructions?.join('\n') || '');
    setNewFormDiets((recipe as any).diets || []);
    setNewFormAllergens((recipe as any).allergens || []);
    setIsSubmittedToLibrary(recipe.isSubmitted || false);
    setSelectedRecipe(null);
    setAddRecipeModalVisible(true);
  };

  const handleOpenDuplicateModal = (recipe: Recipe) => {
    setEditingRecipeId(null);
    setNewTitle(`${recipe.title} (Kopya)`);
    setNewCategory(recipe.category || 'Ana Yemek');
    setNewTime(recipe.cookingTime || '25 Dk');
    setNewRawIngredients(recipe.ingredientsWithQuantities?.join('\n') || recipe.ingredients.join('\n'));
    setNewRawInstructions(recipe.instructions?.join('\n') || '');
    setNewFormDiets((recipe as any).diets || []);
    setNewFormAllergens((recipe as any).allergens || []);
    setIsSubmittedToLibrary(false);
    setSelectedRecipe(null);
    setAddRecipeModalVisible(true);
  };

  const handleOpenUserProfile = async (recipe: Recipe) => {
    const targetUserId = (recipe as any).user_id;

    const userRecipeCount = targetUserId 
      ? recipes.filter(r => (r as any).user_id === targetUserId).length 
      : 1;

    let profileName = 'Topluluk Şefi';
    let profileBadge = '🌟 Kıdemli Gurme';
    let profileXp = 0;

    if (targetUserId) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('name, active_title, title, xp')
          .eq('id', targetUserId)
          .single();

        if (data && !error) {
          profileName = data.name || profileName;
          profileBadge = data.active_title || data.title || profileBadge;
          profileXp = data.xp !== null && data.xp !== undefined ? data.xp : 0;
        }
      } catch (err) {
        console.log('Profil bilgisi çekilemedi:', err);
      }
    } else if ((recipe as any).creatorProfile) {
      const cp = (recipe as any).creatorProfile;
      profileName = cp.name || profileName;
      profileBadge = cp.badge || profileBadge;
      profileXp = cp.xp !== undefined ? cp.xp : 0;
    }

    setSelectedUserProfile({
      name: profileName,
      badge: profileBadge,
      recipeCount: userRecipeCount,
      xp: profileXp 
    });

    setProfileModalVisible(true);
  };

  const handleToggleDiet = (diet: string) => {
    const isSelected = userPreferences.diets.includes(diet);
    const updatedDiets = isSelected 
      ? userPreferences.diets.filter(d => d !== diet)
      : [...userPreferences.diets, diet];
    setUserPreferences({ ...userPreferences, diets: updatedDiets });
  };
  
  const handleToggleAllergen = (allergen: string) => {
    const isSelected = userPreferences.allergens.includes(allergen);
    const updatedAllergens = isSelected 
      ? userPreferences.allergens.filter(a => a !== allergen)
      : [...userPreferences.allergens, allergen];
    setUserPreferences({ ...userPreferences, allergens: updatedAllergens });
  };

  const handleToggleFormDiet = (diet: string) => {
    const exists = newFormDiets.includes(diet);
    if (exists) {
      setNewFormDiets(newFormDiets.filter(d => d !== diet));
    } else {
      setNewFormDiets([...newFormDiets, diet]);
    }
  };

  const handleToggleFormAllergen = (allergen: string) => {
    const exists = newFormAllergens.includes(allergen);
    if (exists) {
      setNewFormAllergens(newFormAllergens.filter(a => a !== allergen));
    } else {
      setNewFormAllergens([...newFormAllergens, allergen]);
    }
  };

  const handleSaveAIRecipe = async () => {
    if (!aiRecipe) return;
    const newRecipe: Recipe = {
      id: Date.now().toString(),
      title: aiRecipe.title,
      mainIngredient: aiRecipe.mainIngredient,
      ingredients: [aiRecipe.mainIngredient, ...aiRecipe.missingIngredients],
      ingredientsWithQuantities: aiRecipe.ingredientsWithQuantities,
      cookingTime: aiRecipe.cookingTime,
      instructions: aiRecipe.instructions,
      isAI: true,
      isUserCreated: false
    };
    await addRecipeToSupabase(newRecipe);
    setAiRecipe(null);
    Alert.alert("Eklendi!", "AI Tarifi Supabase veritabanına ve tarif listenize kaydedildi.");
  };

  const handleToggleCook = async (recipeId: string, title: string) => {
    const isAlreadyCooked = history.includes(recipeId);
    toggleHistory(recipeId, 3);
    
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const newHistoryCount = isAlreadyCooked ? Math.max(0, history.length - 1) : history.length + 1;
        await supabase
          .from('profiles')
          .update({ total_cooked: newHistoryCount })
          .eq('id', authUser.id);
      }
    } catch (err) {
      console.log('Pişirilen tarif sayısı güncellenirken hata:', err);
    }

    if (isAlreadyCooked) {
      Alert.alert("İptal Edildi", `"${title}" tarifi yapılanlar geçmişinden çıkarıldı.`);
    } else {
      Alert.alert("Afiyet Olsun! 👨‍🍳", `"${title}" tarifi pişirildi! Malzemeler tasarruf istatistiğinize eklendi.`);
    }
  };

  const handleOpenYouTubeVideo = (recipeTitle: string) => {
    const searchQuery = encodeURIComponent(`${recipeTitle} tarifi nasıl yapılır`);
    const youtubeUrl = `https://www.youtube.com/results?search_query=${searchQuery}`;
    Linking.openURL(youtubeUrl).catch(() => {
      Alert.alert("Hata", "YouTube uygulaması veya tarayıcı açılamadı.");
    });
  };

  const getDynamicMissingIngredients = (recipeIngredients: string[]): string[] => {
    const inventoryNames = inventory.map(i => i.name.toLowerCase());
    return recipeIngredients.filter(reqIng => {
      const lowerReq = reqIng.toLowerCase();
      const exists = inventoryNames.some(invName => invName.includes(lowerReq) || lowerReq.includes(invName));
      return !exists;
    });
  };

  const filteredRecipes = recipes
    .filter(recipe => {
      const dynamicMissing = getDynamicMissingIngredients(recipe.ingredients);
      const allIngs = [...recipe.ingredients, recipe.mainIngredient].map(i => i.toLowerCase());

      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase().trim();
        const matchesTitle = recipe.title.toLowerCase().includes(query);
        const matchesIngredient = allIngs.some(ing => ing.includes(query));
        if (!matchesTitle && !matchesIngredient) return false;
      }

      if (selectedCategory === 'Sizin Tarifleriniz') {
        if (!recipe.isUserCreated || recipe.isAI) return false;
      } else if (selectedCategory === 'Topluluk Tarifleri') {
        if (!(recipe as any).is_approved) return false;
      } else if (selectedCategory === 'Whiskdom Özel') {
        if (!recipe.isAI && !(recipe as any).isWhiskdomSpecial) return false;
      } else if (selectedCategory !== 'Tümü' && (recipe as any).category !== selectedCategory) {
        return false;
      }

      if (userPreferences.allergens && userPreferences.allergens.length > 0) {
        const hasAllergen = userPreferences.allergens.some(allergen => {
          const lowerAllergen = allergen.toLowerCase();
          return allIngs.some(ing => 
            ing.includes(lowerAllergen) || 
            (lowerAllergen.includes('süt') && (ing.includes('süt') || ing.includes('kaşar') || ing.includes('yoğurt') || ing.includes('peynir') || ing.includes('tereyağı'))) ||
            (lowerAllergen.includes('gluten') && (ing.includes('un') || ing.includes('makarna') || ing.includes('ekmek') || ing.includes('galeta')))
          );
        });
        if (hasAllergen) return false;
      }

      if (userPreferences.diets && userPreferences.diets.length > 0) {
        const violatesDiet = userPreferences.diets.some(diet => {
          const lowerDiet = diet.toLowerCase();
          if (lowerDiet === 'vegan') {
            return allIngs.some(ing => 
              ing.includes('et') || ing.includes('kıyma') || ing.includes('tavuk') || 
              ing.includes('süt') || ing.includes('yumurta') || ing.includes('peynir') || ing.includes('yoğurt') || ing.includes('tereyağı')
            );
          }
          if (lowerDiet === 'vejetaryen') {
            return allIngs.some(ing => ing.includes('et') || ing.includes('kıyma') || ing.includes('tavuk'));
          }
          if (lowerDiet === 'glutensiz') {
            return allIngs.some(ing => ing.includes('un') || ing.includes('makarna') || ing.includes('ekmek') || ing.includes('galeta'));
          }
          return false;
        });
        if (violatesDiet) return false;
      }

      if (collectionFilter === 'favorites' && !favorites.includes(recipe.id)) return false;
      if (collectionFilter === 'history' && !history.includes(recipe.id)) return false;

      if (ingredientFilter === 'complete' && dynamicMissing.length > 0) return false;
      if (ingredientFilter === 'missing' && dynamicMissing.length === 0) return false;

      return true;
    })
    .sort((a, b) => {
      if (collectionFilter === 'favorites') return favorites.indexOf(a.id) - favorites.indexOf(b.id);
      if (collectionFilter === 'history') return history.indexOf(a.id) - history.indexOf(b.id);
      
      const missingA = getDynamicMissingIngredients(a.ingredients).length;
      const missingB = getDynamicMissingIngredients(b.ingredients).length;
      return missingA - missingB;
    });

  // 📄 SAYFALAMA HESAPLAMALARI
  const totalPages = recipesPerPage === 0 ? 1 : Math.ceil(filteredRecipes.length / recipesPerPage);
  const displayedRecipes = recipesPerPage === 0 
    ? filteredRecipes 
    : filteredRecipes.slice((currentPage - 1) * recipesPerPage, currentPage * recipesPerPage);

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={styles.title}>🍳 Tarif Önerileri</Text>
        <TouchableOpacity 
          style={styles.addRecipeBtnHeader}
          onPress={() => {
            setEditingRecipeId(null);
            setNewTitle('');
            setNewCategory('Ana Yemek');
            setNewRawIngredients('');
            setNewRawInstructions('');
            setNewFormDiets([]);
            setNewFormAllergens([]);
            setIsSubmittedToLibrary(false);
            setAddRecipeModalVisible(true);
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.addRecipeBtnHeaderText}>+ Tarif Ekle</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.subtitle}>Mutfaktakilere danış, kendi tarifini oluştur</Text>


      <View style={styles.searchBarContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Tarif adı veya malzeme ara..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery !== '' && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
            <Text style={{ fontSize: 12, color: '#6C757D', fontWeight: '700' }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryPill,
                selectedCategory === cat && styles.categoryPillActive,
                cat === 'Whiskdom Özel' && { borderColor: '#7E22CE' },
                cat === 'Whiskdom Özel' && selectedCategory === cat && { backgroundColor: '#7E22CE' },
                cat === 'Sizin Tarifleriniz' && { borderColor: '#10B981', backgroundColor: selectedCategory === cat ? '#10B981' : '#ECFDF5' },
                cat === 'Topluluk Tarifleri' && { borderColor: '#3B82F6', backgroundColor: selectedCategory === cat ? '#3B82F6' : '#EFF6FF' },
              ]}
              onPress={() => setSelectedCategory(cat)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.categoryPillText,
                  selectedCategory === cat && styles.categoryPillTextActive,
                  cat === 'Whiskdom Özel' && selectedCategory !== cat && { color: '#7E22CE', fontWeight: '800' },
                  cat === 'Sizin Tarifleriniz' && selectedCategory !== cat && { color: '#059669', fontWeight: '800' },
                  cat === 'Topluluk Tarifleri' && selectedCategory !== cat && { color: '#2563EB', fontWeight: '800' },
                ]}
              >
                {cat === 'Whiskdom Özel' ? '✨ Whiskdom Özel' : cat === 'Sizin Tarifleriniz' ? '💚 Sizin Tarifleriniz' : cat === 'Topluluk Tarifleri' ? '👥 Topluluk Tarifleri' : cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* ✨ AI ŞEF İLE ÖZEL TARİF ÜRET BUTONU */}
      <TouchableOpacity 
        style={styles.aiButton} 
        onPress={handleOpenAiModal}
        disabled={aiLoading}
        activeOpacity={0.85}
      >
        {aiLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.aiButtonText}>✨ AI Şef ile Özel Tarif Üret</Text>
        )}
      </TouchableOpacity>

      <View style={styles.filterRow}>
        <TouchableOpacity 
          style={styles.mainFilterBtn} 
          onPress={() => setPrefModalVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.mainFilterBtnText}>
            🌱 Diyet & Alerjen ({userPreferences.diets.length + userPreferences.allergens.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.mainFilterBtn} 
          onPress={() => setFilterModalVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.mainFilterBtnText}>
            ⚙️ Filtreler
          </Text>
        </TouchableOpacity>
      </View>

      {((expiryThreshold > 0 && activeRangeItems.length > 0) || (expiryThreshold === 0 && criticalUrgentItems.length > 0)) && (
        <View style={styles.sktWarningBanner}>
          <Text style={styles.sktWarningTitle}>
            🔥 {expiryThreshold > 0 ? `${expiryThreshold} Gün İçinde` : '0-3 Gün İçinde'} Tüketilmesi Gereken Ürünler:
          </Text>
          <Text style={styles.sktWarningItems}>
            {(expiryThreshold > 0 ? activeRangeItems : criticalUrgentItems).map(i => i.name).join(', ')}
          </Text>
        </View>
      )}

      {aiRecipe && (
        <View style={styles.aiCardContainer}>
          <View style={styles.aiCardHeader}>
            <Text style={styles.aiBadgeText}>✨ AI ÖNERİSİ</Text>
            {aiRecipe.cookingTime ? <Text style={styles.timeBadge}>⏱️ {aiRecipe.cookingTime}</Text> : null}
          </View>

          <Text style={styles.aiNoteText}>
            Dolabındaki malzemeler ve kişisel tercihlerine özel hazırlanan tarif:
          </Text>

          <Text style={styles.recipeTitle}>{aiRecipe.title}</Text>
          <Text style={styles.ingredientText}>
            Kullanılacak Malzeme: <Text style={{ fontWeight: '800', color: '#1A1A1A' }}>{aiRecipe.mainIngredient}</Text>
          </Text>

          <View style={styles.missingBox}>
            <Text style={styles.missingTitle}>Eksik Malzemeler:</Text>
            <Text style={styles.missingText}>
              {aiRecipe.missingIngredients.length === 0 
                ? '✅ Tüm malzemeler dolabında mevcut!' 
                : aiRecipe.missingIngredients.join(', ')}
            </Text>
          </View>

          <View style={styles.aiCardActions}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#1A1A1A' }]} onPress={handleSaveAIRecipe} activeOpacity={0.8}>
              <Text style={styles.buttonText}>📌 Listeye Ekle</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#4A5568' }]} onPress={handleOpenAiModal} activeOpacity={0.8}>
              <Text style={styles.buttonText}>🔄 Yeni Öner</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {filteredRecipes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🍳</Text>
          <Text style={styles.emptyTitle}>Tarif Bulunamadı</Text>
          <Text style={styles.emptySubtitle}>Arama teriminize, malzemelerinize veya filtrelerinize uygun tarif bulunamadı.</Text>
        </View>
      ) : (
        <>
          {displayedRecipes.map((item) => {
            const dynamicMissing = getDynamicMissingIngredients(item.ingredients);
            const isUrgent = (expiryThreshold !== 0 && activeRangeItems.some(i => i.name.toLowerCase() === item.mainIngredient.toLowerCase())) || 
                           (expiryThreshold === 0 && criticalUrgentItems.some(i => i.name.toLowerCase() === item.mainIngredient.toLowerCase()));
            const isFav = favorites.includes(item.id);
            const isCooked = history.includes(item.id);

            return (
              <TouchableOpacity 
                key={item.id} 
                activeOpacity={0.85}
                style={[styles.recipeCard, isUrgent && styles.urgentCard]}
                onPress={() => {
                  setSelectedRecipe(item);
                  setPortionCount(4);
                }}
              >
                <View style={styles.cardHeaderRow}>
                  <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
                    {item.isUserCreated && !item.isAI && (
                      <View style={{ backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#A7F3D0' }}>
                        <Text style={{ color: '#047857', fontWeight: '800', fontSize: 10 }}>💚 Sizin Tarifiniz</Text>
                      </View>
                    )}
                    {(item as any).is_approved && (
                      <TouchableOpacity 
                        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#BFDBFE' }}
                        onPress={() => handleOpenUserProfile(item)}
                        activeOpacity={0.8}
                      >
                        <Text style={{ fontSize: 9, marginRight: 2 }}>👥</Text>
                        <Text style={{ color: '#1D4ED8', fontWeight: '800', fontSize: 10 }}>Topluluk Üyesi Üretti</Text>
                      </TouchableOpacity>
                    )}
                    {item.isAI && (
                      <Text style={{ color: '#7E22CE', fontWeight: '800', fontSize: 11 }}>✨ ÖZEL AI TARİFİ</Text>
                    )}
                  </View>

                  {/* 🤍 FAVORİ BUTONU */}
                  <View>
                    <TouchableOpacity onPress={() => toggleFavorite(item.id)} style={styles.starBtn} activeOpacity={0.7}>
                      <Text style={{ fontSize: 18 }}>{isFav ? '❤️' : '🤍'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {isUrgent && <Text style={styles.urgentBadge}>🔥 SKT ÖNCELİKLİ ÜRÜN</Text>}
                
                <Text style={styles.recipeTitle}>{item.title}</Text>
                <Text style={styles.ingredientText}>
                  Ana Malzeme: <Text style={{ fontWeight: '700', color: '#1A1A1A' }}>{item.mainIngredient}</Text>
                </Text>
                
                <View style={[styles.missingBox, dynamicMissing.length === 0 && { backgroundColor: '#F4FBF7', borderColor: '#D1E7DD' }]}>
                  <Text style={[styles.missingTitle, dynamicMissing.length === 0 && { color: '#0F5132' }]}>
                    {dynamicMissing.length === 0 ? '✅ Tam Malzemeli Tarif' : `Eksik Malzemeler (${dynamicMissing.length}):`}
                  </Text>
                  <Text style={[styles.missingText, dynamicMissing.length === 0 && { color: '#198754' }]}>
                    {dynamicMissing.length === 0 ? 'Dolabında hepsi mevcut!' : dynamicMissing.join(', ')}
                  </Text>
                </View>

                <View style={styles.cardActionGroup}>
                  {dynamicMissing.length > 0 && (
                    <TouchableOpacity 
                      style={[styles.cartButton, { backgroundColor: '#4A5568' }]}
                      onPress={() => handleAddMissingToCart(dynamicMissing)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.buttonText}>🛒 Sepete Ekle</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity 
                    style={[
                      styles.cartButton, 
                      { backgroundColor: isCooked ? '#9B1C1C' : '#1A1A1A', flex: 1 }
                    ]}
                    onPress={() => handleToggleCook(item.id, item.title)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.buttonText}>
                      {isCooked ? '✕ Yapıldı (İptal Et)' : '🍳 Pişirdim'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}

          {/* 📄 SAYFALAMA KONTROL PANELİ */}
          <View style={styles.paginationContainer}>
            <View style={styles.perPageSelectorRow}>
              <Text style={styles.paginationLabel}>Sayfa Başına:</Text>
              {[10, 20, 50].map((num) => (
                <TouchableOpacity
                  key={num}
                  style={[styles.perPageBtn, recipesPerPage === num && styles.perPageBtnActive]}
                  onPress={() => setRecipesPerPage(num)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.perPageBtnText, recipesPerPage === num && styles.perPageBtnTextActive]}>
                    {num}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.pageNavRow}>
              <TouchableOpacity
                style={[styles.pageNavBtn, currentPage === 1 && { opacity: 0.4 }]}
                disabled={currentPage === 1}
                onPress={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                activeOpacity={0.8}
              >
                <Text style={styles.pageNavBtnText}>◀ Önceki</Text>
              </TouchableOpacity>

              <View style={{ alignItems: 'center' }}>
                <Text style={styles.pageIndicatorText}>
                  Sayfa {currentPage} / {totalPages}
                </Text>
                <Text style={styles.totalCountText}>
                  Toplam {filteredRecipes.length} tarif
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.pageNavBtn, currentPage === totalPages && { opacity: 0.4 }]}
                disabled={currentPage === totalPages}
                onPress={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                activeOpacity={0.8}
              >
                <Text style={styles.pageNavBtnText}>Sonraki ▶</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      {/* 🪟 AI ŞEF KATEGORİ SEÇİM MODALI */}
      <Modal
        visible={aiCategoryModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setAiCategoryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>👨‍🍳 AI Şef İçin Tarz / Kategori Seç</Text>
            
            {/* 🏷️ Kalan Hak Göstergesi */}
            <View style={{ backgroundColor: '#F3E8FF', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, alignSelf: 'center', marginVertical: 6 }}>
              <Text style={{ fontSize: 12, color: '#7E22CE', fontWeight: '700' }}>
                ✨ Günlük Kalan Hak: {remainingQuota !== null ? `${remainingQuota} / 3` : 'Yükleniyor...'}
              </Text>
            </View>

            <Text style={{ fontSize: 11, color: '#6C757D', textAlign: 'center', marginBottom: 10 }}>
              Hangi tarzda bir tarif üretmek istiyorsun?
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%', marginVertical: 4 }}>
              {AI_TARGET_CATEGORIES.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.modalOptionBtn,
                    { marginVertical: 3 },
                    selectedAiCategory === category && styles.activeModalOptionBtn,
                    category.includes('AI Sürprizi') && { borderColor: '#7E22CE', backgroundColor: selectedAiCategory === category ? '#7E22CE' : '#F3E8FF' }
                  ]}
                  onPress={() => setSelectedAiCategory(category)}
                  activeOpacity={0.8}
                >
                  <Text style={[
                    styles.modalOptionText,
                    selectedAiCategory === category && styles.activeModalOptionText,
                    category.includes('AI Sürprizi') && selectedAiCategory !== category && { color: '#7E22CE', fontWeight: '800' }
                  ]}>
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              <TouchableOpacity 
                style={[styles.modalActionBtn, { backgroundColor: '#6C757D', flex: 1 }]}
                onPress={() => setAiCategoryModalVisible(false)}
              >
                <Text style={styles.modalActionBtnText}>İptal</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.modalActionBtn, { backgroundColor: '#7E22CE', flex: 2 }]}
                disabled={aiLoading}
                onPress={() => {
                  setAiCategoryModalVisible(false);
                  handleGenerateAIRecipe(selectedAiCategory);
                }}
              >
                {aiLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalActionBtnText}>Tarif Üret ✨</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MANUEL TARİF EKLEME / DÜZENLEME MODALI */}
      <Modal visible={addRecipeModalVisible} animationType="slide" transparent={true} onRequestClose={() => setAddRecipeModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: '90%' }]}>
            <ScrollView style={{ width: '100%' }} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>{editingRecipeId ? '✏️ Tarifi Düzenle' : '👨‍🍳 Kendi Tarifini Ekle'}</Text>
              <Text style={{ fontSize: 11, color: '#6C757D', textAlign: 'center', marginBottom: 12 }}>
                Yazdığın malzemeler ve adımlar AI Şef tarafından otomatik düzeltilip formatlanacaktır.
              </Text>

              <Text style={styles.inputLabel}>Tarif Adı:</Text>
              <TextInput style={styles.formInput} placeholder="Örn: Annemin Özel Köftesi" value={newTitle} onChangeText={setNewTitle} />

              <Text style={styles.inputLabel}>Kategori Seçin:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {RECIPE_FORM_CATEGORIES.map((cat) => {
                    const isSelected = newCategory === cat;
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[
                          styles.modalCategoryPill,
                          isSelected && styles.modalCategoryPillActive
                        ]}
                        onPress={() => setNewCategory(cat)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.modalCategoryPillText, isSelected && styles.modalCategoryPillTextActive]}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              <Text style={styles.inputLabel}>Diyet Uyumluluğu (İsteğe Bağlı - Birden Fazla Seçilebilir):</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {AVAILABLE_DIETS.map((diet) => {
                  const isSelected = newFormDiets.includes(diet);
                  return (
                    <TouchableOpacity
                      key={diet}
                      style={[
                        styles.modalMultiSelectPill,
                        isSelected && styles.modalMultiSelectPillActive
                      ]}
                      onPress={() => handleToggleFormDiet(diet)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.modalMultiSelectText, isSelected && styles.modalMultiSelectTextActive]}>
                        {isSelected ? '✓ ' : ''}{diet}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>Alerjen / İçermeyen Kısıtlar (İsteğe Bağlı - Birden Fazla Seçilebilir):</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {AVAILABLE_ALLERGENS.map((allergen) => {
                  const isSelected = newFormAllergens.includes(allergen);
                  return (
                    <TouchableOpacity
                      key={allergen}
                      style={[
                        styles.modalMultiSelectPill,
                        isSelected && { backgroundColor: '#9B1C1C', borderColor: '#9B1C1C' }
                      ]}
                      onPress={() => handleToggleFormAllergen(allergen)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.modalMultiSelectText, isSelected && styles.modalMultiSelectTextActive]}>
                        {isSelected ? '✓ ' : ''}{allergen}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>Pişirme Süresi:</Text>
              <TextInput style={styles.formInput} placeholder="Örn: 25 Dk" value={newTime} onChangeText={setNewTime} />

              <Text style={styles.inputLabel}>Gerekli Malzemeler (Her satıra bir malzeme):</Text>
              <TextInput 
                style={[styles.formInput, { height: 90, textAlignVertical: 'top' }]} 
                multiline 
                placeholder="Örn:&#10;500g kıyma&#10;1 soğan&#10;1 yumurta" 
                value={newRawIngredients} 
                onChangeText={setNewRawIngredients} 
              />

              <Text style={styles.inputLabel}>Hazırlanışı ve Adımlar:</Text>
              <TextInput 
                style={[styles.formInput, { height: 110, textAlignVertical: 'top' }]} 
                multiline 
                placeholder="Örn:&#10;Soğanı rendeleyip kıymaya ekleyin. Yoğurup şekil verin ve kızartın." 
                value={newRawInstructions} 
                onChangeText={setNewRawInstructions} 
              />

              <TouchableOpacity 
                style={styles.libraryToggleBox}
                onPress={() => setIsSubmittedToLibrary(!isSubmittedToLibrary)}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 16 }}>{isSubmittedToLibrary ? '✅' : '⬜'}</Text>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#1A1A1A' }}>Whiskdom Kütüphanesine Öner</Text>
                  <Text style={{ fontSize: 10, color: '#6C757D' }}>Onaylanırsa genel kütüphaneye eklenir ve XP kazanırsınız!</Text>
                </View>
              </TouchableOpacity>
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              <TouchableOpacity 
                style={[styles.modalActionBtn, { backgroundColor: '#6C757D', flex: 1 }]}
                onPress={() => setAddRecipeModalVisible(false)}
                disabled={isFormattingAI}
              >
                <Text style={styles.modalActionBtnText}>İptal</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.modalActionBtn, { backgroundColor: '#10B981', flex: 2 }]}
                onPress={handleCreateOrUpdateUserRecipe}
                disabled={isFormattingAI}
              >
                {isFormattingAI ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.modalActionBtnText}>✨ {editingRecipeId ? 'Güncelle' : 'AI ile Düzenle & Kaydet'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* HAFTALIK PLANA EKLEME MODALI */}
      <Modal visible={mealPlanModalVisible} animationType="fade" transparent={true} onRequestClose={() => setMealPlanModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>📅 Haftalık Plana Ekle</Text>
            <Text style={{ fontSize: 11, color: '#6C757D', textAlign: 'center', marginBottom: 12 }}>
              "{recipeToPlan?.title}" tarifini hangi gün ve öğüne eklemek istersin?
            </Text>

            <Text style={styles.filterSectionTitle}>Gün Seçin:</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'].map((day) => (
                <TouchableOpacity
                  key={day}
                  style={[styles.modalOptionBtn, { width: '30%' }, selectedDay === day && styles.activeModalOptionBtn]}
                  onPress={() => setSelectedDay(day)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.modalOptionText, selectedDay === day && styles.activeModalOptionText]}>{day}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterSectionTitle}>Öğün Seçin:</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[
                { label: '🌅 Kahvaltı', value: 'breakfast' },
                { label: '☀️ Öğle', value: 'lunch' },
                { label: '🌙 Akşam', value: 'dinner' }
              ].map((meal) => (
                <TouchableOpacity
                  key={meal.value}
                  style={[styles.modalOptionBtn, { flex: 1 }, selectedMealType === meal.value && styles.activeModalOptionBtn]}
                  onPress={() => setSelectedMealType(meal.value as any)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.modalOptionText, selectedMealType === meal.value && styles.activeModalOptionText]}>{meal.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 20 }}>
              <TouchableOpacity 
                style={[styles.modalActionBtn, { backgroundColor: '#6C757D', flex: 1 }]}
                onPress={() => setMealPlanModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalActionBtnText}>İptal</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.modalActionBtn, { backgroundColor: '#1A1A1A', flex: 2 }]}
                onPress={async () => {
                  if (recipeToPlan) {
                    await assignRecipeToMealPlan(selectedDay, selectedMealType, recipeToPlan.id, recipeToPlan.title);
                    setMealPlanModalVisible(false);
                    Alert.alert("Başarılı!", `Tarif ${selectedDay} günü planına eklendi.`);
                  }
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.modalActionBtnText}>Plana Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={profileModalVisible} animationType="fade" transparent={true} onRequestClose={() => setProfileModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { alignItems: 'center', paddingVertical: 24 }]}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 28 }}>👨‍🍳</Text>
            </View>
            <Text style={{ fontSize: 18, fontWeight: '900', color: '#1A1A1A' }}>{selectedUserProfile?.name}</Text>
            <Text style={{ fontSize: 12, color: '#2563EB', fontWeight: '800', marginTop: 2, marginBottom: 16 }}>{selectedUserProfile?.badge}</Text>

            <View style={{ flexDirection: 'row', width: '100%', gap: 10, marginBottom: 20 }}>
              <View style={{ flex: 1, backgroundColor: '#F8F9FA', padding: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#E9ECEF' }}>
                <Text style={{ fontSize: 16, fontWeight: '900', color: '#1A1A1A' }}>{selectedUserProfile?.recipeCount}</Text>
                <Text style={{ fontSize: 10, color: '#6C757D', fontWeight: '700', marginTop: 2 }}>Tarif</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: '#F8F9FA', padding: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#E9ECEF' }}>
                <Text style={{ fontSize: 16, fontWeight: '900', color: '#7E22CE' }}>{selectedUserProfile?.xp} XP</Text>
                <Text style={{ fontSize: 10, color: '#6C757D', fontWeight: '700', marginTop: 2 }}>Şef Puanı</Text>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.modalActionBtn, { backgroundColor: '#1A1A1A' }]}
              onPress={() => setProfileModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalActionBtnText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={prefModalVisible} animationType="fade" transparent={true} onRequestClose={() => setPrefModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>🌱 Diyet & Alerjen Tercihleri</Text>
            
            <Text style={styles.filterSectionTitle}>🥗 Diyet Tipi:</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {AVAILABLE_DIETS.map((diet) => {
                const active = userPreferences.diets.includes(diet);
                return (
                  <TouchableOpacity 
                    key={diet}
                    style={[styles.modalOptionBtn, active && styles.activeModalOptionBtn]}
                    onPress={() => handleToggleDiet(diet)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.modalOptionText, active && styles.activeModalOptionText]}>{diet}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.filterSectionTitle}>🚨 Alerjen & Hassasiyetler:</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {AVAILABLE_ALLERGENS.map((allergen) => {
                const active = userPreferences.allergens.includes(allergen);
                return (
                  <TouchableOpacity 
                    key={allergen}
                    style={[styles.modalOptionBtn, active && { backgroundColor: '#9B1C1C', borderColor: '#9B1C1C' }]}
                    onPress={() => handleToggleAllergen(allergen)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.modalOptionText, active && styles.activeModalOptionText]}>{allergen}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity 
              style={[styles.modalActionBtn, { backgroundColor: '#1A1A1A', marginTop: 20 }]}
              onPress={() => setPrefModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalActionBtnText}>Kaydet ve Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={filterModalVisible} animationType="fade" transparent={true} onRequestClose={() => setFilterModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>⚙️ Tarif Görünüm Filtreleri</Text>

            <Text style={styles.filterSectionTitle}>⭐ Özel Koleksiyonlar:</Text>
            <View style={styles.filterOptionsGroup}>
              {[
                { label: 'Tüm Tarif Koleksiyonu', value: 'all' },
                { label: '❤️ Favori Tariflerim', value: 'favorites' },
                { label: '📜 Son Yapılan Tarifler', value: 'history' }
              ].map((opt) => (
                <TouchableOpacity 
                  key={opt.value}
                  style={[styles.modalOptionBtn, collectionFilter === opt.value && styles.activeModalOptionBtn]}
                  onPress={() => setCollectionFilter(opt.value as any)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.modalOptionText, collectionFilter === opt.value && styles.activeModalOptionText]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterSectionTitle}>🛒 Malzeme Durumuna Göre:</Text>
            <View style={styles.filterOptionsGroup}>
              {[
                { label: 'Tümünü Göster', value: 'all' },
                { label: '✅ Sadece Tam Malzemeli (Hazır)', value: 'complete' },
                { label: '🛒 Eksik Malzemeli (Market Gerekli)', value: 'missing' }
              ].map((opt) => (
                <TouchableOpacity 
                  key={opt.value}
                  style={[styles.modalOptionBtn, ingredientFilter === opt.value && styles.activeModalOptionBtn]}
                  onPress={() => setIngredientFilter(opt.value as any)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.modalOptionText, ingredientFilter === opt.value && styles.activeModalOptionText]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterSectionTitle}>🔥 SKT Kritik Eşiği:</Text>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {[
                { label: 'Kapalı', value: 0 },
                { label: '0-3 Gün', value: 3 },
                { label: '4-7 Gün', value: 7 },
                { label: '8-14 Gün', value: 14 }
              ].map((item) => (
                <TouchableOpacity
                  key={item.value}
                  style={[styles.modalOptionBtn, { width: '48%' }, expiryThreshold === item.value && styles.activeModalOptionBtn]}
                  onPress={() => setExpiryThreshold(item.value)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.modalOptionText, expiryThreshold === item.value && styles.activeModalOptionText]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity 
              style={[styles.modalActionBtn, { backgroundColor: '#1A1A1A', marginTop: 15 }]}
              onPress={() => setFilterModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalActionBtnText}>Uygula ve Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={!!selectedRecipe} animationType="slide" transparent={true} onRequestClose={() => setSelectedRecipe(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: '85%' }]}>
            <ScrollView style={{ width: '100%' }} showsVerticalScrollIndicator={false}>
              <Text style={styles.detailTitle}>{selectedRecipe?.title}</Text>
              
              {selectedRecipe?.cookingTime && (
                <Text style={styles.detailTime}>⏱️ Hazırlama / Pişirme Süresi: {selectedRecipe.cookingTime}</Text>
              )}

              {(selectedRecipe as any)?.is_approved && (
                <TouchableOpacity 
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#BFDBFE', marginVertical: 8, justifyContent: 'center' }}
                  onPress={() => {
                    const currentRecipe = selectedRecipe;
                    setSelectedRecipe(null);
                    if (currentRecipe) {
                      handleOpenUserProfile(currentRecipe);
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 14, marginRight: 6 }}>👥</Text>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#1D4ED8' }}>Tarifi Yapan Topluluk Üyesinin Profili</Text>
                </TouchableOpacity>
              )}

              <View style={styles.portionBox}>
                <Text style={styles.portionTitle}>👥 Kişi Sayısı / Porsiyon:</Text>
                <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center', marginTop: 8 }}>
                  {[1, 2, 4, 6].map((p) => (
                    <TouchableOpacity 
                      key={p}
                      style={[styles.portionBtn, portionCount === p && styles.portionBtnActive]}
                      onPress={() => setPortionCount(p)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.portionBtnText, portionCount === p && { color: '#fff' }]}>
                        {p} Kişilik
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {!selectedRecipe?.isUserCreated && (
                <TouchableOpacity 
                  style={styles.youtubeButton}
                  onPress={() => selectedRecipe && handleOpenYouTubeVideo(selectedRecipe.title)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.youtubeButtonText}>▶️ YouTube'da Yapılışını İzle</Text>
                </TouchableOpacity>
              )}

              <Text style={styles.detailSubTitle}>📏 Gerekli Malzemeler ({portionCount} Kişilik):</Text>
              {selectedRecipe?.ingredientsWithQuantities ? (
                selectedRecipe.ingredientsWithQuantities.map((item, idx) => (
                  <Text key={idx} style={styles.detailText}>
                    • {calculateIngredientPortion(item, portionCount)}
                  </Text>
                ))
              ) : (
                <Text style={styles.detailText}>• {selectedRecipe?.mainIngredient}</Text>
              )}

              <Text style={styles.detailSubTitle}>👨‍🍳 Hazırlanışı & Adımları:</Text>
              {selectedRecipe?.instructions ? (
                selectedRecipe.instructions.map((step, idx) => (
                  <Text key={idx} style={styles.stepText}>{step.startsWith(`${idx + 1}.`) ? step : `${idx + 1}. ${step}`}</Text>
                ))
              ) : (
                <Text style={styles.stepText}>1. Malzemeleri hazırlayıp pişirmeye başlayın.</Text>
              )}

              {selectedRecipe?.isUserCreated && (
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 20 }}>
                  <TouchableOpacity 
                    style={[styles.modalActionBtn, { backgroundColor: '#3B82F6', flex: 1, paddingVertical: 10 }]}
                    onPress={() => selectedRecipe && handleOpenEditModal(selectedRecipe)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.modalActionBtnText, { fontSize: 11 }]}>✏️ Düzenle</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.modalActionBtn, { backgroundColor: '#7C3AED', flex: 1, paddingVertical: 10 }]}
                    onPress={() => selectedRecipe && handleOpenDuplicateModal(selectedRecipe)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.modalActionBtnText, { fontSize: 11 }]}>📋 Kopyala</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.modalActionBtn, { backgroundColor: '#EF4444', flex: 1, paddingVertical: 10 }]}
                    onPress={() => selectedRecipe && handleDeleteRecipe(selectedRecipe.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.modalActionBtnText, { fontSize: 11 }]}>🗑️ Sil</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity 
              style={[styles.modalActionBtn, { backgroundColor: '#1A1A1A', marginTop: 15 }]}
              onPress={() => setSelectedRecipe(null)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalActionBtnText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  totalCountText: { fontSize: 10, color: '#6C757D', fontWeight: '600', marginTop: 2 },
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  scrollContent: { paddingTop: 54, paddingHorizontal: 18, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '900', color: '#1A1A1A', letterSpacing: -0.5 },
  subtitle: { fontSize: 12, color: '#6C757D', marginTop: 2, fontWeight: '600', marginBottom: 12 },
  
  // 📅 WİDGET STİLLERİ EKLENDİ
  widgetContainer: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#E9ECEF', elevation: 1 },
  widgetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  widgetTitle: { fontSize: 13, fontWeight: '900', color: '#1A1A1A' },
  widgetSubtitle: { fontSize: 10, color: '#6C757D', fontWeight: '700' },
  widgetDayCard: { width: 110, backgroundColor: '#F8F9FA', borderRadius: 10, padding: 8, borderWidth: 1, borderColor: '#E9ECEF' },
  widgetDayName: { fontSize: 11, fontWeight: '800', color: '#1A1A1A', textAlign: 'center', marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#E9ECEF', paddingBottom: 4 },
  widgetMealRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, height: 20 },
  widgetMealLabel: { fontSize: 10 },
  widgetEmptyText: { fontSize: 9, color: '#9CA3AF', fontStyle: 'italic', flex: 1, textAlign: 'right' },
  widgetMealFilled: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', backgroundColor: '#E2E8F0', borderRadius: 4, paddingHorizontal: 4, marginLeft: 4 },
  widgetMealText: { fontSize: 9, fontWeight: '700', color: '#1A1A1A', flex: 1, marginRight: 2 },
  widgetDeleteText: { fontSize: 9, color: '#9B1C1C', fontWeight: '900' },

  addRecipeBtnHeader: { backgroundColor: '#10B981', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  addRecipeBtnHeaderText: { color: '#FFFFFF', fontWeight: '800', fontSize: 11 },

  searchBarContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E9ECEF', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12 },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 13, color: '#1A1A1A', padding: 0 },

  categoryPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: '#E9ECEF', borderWidth: 1, borderColor: '#E9ECEF' },
  categoryPillActive: { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  categoryPillText: { fontSize: 11, fontWeight: '700', color: '#495057' },
  categoryPillTextActive: { color: '#FFFFFF' },

  modalCategoryPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F1F3F5', borderWidth: 1, borderColor: '#E9ECEF' },
  modalCategoryPillActive: { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  modalCategoryPillText: { fontSize: 11, fontWeight: '700', color: '#495057' },
  modalCategoryPillTextActive: { color: '#FFFFFF' },

  modalMultiSelectPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F8F9FA', borderWidth: 1, borderColor: '#E9ECEF' },
  modalMultiSelectPillActive: { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  modalMultiSelectText: { fontSize: 11, fontWeight: '600', color: '#495057' },
  modalMultiSelectTextActive: { color: '#FFFFFF', fontWeight: '800' },

  aiButton: { backgroundColor: '#1A1A1A', paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginBottom: 10, elevation: 1 },
  aiButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  mainFilterBtn: { flex: 1, backgroundColor: '#FFFFFF', paddingVertical: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E9ECEF' },
  mainFilterBtnText: { color: '#1A1A1A', fontWeight: '700', fontSize: 12 },

  sktWarningBanner: { backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#F59E0B', borderRadius: 12, padding: 12, marginBottom: 14 },
  sktWarningTitle: { fontSize: 12, fontWeight: '800', color: '#B45309', marginBottom: 2 },
  sktWarningItems: { fontSize: 12, fontWeight: '600', color: '#92400E' },

  aiCardContainer: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E9ECEF', elevation: 1 },
  aiCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  aiBadgeText: { color: '#7E22CE', fontWeight: '800', fontSize: 12 },
  timeBadge: { backgroundColor: '#F3E8FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, fontSize: 11, color: '#6B21A8', fontWeight: '700' },
  aiNoteText: { fontSize: 12, color: '#6C757D', marginBottom: 10, fontWeight: '500' },
  aiCardActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },

  recipeCard: { backgroundColor: '#FFFFFF', padding: 14, borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E9ECEF', elevation: 1 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  starBtn: { padding: 2 },
  urgentCard: { borderWidth: 1.5, borderColor: '#D97706' },
  urgentBadge: { color: '#D97706', fontWeight: '800', fontSize: 11, marginBottom: 4 },
  recipeTitle: { fontSize: 16, fontWeight: '800', color: '#1A1A1A' },
  ingredientText: { fontSize: 12, color: '#495057', marginVertical: 4 },
  missingBox: { backgroundColor: '#F8F9FA', padding: 10, borderRadius: 10, marginVertical: 8, borderWidth: 1, borderColor: '#E9ECEF' },
  missingTitle: { fontSize: 11, fontWeight: '800', color: '#D97706' },
  missingText: { fontSize: 12, color: '#D97706', fontWeight: '600', marginTop: 1 },
  cardActionGroup: { flexDirection: 'row', gap: 8, marginTop: 4 },
  cartButton: { backgroundColor: '#1A1A1A', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },

  // 📄 SAYFALAMA (PAGINATION) STİLLERİ
  paginationContainer: { backgroundColor: '#FFFFFF', padding: 14, borderRadius: 14, marginTop: 6, marginBottom: 14, borderWidth: 1, borderColor: '#E9ECEF', alignItems: 'center' },
  perPageSelectorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' },
  paginationLabel: { fontSize: 12, fontWeight: '700', color: '#495057', marginRight: 4 },
  perPageBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: '#F1F3F5', borderWidth: 1, borderColor: '#E9ECEF' },
  perPageBtnActive: { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  perPageBtnText: { fontSize: 11, fontWeight: '700', color: '#495057' },
  perPageBtnTextActive: { color: '#FFFFFF' },
  pageNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: 6, borderTopWidth: 1, borderTopColor: '#F1F3F5', paddingTop: 10 },
  pageNavBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#E9ECEF' },
  pageNavBtnText: { fontSize: 11, fontWeight: '700', color: '#1A1A1A' },
  pageIndicatorText: { fontSize: 12, fontWeight: '800', color: '#495057' },

  inputLabel: { fontSize: 12, fontWeight: '700', color: '#1A1A1A', marginTop: 10, marginBottom: 4 },
  formInput: { backgroundColor: '#F8F9FA', borderWidth: 1, borderColor: '#E9ECEF', borderRadius: 10, padding: 10, fontSize: 12, color: '#1A1A1A' },
  libraryToggleBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0', padding: 10, borderRadius: 10, marginTop: 14 },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  emptyIcon: { fontSize: 44, marginBottom: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#1A1A1A', marginBottom: 4 },
  emptySubtitle: { fontSize: 12, color: '#6C757D', textAlign: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  modalContainer: { width: '100%', backgroundColor: '#FFFFFF', padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#E9ECEF', elevation: 5 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#1A1A1A', textAlign: 'center', marginBottom: 4 },
  filterSectionTitle: { fontSize: 12, fontWeight: '800', color: '#495057', marginTop: 12, marginBottom: 6 },
  filterOptionsGroup: { gap: 6, width: '100%' },
  modalOptionBtn: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#F8F9FA', borderWidth: 1, borderColor: '#E9ECEF' },
  activeModalOptionBtn: { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  modalOptionText: { fontSize: 12, color: '#495057', fontWeight: '600', textAlign: 'center' },
  activeModalOptionText: { color: '#FFFFFF', fontWeight: '700' },
  
  modalActionBtn: { width: '100%', paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  modalActionBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

  detailTitle: { fontSize: 18, fontWeight: '900', color: '#1A1A1A', textAlign: 'center', marginBottom: 4 },
  detailTime: { fontSize: 12, color: '#D97706', fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  
  portionBox: { backgroundColor: '#F8F9FA', padding: 10, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: '#E9ECEF' },
  portionTitle: { fontSize: 11, fontWeight: '800', color: '#495057', textAlign: 'center' },
  portionBtn: { flex: 1, backgroundColor: '#FFFFFF', paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#E9ECEF', alignItems: 'center' },
  portionBtnActive: { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  portionBtnText: { fontSize: 11, fontWeight: '700', color: '#495057' },

  youtubeButton: { backgroundColor: '#EF4444', paddingVertical: 10, borderRadius: 10, alignItems: 'center', marginBottom: 14 },
  youtubeButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },

  detailSubTitle: { fontSize: 13, fontWeight: '800', color: '#1A1A1A', marginTop: 12, marginBottom: 6 },
  detailText: { fontSize: 13, color: '#495057', marginBottom: 4, fontWeight: '500' },
  stepText: { fontSize: 13, color: '#333333', marginBottom: 8, backgroundColor: '#F8F9FA', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E9ECEF', lineHeight: 18 }
});