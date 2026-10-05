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
import { checkQuota } from '../services/quotaService';
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

type IngredientItem = string | { name?: string; amount?: number; unit?: string };

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
    expiryThreshold, 
    setExpiryThreshold,
    fetchRecipesFromSupabase,
    addRecipeToSupabase,
    deleteRecipe
  } = useContext(AppContext);

  const activeRangeItems = getExpiringItemsByRange(expiryThreshold);
  const criticalUrgentItems = getExpiringItemsByRange(3); 

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRecipe, setAiRecipe] = useState<AIRecipeResult | null>(null);

  const [aiCategoryModalVisible, setAiCategoryModalVisible] = useState(false);
  const [selectedAiCategory, setSelectedAiCategory] = useState<string>('Ana Yemek');
  const [aiIngredientMode, setAiIngredientMode] = useState<'complete' | 'missing' | 'free'>('free');
  const [remainingQuota, setRemainingQuota] = useState<number | null>(null);

  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [prefModalVisible, setPrefModalVisible] = useState(false);
  const [addRecipeModalVisible, setAddRecipeModalVisible] = useState(false);

  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [selectedUserProfile, setSelectedUserProfile] = useState<UserProfileData | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>('Tümü');
  const [collectionFilter, setCollectionFilter] = useState<'all' | 'favorites' | 'history'>('all');
  const [ingredientFilter, setIngredientFilter] = useState<'all' | 'complete' | 'missing'>('all');

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [recipesPerPage, setRecipesPerPage] = useState<number>(10);

  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [portionCount, setPortionCount] = useState<number>(4);

  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Ana Yemek');
  const [newTime, setNewTime] = useState('25 Dk');
  const [newPortions, setNewPortions] = useState('4 Kişilik');
  const [newRawIngredients, setNewRawIngredients] = useState('');
  const [newRawInstructions, setNewRawInstructions] = useState('');
  const [newFormDiets, setNewFormDiets] = useState<string[]>([]);
  const [newFormAllergens, setNewFormAllergens] = useState<string[]>([]);
  const [isSubmittedToLibrary, setIsSubmittedToLibrary] = useState(false);
  const [isFormattingAI, setIsFormattingAI] = useState(false);

  useEffect(() => {
    fetchRecipesFromSupabase();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, collectionFilter, ingredientFilter, recipesPerPage]);

  const handleOpenAiModal = async () => {
    try {
      const quotaStatus = await checkQuota('aiRecipe');
      setRemainingQuota(quotaStatus.remaining);
    } catch {
      // Sessizce geçilir
    }
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

  const handleGenerateAIRecipe = async (targetCategory: string, ingredientMode: 'complete' | 'missing' | 'free') => {
    try {
      const quotaStatus = await checkQuota('aiRecipe');

      if (!quotaStatus.allowed) {
        Alert.alert(
          "Günlük Hak Doldu ⏳",
          `AI Şef günlük kullanım hakkınızı tüketti.\n${quotaStatus.resetTimeText}`
        );
        return;
      }
    } catch {
      // Sessizce geçilir
    }

    const allIngredientNames = inventory.map(item => item.name);
    if (allIngredientNames.length === 0) {
      Alert.alert("Uyarı", "Dolabınız boş! Önce envantere ürün ekleyin.");
      return;
    }

    setAiLoading(true);
    
    try {
      const result = await generateRecipeWithAI(allIngredientNames, userPreferences, targetCategory, ingredientMode);
      setAiLoading(false);

      if (result) {
        setAiRecipe(result);
        const updatedStatus = await checkQuota('aiRecipe');
        setRemainingQuota(updatedStatus.remaining);
      } else {
        Alert.alert("Hata", "AI tarif oluştururken bir sorun oluştu. Lütfen tekrar deneyin.");
      }
    } catch {
      setAiLoading(false);
    }
  };

  const handleCreateOrUpdateUserRecipeWithAI = async () => {
    if (!newTitle.trim() || !newRawIngredients.trim() || !newRawInstructions.trim()) {
      Alert.alert("Eksik Bilgi", "Lütfen tarif başlığını, malzemeleri ve hazırlanış adımlarını doldurun.");
      return;
    }

    setIsFormattingAI(true);
    const aiFormatted = await formatUserRecipeWithAI({
      title: newTitle,
      category: newCategory,
      cookingTime: newTime,
      servings: newPortions,
      rawIngredients: newRawIngredients,
      rawInstructions: newRawInstructions,
    });
    setIsFormattingAI(false);

    const finalTitle = aiFormatted?.title || newTitle;
    const finalCookingTime = aiFormatted?.cookingTime || newTime;
    const finalMainIngredient = aiFormatted?.mainIngredient || 'Genel';
    const rawItems: IngredientItem[] = aiFormatted?.ingredientsWithQuantities || newRawIngredients.split('\n').map(i => i.trim()).filter(Boolean);
    
    // Nesne dizisini kesin olarak string[] dizisine dönüştürüyoruz
    const finalIngredientsWithQuantities: string[] = rawItems.map((item: IngredientItem) => 
      typeof item === 'string' ? item : `${item.amount || 1} ${item.unit || 'adet'} ${item.name || ''}`
    );

    const finalIngredients = aiFormatted?.ingredients || finalIngredientsWithQuantities;
    const finalInstructions = aiFormatted?.instructions || newRawInstructions.split('\n').map(i => i.trim()).filter(Boolean);

    await saveRecipeToDatabase({
      title: finalTitle,
      mainIngredient: finalMainIngredient,
      ingredients: finalIngredients,
      ingredientsWithQuantities: finalIngredientsWithQuantities,
      cookingTime: finalCookingTime,
      instructions: finalInstructions,
    });
  };

  const handleCreateOrUpdateUserRecipeDirect = async () => {
    if (!newTitle.trim() || !newRawIngredients.trim() || !newRawInstructions.trim()) {
      Alert.alert("Eksik Bilgi", "Lütfen tarif başlığını, malzemeleri ve hazırlanış adımlarını doldurun.");
      return;
    }

    const directIngredients = newRawIngredients.split('\n').map(i => i.trim()).filter(Boolean);
    const directInstructions = newRawInstructions.split('\n').map(i => i.trim()).filter(Boolean);

    await saveRecipeToDatabase({
      title: newTitle,
      mainIngredient: directIngredients[0] || 'Genel',
      ingredients: directIngredients,
      ingredientsWithQuantities: directIngredients,
      cookingTime: newTime,
      instructions: directInstructions,
    });
  };

  const saveRecipeToDatabase = async (data: {
    title: string;
    mainIngredient: string;
    ingredients: string[];
    ingredientsWithQuantities: string[]; // <-- Tipi kesin olarak string[] yaptık
    cookingTime: string;
    instructions: string[];
  }) => {
    const recipeData: Recipe = {
      id: editingRecipeId || Date.now().toString(),
      title: data.title,
      category: newCategory,
      mainIngredient: data.mainIngredient,
      ingredients: data.ingredients,
      ingredientsWithQuantities: data.ingredientsWithQuantities, // Artık sorunsuz atanacak
      cookingTime: data.cookingTime,
      instructions: data.instructions,
      isUserCreated: true,
      is_user_created: true,
      isAI: false,
      isSubmitted: isSubmittedToLibrary,
      is_submitted: isSubmittedToLibrary,
      diets: newFormDiets,
      allergens: newFormAllergens,
    };
    // ... devamı

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
      Alert.alert("Tebrikler! 🎉", "Tarifiniz başarıyla kaydedildi.");
    }

    setAddRecipeModalVisible(false);
    setEditingRecipeId(null);
    setNewTitle('');
    setNewRawIngredients('');
    setNewRawInstructions('');
    setNewPortions('4 Kişilik');
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
    
    const rawIngsText = recipe.ingredientsWithQuantities 
      ? recipe.ingredientsWithQuantities.map((i: IngredientItem) => typeof i === 'string' ? i : `${i.amount || 1} ${i.unit || 'adet'} ${i.name || ''}`).join('\n')
      : (recipe.ingredients || []).join('\n');

    setNewRawIngredients(rawIngsText);
    setNewRawInstructions(recipe.instructions?.join('\n') || '');
    setNewFormDiets(recipe.diets || []);
    setNewFormAllergens(recipe.allergens || []);
    setIsSubmittedToLibrary(recipe.isSubmitted || false);
    setSelectedRecipe(null);
    setAddRecipeModalVisible(true);
  };

  const handleOpenDuplicateModal = (recipe: Recipe) => {
    setEditingRecipeId(null);
    setNewTitle(`${recipe.title} (Kopya)`);
    setNewCategory(recipe.category || 'Ana Yemek');
    setNewTime(recipe.cookingTime || '25 Dk');

    const rawIngsText = recipe.ingredientsWithQuantities 
      ? recipe.ingredientsWithQuantities.map((i: IngredientItem) => typeof i === 'string' ? i : `${i.amount || 1} ${i.unit || 'adet'} ${i.name || ''}`).join('\n')
      : (recipe.ingredients || []).join('\n');

    setNewRawIngredients(rawIngsText);
    setNewRawInstructions(recipe.instructions?.join('\n') || '');
    setNewFormDiets(recipe.diets || []);
    setNewFormAllergens(recipe.allergens || []);
    setIsSubmittedToLibrary(false);
    setSelectedRecipe(null);
    setAddRecipeModalVisible(true);
  };

  const handleOpenUserProfile = async (recipe: Recipe) => {
    const targetUserId = recipe.user_id;

    const userRecipeCount = targetUserId 
      ? recipes.filter(r => r.user_id === targetUserId).length 
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
          profileXp = data.xp !== null && data.xp !== undefined ? Number(data.xp) : 0;
        }
      } catch {
        // Sessizce geçilir
      }
    } else if (recipe.creatorProfile) {
      const cp = recipe.creatorProfile;
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
      setNewFormAllergens(newFormAllergens.filter(d => d !== allergen));
    } else {
      setNewFormAllergens([...newFormAllergens, allergen]);
    }
  };

  const handleSaveAIRecipe = async () => {
    if (!aiRecipe) return;

    const rawList: IngredientItem[] = (aiRecipe.ingredientsWithQuantities && aiRecipe.ingredientsWithQuantities.length > 0) 
      ? aiRecipe.ingredientsWithQuantities 
      : [aiRecipe.mainIngredient, ...aiRecipe.missingIngredients];

    const stringQuantities = rawList.map((item: IngredientItem) => {
      if (typeof item === 'string') {
        return item;
      }
      return `${item?.amount || 1} ${item?.unit || 'adet'} ${item?.name || 'Malzeme'}`;
    });

    const newRecipe: Recipe = {
      id: Date.now().toString(),
      title: aiRecipe.title,
      category: selectedAiCategory,
      mainIngredient: aiRecipe.mainIngredient,
      ingredients: stringQuantities,
      ingredientsWithQuantities: stringQuantities,
      cookingTime: aiRecipe.cookingTime,
      instructions: aiRecipe.instructions,
      isAI: true,
      isUserCreated: false,
      is_user_created: false,
      isSubmitted: false,
      is_submitted: false
    };

    await addRecipeToSupabase(newRecipe);
    setAiRecipe(null);
    Alert.alert("Eklendi!", "AI Tarifi yalnızca sizin görebileceğiniz şekilde kaydedildi ve malzemeleri eklendi.");
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
    } catch {
      // Sessizce geçilir
    }

    if (isAlreadyCooked) {
      Alert.alert("İptal Edildi", `"${title}" tarifi yapılanlar geçmişinden çıkarıldı.`);
    } else {
      Alert.alert("Afiyet Olsun! 👨‍🍳", `"${title}" tarifi pişirildi! Malzemeler tasarruf istatistiğinize eklendi.`);
    }
  };

  const handleOpenYouTubeVideo = (recipeTitle: string) => {
    const ytQuery = encodeURIComponent(`${recipeTitle} tarifi nasıl yapılır`);
    const youtubeUrl = `https://www.youtube.com/results?search_query=${ytQuery}`;
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
        const isUserRecipe = recipe.isUserCreated || recipe.is_user_created;
        if (!isUserRecipe || recipe.isAI) return false;
      } else if (selectedCategory === 'Topluluk Tarifleri') {
        if (!recipe.is_approved) return false;
      } else if (selectedCategory === 'Whiskdom Özel') {
        if (!recipe.isAI && !recipe.isWhiskdomSpecial) return false;
      } else if (selectedCategory !== 'Tümü' && recipe.category !== selectedCategory) {
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

  const totalPages = recipesPerPage === 0 ? 1 : Math.ceil(filteredRecipes.length / recipesPerPage);
  const displayedRecipes = recipesPerPage === 0 
    ? filteredRecipes 
    : filteredRecipes.slice((currentPage - 1) * recipesPerPage, currentPage * recipesPerPage);

  const isUserRecipeModal = Boolean(selectedRecipe && (selectedRecipe.isUserCreated || selectedRecipe.is_user_created) && !selectedRecipe.isAI);
  const isAiRecipeModal = Boolean(selectedRecipe?.isAI);

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
            setNewPortions('4 Kişilik');
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
        <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 2, alignItems: 'center' }}>
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
                numberOfLines={1}
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
            Şefimiz dolabınızdaki malzemeler ve kişisel diyet/alerjen tercihlerinize özel tarifi hazırladı:
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
              <Text style={styles.buttonText}>🔄 Yeni Tarif Öner</Text>
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
                  <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap', alignItems: 'center', flex: 1, marginRight: 8 }}>
                    <View style={{ backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#E5E7EB', maxWidth: '70%' }}>
                      <Text numberOfLines={1} ellipsizeMode="tail" style={{ color: '#374151', fontWeight: '800', fontSize: 10 }}>🍲 {item.category || 'Ana Yemek'}</Text>
                    </View>

                    {item.is_approved && (
                      <TouchableOpacity 
                        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#BFDBFE' }}
                        onPress={() => handleOpenUserProfile(item)}
                        activeOpacity={0.8}
                      >
                        <Text style={{ fontSize: 9, marginRight: 2 }}>👥</Text>
                        <Text style={{ color: '#1D4ED8', fontWeight: '800', fontSize: 10 }}>Topluluk Üyesi Üretti</Text>
                      </TouchableOpacity>
                    )}

                    {Boolean(item.isUserCreated || item.is_user_created) && !item.isAI && (
                      <View style={{ backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#A7F3D0' }}>
                        <Text style={{ color: '#047857', fontWeight: '800', fontSize: 10 }}>💚 Sizin Tarifiniz</Text>
                      </View>
                    )}

                    {item.isAI && (
                      <View style={{ backgroundColor: '#F3E8FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#D8B4FE' }}>
                        <Text style={{ color: '#7E22CE', fontWeight: '800', fontSize: 10 }}>✨ AI Özel Tarif</Text>
                      </View>
                    )}
                  </View>

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

      <Modal
        visible={aiCategoryModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setAiCategoryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: '85%' }]}>
            <Text style={styles.modalTitle}>👨‍‍🍳 AI Şef Özel Tarif Oluşturucu</Text>
            
            <View style={{ backgroundColor: '#F3E8FF', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, alignSelf: 'center', marginVertical: 6 }}>
              <Text style={{ fontSize: 12, color: '#7E22CE', fontWeight: '700' }}>
                ✨ Günlük Kalan AI Hak: {remainingQuota !== null ? `${remainingQuota} / 5` : 'Yükleniyor...'}
              </Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%', marginVertical: 4 }}>
              
              <Text style={styles.filterSectionTitle}>🛒 Malzeme Modu:</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
                {[
                  { label: '✨ Serbest', value: 'free' },
                  { label: '✅ Tam Malzeme', value: 'complete' },
                  { label: '🛒 Eksik Malzeme', value: 'missing' },
                ].map((mode) => (
                  <TouchableOpacity
                    key={mode.value}
                    style={[
                      styles.modalOptionBtn,
                      { flex: 1, paddingVertical: 10 },
                      aiIngredientMode === mode.value && styles.activeModalOptionBtn,
                      mode.value === 'free' && { borderColor: '#7E22CE', backgroundColor: aiIngredientMode === mode.value ? '#7E22CE' : '#F3E8FF' }
                    ]}
                    onPress={() => setAiIngredientMode(mode.value as 'complete' | 'missing' | 'free')}
                    activeOpacity={0.8}
                  >
                    <Text style={[
                      styles.modalOptionText,
                      aiIngredientMode === mode.value && styles.activeModalOptionText,
                      mode.value === 'free' && aiIngredientMode !== mode.value && { color: '#7E22CE', fontWeight: '800' }
                    ]}>
                      {mode.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.filterSectionTitle}>🍲 Yemek Kategorisi / Tarzı:</Text>
              {AI_TARGET_CATEGORIES.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.modalOptionBtn,
                    { marginVertical: 3 },
                    selectedAiCategory === category && styles.activeModalOptionBtn,
                  ]}
                  onPress={() => setSelectedAiCategory(category)}
                  activeOpacity={0.8}
                >
                  <Text style={[
                    styles.modalOptionText,
                    selectedAiCategory === category && styles.activeModalOptionText,
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
                  handleGenerateAIRecipe(selectedAiCategory, aiIngredientMode);
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

      <Modal visible={addRecipeModalVisible} animationType="slide" transparent={true} onRequestClose={() => setAddRecipeModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: '90%' }]}>
            <ScrollView style={{ width: '100%' }} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>{editingRecipeId ? '✏️ Tarifi Düzenle' : '👨‍🍳 Kendi Tarifini Ekle'}</Text>
              <Text style={{ fontSize: 11, color: '#6C757D', textAlign: 'center', marginBottom: 12 }}>
                İster AI yardımıyla düzenle, ister direkt kendi yazdığın gibi kaydet!
              </Text>

              <Text style={styles.inputLabel}>Tarif Adı:</Text>
              <TextInput style={styles.formInput} placeholder="Örn: Annemin Özel Köftesi" value={newTitle} onChangeText={setNewTitle} />

              <Text style={styles.inputLabel}>Kategori Seçin:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', gap: 6, paddingVertical: 2 }}>
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

              <Text style={styles.inputLabel}>Kaç Kişilik (Porsiyon):</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                {['1 Kişilik', '2 Kişilik', '4 Kişilik', '6 Kişilik'].map((p) => {
                  const isSelected = newPortions === p;
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[
                        styles.modalCategoryPill,
                        { flex: 1, alignItems: 'center' },
                        isSelected && styles.modalCategoryPillActive
                      ]}
                      onPress={() => setNewPortions(p)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.modalCategoryPillText, isSelected && styles.modalCategoryPillTextActive]}>
                        {p}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>Diyet Uyumluluğu (İsteğe Bağlı):</Text>
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

              <Text style={styles.inputLabel}>Alerjen / İçermeyen Kısıtlar (İsteğe Bağlı):</Text>
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

            <TouchableOpacity 
              style={[styles.modalActionBtn, { backgroundColor: '#6C757D', marginTop: 10 }]}
              onPress={() => setAddRecipeModalVisible(false)}
              disabled={isFormattingAI}
            >
              <Text style={styles.modalActionBtnText}>İptal</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <TouchableOpacity 
                style={[styles.modalActionBtn, { backgroundColor: '#4B5563', flex: 1 }]}
                onPress={handleCreateOrUpdateUserRecipeDirect}
                disabled={isFormattingAI}
              >
                <Text style={styles.modalActionBtnText}>💾 Direkt Kaydet</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.modalActionBtn, { backgroundColor: '#10B981', flex: 1.2 }]}
                onPress={handleCreateOrUpdateUserRecipeWithAI}
                disabled={isFormattingAI}
              >
                {isFormattingAI ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.modalActionBtnText}>✨ AI ile Düzenle & Kaydet</Text>
                )}
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
            <Text style={styles.modalTitle}>⚙ Tarif Görünüm Filtreleri</Text>

            <Text style={styles.filterSectionTitle}>⭐ Özel Koleksiyonlar:</Text>
            <View style={styles.filterOptionsGroup}>
              {[
                { label: 'Tüm Tarif Koleksiyonu', value: 'all' },
                { label: '❤ Favori Tariflerim', value: 'favorites' },
                { label: '📜 Son Yapılan Tarifler', value: 'history' }
              ].map((opt) => (
                <TouchableOpacity 
                  key={opt.value}
                  style={[styles.modalOptionBtn, collectionFilter === opt.value && styles.activeModalOptionBtn]}
                  onPress={() => setCollectionFilter(opt.value as 'all' | 'favorites' | 'history')}
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
                  onPress={() => setIngredientFilter(opt.value as 'all' | 'complete' | 'missing')}
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
                <Text style={styles.detailTime}>⏱ Hazırlama / Pişirme Süresi: {selectedRecipe.cookingTime}</Text>
              )}

              {selectedRecipe?.is_approved && (
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

              <View style={{ backgroundColor: '#F9FAFB', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', marginVertical: 10 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#374151', marginBottom: 4 }}>💡 Pratik Kaşık Ölçüleri (Referans):</Text>
                <Text style={{ fontSize: 10, color: '#6B7280', lineHeight: 15 }}>
                  • 1 Çay Kaşığı ≈ 3g / 3ml{'\n'}
                  • 1 Tatlı Kaşığı ≈ 5g / 5ml{'\n'}
                  • 1 Yemek Kaşığı ≈ 15g / 15ml
                </Text>
              </View>

              {!selectedRecipe?.isUserCreated && !selectedRecipe?.isAI && (
                <TouchableOpacity 
                  style={styles.youtubeButton}
                  onPress={() => selectedRecipe && handleOpenYouTubeVideo(selectedRecipe.title)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.youtubeButtonText}>▶ YouTube'da Yapılışını İzle</Text>
                </TouchableOpacity>
              )}

              <Text style={styles.detailSubTitle}>📏 Gerekli Malzemeler ({portionCount} Kişilik):</Text>
              {selectedRecipe?.ingredientsWithQuantities ? (
                selectedRecipe.ingredientsWithQuantities.map((item: IngredientItem, idx: number) => {
                  const ingredientStr = typeof item === 'string' ? item : `${item.amount || 1} ${item.unit || 'adet'} ${item.name || ''}`;
                  return (
                    <Text key={idx} style={styles.detailText}>
                      • {calculateIngredientPortion(ingredientStr, portionCount)}
                    </Text>
                  );
                })
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

              {isUserRecipeModal && (
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 20 }}>
                  <TouchableOpacity 
                    style={[styles.modalActionBtn, { backgroundColor: '#3B82F6', flex: 1, paddingVertical: 12 }]}
                    onPress={() => selectedRecipe && handleOpenEditModal(selectedRecipe)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.modalActionBtnText, { fontSize: 12 }]}>✏ Düzenle</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.modalActionBtn, { backgroundColor: '#7C3AED', flex: 1, paddingVertical: 12 }]}
                    onPress={() => selectedRecipe && handleOpenDuplicateModal(selectedRecipe)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.modalActionBtnText, { fontSize: 12 }]}>📋 Kopyala</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.modalActionBtn, { backgroundColor: '#EF4444', flex: 1, paddingVertical: 12 }]}
                    onPress={() => selectedRecipe && handleDeleteRecipe(selectedRecipe.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.modalActionBtnText, { fontSize: 12 }]}>🗑️ Sil</Text>
                  </TouchableOpacity>
                </View>
              )}

              {isAiRecipeModal && (
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 20 }}>
                  <TouchableOpacity 
                    style={[styles.modalActionBtn, { backgroundColor: '#EF4444', flex: 1, paddingVertical: 12 }]}
                    onPress={() => selectedRecipe && handleDeleteRecipe(selectedRecipe.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.modalActionBtnText, { fontSize: 12 }]}>🗑 Bu AI Tarifini Sil</Text>
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

  addRecipeBtnHeader: { backgroundColor: '#10B981', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  addRecipeBtnHeaderText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },

  searchBarContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E9ECEF', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12 },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 13, color: '#1A1A1A', padding: 0 },

  categoryPill: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: '#E9ECEF', borderWidth: 1, borderColor: '#E9ECEF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  categoryPillActive: { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  categoryPillText: { fontSize: 12, fontWeight: '700', color: '#495057' },
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

  aiCardContainer: { backgroundColor: '#F3E8FF', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1.5, borderColor: '#9333EA', elevation: 1 },
  aiCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  aiBadgeText: { color: '#7E22CE', fontWeight: '800', fontSize: 12 },
  timeBadge: { backgroundColor: '#E9D5FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, fontSize: 11, color: '#6B21A8', fontWeight: '700' },
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