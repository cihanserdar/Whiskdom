import { useContext, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  Share,
  StyleSheet, Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { AppContext, CartItem } from '../context/AppContext';

export default function CartScreen() {
  const { cart, addToCart, toggleCartItem, clearCheckedCartItems, updateCartItemQuantity, toggleAllCartItems, toggleCategoryCartItems } = useContext(AppContext);

  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('1 Paket / Adet');
  const [editingItem, setEditingItem] = useState<CartItem | null>(null);

  const handleAddManualItem = () => {
    if (!newItemName.trim()) {
      Alert.alert('Hata', 'Lütfen ürün adı girin.');
      return;
    }
    addToCart([newItemName.trim()], newItemQuantity);
    setNewItemName('');
    setNewItemQuantity('1 Paket / Adet');
  };

  const categories = ['Manav', 'Süt Ürünleri', 'Kiler & Kuru Gıda', 'Et & Şarküteri', 'Diğer'] as const;

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Manav': return '🍏';
      case 'Süt Ürünleri': return '🥛';
      case 'Kiler & Kuru Gıda': return '🌾';
      case 'Et & Şarküteri': return '🥩';
      default: return '📦';
    }
  };

  const handleShareList = async () => {
    if (cart.length === 0) {
      Alert.alert('Bilgi', 'Paylaşılacak ürün bulunmuyor.');
      return;
    }

    const listText = `🛒 Whiskdom Mutfak Alışveriş Listem:\n\n` + 
      cart.map(i => `- [${i.checked ? 'X' : ' '}] ${i.name} (${i.quantity || '1 Adet'})`).join('\n');

    try {
      await Share.share({ message: listText });
    } catch (error) {
      Alert.alert('Hata', 'Liste paylaşılamadı.');
    }
  };

  const allChecked = cart.length > 0 && cart.every(i => i.checked);
  const checkedCount = cart.filter(i => i.checked).length;

  const handleToggleAll = () => {
    toggleAllCartItems(!allChecked);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>🛒 Mutfak Alışveriş Listem</Text>
      
      {/* 1. SATIR: TOPLAM ÖZET BİLGİSİ */}
      <View style={styles.summaryBadgeBox}>
        <Text style={styles.summaryBadgeText}>
          📋 Toplam <Text style={{ fontWeight: '900', color: '#1A1A1A' }}>{cart.length}</Text> kalem ürün ({checkedCount} alındı)
        </Text>
      </View>

      {/* MANUEL HIZLI ÜRÜN EKLEME */}
      <View style={styles.addBox}>
        <TextInput
          style={styles.inputName}
          placeholder="Ürün Adı (Örn: Kaşar Peyniri)"
          placeholderTextColor="#A0AEC0"
          value={newItemName}
          onChangeText={setNewItemName}
        />
        <TextInput
          style={styles.inputQty}
          placeholder="Miktar / Paket (Örn: 2 Paket, 500g)"
          placeholderTextColor="#A0AEC0"
          value={newItemQuantity}
          onChangeText={setNewItemQuantity}
        />
        <TouchableOpacity style={styles.addBtn} onPress={handleAddManualItem} activeOpacity={0.85}>
          <Text style={styles.addBtnText}>+ Sepete Ekle</Text>
        </TouchableOpacity>
      </View>

      {/* AKSİYON BUTONLARI */}
      {cart.length > 0 && (
        <View style={styles.actionRow}>
          <TouchableOpacity 
            style={styles.actionSubBtn} 
            onPress={handleToggleAll} 
            activeOpacity={0.8}
          >
            <Text style={styles.actionSubBtnText}>
              {allChecked ? '☑️ Hiçbirini Seçme' : '✅ Tümünü Seç'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionSubBtn, { backgroundColor: '#E2E8F0' }]} 
            onPress={handleShareList} 
            activeOpacity={0.8}
          >
            <Text style={[styles.actionSubBtnText, { color: '#1A1A1A' }]}>📤 Listeyi Paylaş</Text>
          </TouchableOpacity>
        </View>
      )}

      {cart.some(i => i.checked) && (
        <TouchableOpacity style={styles.clearBtn} onPress={clearCheckedCartItems} activeOpacity={0.8}>
          <Text style={styles.clearBtnText}>🧹 Alınanları Listeden Temizle</Text>
        </TouchableOpacity>
      )}

      {/* REYON BAZLI LİSTELEME */}
      {cart.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🛒</Text>
          <Text style={styles.emptyTitle}>Sepetiniz Boş</Text>
          <Text style={styles.emptySubtitle}>Alışveriş listenizde henüz ürün bulunmuyor.</Text>
        </View>
      ) : (
        categories.map(cat => {
          const categoryItems = cart.filter(i => i.category === cat);
          if (categoryItems.length === 0) return null;

          // Bu kategorideki tüm ürünlerin seçili olup olmadığını kontrol et
          const isCategoryAllChecked = categoryItems.every(i => i.checked);

          return (
            <View key={cat} style={styles.categoryCard}>
              {/* KATEGORİ BAŞLIĞI VE REYON CHECKBOX'I */}
              <View style={styles.categoryHeaderRow}>
                <Text style={styles.categoryTitleText}>
                  {getCategoryIcon(cat)} {cat} ({categoryItems.length})
                </Text>
                
                <TouchableOpacity 
                  style={{ flexDirection: 'row', alignItems: 'center', padding: 4 }}
                  onPress={() => toggleCategoryCartItems(cat, !isCategoryAllChecked)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, isCategoryAllChecked && styles.checkboxActive]}>
                    <Text style={{ color: isCategoryAllChecked ? '#fff' : '#aaa', fontWeight: 'bold', fontSize: 11 }}>
                      {isCategoryAllChecked ? '✓' : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* ÜRÜNLER LİSTESİ */}
              {categoryItems.map(item => (
                <View key={item.id} style={styles.itemRow}>
                  <TouchableOpacity 
                    style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                    onPress={() => toggleCartItem(item.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.checkbox, item.checked && styles.checkboxActive]}>
                      <Text style={{ color: item.checked ? '#fff' : '#aaa', fontWeight: 'bold', fontSize: 12 }}>
                        {item.checked ? '✓' : ''}
                      </Text>
                    </View>
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text style={[styles.itemName, item.checked && styles.itemCheckedName]}>
                        {item.name}
                      </Text>
                      <Text style={styles.itemQty}>{item.quantity || '1 Adet / Paket'}</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.editQtyBtn}
                    onPress={() => setEditingItem(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#1A1A1A' }}>✏️ Miktar</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          );
        })
      )}

      {/* MİKTAR / GRAMAJ DÜZENLEME MODALI */}
      <Modal visible={!!editingItem} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>✏️ Miktar / Paket Düzenle</Text>
            <Text style={{ fontSize: 13, color: '#4A5568', fontWeight: '700', marginVertical: 8, textAlign: 'center' }}>
              {editingItem?.name}
            </Text>

            <TextInput
              style={styles.modalInput}
              value={editingItem?.quantity}
              onChangeText={(val) => editingItem && setEditingItem({ ...editingItem, quantity: val })}
              placeholder="Örn: 500 Gram, 2 Paket"
              placeholderTextColor="#A0AEC0"
            />

            <TouchableOpacity 
              style={styles.saveModalBtn}
              onPress={() => {
                if (editingItem) {
                  updateCartItemQuantity(editingItem.id, editingItem.quantity);
                  setEditingItem(null);
                }
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.saveModalBtnText}>Kaydet</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  scrollContent: { paddingTop: 54, paddingHorizontal: 18, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '900', color: '#1A1A1A', letterSpacing: -0.5, textAlign: 'center', marginBottom: 6 },
  
  summaryBadgeBox: { alignItems: 'center', marginBottom: 14 },
  summaryBadgeText: { fontSize: 12, color: '#6C757D', fontWeight: '600', backgroundColor: '#EDF2F7', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },

  addBox: { backgroundColor: '#FFFFFF', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#E9ECEF', elevation: 1, marginBottom: 12, gap: 8 },
  inputName: { backgroundColor: '#F8F9FA', borderWidth: 1, borderColor: '#E9ECEF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#1A1A1A', fontWeight: '500' },
  inputQty: { backgroundColor: '#F8F9FA', borderWidth: 1, borderColor: '#E9ECEF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#1A1A1A', fontWeight: '500' },
  addBtn: { backgroundColor: '#1A1A1A', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  addBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

  actionRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  actionSubBtn: { flex: 1, backgroundColor: '#1A1A1A', paddingVertical: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actionSubBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },

  clearBtn: { backgroundColor: '#FCE8E6', borderWidth: 1, borderColor: '#F87171', padding: 10, borderRadius: 10, alignItems: 'center', marginBottom: 14 },
  clearBtnText: { color: '#9B1C1C', fontWeight: '700', fontSize: 12 },

  categoryCard: { backgroundColor: '#FFFFFF', padding: 14, borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E9ECEF', elevation: 1 },
  categoryHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#E9ECEF', paddingBottom: 6 },
  categoryTitleText: { fontSize: 13, fontWeight: '800', color: '#1A1A1A' },

  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F8F9FA' },
  itemName: { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
  itemCheckedName: { color: '#ADB5BD', textDecorationLine: 'line-through' },
  itemQty: { fontSize: 11, color: '#6C757D', fontWeight: '500', marginTop: 1 },

  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: '#CED4DA', justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  editQtyBtn: { backgroundColor: '#F8F9FA', borderWidth: 1, borderColor: '#E9ECEF', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  emptyIcon: { fontSize: 44, marginBottom: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#1A1A1A', marginBottom: 4 },
  emptySubtitle: { fontSize: 12, color: '#6C757D', textAlign: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  modalContainer: { width: '100%', backgroundColor: '#FFFFFF', padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#E9ECEF', elevation: 5 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#1A1A1A', textAlign: 'center' },
  modalInput: { backgroundColor: '#F8F9FA', borderWidth: 1, borderColor: '#E9ECEF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, width: '100%', marginVertical: 12, color: '#1A1A1A', fontWeight: '500' },
  saveModalBtn: { backgroundColor: '#1A1A1A', paddingVertical: 12, borderRadius: 10, alignItems: 'center', width: '100%' },
  saveModalBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 }
});
