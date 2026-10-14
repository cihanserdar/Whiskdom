import { Tabs } from 'expo-router';
import { useContext, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Colors } from '../constants/Colors';
import { AppContext, AppProvider } from '../context/AppContext';
import { supabase } from '../services/supabase';
import LoginScreen from './login';

function MainTabsNavigator() {
  const { user, loading, isPasswordRecovery, setIsPasswordRecovery } = useContext(AppContext);
  const [newPassword, setNewPassword] = useState('');

  const handleGlobalChangePassword = async () => {
    if (!newPassword) {
      Alert.alert("Hata", "Lütfen yeni şifrenizi girin.");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Hata", "Yeni şifre en az 6 karakter olmalıdır.");
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setNewPassword('');
      setIsPasswordRecovery(false);
      Alert.alert("Başarılı 🔒", "Şifreniz güvenli bir şekilde güncellendi.");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Şifre güncellenirken bir sorun oluştu.";
      Alert.alert("Hata ❌", errorMessage);
    }
  };

  // 1. Supabase Oturum Bilgisi Yükleniyorsa Beklet
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.inputBg }}>
        <ActivityIndicator size="large" color={Colors.textDark} />
      </View>
    );
  }

  // 2. Kullanıcı Giriş Yapmadıysa Doğrudan Giriş Ekranını Aç
  if (!user) {
    return <LoginScreen />;
  }

  // 3. Oturum Açıldıysa Sekmeleri Yükle
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.inactiveTab,
          tabBarStyle: {
            paddingBottom: 5,
            height: 60,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Envanter',
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🍏</Text>,
          }}
        />

        <Tabs.Screen
          name="recipes"
          options={{
            title: 'Tarifler',
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🍳</Text>,
          }}
        />

        <Tabs.Screen
          name="cart"
          options={{
            title: 'Sepetim',
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🛒</Text>,
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profilim',
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>👤</Text>,
          }}
        />

        {/* ALT MENÜDE GİZLENEN ROTALAR */}
        <Tabs.Screen
          name="login"
          options={{
            href: null,
          }}
        />

        <Tabs.Screen
          name="reset-password"
          options={{
            href: null,
          }}
        />
      </Tabs>

      {/* ŞİFRE SIFIRLAMA MODALI */}
      <Modal visible={isPasswordRecovery} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>🔒 Yeni Şifre Belirle</Text>
            <Text style={styles.modalSubtitle}>Şifre sıfırlama bağlantınız doğrulandı. Lütfen yeni şifrenizi girin.</Text>
            
            <View style={{ width: '100%', marginVertical: 12 }}>
              <Text style={styles.inputLabel}>Yeni Şifre (En az 6 karakter):</Text>
              <TextInput
                style={styles.modalInput}
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Yeni şifreniz"
                placeholderTextColor="#A0AEC0"
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 10, width: '100%', marginTop: 10 }}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: Colors.border }]}
                onPress={() => {
                  setNewPassword('');
                  setIsPasswordRecovery(false);
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.modalBtnText, { color: Colors.textDark }]}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: Colors.primary }]}
                onPress={handleGlobalChangePassword}
                activeOpacity={0.8}
              >
                <Text style={styles.modalBtnText}>Güncelle</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function RootLayout() {
  return (
    <AppProvider>
      <MainTabsNavigator />
    </AppProvider>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  modalContainer: { width: '100%', backgroundColor: Colors.white, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, elevation: 5 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: Colors.textDark, marginBottom: 4, textAlign: 'center' },
  modalSubtitle: { fontSize: 12, color: Colors.grayText, textAlign: 'center', marginBottom: 10 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: Colors.grayText, marginBottom: 6 },
  modalInput: { backgroundColor: Colors.inputBg, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: Colors.textDark, fontWeight: '500', width: '100%' },
  modalBtn: { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center' },
  modalBtnText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
});