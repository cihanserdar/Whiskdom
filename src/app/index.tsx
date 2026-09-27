import DateTimePicker from '@react-native-community/datetimepicker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useContext, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppContext, InventoryItem } from '../context/AppContext';
import SplashScreen from '../screens/SplashScreen';
import { checkQuota, consumeQuota } from '../services/quotaService';
import { supabase } from '../services/supabase'; // 🔒 Güvenli Supabase istemcisi

const BRAND_SUGGESTIONS = ['Torku', 'Sütaş', 'İçim', 'Pınar', 'Öncü', 'Filiz', 'Tadım', 'Banvit', 'Reis', 'Söke', 'Komili'];
const PRODUCT_SUGGESTIONS = ['Çikolata', 'Süt', 'Yumurta', 'Kaşar Peyniri', 'Yoğurt', 'Tereyağı', 'Domates', 'Kuru Soğan', 'Salça', 'Makarna', 'Kıyma'];
const UNITS = ['Adet', 'Kg', 'Gram', 'Litre', 'Ml', 'Paket', 'Kavanoz', 'Baş'];

interface ScannedReceiptItem {
  id: string;
  name: string;
  brand: string;
  amount: number;
  unit: string;
  selected: boolean;
}

const getProductCategoryIcon = (name: string): string => {
  const lower = name.toLowerCase();
  if (lower.includes('süt') || lower.includes('yoğurt') || lower.includes('peynir') || lower.includes('tereyağı')) return '🥛';
  if (lower.includes('yumurta')) return '🥚';
  if (lower.includes('et') || lower.includes('kıyma') || lower.includes('tavuk')) return '🥩';
  if (lower.includes('domates') || lower.includes('soğan') || lower.includes('sebze') || lower.includes('biber')) return '🥦';
  if (lower.includes('makarna') || lower.includes('un') || lower.includes('pirinç') || lower.includes('mercimek')) return '🌾';
  if (lower.includes('çikolata') || lower.includes('tatlı')) return '🍫';
  return '📦';
};

const parseTRDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    return new Date(year, month, day);
  }
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
};

// Yardımcı: Metin miktar ifadesini (örn. "1 Litre" veya "500g") sayı ve birime ayırır
const parseQuantityString = (qtyStr: string): { amount: number; unit: string } => {
  if (!qtyStr) return { amount: 1, unit: 'Adet' };
  const cleaned = qtyStr.trim();
  const match = cleaned.match(/^([\d.,]+)\s*(.*)$/);
  if (match) {
    const parsedNum = parseFloat(match[1].replace(',', '.'));
    const parsedUnit = match[2].trim() || 'Adet';
    return {
      amount: isNaN(parsedNum) ? 1 : parsedNum,
      unit: parsedUnit.charAt(0).toUpperCase() + parsedUnit.slice(1).toLowerCase(),
    };
  }
  return { amount: 1, unit: 'Adet' };
};

export default function HomeScreen() {
  const [isReady, setIsReady] = useState(true);
  const context = useContext(AppContext);
  const [permission, requestPermission] = useCameraPermissions();

  if (!context) return null;

  const { inventory, deleteItem, updateItem, addInventoryItem, addMultipleInventoryItems } = context;

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'default' | 'expiry'>('default');

  // Modal State'leri
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const [formName, setFormName] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [formAmountNum, setFormAmountNum] = useState('1');
  const [formUnit, setFormUnit] = useState('Adet');
  const [formExpiryDate, setFormExpiryDate] = useState('15-10-2026');
  const [formImageUrl, setFormImageUrl] = useState('');

  // Besin Değerleri State'leri
  const [formCalories, setFormCalories] = useState('');
  const [formProtein, setFormProtein] = useState('');
  const [formCarbs, setFormCarbs] = useState('');
  const [formFat, setFormFat] = useState('');

  // Takvim Seçici Modal State'leri (Gerçek Date Picker İçin)
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [selectedDateObj, setSelectedDateObj] = useState(new Date());

  // Barkod Kamera Modalı State'i
  const [isBarcodeScannerVisible, setIsBarcodeScannerVisible] = useState(false);
  const [scanned, setScanned] = useState(false);

  // FİŞ / GALERİ GEMINI AI TOPLU ÜRÜN SEÇİM MODALI STATE'LERİ
  const [isReceiptModalVisible, setIsReceiptModalVisible] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [receiptItems, setReceiptItems] = useState<ScannedReceiptItem[]>([]);
  const [receiptImageUri, setReceiptImageUri] = useState<string | null>(null);
  
  // 🏷️ FİŞ KOTA STATE'İ
  const [remainingReceiptQuota, setRemainingReceiptQuota] = useState<number | null>(null);

  // Öneri State'leri
  const [filteredBrands, setFilteredBrands] = useState<string[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<string[]>([]);

  // Sayfa yüklendiğinde kalan fiş hakkını quotaService üzerinden çek
  useEffect(() => {
    updateReceiptQuota();
  }, []);

  const updateReceiptQuota = async () => {
    try {
      const quotaStatus = await checkQuota('receipt');
      setRemainingReceiptQuota(quotaStatus.remaining);
    } catch (e) {
      // Sessizce geçilir
    }
  };

  // AKILLI YENİDEN DENEME MEKANİZMALI GEMINI ANALİZİ (SUPABASE EDGE FUNCTION ÜZERİNDEN)
  const analyzeReceiptWithGemini = async (base64Image: string, imageUri: string) => {
    try {
      const quotaStatus = await checkQuota('receipt');

      if (!quotaStatus.allowed) {
        Alert.alert(
          "Günlük Fiş Tarama Hakkı Doldu ⏳",
          `Günlük fiş tarama limitinize ulaştınız.\n${quotaStatus.resetTimeText}`
        );
        return;
      }
    } catch (e) {
      // Sessizce geçilir
    }

    setReceiptImageUri(imageUri);
    setIsAnalyzing(true);
    setIsReceiptModalVisible(true);
    setReceiptItems([]);

    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const prompt = 'Bu alışveriş fişi veya gıda listesi fotoğrafındaki ürünleri tespit et. Sadece şu JSON formatında cevap ver: [{"name": "Ürün Adı", "brand": "Marka", "quantity": "Miktar (örn: 1 Litre, 2 Adet)"}]. Başka hiçbir açıklama yazma.';

        const { data, error } = await supabase.functions.invoke('generate-recipe', {
          body: { 
            prompt: prompt,
            base64Image: base64Image 
          },
        });

        if (error) {
          throw new Error(error.message || 'Supabase fonksiyonu hata döndürdü.');
        }

        const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || data?.text;

        if (responseText) {
          const jsonStart = responseText.indexOf('[');
          const jsonEnd = responseText.lastIndexOf(']') + 1;

          if (jsonStart !== -1 && jsonEnd !== -1) {
            const jsonString = responseText.substring(jsonStart, jsonEnd);
            const parsedData = JSON.parse(jsonString);

            const formattedItems: ScannedReceiptItem[] = (parsedData as Array<{ name?: string; brand?: string; quantity?: string }>).map((item, idx) => {
              const parsedQty = parseQuantityString(item.quantity || '1 Adet');
              return {
                id: `gemini_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 5)}`,
                name: item.name || 'Bilinmeyen Ürün',
                brand: item.brand || '',
                amount: parsedQty.amount,
                unit: parsedQty.unit,
                selected: true,
              };
            });

            setReceiptItems(formattedItems);
            setIsAnalyzing(false);
            
            await consumeQuota('receipt');
            updateReceiptQuota();
            return;
          }
        }
        break;
      } catch (error) {
        attempt++;
        if (attempt >= maxRetries) {
          Alert.alert('Hata', 'Google Gemini AI analizinde bir hata oluştu. Lütfen birkaç saniye bekleyip tekrar deneyin.');
          setIsAnalyzing(false);
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
    setIsAnalyzing(false);
  };

  // GALERİDEN SEÇİM
  const handlePickFromGallery = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('İzin Gerekli', 'Galeriye erişmek için izin vermeniz gerekmektedir.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      base64: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0].base64 && result.assets[0].uri) {
      analyzeReceiptWithGemini(result.assets[0].base64, result.assets[0].uri);
    }
  };

  // KAMERADAN FİŞ ÇEKME
  const handleTakePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('İzin Gerekli', 'Kamerayı kullanmak için izin vermeniz gerekmektedir.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      base64: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0].base64 && result.assets[0].uri) {
      analyzeReceiptWithGemini(result.assets[0].base64, result.assets[0].uri);
    }
  };

  const toggleReceiptItemSelection = (id: string) => {
    setReceiptItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  const handleAddSelectedReceiptItems = async () => {
    const selectedItems = receiptItems.filter((item) => item.selected);

    if (selectedItems.length === 0) {
      Alert.alert('Uyarı', 'Lütfen envantere eklemek için en az bir ürün seçin.');
      return;
    }

    const formattedForInventory: InventoryItem[] = selectedItems.map((item, index) => ({
      id: `${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
      name: item.name,
      brand: item.brand,
      amount: item.amount,
      unit: item.unit,
      expiryDate: '15-10-2026',
    }));

    setIsReceiptModalVisible(false);
    await addMultipleInventoryItems(formattedForInventory);
    Alert.alert('Başarılı 🎉', `${selectedItems.length} adet ürün envantere eklendi.`);
  };

  const handleOpenBarcodeScanner = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('İzin Gerekli', 'Barkod taramak için kamera izni gereklidir.');
        return;
      }
    }
    setScanned(false);
    setIsBarcodeScannerVisible(true);
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    setIsBarcodeScannerVisible(false);

    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${data}.json`);
      const json = await response.json();

      if (json.status === 1 && json.product) {
        const prod = json.product;
        handleOpenModal();
        setFormName(prod.product_name || 'Bilinmeyen Ürün');
        setFormBrand(prod.brands ? prod.brands.split(',')[0] : '');
        if (prod.image_front_url) setFormImageUrl(prod.image_front_url);

        if (prod.nutriments) {
          setFormCalories(Math.round(prod.nutriments['energy-kcal_100g'] || 0).toString());
          setFormProtein(Math.round(prod.nutriments.proteins_100g || 0).toString());
          setFormCarbs(Math.round(prod.nutriments.carbohydrates_100g || 0).toString());
          setFormFat(Math.round(prod.nutriments.fat_100g || 0).toString());
        }
      } else {
        Alert.alert('Ürün Bulunamadı', `Barkod (${data}) veritabanında eşleşmedi. Manuel ekleyebilirsiniz.`);
        handleOpenModal();
      }
    } catch (e) {
      Alert.alert('Hata', 'Barkod verisi sorgulanırken bir hata oluştu.');
      handleOpenModal();
    }
  };

  const handleBrandChange = (text: string) => {
    setFormBrand(text);
    if (text.trim().length > 0) {
      setFilteredBrands(BRAND_SUGGESTIONS.filter((b) => b.toLowerCase().includes(text.toLowerCase())));
    } else {
      setFilteredBrands([]);
    }
  };

  const handleNameChange = (text: string) => {
    setFormName(text);
    if (text.trim().length > 0) {
      setFilteredProducts(PRODUCT_SUGGESTIONS.filter((p) => p.toLowerCase().includes(text.toLowerCase())));
    } else {
      setFilteredProducts([]);
    }
  };

  const handleOpenModal = (item?: InventoryItem) => {
    if (item) {
      setIsEditing(true);
      setSelectedItemId(item.id);
      setFormName(item.name);
      setFormBrand(item.brand || '');
      setFormAmountNum(item.amount?.toString() || '1');
      setFormUnit(item.unit || 'Adet');
      setFormExpiryDate(item.expiryDate || '15-10-2026');
      setFormImageUrl(item.imageUrl || '');

      const parsed = parseTRDate(item.expiryDate);
      if (parsed) setSelectedDateObj(parsed);

      const nutrients = item.nutrients || {};
      setFormCalories(nutrients.calories?.toString() || '');
      setFormProtein(nutrients.protein?.toString() || '');
      setFormCarbs(nutrients.carbs?.toString() || '');
      setFormFat(nutrients.fat?.toString() || '');
    } else {
      setIsEditing(false);
      setSelectedItemId(null);
      setFormName('');
      setFormBrand('');
      setFormAmountNum('1');
      setFormUnit('Adet');
      setFormExpiryDate('15-10-2026');
      setSelectedDateObj(new Date());
      setFormCalories('');
      setFormProtein('');
      setFormCarbs('');
      setFormFat('');
    }
    setFilteredBrands([]);
    setFilteredProducts([]);
    setIsModalVisible(true);
  };

  const handleValueChange = (event: { type: string }, selectedDate?: Date) => {
    if (event.type === 'set' && selectedDate) {
      setSelectedDateObj(selectedDate);
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const year = selectedDate.getFullYear();
      setFormExpiryDate(`${day}-${month}-${year}`);
    }
    setIsDatePickerVisible(false);
  };

  const handleSave = () => {
    if (!formName.trim()) return;

    const numericAmount = parseFloat(formAmountNum.replace(',', '.')) || 1;

    const nutrients = {
      calories: Number(formCalories) || 0,
      protein: Number(formProtein) || 0,
      carbs: Number(formCarbs) || 0,
      fat: Number(formFat) || 0,
    };

    if (isEditing && selectedItemId) {
      updateItem({
        id: selectedItemId,
        name: formName,
        brand: formBrand,
        amount: numericAmount,
        unit: formUnit,
        expiryDate: formExpiryDate,
        imageUrl: formImageUrl,
        ...(nutrients.calories > 0 ? { nutrients } : {}),
      });
    } else {
      addInventoryItem({
        id: Date.now().toString(),
        name: formName,
        brand: formBrand,
        amount: numericAmount,
        unit: formUnit,
        expiryDate: formExpiryDate,
        imageUrl: formImageUrl,
        ...(nutrients.calories > 0 ? { nutrients } : {}),
      });
    }
    setIsModalVisible(false);
  };

  const processedInventory = inventory
    .filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'expiry') {
        const dateA = parseTRDate(a.expiryDate)?.getTime() || Infinity;
        const dateB = parseTRDate(b.expiryDate)?.getTime() || Infinity;
        return dateA - dateB;
      }
      return 0;
    });

  const totalItems = inventory.length;
  const expiringSoonCount = inventory.filter((item) => {
    const expiry = parseTRDate(item.expiryDate);
    if (!expiry) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 3600 * 24));
    return diffDays <= 3 && diffDays >= 0;
  }).length;

  if (!isReady) {
    return <SplashScreen onFinish={() => setIsReady(true)} />;
  }

  return (
    <View style={styles.container}>
      {/* ÜST BAŞLIK */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>Mutfak Envanteri</Text>
          <Text style={styles.headerSubtitle}>Besin Odaklı Stok Takibi</Text>
        </View>
        <TouchableOpacity style={styles.addManualBtn} onPress={() => handleOpenModal()} activeOpacity={0.8}>
          <Text style={styles.addManualBtnText}>+ Ürün Ekle</Text>
        </TouchableOpacity>
      </View>

      {/* İSTATİSTİK PANOSU */}
      <View style={styles.statsCard}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{totalItems}</Text>
          <Text style={styles.statLabel}>Toplam Ürün</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: '#D97706' }]}>{expiringSoonCount}</Text>
          <Text style={styles.statLabel}>Kritik SKT</Text>
        </View>
      </View>

      {/* ARAMA BAR */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Ürün, marka veya içerik ara..."
          placeholderTextColor="#A0AEC0"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={styles.clearIcon}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* SIRALAMA SEÇENEKLERİ */}
      <View style={styles.sortContainer}>
        <TouchableOpacity
          style={[styles.sortPill, sortBy === 'default' && styles.sortPillActive]}
          onPress={() => setSortBy('default')}
        >
          <Text style={[styles.sortPillText, sortBy === 'default' && styles.sortPillTextActive]}>
            Eklenme Sırası
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sortPill, sortBy === 'expiry' && styles.sortPillActive]}
          onPress={() => setSortBy('expiry')}
        >
          <Text style={[styles.sortPillText, sortBy === 'expiry' && styles.sortPillTextActive]}>
            SKT'ye Göre
          </Text>
        </TouchableOpacity>
      </View>

      {/* 🏷️ FİŞ KOTA GÖSTERGESİ */}
      <View style={{ backgroundColor: '#F3E8FF', paddingVertical: 5, paddingHorizontal: 12, borderRadius: 10, alignSelf: 'flex-start', marginBottom: 8, borderWidth: 1, borderColor: '#E9D5FF' }}>
        <Text style={{ fontSize: 11, color: '#7E22CE', fontWeight: '800' }}>
          🧾 Günlük Kalan Fiş Tarama Hakkı: {remainingReceiptQuota !== null ? `${remainingReceiptQuota} / 1` : 'Yükleniyor...'}
        </Text>
      </View>

      {/* TARAMA BUTONLARI */}
      <View style={styles.scanButtonGroup}>
        <TouchableOpacity style={[styles.scanBtn, { backgroundColor: '#1A1A1A' }]} onPress={handleOpenBarcodeScanner}>
          <Text style={styles.scanBtnIcon}>║█║</Text>
          <Text style={styles.scanBtnText}>Barkod</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.scanBtn, { backgroundColor: '#4A5568' }]} onPress={handleTakePhoto}>
          <Text style={styles.scanBtnIcon}>📸</Text>
          <Text style={styles.scanBtnText}>Fiş Çek</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.scanBtn, { backgroundColor: '#718096' }]} onPress={handlePickFromGallery}>
          <Text style={styles.scanBtnIcon}>🖼️</Text>
          <Text style={styles.scanBtnText}>Galeri</Text>
        </TouchableOpacity>
      </View>

      {/* ÜRÜN LİSTESİ */}
      <FlatList
        data={processedInventory}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🥬</Text>
            <Text style={styles.emptyTitle}>Envanteriniz Boş</Text>
            <Text style={styles.emptySubtitle}>
              Mutfaktaki malzemelerinizi ekleyerek israfın önüne geçmeye başlayın.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          let diffDays: number | null = null;
          const expiryDateObj = parseTRDate(item.expiryDate);

          if (expiryDateObj) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            diffDays = Math.ceil((expiryDateObj.getTime() - today.getTime()) / (1000 * 3600 * 24));
          }

          const nutrients = item.nutrients;
          const categoryEmoji = getProductCategoryIcon(item.name);

          return (
            <TouchableOpacity style={styles.card} activeOpacity={0.85}>
              <View style={styles.cardTopRow}>
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="cover" />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Text style={styles.placeholderEmoji}>{categoryEmoji}</Text>
                  </View>
                )}

                <View style={styles.infoContainer}>
                  <View style={styles.titleRow}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    {diffDays !== null && (
                      <View
                        style={[
                          styles.badgePill,
                          diffDays <= 3 ? { backgroundColor: '#FCE8E6' } : { backgroundColor: '#E9ECEF' },
                        ]}
                      >
                        <Text style={[styles.badgeText, diffDays <= 3 ? { color: '#9B1C1C' } : { color: '#495057' }]}>
                          {diffDays < 0 ? 'Tarihi Geçti' : diffDays === 0 ? 'Son Gün!' : `${diffDays} gün`}
                        </Text>
                      </View>
                    )}
                  </View>

                  {item.brand ? <Text style={styles.itemBrand}>{item.brand}</Text> : null}

                  <View style={styles.metaRow}>
                    <Text style={styles.itemQuantity}>Miktar: {item.amount} {item.unit}</Text>
                    {item.expiryDate ? <Text style={styles.expiryDateText}>• SKT: {item.expiryDate}</Text> : null}
                  </View>
                </View>

                <View style={styles.actionGroup}>
                  <TouchableOpacity style={styles.editBtn} onPress={() => handleOpenModal(item)} activeOpacity={0.7}>
                    <Text style={styles.editIconText}>✎</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteItem(item.id)} activeOpacity={0.7}>
                    <Text style={styles.deleteIconText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* BESİN PANELİ */}
              <View style={styles.nutritionRow}>
                <View style={styles.nutriBadge}>
                  <Text style={styles.nutriLabel}>KALORİ</Text>
                  <Text style={styles.nutriVal}>{nutrients?.calories || 0} kcal</Text>
                </View>
                <View style={styles.nutriBadge}>
                  <Text style={styles.nutriLabel}>PROTEİN</Text>
                  <Text style={styles.nutriVal}>{nutrients?.protein || 0}g</Text>
                </View>
                <View style={styles.nutriBadge}>
                  <Text style={styles.nutriLabel}>KARB</Text>
                  <Text style={styles.nutriVal}>{nutrients?.carbs || 0}g</Text>
                </View>
                <View style={styles.nutriBadge}>
                  <Text style={styles.nutriLabel}>YAĞ</Text>
                  <Text style={styles.nutriVal}>{nutrients?.fat || 0}g</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* GEMINI AI FİŞ / GALERİ ANALİZ MODALI */}
      <Modal visible={isReceiptModalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: '85%' }]}>
            <Text style={styles.modalTitle}>🤖 AI Fiş Analizi</Text>

            {isAnalyzing ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#1A1A1A" />
                <Text style={{ marginTop: 14, fontSize: 13, fontWeight: '700', color: '#1A1A1A' }}>
                  Fiş üzerindeki ürünler okunuyor...
                </Text>
              </View>
            ) : (
              <>
                <Text style={{ fontSize: 12, color: '#6C757D', marginBottom: 12 }}>
                  Fişte tespit edilen ürünleri kontrol edip ekleyin:
                </Text>

                <ScrollView style={{ maxHeight: 300 }}>
                  {receiptItems.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.receiptItemRow,
                        item.selected && styles.receiptItemRowSelected,
                      ]}
                      onPress={() => toggleReceiptItemSelection(item.id)}
                    >
                      <View style={styles.checkbox}>
                        {item.selected && <Text style={styles.checkboxCheck}>✓</Text>}
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#1A1A1A' }}>{item.name}</Text>
                        <Text style={{ fontSize: 11, color: '#6C757D' }}>
                          {item.brand ? `${item.brand} • ` : ''}{item.amount} {item.unit}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <View style={styles.modalActionGroup}>
                  <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setIsReceiptModalVisible(false)}>
                    <Text style={styles.modalCancelBtnText}>İptal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalSaveBtn, { backgroundColor: '#1A1A1A' }]}
                    onPress={handleAddSelectedReceiptItems}
                  >
                    <Text style={styles.modalSaveBtnText}>Seçilenleri Ekle</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* MANUEL EKLEME / DÜZENLEME MODALI */}
      <Modal visible={isModalVisible} transparent={true} animationType="fade" onRequestClose={() => setIsModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView style={{ width: '100%' }} contentContainerStyle={{ justifyContent: 'center', alignItems: 'center' }}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>{isEditing ? 'Ürünü Düzenle' : 'Yeni Ürün Ekle'}</Text>

              {formImageUrl ? (
                <View style={{ alignItems: 'center', marginBottom: 12 }}>
                  <Image source={{ uri: formImageUrl }} style={{ width: 70, height: 70, borderRadius: 12 }} />
                  <TouchableOpacity onPress={() => setFormImageUrl('')} style={{ marginTop: 4 }}>
                    <Text style={{ fontSize: 11, color: '#9B1C1C', fontWeight: '700' }}>Fotoğrafı Kaldır</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {/* ÜRÜN ADI & ÖNERİ */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Ürün Adı</Text>
                <TextInput
                  style={styles.modalInput}
                  value={formName}
                  onChangeText={handleNameChange}
                  placeholder="Örn: Süt veya Çikolata"
                  placeholderTextColor="#A0AEC0"
                />
                {filteredProducts.length > 0 && (
                  <View style={styles.suggestionDropdown}>
                    {filteredProducts.map((p) => (
                      <TouchableOpacity
                        key={p}
                        style={styles.suggestionItem}
                        onPress={() => {
                          setFormName(p);
                          setFilteredProducts([]);
                        }}
                      >
                        <Text style={styles.suggestionText}>{p}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* MARKA & ÖNERİ */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Marka</Text>
                <TextInput
                  style={styles.modalInput}
                  value={formBrand}
                  onChangeText={handleBrandChange}
                  placeholder="Örn: Torku"
                  placeholderTextColor="#A0AEC0"
                />
                {filteredBrands.length > 0 && (
                  <View style={styles.suggestionDropdown}>
                    {filteredBrands.map((b) => (
                      <TouchableOpacity
                        key={b}
                        style={styles.suggestionItem}
                        onPress={() => {
                          setFormBrand(b);
                          setFilteredBrands([]);
                        }}
                      >
                        <Text style={styles.suggestionText}>{b}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* MİKTAR VE BİRİM SEÇİMİ */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Miktar ve Birim</Text>
                <View style={styles.quantityRow}>
                  <TextInput
                    style={[styles.modalInput, { width: 70 }]}
                    value={formAmountNum}
                    onChangeText={setFormAmountNum}
                    keyboardType="numeric"
                  />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {UNITS.map((unit) => (
                      <TouchableOpacity
                        key={unit}
                        style={[styles.unitPill, formUnit === unit && styles.unitPillActive]}
                        onPress={() => setFormUnit(unit)}
                      >
                        <Text style={[styles.unitPillText, formUnit === unit && styles.unitPillTextActive]}>{unit}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              {/* SKT / TAKVİM SEÇİMİ KUTUSU */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Son Kullanma Tarihi</Text>
                <TouchableOpacity style={styles.datePickerTrigger} onPress={() => setIsDatePickerVisible(true)}>
                  <Text style={styles.datePickerTriggerText}>📅  {formExpiryDate || 'Tarih Seçiniz'}</Text>
                </TouchableOpacity>
              </View>

              {/* BESİN DEĞERLERİ BİLGİSİ */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { fontWeight: '800', marginTop: 4 }]}>
                  Besin Değerleri (100g)
                </Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TextInput
                    style={[styles.modalInput, { flex: 1 }]}
                    placeholder="Kcal"
                    placeholderTextColor="#A0AEC0"
                    keyboardType="numeric"
                    value={formCalories}
                    onChangeText={setFormCalories}
                  />
                  <TextInput
                    style={[styles.modalInput, { flex: 1 }]}
                    placeholder="Protein"
                    placeholderTextColor="#A0AEC0"
                    keyboardType="numeric"
                    value={formProtein}
                    onChangeText={setFormProtein}
                  />
                  <TextInput
                    style={[styles.modalInput, { flex: 1 }]}
                    placeholder="Karb"
                    placeholderTextColor="#A0AEC0"
                    keyboardType="numeric"
                    value={formCarbs}
                    onChangeText={setFormCarbs}
                  />
                  <TextInput
                    style={[styles.modalInput, { flex: 1 }]}
                    placeholder="Yağ"
                    placeholderTextColor="#A0AEC0"
                    keyboardType="numeric"
                    value={formFat}
                    onChangeText={setFormFat}
                  />
                </View>
              </View>

              <View style={styles.modalActionGroup}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setIsModalVisible(false)}>
                  <Text style={styles.modalCancelBtnText}>İptal</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalSaveBtn, { backgroundColor: '#1A1A1A' }]} onPress={handleSave}>
                  <Text style={styles.modalSaveBtnText}>Kaydet</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* GERÇEK ZAMANLI BARKOD TARAYICI MODALI */}
      <Modal visible={isBarcodeScannerVisible} animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'ean8', 'qr', 'upc_a'],
            }}
          />
          
          <View style={styles.scannerOverlay}>
            <View style={styles.scannerHeader}>
              <Text style={styles.scannerTitle}>Barkod Tarat</Text>
              <Text style={styles.scannerSubtitle}>Ürün barkodunu kare içerisine hizalayın</Text>
            </View>

            <View style={styles.scanBox}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>

            <TouchableOpacity style={styles.closeCameraBtn} onPress={() => setIsBarcodeScannerVisible(false)}>
              <Text style={styles.closeCameraBtnText}>İptal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* GERÇEK DATE PICKER TAKVİM BİLEŞENİ */}
      {isDatePickerVisible && (
        <DateTimePicker
          value={selectedDateObj}
          mode="date"
          display="default"
          onChange={handleValueChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 54, paddingHorizontal: 18, backgroundColor: '#F8F9FA' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#1A1A1A', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 12, color: '#6C757D', marginTop: 2, fontWeight: '600' },
  addManualBtn: { backgroundColor: '#1A1A1A', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  addManualBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  statsCard: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 20, marginBottom: 14, borderWidth: 1, borderColor: '#E9ECEF', alignItems: 'center', justifyContent: 'space-around', elevation: 1 },
  statBox: { alignItems: 'center' },
  statNumber: { fontSize: 20, fontWeight: '800', color: '#1A1A1A' },
  statLabel: { fontSize: 11, color: '#6C757D', fontWeight: '600', marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: '#E9ECEF' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 12, height: 44, marginBottom: 10, borderWidth: 1, borderColor: '#E9ECEF' },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 13, color: '#1A1A1A' },
  clearIcon: { fontSize: 14, color: '#6C757D', padding: 4 },
  sortContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sortPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#E9ECEF' },
  sortPillActive: { backgroundColor: '#1A1A1A' },
  sortPillText: { fontSize: 11, fontWeight: '700', color: '#495057' },
  sortPillTextActive: { color: '#FFFFFF' },
  scanButtonGroup: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  scanBtn: { flex: 1, flexDirection: 'row', height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 6 },
  scanBtnIcon: { fontSize: 13, color: '#FFFFFF' },
  scanBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  listContainer: { paddingBottom: 30 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E9ECEF', elevation: 1 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center' },
  image: { width: 50, height: 50, borderRadius: 10, marginRight: 12 },
  imagePlaceholder: { width: 50, height: 50, borderRadius: 10, backgroundColor: '#F1F3F5', justifyContent: 'center', alignItems: 'center', marginRight: 12, borderWidth: 1, borderColor: '#E9ECEF' },
  placeholderEmoji: { fontSize: 22 },
  infoContainer: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 6 },
  itemName: { fontSize: 14, fontWeight: '800', color: '#1A1A1A' },
  badgePill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  itemBrand: { fontSize: 11, color: '#6C757D', marginTop: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  itemQuantity: { fontSize: 11, fontWeight: '600', color: '#495057' },
  expiryDateText: { fontSize: 11, color: '#6C757D', fontWeight: '500' },
  actionGroup: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 6 },
  editBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#F1F3F5', borderWidth: 1, borderColor: '#E9ECEF', justifyContent: 'center', alignItems: 'center' },
  editIconText: { fontSize: 13, color: '#1A1A1A', fontWeight: '600' },
  deleteBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#FCE8E6', borderWidth: 1, borderColor: '#F87171', justifyContent: 'center', alignItems: 'center' },
  deleteIconText: { fontSize: 12, color: '#9B1C1C', fontWeight: '800' },

  nutritionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F1F3F5' },
  nutriBadge: { alignItems: 'center' },
  nutriLabel: { fontSize: 8, fontWeight: '700', color: '#868E96', textTransform: 'uppercase' },
  nutriVal: { fontSize: 11, fontWeight: '800', color: '#212529', marginTop: 1 },

  receiptItemRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E9ECEF', marginBottom: 8, backgroundColor: '#F8F9FA' },
  receiptItemRowSelected: { borderColor: '#1A1A1A', backgroundColor: '#FFFFFF' },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center' },
  checkboxCheck: { fontSize: 12, fontWeight: 'bold', color: '#1A1A1A' },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: '#1A1A1A', marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: '#6C757D', textAlign: 'center', lineHeight: 18 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, paddingTop: 40 },
  modalContainer: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#E9ECEF', elevation: 5 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#1A1A1A', marginBottom: 12 },
  inputGroup: { marginBottom: 10 },
  inputLabel: { fontSize: 11, fontWeight: '700', color: '#495057', marginBottom: 4 },
  modalInput: { backgroundColor: '#F8F9FA', borderRadius: 8, paddingHorizontal: 10, height: 38, fontSize: 12, color: '#1A1A1A', borderWidth: 1, borderColor: '#E9ECEF' },
  suggestionDropdown: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E9ECEF', borderRadius: 8, marginTop: 4, maxHeight: 100, elevation: 3 },
  suggestionItem: { paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E9ECEF' },
  suggestionText: { fontSize: 12, color: '#1A1A1A', fontWeight: '600' },
  quantityRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  unitPill: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: '#F1F3F5', borderWidth: 1, borderColor: '#E9ECEF', marginRight: 6 },
  unitPillActive: { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  unitPillText: { fontSize: 11, fontWeight: '700', color: '#1A1A1A' },
  unitPillTextActive: { color: '#FFFFFF' },
  datePickerTrigger: { backgroundColor: '#F8F9FA', height: 38, borderRadius: 8, borderWidth: 1, borderColor: '#E9ECEF', justifyContent: 'center', paddingHorizontal: 10 },
  datePickerTriggerText: { fontSize: 12, fontWeight: '700', color: '#1A1A1A' },
  modalActionGroup: { flexDirection: 'row', gap: 8, marginTop: 12 },
  modalCancelBtn: { flex: 1, height: 38, borderRadius: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F3F5', borderWidth: 1, borderColor: '#E9ECEF' },
  modalCancelBtnText: { fontSize: 12, fontWeight: '700', color: '#1A1A1A' },
  modalSaveBtn: { flex: 1, height: 38, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  modalSaveBtnText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },

  scannerOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  scannerHeader: {
    alignItems: 'center',
  },
  scannerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  scannerSubtitle: {
    color: '#A0AEC0',
    fontSize: 13,
    fontWeight: '600',
  },
  scanBox: {
    width: 260,
    height: 160,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#FFFFFF',
    borderWidth: 3,
  },
  topLeft: { top: 0, left: 0, borderBottomWidth: 0, borderRightWidth: 0 },
  topRight: { top: 0, right: 0, borderBottomWidth: 0, borderLeftWidth: 0 },
  bottomLeft: { bottom: 0, left: 0, borderTopWidth: 0, borderRightWidth: 0 },
  bottomRight: { bottom: 0, right: 0, borderTopWidth: 0, borderLeftWidth: 0 },
  closeCameraBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  closeCameraBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
});