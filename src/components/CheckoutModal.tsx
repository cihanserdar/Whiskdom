import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

interface CheckoutModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CheckoutModal({ visible, onClose, onSuccess }: CheckoutModalProps) {
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    if (!cardNumber || !expiry || !cvv || !cardHolder) {
      Alert.alert('Eksik Bilgi', 'Lütfen tüm kart bilgilerini eksiksiz doldurun.');
      return;
    }

    setLoading(true);

    // Gerçekçi bir ödeme gecikmesi simülasyonu (2 saniye)
    setTimeout(async () => {
      try {
        const stored = await AsyncStorage.getItem('@whiskdom_user_quota_v1');
        if (stored) {
          const data = JSON.parse(stored);
          data.tier = 'pro';
          await AsyncStorage.setItem('@whiskdom_user_quota_v1', JSON.stringify(data));
        } else {
          const initialData = {
            tier: 'pro',
            aiRecipeUsed: 0,
            receiptUsed: 0,
            lastResetDate: new Date().toISOString().split('T')[0],
          };
          await AsyncStorage.setItem('@whiskdom_user_quota_v1', JSON.stringify(initialData));
        }

        setLoading(false);
        Alert.alert('Ödeme Başarılı! 🎉', 'Whiskdom Pro aboneliğiniz aktif edilmiştir. İyi mutfaklar!');
        onSuccess();
        onClose();
      } catch (error) {
        setLoading(false);
        Alert.alert('Hata', 'Ödeme işlenirken bir sorun oluştu.');
      }
    }, 2000);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.container}>
        {/* ÜST BAR */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Güvenli Ödeme 🔒</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* ÜRÜN ÖZET KARTI */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryBadge}>👑 PRO ABONELİK</Text>
            <Text style={styles.summaryTitle}>Whiskdom Pro Sınırsız Paket</Text>
            <Text style={styles.summaryDesc}>Sınırsız AI Şef, Fiş Tarama ve Öncelikli Özellikler</Text>
            <View style={styles.divider} />
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Toplam Tutar:</Text>
              <Text style={styles.priceValue}>₺99.99 / ay</Text>
            </View>
          </View>

          {/* KART BİLGİLERİ FORMU */}
          <View style={styles.formContainer}>
            <Text style={styles.sectionTitle}>💳 Kart Bilgileri</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Kart Üzerindeki İsim</Text>
              <TextInput
                style={styles.input}
                placeholder="Ad Soyad"
                placeholderTextColor="#A0AEC0"
                value={cardHolder}
                onChangeText={setCardHolder}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Kart Numarası</Text>
              <TextInput
                style={styles.input}
                placeholder="4532 •••• •••• ••••"
                placeholderTextColor="#A0AEC0"
                keyboardType="numeric"
                maxLength={19}
                value={cardNumber}
                onChangeText={setCardNumber}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Son Kul. Tarihi</Text>
                <TextInput
                  style={styles.input}
                  placeholder="AA/YY"
                  placeholderTextColor="#A0AEC0"
                  maxLength={5}
                  value={expiry}
                  onChangeText={setExpiry}
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>CVV / CVC</Text>
                <TextInput
                  style={styles.input}
                  placeholder="123"
                  placeholderTextColor="#A0AEC0"
                  keyboardType="numeric"
                  secureTextEntry
                  maxLength={4}
                  value={cvv}
                  onChangeText={setCvv}
                />
              </View>
            </View>
          </View>

          {/* GÜVENLİK BİLGİSİ */}
          <View style={styles.securityInfo}>
            <Text style={styles.securityText}>🛡️ 256-bit SSL Güvenli Şifreleme ile korunmaktadır.</Text>
          </View>

          {/* ÖDEMEYİ TAMAMLA BUTONU */}
          <TouchableOpacity
            style={[styles.payButton, loading && { opacity: 0.7 }]}
            onPress={handlePayment}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.payButtonText}>Ödemeyi Tamamla ve Pro Ol 🚀</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 54, paddingBottom: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E9ECEF' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F3F5', justifyContent: 'center', alignItems: 'center' },
  closeText: { fontSize: 16, fontWeight: '800', color: '#1A1A1A' },
  headerTitle: { fontSize: 16, fontWeight: '900', color: '#1A1A1A' },
  scrollContent: { padding: 20 },
  summaryCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#E9ECEF', marginBottom: 20, elevation: 1 },
  summaryBadge: { backgroundColor: '#F3E8FF', color: '#7E22CE', fontWeight: '900', fontSize: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 8, overflow: 'hidden' },
  summaryTitle: { fontSize: 16, fontWeight: '900', color: '#1A1A1A', marginBottom: 4 },
  summaryDesc: { fontSize: 12, color: '#6C757D', lineHeight: 16 },
  divider: { height: 1, backgroundColor: '#E9ECEF', marginVertical: 14 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { fontSize: 13, fontWeight: '700', color: '#4A5568' },
  priceValue: { fontSize: 18, fontWeight: '900', color: '#7E22CE' },
  formContainer: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#E9ECEF', marginBottom: 16, elevation: 1 },
  sectionTitle: { fontSize: 14, fontWeight: '900', color: '#1A1A1A', marginBottom: 14 },
  inputGroup: { marginBottom: 12 },
  label: { fontSize: 11, fontWeight: '700', color: '#4A5568', marginBottom: 4 },
  input: { backgroundColor: '#F8F9FA', borderRadius: 10, paddingHorizontal: 12, height: 42, fontSize: 13, color: '#1A1A1A', borderWidth: 1, borderColor: '#E9ECEF', fontWeight: '600' },
  row: { flexDirection: 'row', gap: 10 },
  securityInfo: { alignItems: 'center', marginBottom: 20 },
  securityText: { fontSize: 11, color: '#6C757D', fontWeight: '600' },
  payButton: { backgroundColor: '#7E22CE', height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  payButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
});