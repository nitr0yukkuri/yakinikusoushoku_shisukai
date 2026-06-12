import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Image, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppMap } from '../components/AppMap';
import { Footer } from '../components/Footer';
import { Popup } from '../components/Popup';
import ProfileEditSection from '../components/ProfileEditSection';
import SettingsPanel from '../components/SettingsPanel';

const pastimeOptions = ['カフェ', 'カラオケ', 'ファミレス', 'ゲーム', 'ジム'];

export default function HomeScreen() {
  // 通知用のポップアップ状態
  const [isPopupVisible, setPopupVisible] = useState(false);
  // プロフィール用のポップアップ状態
  const [isProfilePopupVisible, setProfilePopupVisible] = useState(false);
  // 設定用のポップアップ状態
  const [isSettingsVisible, setSettingsVisible] = useState(false);
  // システム設定用のポップアップ状態
  const [isSystemVisible, setSystemVisible] = useState(false);
  // 好きな暇つぶし用のポップアップ状態
  const [isPastimeVisible, setPastimeVisible] = useState(false);
  // 暇つぶし選択状態
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

            <TouchableOpacity
              style={styles.iconContainer}
              onPress={() => setProfilePopupVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="person" size={26} color="#2330df" />
            </TouchableOpacity>
          </View>

          <View style={styles.mainContent} pointerEvents="none" />

          {/* 通知用のポップアップ */}
          <Popup
            visible={isPopupVisible}
            onClose={() => setPopupVisible(false)}
            title="通知"
            message="新着の通知はありません。"
          />

          {/* プロフィール設定用のポップアップ */}
          <Popup
            visible={isProfilePopupVisible}
            onClose={() => setProfilePopupVisible(false)}
            title="プロフィール設定"
            icon="person-outline"
          >
            <ProfileEditSection onSaveSuccess={() => setProfilePopupVisible(false)} />
          </Popup>

          {/* 設定用のポップアップ */}
          <Popup
            visible={isSettingsVisible}
            onClose={() => setSettingsVisible(false)}
            title="設定"
            icon="settings-outline"
          >
            <SettingsPanel
              onOpenSystem={() => setSystemVisible(true)}
              onOpenPastime={() => setPastimeVisible(true)}
            />
          </Popup>

          {/* システム設定ポップアップ（設定の上に重ねる） */}
          <Popup
            visible={isSystemVisible}
            onClose={() => setSystemVisible(false)}
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

          {/* 好きな暇つぶしポップアップ（設定の上に重ねる） */}
          <Popup
            visible={isPastimeVisible}
            onClose={() => setPastimeVisible(false)}
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
                    <Text style={styles.chipText}>{option}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Popup>

        </View>

        <View style={styles.footerWrapper}>
          <Footer
            onPressNotification={() => setPopupVisible(true)}
            onPressSettings={() => setSettingsVisible(true)}
          />
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
  mainContent: {
    flex: 1,
  },
  popupBody: {
    width: '100%',
    alignItems: 'center',
    marginTop: 40,
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
    marginTop: 120,
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