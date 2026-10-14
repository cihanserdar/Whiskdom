import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '../constants/Colors';
import { sendPasswordResetEmail, signInWithEmail, signInWithGoogle, signUpWithEmail } from '../services/auth';

export default function LoginScreen() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const toggleAuthMode = () => {
    setIsSignUp((prev) => !prev);
    setFullName('');
    setEmail('');
    setPassword('');
  };

  const handleEmailAuth = async () => {
    if (!email || !password || (isSignUp && !fullName)) {
      Alert.alert('Hata', 'Lütfen tüm alanları doldurun.');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password, fullName);
        Alert.alert(
          'Doğrulama E-postası Gönderildi 📧',
          'Hesabınızı aktifleştirmek için lütfen e-posta adresinize gelen doğrulama bağlantısına tıklayın.',
          [
            {
              text: 'Tamam',
              onPress: () => toggleAuthMode(),
            },
          ]
        );
      } else {
        await signInWithEmail(email, password);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';

      if (
        errorMessage.includes('invalid login credentials') ||
        errorMessage.includes('user not found') ||
        errorMessage.includes('invalid_grant')
      ) {
        Alert.alert(
          'Hesap Bulunamadı veya Bilgiler Hatalı 🔍',
          'Girdiğiniz e-posta adresiyle kayıtlı bir hesap bulunamadı veya şifreniz hatalı. Kaydolmak ister misiniz?',
          [
            { text: 'Tekrar Dene', style: 'cancel' },
            {
              text: 'Kaydol',
              style: 'default',
              onPress: () => {
                if (!isSignUp) toggleAuthMode();
              },
            },
          ]
        );
      } else {
        const fallbackMsg = error instanceof Error ? error.message : 'Bir hata oluştu.';
        Alert.alert('Giriş Hatası', fallbackMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Giriş yapılamadı.';
      Alert.alert('Google Giriş Hatası', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.alert(
      'Şifrenizi mi Unuttunuz? 🔒',
      'Şifrenizi sıfırlamak için lütfen kayıtlı e-posta adresinizi girin:',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Bağlantı Gönder',
          onPress: async (inputEmail?: string) => {
            const targetEmail = inputEmail || email;
            if (!targetEmail) {
              Alert.alert('Hata', 'Lütfen e-posta adresinizi girin.');
              return;
            }
            try {
              setLoading(true);
              await sendPasswordResetEmail(targetEmail);
              Alert.alert('E-posta Gönderildi 📩', 'Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.');
            } catch (err: unknown) {
              const errMsg = err instanceof Error ? err.message : 'Sıfırlama e-postası gönderilemedi.';
              Alert.alert('Hata ❌', errMsg);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.logo}>🍳 Whiskdom</Text>
          <Text style={styles.subtitle}>Mutfakta İsrafa Son Verin</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {isSignUp ? 'Hesap Oluştur' : 'Giriş Yap'}
          </Text>

          {isSignUp && (
            <TextInput
              style={styles.input}
              placeholder="Ad Soyad"
              placeholderTextColor="#A0AEC0"
              autoCapitalize="words"
              value={fullName}
              onChangeText={setFullName}
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="E-posta Adresi"
            placeholderTextColor="#A0AEC0"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <TextInput
            style={styles.input}
            placeholder="Şifre"
            placeholderTextColor="#A0AEC0"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {!isSignUp && (
            <TouchableOpacity style={styles.forgotPasswordBtn} onPress={handleForgotPassword}>
              <Text style={styles.forgotPasswordText}>Şifrenizi mi unuttunuz?</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleEmailAuth}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.primaryBtnText}>
                {isSignUp ? 'Kaydol' : 'E-posta ile Giriş Yap'}
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>VEYA</Text>
            <View style={styles.divider} />
          </View>

          <TouchableOpacity
            style={styles.googleBtn}
            onPress={handleGoogleAuth}
            disabled={loading}
          >
            <Text style={styles.googleIcon}>🌐</Text>
            <Text style={styles.googleBtnText}>Google ile Devam Et</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchAuthBtn}
            onPress={toggleAuthMode}
          >
            <Text style={styles.switchAuthText}>
              {isSignUp ? (
                <>
                  Zaten hesabınız var mı?{' '}
                  <Text style={styles.switchAuthHighlight}>Giriş Yapın</Text>
                </>
              ) : (
                <>
                  Hesabınız yok mu?{' '}
                  <Text style={styles.switchAuthHighlight}>Kaydolun</Text>
                </>
              )}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: {
    fontSize: 38,
    fontWeight: '900',
    color: Colors.white,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.accent,
    marginTop: 6,
    fontWeight: '500',
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 24,
    elevation: 8,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.primary,
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.textDark,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
  },
  forgotPasswordBtn: {
    alignSelf: 'flex-end',
    marginBottom: 14,
    marginTop: -4,
  },
  forgotPasswordText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '700',
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    marginHorizontal: 12,
    color: '#888',
    fontSize: 12,
    fontWeight: '700',
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 14,
    borderRadius: 12,
  },
  googleIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  googleBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textDark,
  },
  switchAuthBtn: {
    marginTop: 20,
    alignItems: 'center',
  },
  switchAuthText: {
    fontSize: 14,
    color: Colors.grayText,
  },
  switchAuthHighlight: {
    color: Colors.primary,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
});