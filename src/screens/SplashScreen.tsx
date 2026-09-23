import { useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

interface SplashScreenProps {
  onFinish?: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const [email, setEmail] = useState('');
  const [isEmailLoginMode, setIsEmailLoginMode] = useState(false);

  const handleEmailLogin = () => {
    if (!email.trim() || !email.includes('@')) {
      Alert.alert("Hata", "Lütfen geçerli bir e-posta adresi girin.");
      return;
    }
    if (onFinish) onFinish();
  };

  const handleGoogleLogin = () => {
    Alert.alert("Başarılı 🎉", "Google hesabı ile giriş yapıldı.");
    if (onFinish) onFinish();
  };

  return (
    <View style={styles.container}>
      <View style={styles.contentBox}>
        
        {/* MARKA BÖLÜMÜ */}
        <Text style={styles.brandTitle}>WHISKDOM</Text>
        <Text style={styles.brandSubtitle}>Teknolojinin Bilgelikle Harmanlandığı Mutfak Asistanı</Text>
        
        <View style={styles.badgePill}>
          <Text style={styles.badgeText}>Akıllı Mutfak & Sıfır İsraf</Text>
        </View>

        {/* GİRİŞ SEÇENEKLERİ */}
        <View style={styles.authContainer}>
          {isEmailLoginMode ? (
            <View style={styles.emailBox}>
              <TextInput 
                style={styles.input}
                placeholder="E-posta adresinizi girin"
                placeholderTextColor="#a3b8a4"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.primaryButton} onPress={handleEmailLogin} activeOpacity={0.8}>
                <Text style={styles.primaryButtonText}>Devam Et</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setIsEmailLoginMode(false)} activeOpacity={0.7}>
                <Text style={styles.backText}>← Geri Dön</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ width: '100%', gap: 12 }}>
              {/* GOOGLE İLE DEVAM ET (Harici paket gerektirmeyen şık tasarım) */}
              <TouchableOpacity style={styles.googleButton} onPress={handleGoogleLogin} activeOpacity={0.85}>
                <View style={styles.googleIconCircle}>
                  <Text style={styles.googleGText}>G</Text>
                </View>
                <Text style={styles.googleButtonText}>Google ile Devam Et</Text>
              </TouchableOpacity>

              {/* E-POSTA İLE GİRİŞ */}
              <TouchableOpacity style={styles.emailButton} onPress={() => setIsEmailLoginMode(true)} activeOpacity={0.85}>
                <Text style={styles.emailButtonText}>✉️ E-posta ile Giriş Yap</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F3814',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  contentBox: {
    width: '100%',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 40,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 6,
    marginBottom: 8,
    textAlign: 'center',
  },
  brandSubtitle: {
    fontSize: 13,
    color: '#c8e6c9',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
    fontWeight: '500',
  },
  badgePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    marginBottom: 40,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  authContainer: {
    width: '100%',
    alignItems: 'center',
  },
  googleButton: {
    width: '100%',
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  googleIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f1f3f4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  googleGText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#4285F4',
  },
  googleButtonText: {
    color: '#1A1A1A',
    fontSize: 14,
    fontWeight: '700',
  },
  emailButton: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  emailButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  emailBox: {
    width: '100%',
    gap: 12,
  },
  input: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#ffffff',
    fontSize: 14,
  },
  primaryButton: {
    width: '100%',
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#0F3814',
    fontSize: 14,
    fontWeight: '800',
  },
  backText: {
    color: '#c8e6c9',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
});