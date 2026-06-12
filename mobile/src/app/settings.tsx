import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Image, TextInput, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AppMap } from '../components/AppMap';
import { Footer } from '../components/Footer';
import { Popup } from '../components/Popup';

type SettingsPopup = 'system' | 'pastime' | null;

const pastimeOptions = ['カフェ', 'カラオケ', 'ファミレス', 'ゲーム', 'ジム'];

export default function SettingsScreen() {
  const router = useRouter();
  const [activePopup, setActivePopup] = useState<SettingsPopup>(null);
  const [selectedPastimes, setSelectedPastimes] = useState<string[]>([]);

  const togglePastime = (option: string) => {
    setSelectedPastimes(prev => 
      prev.includes(option) ? prev.filter(p => p !== option) : [...prev, option]
    );
  };

  return (
    <View style={styles.container}>
      <AppMap style={styles.map} />

      <SafeAreaView style={styles.safeArea} pointerEvents="box-none">
        <View style={styles.contentWrapper} pointerEvents="box-none">
          <View style={styles.header}>
            <Image
              source={require('../../assets/images/matsunya-logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />

            <TouchableOpacity style={styles.iconContainer}>
              <Ionicons name="person" size={26} color="#2330df" />
            </TouchableOpacity>
          </View>

          <View style={styles.panel}>
            {/* ドラッグハンドル */}
            <View style={styles.dragHandleWrapper}>
              <View style={styles.dragHandle} />
            </View>

            {/* ヘッダー領域 */}
            <View style={styles.headerContainer}>
              <View style={styles.headerLeft}>
                <Ionicons name="settings-outline" size={26} color="#515151" />
              </View>
              <Text style={styles.title}>設定</Text>
              <View style={styles.headerRight}>
                <TouchableOpacity onPress={() => router.replace('/home')} style={styles.closeXButton} activeOpacity={0.6}>
                  <Ionicons name="close" size={28} color="#515151" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.contentContainer}>

            <TouchableOpacity style={styles.settingRow} onPress={() => setActivePopup('system')}>
              <Text style={styles.settingText}>システム設定</Text>
              <Text style={styles.settingArrow}>＞</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingRow} onPress={() => setActivePopup('pastime')}>
              <Text style={styles.settingText}>好きな暇つぶし</Text>
              <Text style={styles.settingArrow}>＞</Text>
            </TouchableOpacity>
            </View>
          </View>

          <Popup
            visible={activePopup === 'system'}
            onClose={() => setActivePopup(null)}
            title="システム設定"
            icon="settings-outline"
            slideDirection="right"
            showBackButton
          >
            <View style={styles.popupBody}>
              <Text style={styles.popupLabel}>メールアドレスの変更</Text>
              <TextInput
                style={styles.emailInput}
                value="gaikenhoge@gmail.com"
                editable={false}
              />

              <Text style={styles.deleteTitle}>アカウントを削除</Text>
              <TouchableOpacity style={styles.deleteButton}>
                <Ionicons name="trash-outline" size={18} color="#b71c1c" />
                <Text style={styles.deleteButtonText}>削除する</Text>
              </TouchableOpacity>
            </View>
          </Popup>

          <Popup
            visible={activePopup === 'pastime'}
            onClose={() => setActivePopup(null)}
            title="好きな暇つぶし"
            icon="cafe-outline"
            slideDirection="right"
            showBackButton
          >
            <View style={styles.chipGrid}>
              {pastimeOptions.map((option) => {
                const isSelected = selectedPastimes.includes(option);
                return (
                  <TouchableOpacity 
                    key={option} 
                    style={styles.chip}
                    onPress={() => togglePastime(option)}
                    activeOpacity={0.7}
                  >
                    {isSelected && <Ionicons name="checkmark" size={16} color="#4d6048" style={styles.checkIcon} />}
                    <Text style={styles.chipText}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Popup>
        </View>

        <View style={styles.footerWrapper}>
          <Footer />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  safeArea: {
    flex: 1,
  },
  contentWrapper: {
    flex: 1,
    zIndex: 1,
    elevation: 1,
    overflow: 'hidden',
  },
  footerWrapper: {
    zIndex: 10,
    elevation: 10,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 5,
  },
  logoImage: {
    width: 260,
    height: 90,
    marginLeft: -35,
  },
  iconContainer: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#515151',
  },
  panel: {
    flex: 1,
    backgroundColor: '#e2fbe2',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 20,
    paddingTop: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.15,
        shadowRadius: 5,
      },
      android: { elevation: 10 },
      web: { boxShadow: '0px -3px 6px rgba(0, 0, 0, 0.15)' as any },
    }),
  },
  dragHandleWrapper: { alignItems: 'center', width: '100%', paddingBottom: 10 },
  dragHandle: { width: 40, height: 5, backgroundColor: '#cccccc', borderRadius: 2.5 },
  headerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', height: 45, paddingHorizontal: 4 },
  headerLeft: { width: 40, alignItems: 'flex-start' },
  headerRight: { width: 40, alignItems: 'flex-end' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#333', textAlign: 'center', flex: 1 },
  closeXButton: { padding: 4 },
  contentContainer: { flex: 1, width: '100%', paddingTop: 16, paddingBottom: 20 },
  settingRow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  settingText: {
    fontSize: 15,
    color: '#1f1f1f',
  },
  settingArrow: {
    fontSize: 15,
    color: '#666666',
  },
  popupBody: {
    width: '100%',
    alignItems: 'center',
  },
  popupLabel: {
    alignSelf: 'flex-start',
    fontSize: 14,
    color: '#333333',
    marginBottom: 8,
  },
  emailInput: {
    width: '100%',
    height: 38,
    borderWidth: 1,
    borderColor: '#4d6048',
    backgroundColor: '#f6fff1',
    paddingHorizontal: 10,
    color: '#1f1f1f',
    marginBottom: 28,
  },
  deleteTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f1f1f',
    marginBottom: 14,
  },
  deleteButton: {
    minWidth: 150,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#ffcdd2',
    borderWidth: 1,
    borderColor: '#e57373',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  deleteButtonText: {
    color: '#b71c1c',
    fontSize: 15,
    fontWeight: '700',
  },
  chipGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 10,
    paddingHorizontal: 6,
  },
  chip: {
    width: '31%',
    borderWidth: 1,
    borderColor: '#4d6048',
    backgroundColor: '#f6fff1',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  checkIcon: {
    position: 'absolute',
    left: 6,
  },
  chipText: {
    fontSize: 13,
    color: '#1f1f1f',
    fontWeight: '600',
  },
});
