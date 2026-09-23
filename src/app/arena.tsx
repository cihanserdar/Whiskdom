import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

export default function ArenaScreen() {
  const [activeTab, setActiveTab] = useState<'league' | 'quests' | 'vision'>('league');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.screenTitle}>🏆 Whiskdom Ligi & Arena</Text>
      <Text style={styles.screenSubtitle}>Mutfak stratejini konuştur, ligde tırman ve geleceğin vizyonunu keşfet.</Text>

      {/* SEKME GEÇİŞLERİ */}
      <View style={styles.tabRow}>
        <TouchableOpacity 
          style={[styles.tabBtn, activeTab === 'league' && styles.activeTabBtn]} 
          onPress={() => setActiveTab('league')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabBtnText, activeTab === 'league' && styles.activeTabBtnText]}>Lig & Sıralama</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabBtn, activeTab === 'quests' && styles.activeTabBtn]} 
          onPress={() => setActiveTab('quests')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabBtnText, activeTab === 'quests' && styles.activeTabBtnText]}>Haftalık Görevler</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabBtn, activeTab === 'vision' && styles.activeTabBtn]} 
          onPress={() => setActiveTab('vision')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabBtnText, activeTab === 'vision' && styles.activeTabBtnText]}>Gelecek Vizyonu</Text>
        </TouchableOpacity>
      </View>

      {/* 1. SEKME: LİG & SIRALAMA */}
      {activeTab === 'league' && (
        <View style={styles.sectionContainer}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>🔥 Sezon: Gurme Lig</Text>
            <Text style={styles.timerText}>Yenilenmeye: 3 Gün kaldı</Text>
          </View>
          
          <View style={styles.rankRowCurrent}>
            <Text style={styles.rankNumber}>#4</Text>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.rankName}>Sen (Master Mutfak Şefi)</Text>
              <Text style={styles.rankXp}>1,420 XP • 14 Ürün Kurtarıldı</Text>
            </View>
            <View style={styles.badgePill}><Text style={styles.badgePillText}>Yükselme Hattı 🚀</Text></View>
          </View>

          <View style={styles.leaderboardList}>
            <View style={styles.rankRow}><Text style={styles.rankNumber}>#1</Text><Text style={styles.rankNameUser}>ChefBurak</Text><Text style={styles.rankXpVal}>2,150 XP</Text></View>
            <View style={styles.rankRow}><Text style={styles.rankNumber}>#2</Text><Text style={styles.rankNameUser}>ZehraGourmet</Text><Text style={styles.rankXpVal}>1,980 XP</Text></View>
            <View style={styles.rankRow}><Text style={styles.rankNumber}>#3</Text><Text style={styles.rankNameUser}>EcoChef</Text><Text style={styles.rankXpVal}>1,650 XP</Text></View>
            <View style={[styles.rankRow, { backgroundColor: '#F8F9FA', borderWidth: 1, borderColor: '#1A1A1A' }]}><Text style={styles.rankNumber}>#4</Text><Text style={[styles.rankNameUser, { fontWeight: '900' }]}>Sen</Text><Text style={styles.rankXpVal}>1,420 XP</Text></View>
            <View style={styles.rankRow}><Text style={styles.rankNumber}>#5</Text><Text style={styles.rankNameUser}>KitchenNinja</Text><Text style={styles.rankXpVal}>1,200 XP</Text></View>
          </View>
        </View>
      )}

      {/* 2. SEKME: HAFTALIK GÖREVLER */}
      {activeTab === 'quests' && (
        <View style={styles.sectionContainer}>
          <Text style={styles.cardTitle}>🎯 Bu Haftanın Mutfak Görevleri</Text>
          <Text style={styles.cardSub}>Görevleri tamamla, XP kazan ve ligde öne geç.</Text>

          <View style={styles.questCard}>
            <View style={{ flex: 1 }}><Text style={styles.questTitle}>♻️ Sıfır Atık Hamlesi</Text><Text style={styles.questDesc}>SKT'si yaklaşan en az 3 ürünü ziyan etmeden pişir.</Text></View>
            <View style={styles.questReward}><Text style={styles.questRewardText}>+150 XP</Text></View>
          </View>

          <View style={styles.questCard}>
            <View style={{ flex: 1 }}><Text style={styles.questTitle}>🧪 Simyacı Deneyi</Text><Text style={styles.questDesc}>Elindeki kısıtlı malzemelerle AI Şef'ten 2 yeni tarif üret.</Text></View>
            <View style={styles.questReward}><Text style={styles.questRewardText}>+200 XP</Text></View>
          </View>

          <View style={styles.questCard}>
            <View style={{ flex: 1 }}><Text style={styles.questTitle}>🛒 Eksikleri Tamamlama</Text><Text style={styles.questDesc}>Alışveriş sepetindeki tüm eksik markaları gözden geçir.</Text></View>
            <View style={styles.questReward}><Text style={styles.questRewardText}>+100 XP</Text></View>
          </View>
        </View>
      )}

      {/* 3. SEKME: GELECEK VİZYONU (ROADMAP) */}
      {activeTab === 'vision' && (
        <View style={styles.sectionContainer}>
          <Text style={styles.cardTitle}>🚀 Whiskdom Yol Haritası & Vizyon</Text>
          <Text style={styles.cardSub}>Geliştirmeye ara verdiğinde kaldığın yeri hatırlaman için:</Text>

          <View style={styles.visionItem}>
            <Text style={styles.visionEmoji}>⚖️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.visionTitle}>Aşama 4: Akıllı Hassas Terazi</Text>
              <Text style={styles.visionDesc}>Uygulama ile Bluetooth üzerinden anlık gramaj senkronizasyonu çalışan özel Whiskdom terazisi.</Text>
            </View>
          </View>

          <View style={styles.visionItem}>
            <Text style={styles.visionEmoji}>🛒</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.visionTitle}>Aşama 5: Zincir Market Entegrasyonu</Text>
              <Text style={styles.visionDesc}>Alışveriş listesindeki eksiklerin Getir, Migros vb. üzerinden affiliate (satış ortaklığı) ile tek tıkla sipariş edilmesi.</Text>
            </View>
          </View>

          <View style={styles.visionItem}>
            <Text style={styles.visionEmoji}>🤖</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.visionTitle}>Aşama 6 & 7: Thermomix ve Akıllı Robotik</Text>
              <Text style={styles.visionDesc}>Mutfak robotları ve akıllı buzdolabı kameralarıyla tam otomatik gıda israfı ve pişirme ekosistemi.</Text>
            </View>
          </View>
        </View>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  scrollContent: { paddingTop: 54, paddingHorizontal: 18, paddingBottom: 40 },
  screenTitle: { fontSize: 24, fontWeight: '900', color: '#1A1A1A', letterSpacing: -0.5, textAlign: 'center' },
  screenSubtitle: { fontSize: 12, color: '#6C757D', textAlign: 'center', marginTop: 4, marginBottom: 16 },

  tabRow: { flexDirection: 'row', backgroundColor: '#E9ECEF', padding: 4, borderRadius: 12, marginBottom: 16, gap: 4 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  activeTabBtn: { backgroundColor: '#1A1A1A', elevation: 1 },
  tabBtnText: { fontSize: 11, fontWeight: '700', color: '#4A5568' },
  activeTabBtnText: { color: '#FFFFFF', fontWeight: '800' },

  sectionContainer: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E9ECEF', elevation: 1 },
  cardTitle: { fontSize: 15, fontWeight: '900', color: '#1A1A1A' },
  cardSub: { fontSize: 11, color: '#6C757D', marginTop: 2, marginBottom: 14 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  timerText: { fontSize: 11, fontWeight: '700', color: '#E53E3E' },

  rankRowCurrent: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F3F5', padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#CED4DA' },
  rankNumber: { fontSize: 16, fontWeight: '900', color: '#1A1A1A', width: 28, textAlign: 'center' },
  rankName: { fontSize: 13, fontWeight: '800', color: '#1A1A1A' },
  rankXp: { fontSize: 10, color: '#6C757D', fontWeight: '600', marginTop: 2 },
  badgePill: { backgroundColor: '#1A1A1A', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgePillText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },

  leaderboardList: { gap: 8 },
  rankRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E9ECEF' },
  rankNameUser: { flex: 1, fontSize: 12, fontWeight: '700', color: '#4A5568', marginLeft: 8 },
  rankXpVal: { fontSize: 12, fontWeight: '800', color: '#1A1A1A' },

  questCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8F9FA', padding: 12, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E9ECEF' },
  questTitle: { fontSize: 13, fontWeight: '800', color: '#1A1A1A' },
  questDesc: { fontSize: 11, color: '#6C757D', marginTop: 2 },
  questReward: { backgroundColor: '#E2E8F0', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8 },
  questRewardText: { fontSize: 11, fontWeight: '800', color: '#1A1A1A' },

  visionItem: { flexDirection: 'row', gap: 12, backgroundColor: '#F8F9FA', padding: 12, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E9ECEF', alignItems: 'flex-start' },
  visionEmoji: { fontSize: 20 },
  visionTitle: { fontSize: 12, fontWeight: '800', color: '#1A1A1A' },
  visionDesc: { fontSize: 11, color: '#6C757D', marginTop: 2, lineHeight: 15 }
});
