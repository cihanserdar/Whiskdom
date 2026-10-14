import AsyncStorage from '@react-native-async-storage/async-storage';
import { useContext, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet, Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Colors } from '../constants/Colors';
import { AppContext } from '../context/AppContext';
import { sendPasswordResetEmail } from '../services/auth';
import { sendBadgeUnlockedNotification } from '../services/notificationService';
import { supabase } from '../services/supabase';

const AVAILABLE_DIETS = ['Vegan', 'Vejetaryen', 'Ketojenik', 'Glutensiz', 'Rafine Şekersiz', 'Yüksek Protein'];
const AVAILABLE_ALLERGENS = ['Gluten', 'Laktoz / Süt', 'Yumurta', 'Kabuklu Deniz Ürünleri', 'Kuruyemiş', 'Soya'];
const NOTIFIED_BADGES_KEY = '@whiskdom_notified_badges';

interface BadgeDetail {
  id: string;
  icon: string;
  name: string;
  unlocked: boolean;
  unlockedDate?: string;
  description: string;
  requirement: string;
  grantsTitle: string;
}

export default function ProfileScreen() {
  const context = useContext(AppContext);

  const user = context?.user;
  const userProfile = context?.userProfile || { name: 'Kullanıcı', email: '', title: 'Çırak Şef 🍳', activeTitle: 'Çırak Şef 🍳', avatarUrl: '', tier: 'free' };
  const setUserProfile = context?.setUserProfile || (() => {});
  const userPreferences = context?.userPreferences || { diets: [], allergens: [] };
  const setUserPreferences = context?.setUserPreferences || (() => {});
  const inventory = context?.inventory || [];
  const favorites = context?.favorites || [];
  const history = context?.history || [];
  const wasteStats = context?.wasteStats || { savedCount: 0, wastedCount: 0 };
  const logout = context?.logout || (() => {});
  const isPasswordRecovery = context?.isPasswordRecovery || false;
  const setIsPasswordRecovery = context?.setIsPasswordRecovery || (() => {});

  const [userXp, setUserXp] = useState<number>(0); 
  const [totalCooked, setTotalCooked] = useState<number>(0); 

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [prefModalVisible, setPrefModalVisible] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<BadgeDetail | null>(null);
  const [aboutModalVisible, setAboutModalVisible] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [badgesExpanded, setBadgesExpanded] = useState(false);
  
  const [checkoutModalVisible, setCheckoutModalVisible] = useState(false);
  const userTier = userProfile.tier || 'free';

  const [nameInput, setNameInput] = useState(userProfile.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const savedCount = wasteStats.savedCount || 0;
  const wastedCount = wasteStats.wastedCount || 0;
  const totalItemsCount = savedCount + wastedCount;
  const successPercentage = totalItemsCount > 0 
    ? Math.round((savedCount / totalItemsCount) * 100) 
    : 100;

  const historyLen = history.length;
  const favoritesLen = favorites.length;

  useEffect(() => {
    const syncUserDataWithSupabase = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          const { data, error } = await supabase
            .from('profiles')
            .select('xp, total_cooked')
            .eq('id', authUser.id)
            .single();

          if (!error && data) {
            if (data.xp !== undefined && data.xp !== null) {
              setUserXp(data.xp);
            }
            const currentHistoryCount = history.length;
            if (data.total_cooked !== currentHistoryCount) {
              await supabase
                .from('profiles')
                .update({ 
                  total_cooked: currentHistoryCount,
                })
                .eq('id', authUser.id);
              
              setTotalCooked(currentHistoryCount);
            } else {
              setTotalCooked(data.total_cooked);
            }
          }
        }
      } catch (err) {
        // Sessizce geçilir
      }
    };

    syncUserDataWithSupabase();
  }, [history.length]);

  const badges: BadgeDetail[] = [
    {
      id: 'cirak_sef',
      icon: '🍳',
      name: 'Çırak Şef',
      unlocked: true,
      unlockedDate: '10.09.2026',
      description: 'Whiskdom mutfağına ilk adımını atan ve yolculuğa başlayan aday şeflere verilir.',
      requirement: 'Gereksinim: Uygulamaya ilk giriş yapmak.',
      grantsTitle: 'Çırak Şef 🍳'
    },
    {
      id: 'usta_sef',
      icon: '👨‍🍳',
      name: 'Usta Şef',
      unlocked: historyLen >= 3,
      unlockedDate: historyLen >= 3 ? '10.09.2026' : undefined,
      description: 'En az 3 farklı tarifi başarıyla pişiren ve mutfağında aktif olan şeflere verilir.',
      requirement: `Gereksinim: En az 3 tarif pişirmek. (Şu anki durum: ${historyLen}/3)`,
      grantsTitle: 'Master Mutfak Şefi 👨‍🍳'
    },
    {
      id: 'yesil_mutfak',
      icon: '🌱',
      name: 'Yeşil Mutfak',
      unlocked: savedCount >= 10,
      unlockedDate: savedCount >= 10 ? '10.09.2026' : undefined,
      description: 'Gıdalarını ziyan etmeden zamanında pişirerek 10 veya daha fazla ürünü israftan kurtaran doğa dostu şampiyonlara verilir.',
      requirement: `Gereksinim: 10 ürün kurtarmak. (Şu anki durum: ${savedCount}/10)`,
      grantsTitle: 'Sürdürülebilirlik Uzmanı 🌱'
    },
    {
      id: 'sifir_atik',
      icon: '♻',
      name: 'Sıfır Atık Gurusu',
      unlocked: savedCount >= 20,
      unlockedDate: savedCount >= 20 ? '12.09.2026' : undefined,
      description: 'Mutfakta hiçbir gıdayı ziyan etmeyerek tam 20 ürünü israftan kurtaran üst düzey çevreci şef unvanı.',
      requirement: `Gereksinim: 20 ürün kurtarmak. (Şu anki durum: ${savedCount}/20)`,
      grantsTitle: 'Sıfır Atık Gurusu ♻'
    },
    {
      id: 'simyaci',
      icon: '🧪',
      name: 'Buzdolabı Simyacısı',
      unlocked: favoritesLen >= 5,
      unlockedDate: favoritesLen >= 5 ? '12.09.2026' : undefined,
      description: 'Kısıtlı malzemelerle en yaratıcı kombinasyonları bularak 5 farklı favori tarif oluşturan dahi şef.',
      requirement: `Gereksinim: En az 5 favori tarif biriktirmek. (Şu anki durum: ${favoritesLen}/5)`,
      grantsTitle: 'Simyacı Baş Aşçı 🧪'
    },
    {
      id: 'yildizli_gurme',
      icon: '🌟',
      name: 'Yıldızlı Gurme',
      unlocked: historyLen >= 10,
      unlockedDate: undefined,
      description: 'Mutfağından ödün vermeyerek toplamda 10 veya daha fazla tarif pişiren efsanevi şef.',
      requirement: `Gereksinim: 10 tarif pişirmek. (Şu anki durum: ${historyLen}/10)`,
      grantsTitle: 'Yıldızlı Gurme 🌟'
    }
  ];

  useEffect(() => {
    if (isPasswordRecovery) {
      setPasswordModalVisible(true);
    }
  }, [isPasswordRecovery]);

  useEffect(() => {
    const checkBadgeNotifications = async () => {
      try {
        const storedNotified = await AsyncStorage.getItem(NOTIFIED_BADGES_KEY);
        const notifiedList: string[] = storedNotified ? JSON.parse(storedNotified) : ['cirak_sef'];

        for (const badge of badges) {
          if (badge.unlocked && !notifiedList.includes(badge.id)) {
            await sendBadgeUnlockedNotification(badge.name, badge.grantsTitle);
            notifiedList.push(badge.id);
          }
        }
        await AsyncStorage.setItem(NOTIFIED_BADGES_KEY, JSON.stringify(notifiedList));
      } catch (error) {
        // Sessizce geçilir
      }
    };

    checkBadgeNotifications();
  }, [savedCount, historyLen, favoritesLen]);

  const currentActiveTitle = userProfile.activeTitle || userProfile.title || 'Çırak Şef 🍳';

  const handleEquipTitle = (badge: BadgeDetail) => {
    if (!badge.unlocked) {
      Alert.alert("Kilitli Rozet", "Henüz açmadığınız bir rozetin unvanını kuşanamazsınız!");
      return;
    }
    
    setUserProfile({
      ...userProfile,
      title: badge.grantsTitle,
      activeTitle: badge.grantsTitle
    });

    setSelectedBadge(null);
    Alert.alert("Unvan Güncellendi! 👑", `Yeni şef unvanınız: ${badge.grantsTitle}`);
  };

  const handleSupportEmail = () => {
     Linking.openURL('mailto:destek@whiskdom.app?subject=Whiskdom%20Destek');
  };

  const handleRateApp = () => {
    Linking.openURL('https://play.google.com/store/apps/details?id=com.whiskdom.mobile').catch(() => {});
  };

  const handleSaveProfile = () => {
    if (!nameInput.trim()) {
      Alert.alert("Hata", "İsim alanı boş bırakılamaz.");
      return;
    }
    setUserProfile({
      ...userProfile,
      name: nameInput,
    });
    setEditModalVisible(false);
    Alert.alert("Başarılı! 👤", "Profil adınız güncellendi.");
  };

  const handlePasswordMenuPress = () => {
    setTimeout(() => {
      if (isPasswordRecovery) {
        setPasswordModalVisible(true);
        return;
      }

      const isGoogleUser = user?.app_metadata?.provider === 'google' || 
                           user?.app_metadata?.providers?.includes('google');

      if (isGoogleUser) {
        Alert.alert(
          "Şifre Oluştur 🔒",
          `Google hesabınız (${userProfile?.email || user?.email}) ile bağlısınız. Hesabınıza e-posta ve şifre ile de giriş yapabilmek için e-postanıza bir şifre belirleme bağlantısı gönderilsin mi?`,
          [
            { text: "İptal", style: "cancel" },
            {
              text: "Bağlantı Gönder",
              onPress: async () => {
                try {
                  const emailToSend = userProfile?.email || user?.email;
                  if (!emailToSend) throw new Error("E-posta adresi bulunamadı.");
                  await sendPasswordResetEmail(emailToSend);
                  Alert.alert("E-posta Gönderildi 📩", "Lütfen e-posta kutunuzu kontrol edin ve gelen bağlantıya tıklayın.");
                } catch (err: unknown) {
                  const errorMsg = err instanceof Error ? err.message : "Bağlantı gönderilemedi.";
                  Alert.alert("Hata ❌", errorMsg);
                }
              }
            }
          ]
        );
      } else {
        setPasswordModalVisible(true);
      }
    }, 0);
  };

  const handleChangePassword = async () => {
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

      setPasswordModalVisible(false);
      setCurrentPassword('');
      setNewPassword('');
      setIsPasswordRecovery(false); 
      Alert.alert("Başarılı 🔒", "Şifreniz güvenli bir şekilde güncellendi.");
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : "Şifre güncellenirken bir sorun oluştu.";
      Alert.alert("Hata ❌", errorMsg);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Oturumu Kapat",
      "Hesabınızdan çıkış yapmak istediğinize emin misiniz?",
      [
        { text: "İptal", style: "cancel" },
        { 
          text: "Çıkış Yap", 
          style: "destructive", 
          onPress: () => {
            logout();
          } 
        }
      ] 
    );
  };

  const handleToggleDiet = (diet: string) => {
    const diets = userPreferences.diets || [];
    const isSelected = diets.includes(diet);
    const updatedDiets = isSelected 
      ? diets.filter(d => d !== diet)
      : [...diets, diet];
    setUserPreferences({ ...userPreferences, diets: updatedDiets });
  };

  const handleToggleAllergen = (allergen: string) => {
    const allergens = userPreferences.allergens || [];
    const isSelected = allergens.includes(allergen);
    const updatedAllergens = isSelected 
      ? allergens.filter(a => a !== allergen)
      : [...allergens, allergen];
    setUserPreferences({ ...userPreferences, allergens: updatedAllergens });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.screenTitle}>👤 Whiskdom Profilim</Text>

      {/* KULLANICI KARTI */}
      <View style={styles.profileCard}>
        <Image source={{ uri: userProfile.avatarUrl || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' }} style={styles.avatar} />
        <View style={styles.profileInfo}>
          <Text style={styles.userName}>{userProfile.name}</Text>
          <Text style={styles.userTitle}>{currentActiveTitle}</Text>
          <Text style={styles.userEmail}>{userProfile.email}</Text>
        </View>
        <TouchableOpacity style={styles.editBtn} onPress={() => setEditModalVisible(true)} activeOpacity={0.8}>
          <Text style={{ fontSize: 16 }}>✏️</Text>
        </TouchableOpacity>
      </View>

      {/* PRO PAKET WIDGET'I */}
      <TouchableOpacity 
        style={[styles.proWidgetCard, userTier === 'pro' && styles.proWidgetActive]} 
        onPress={() => setCheckoutModalVisible(true)}
        activeOpacity={0.85}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 24 }}>👑</Text>
            <View>
              <Text style={styles.proWidgetTitle}>Whiskdom Pro ✨</Text>
              <Text style={styles.proWidgetSubTitle}>Bol Hak ve Özel Özellikler</Text>
            </View>
          </View>
          <Text style={{ fontSize: 16, fontWeight: '800', color: Colors.textDark }}>›</Text>
        </View>
      </TouchableOpacity>

      {/* MUTFAK TASARRUF ÖZETİ */}
      <View style={styles.wasteSummaryCard}>
        <View style={styles.wasteHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 15 }}>🌱</Text>
            <Text style={styles.wasteCardTitle}>Mutfak Tasarruf Özeti</Text>
          </View>
          <View style={styles.successBadge}>
            <Text style={styles.successBadgeText}>Başarı: %{successPercentage}</Text>
          </View>
        </View>

        <View style={styles.wasteStatsRow}>
          <View style={styles.wasteStatItem}>
            <Text style={styles.wasteSavedNumber}>🌱 {savedCount}</Text>
            <Text style={styles.wasteStatLabel}>Kurtarılan Ürün</Text>
          </View>

          <View style={styles.verticalDivider} />

          <View style={styles.wasteStatItem}>
            <Text style={styles.wasteWastedNumber}>🗑️ {wastedCount}</Text>
            <Text style={styles.wasteStatLabel}>Ziyan Olan</Text>
          </View>
        </View>

        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${successPercentage}%` }]} />
        </View>
      </View>

      {/* İSTATİSTİKLER */}
      <Text style={styles.sectionHeader}>📊 Mutfak İstatistikleri</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statGridBox}>
          <Text style={styles.gridNumber}>🍏 {inventory.length}</Text>
          <Text style={styles.gridLabel}>Dolaptaki Ürün</Text>
        </View>
        <View style={styles.statGridBox}>
          <Text style={styles.gridNumber}>❤️ {favorites.length}</Text>
          <Text style={styles.gridLabel}>Favori Tarif</Text>
        </View>
        <View style={styles.statGridBox}>
          <Text style={styles.gridNumber}>👨‍🍳 {totalCooked}</Text>
          <Text style={styles.gridLabel}>Pişirilen Tarif</Text>
        </View>
        <View style={styles.statGridBox}>
          <Text style={[styles.gridNumber, { color: '#7E22CE' }]}>⭐ {userXp}</Text>
          <Text style={styles.gridLabel}>Şef Puanı (XP)</Text>
        </View>
      </View>

      {/* ROZETLER */}
      <View style={styles.badgeSectionHeaderRow}>
        <Text style={styles.sectionHeader}>🏆 Mutfak Rozetlerim & Unvanlar</Text>
        <TouchableOpacity 
          onPress={() => setBadgesExpanded(!badgesExpanded)}
          activeOpacity={0.7}
          style={styles.expandToggleBtn}
        >
          <Text style={styles.expandToggleText}>
            {badgesExpanded ? 'Daha Az Gizle ▲' : `Tümünü Gör (${badges.length}) ▼`}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.badgeContainer}>
        {badges.slice(0, 3).map((b, idx) => (
          <TouchableOpacity 
            key={idx} 
            activeOpacity={0.8}
            style={[styles.badgeCard, !b.unlocked && { opacity: 0.5, backgroundColor: Colors.inputBg }]}
            onPress={() => setSelectedBadge(b)}
          >
            <Text style={styles.badgeIcon}>{b.icon}</Text>
            <Text style={styles.badgeName}>{b.name}</Text>
            <Text style={[styles.badgeDesc, !b.unlocked && { color: '#ADB5BD' }]}>
              {b.unlocked ? 'Kazanıldı! 🎉' : 'Kilitli 🔒'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {badgesExpanded && (
        <View style={styles.expandedBadgeContainer}>
          <Text style={styles.challengeSubHeader}>🎯 Challenge & İleri Seviye Rozetler</Text>
          <View style={styles.badgeContainer}>
            {badges.slice(3).map((b, idx) => (
              <TouchableOpacity 
                key={idx + 3} 
                activeOpacity={0.8}
                style={[styles.badgeCard, !b.unlocked && { opacity: 0.5, backgroundColor: Colors.inputBg }]}
                onPress={() => setSelectedBadge(b)}
              >
                <Text style={styles.badgeIcon}>{b.icon}</Text>
                <Text style={styles.badgeName}>{b.name}</Text>
                <Text style={[styles.badgeDesc, !b.unlocked && { color: '#ADB5BD' }]}>
                  {b.unlocked ? 'Kazanıldı! 🎉' : 'Kilitli 🔒'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* DİYET VE ALERJEN */}
      <Text style={styles.sectionHeader}>🥗 Diyet & Alerjen Profili</Text>
      <View style={styles.prefSummaryBox}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.prefSummaryTitle}>Aktif Tercihleriniz:</Text>
          <TouchableOpacity 
            style={styles.editPrefBtn}
            onPress={() => setPrefModalVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.editPrefBtnText}>✏️ Tercihleri Düzenle</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.prefSummaryText}>
          {userPreferences.diets?.length > 0 ? `Diyetler: ${userPreferences.diets.join(', ')}` : 'Diyet kısıtlaması seçilmedi.'}
        </Text>
        <Text style={[styles.prefSummaryText, { marginTop: 4 }]}>
          {userPreferences.allergens?.length > 0 ? `Alerjenler: ${userPreferences.allergens.join(', ')}` : 'Alerjen kısıtlaması seçilmedi.'}
        </Text>
      </View>

      {/* DESTEK & GÜVENLİK */}
      <Text style={styles.sectionHeader}>📞 Destek & Güvenlik</Text>
      <View style={styles.menuGroupCard}>
        <TouchableOpacity style={styles.menuItemRow} onPress={handlePasswordMenuPress} activeOpacity={0.7}>
          <Text style={styles.menuItemText}>🔒 Şifre Değiştir / Sıfırla</Text>
          <Text style={styles.menuItemArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItemRow} onPress={handleSupportEmail} activeOpacity={0.7}>
          <Text style={styles.menuItemText}>💬 Destek & İletişim (E-posta Gönder)</Text>
          <Text style={styles.menuItemArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItemRow} onPress={handleRateApp} activeOpacity={0.7}>
          <Text style={styles.menuItemText}>⭐ Uygulamayı Değerlendir (Play Store)</Text>
          <Text style={styles.menuItemArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItemRow} onPress={() => setAboutModalVisible(true)} activeOpacity={0.7}>
          <Text style={styles.menuItemText}>ℹ️ Uygulama Hakkında (Whiskdom Nedir?)</Text>
          <Text style={styles.menuItemArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItemRow} onPress={() => setPrivacyModalVisible(true)} activeOpacity={0.7}>
          <Text style={styles.menuItemText}>🔒 Gizlilik Politikası & Koşullar</Text>
          <Text style={styles.menuItemArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuItemRow, { borderBottomWidth: 0 }]} onPress={handleLogout} activeOpacity={0.7}>
          <Text style={[styles.menuItemText, { color: '#E53E3E', fontWeight: '800' }]}>🚪 Oturumu Kapat (Çıkış Yap)</Text>
          <Text style={[styles.menuItemArrow, { color: '#E53E3E' }]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* MODALLAR */}
      <Modal visible={checkoutModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>✨ Whiskdom Pro</Text>
            <Text style={styles.aboutModalText}>
              Çok yakında hizmetinizde! 🚀
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setCheckoutModalVisible(false)} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={!!selectedBadge} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeaderRow}>
              <Text style={{ fontSize: 32 }}>{selectedBadge?.icon}</Text>
              <Text style={styles.modalTitleText}>{selectedBadge?.name}</Text>
            </View>

            <View style={[styles.badgeStatusBox, selectedBadge?.unlocked ? { backgroundColor: Colors.inputBg } : { backgroundColor: '#FCE8E6' }]}>
              <Text style={[styles.badgeStatusText, selectedBadge?.unlocked ? { color: Colors.textDark } : { color: '#9B1C1C' }]}>
                {selectedBadge?.unlocked 
                  ? `🎉 Bu rozeti ${selectedBadge.unlockedDate || 'bugün'} başardığınız için kazandınız!\nUnvan ödülü: ${selectedBadge.grantsTitle}` 
                  : '🔒 Bu rozet henüz kilitli.'}
              </Text>
            </View>

            <Text style={styles.badgeDetailDesc}>{selectedBadge?.description}</Text>
            <Text style={styles.badgeDetailReq}>{selectedBadge?.requirement}</Text>

            {selectedBadge?.unlocked && (
              <TouchableOpacity 
                style={styles.equipBtn} 
                onPress={() => handleEquipTitle(selectedBadge)} 
                activeOpacity={0.85}
              >
                <Text style={styles.equipBtnText}>👑 Bu Unvanı Kuşan (Aktif Yap)</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.primaryBtn} onPress={() => setSelectedBadge(null)} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={passwordModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>🔒 Şifre Değiştir</Text>
            <View style={{ width: '100%', marginVertical: 12, gap: 10 }}>
              {!isPasswordRecovery && (
                <View>
                  <Text style={styles.inputLabel}>Mevcut Şifre:</Text>
                  <TextInput style={styles.modalInput} secureTextEntry value={currentPassword} onChangeText={setCurrentPassword} placeholderTextColor="#A0AEC0" />
                </View>
              )}
              <View>
                <Text style={styles.inputLabel}>Yeni Şifre (En az 6 karakter):</Text>
                <TextInput style={styles.modalInput} secureTextEntry value={newPassword} onChangeText={setNewPassword} placeholderTextColor="#A0AEC0" />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, width: '100%', marginTop: 10 }}>
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: Colors.border }]} 
                onPress={() => {
                  setPasswordModalVisible(false);
                  setIsPasswordRecovery(false);
                }} 
                activeOpacity={0.8}
              >
                <Text style={[styles.modalBtnText, { color: Colors.textDark }]}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: Colors.primary }]} onPress={handleChangePassword} activeOpacity={0.8}>
                <Text style={styles.modalBtnText}>Güncelle</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={aboutModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>✨ Whiskdom Nedir?</Text>
            <Text style={styles.aboutModalText}>
              Whiskdom; evinizdeki gıda israfını önlemek, buzdolabınızdaki ürünlerin son kullanma tarihlerini akıllıca takip etmek ve elinizdeki malzemelerle en lezzetli tarifleri üretebilmeniz için geliştirilmiş yenilikçi bir mutfak asistanıdır. 🍏🍳
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setAboutModalVisible(false)} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={privacyModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>🔒 Gizlilik Politikası</Text>
            <Text style={styles.aboutModalText}>
              Whiskdom olarak kişisel verilerinizin güvenliğine büyük önem veriyoruz. Envanter ve profil verileriniz yalnızca cihazınızda güvenle saklanır.
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setPrivacyModalVisible(false)} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={prefModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>🌱 Diyet & Alerjen Tercihleri</Text>
            <Text style={styles.filterSectionTitle}>🥗 Diyet Tipi:</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {AVAILABLE_DIETS.map((diet) => {
                const active = userPreferences.diets?.includes(diet);
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
                const active = userPreferences.allergens?.includes(allergen);
                return (
                  <TouchableOpacity 
                    key={allergen}
                    style={[styles.modalOptionBtn, active && { backgroundColor: Colors.primary, borderColor: Colors.primary }]}
                    onPress={() => handleToggleAllergen(allergen)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.modalOptionText, active && styles.activeModalOptionText]}>{allergen}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={() => setPrefModalVisible(false)} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Kaydet ve Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={editModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>✏️ Profili Düzenle</Text>
            <View style={{ width: '100%', marginVertical: 12, gap: 10 }}>
              <View>
                <Text style={styles.inputLabel}>Ad Soyad:</Text>
                <TextInput style={styles.modalInput} value={nameInput} onChangeText={setNameInput} placeholderTextColor="#A0AEC0" />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, width: '100%', marginTop: 10 }}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: Colors.border }]} onPress={() => setEditModalVisible(false)} activeOpacity={0.8}>
                <Text style={[styles.modalBtnText, { color: Colors.textDark }]}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: Colors.primary }]} onPress={handleSaveProfile} activeOpacity={0.8}>
                <Text style={styles.modalBtnText}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  scrollContent: { paddingTop: 54, paddingHorizontal: 18, paddingBottom: 40 },
  screenTitle: { fontSize: 24, fontWeight: '900', color: Colors.textDark, letterSpacing: -0.5, marginBottom: 16, textAlign: 'center' },

  profileCard: { flexDirection: 'row', backgroundColor: Colors.white, padding: 16, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, elevation: 1, marginBottom: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28, marginRight: 14 },
  profileInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: '800', color: Colors.textDark },
  userTitle: { fontSize: 12, color: Colors.textDark, fontWeight: '700', marginTop: 2 },
  userEmail: { fontSize: 12, color: Colors.grayText, fontWeight: '500', marginTop: 2 },
  editBtn: { padding: 8, backgroundColor: Colors.inputBg, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },

  proWidgetCard: { backgroundColor: '#F3E8FF', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E9D5FF', elevation: 1 },
  proWidgetActive: { backgroundColor: '#EDE9FE', borderColor: '#C084FC' },
  proWidgetTitle: { fontSize: 14, fontWeight: '900', color: '#7E22CE' },
  proWidgetSubTitle: { fontSize: 11, color: '#6B21A8', fontWeight: '600', marginTop: 2 },

  wasteSummaryCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.border, elevation: 1 },
  wasteHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  wasteCardTitle: { fontSize: 14, fontWeight: '800', color: Colors.textDark },
  successBadge: { backgroundColor: Colors.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  successBadgeText: { color: Colors.white, fontSize: 11, fontWeight: '700' },
  wasteStatsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginBottom: 14 },
  wasteStatItem: { alignItems: 'center', flex: 1 },
  wasteSavedNumber: { fontSize: 16, fontWeight: '800', color: Colors.textDark },
  wasteWastedNumber: { fontSize: 16, fontWeight: '800', color: '#E53E3E' },
  wasteStatLabel: { fontSize: 11, color: Colors.grayText, fontWeight: '500', marginTop: 2 },
  verticalDivider: { width: 1, height: 28, backgroundColor: Colors.border },
  progressBarBg: { height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 3 },

  sectionHeader: { fontSize: 14, fontWeight: '800', color: Colors.textDark, marginBottom: 0 },
  badgeSectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, marginBottom: 10 },
  expandToggleBtn: { backgroundColor: Colors.border, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  expandToggleText: { fontSize: 11, fontWeight: '700', color: Colors.textDark },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statGridBox: { flex: 1, minWidth: '45%', backgroundColor: Colors.white, padding: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, elevation: 1 },
  gridNumber: { fontSize: 16, fontWeight: '800', color: Colors.textDark },
  gridLabel: { fontSize: 11, color: Colors.grayText, fontWeight: '500', marginTop: 3 },

  badgeContainer: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  expandedBadgeContainer: { marginTop: 6, marginBottom: 6 },
  challengeSubHeader: { fontSize: 12, fontWeight: '700', color: '#718096', marginBottom: 8 },

  badgeCard: { flex: 1, backgroundColor: Colors.white, padding: 12, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, elevation: 1 },
  badgeIcon: { fontSize: 24, marginBottom: 4 },
  badgeName: { fontSize: 12, fontWeight: '800', color: Colors.textDark },
  badgeDesc: { fontSize: 10, color: Colors.textDark, fontWeight: '700', marginTop: 2 },

  badgeStatusBox: { padding: 10, borderRadius: 10, marginVertical: 10, width: '100%', borderWidth: 1, borderColor: Colors.border },
  badgeStatusText: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  badgeDetailDesc: { fontSize: 13, color: '#4A5568', textAlign: 'center', marginBottom: 8, lineHeight: 18, fontWeight: '500' },
  badgeDetailReq: { fontSize: 11, color: '#718096', fontStyle: 'italic', textAlign: 'center' },

  prefSummaryBox: { backgroundColor: Colors.white, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 16, elevation: 1 },
  prefSummaryTitle: { fontSize: 12, fontWeight: '800', color: Colors.textDark },
  editPrefBtn: { backgroundColor: Colors.inputBg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  editPrefBtnText: { fontSize: 11, fontWeight: '700', color: Colors.textDark },
  prefSummaryText: { fontSize: 12, color: '#4A5568', fontWeight: '500', marginTop: 6 },

  filterSectionTitle: { fontSize: 13, fontWeight: '800', color: Colors.textDark, marginTop: 12, marginBottom: 8, alignSelf: 'flex-start' },
  modalOptionBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: Colors.inputBg, borderWidth: 1, borderColor: Colors.border },
  activeModalOptionBtn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  modalOptionText: { fontSize: 12, color: '#4A5568', fontWeight: '600' },
  activeModalOptionText: { color: Colors.white, fontWeight: '800' },

  menuGroupCard: { backgroundColor: Colors.white, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border, marginBottom: 16, elevation: 1 },
  menuItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.inputBg },
  menuItemText: { fontSize: 13, fontWeight: '700', color: Colors.textDark },
  menuItemArrow: { fontSize: 16, color: '#ADB5BD', fontWeight: 'bold' },
  aboutModalText: { fontSize: 13, color: '#4A5568', textAlign: 'center', marginBottom: 12, lineHeight: 18, fontWeight: '500' },

  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  modalContainer: { width: '100%', backgroundColor: Colors.white, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, elevation: 5 },
  modalTitle: { fontSize: 16, fontWeight: '900', color: Colors.textDark, marginBottom: 12, textAlign: 'center' },
  
  modalHeaderRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 10, 
    marginBottom: 12,
    width: '100%' 
  },

  modalTitleText: { 
    fontSize: 18, 
    fontWeight: '900', 
    color: Colors.textDark 
  },

  inputLabel: { fontSize: 12, fontWeight: '700', color: '#4A5568', marginBottom: 4 },
  modalInput: { backgroundColor: Colors.inputBg, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: Colors.textDark, fontWeight: '500', width: '100%' },
  modalBtn: { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center' },
  modalBtnText: { color: Colors.white, fontWeight: '700', fontSize: 13 },

  equipBtn: {
    backgroundColor: '#0D9488',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    marginTop: 12
  },
  equipBtnText: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: 13
  },

  primaryBtn: { 
    backgroundColor: Colors.primary, 
    paddingVertical: 12, 
    paddingHorizontal: 20,
    borderRadius: 12, 
    alignItems: 'center', 
    justifyContent: 'center',
    alignSelf: 'stretch',
    marginTop: 8 
  },
  primaryBtnText: { 
    color: Colors.white, 
    fontWeight: '800', 
    fontSize: 13 
  }
});