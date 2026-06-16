import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Image,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { AppMap } from '../components/AppMap';
import { CalendarView } from '../components/CalendarView';
import { Footer } from '../components/Footer';
import { Popup } from '../components/Popup';
import ProfileEditSection from '../components/ProfileEditSection';
import { ProfileAvatar } from '../components/ProfileAvatar';
import SettingsPanel from '../components/SettingsPanel';
import { useProfile } from '../contexts/profile-context';
import { getProfileImageSignature } from '../utils/profile-image';

import MeetupSettingForm from '../components/meetupSettingForm';

const pastimeOptions = ['カフェ', 'カラオケ', 'ファミレス', 'ゲーム', 'ジム'];

export default function HomeScreen() {
  const router = useRouter();
  const { profile, avatarUrl, logout } = useProfile();

  const [isPopupVisible, setPopupVisible] = useState(false);
  const [isProfilePopupVisible, setProfilePopupVisible] = useState(false);
  const [isSettingsVisible, setSettingsVisible] = useState(false);
  const [isSystemVisible, setSystemVisible] = useState(false);
  const [isPastimeVisible, setPastimeVisible] = useState(false);
  const [isCalendarPopupVisible, setCalendarPopupVisible] = useState(false);

  const [selectedPastimes, setSelectedPastimes] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [markedDates, setMarkedDates] = useState({});

  const togglePastime = (option: string) => {
    setSelectedPastimes((prev) =>
      prev.includes(option) ? prev.filter((p) => p !== option) : [...prev, option],
    );
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  const handleDayPress = (day: any) => {
    setSelectedDate(day.dateString);
    setMarkedDates({
      [day.dateString]: { selected: true, selectedColor: '#2330df' },
    });
  };

  const [isMeetupSettingVisible, setMeetupSettingVisible] = useState(false);

  return (
    <View style={styles.container}>
      <AppMap
        style={styles.map}
        userId={profile?.userId}
        userName={profile?.name}
        profileImage={avatarUrl || undefined}
      />

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
              <ProfileAvatar
                key={`${profile?.name ?? ''}:${getProfileImageSignature(avatarUrl)}`}
                name={profile?.name}
                profileImage={avatarUrl}
                size={50}
                style={styles.profileAvatar}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.mainContent} pointerEvents="none" />

          <Popup
            visible={isPopupVisible}
            onClose={() => setPopupVisible(false)}
            title="通知"
            message="新着の通知はありません。"
          />

          <Popup
            visible={isProfilePopupVisible}
            onClose={() => setProfilePopupVisible(false)}
            title="プロフィール設定"
            icon="person-outline"
          >
            <ProfileEditSection
              key={`${profile?.id ?? 'profile'}-${profile?.name ?? ''}-${profile?.bio ?? ''}-${getProfileImageSignature(avatarUrl)}`}
              onSaveSuccess={() => setProfilePopupVisible(false)}
            />
          </Popup>

          <Popup
            visible={isCalendarPopupVisible}
            onClose={() => setCalendarPopupVisible(false)}
            title="日付を選択"
            icon="calendar-outline"
          >
            <CalendarView
              selectedDate={selectedDate}
              onDayPress={handleDayPress}
              markedDates={markedDates}
            />

            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => {
                setCalendarPopupVisible(false); // カレンダーを閉じる
                setMeetupSettingVisible(true);  // 待ち合わせ設定を開く！
              }}
            >
              <Text style={styles.selectButtonText}>選択</Text>
            </TouchableOpacity>
          </Popup>
          <Popup
            visible={isMeetupSettingVisible}
            onClose={() => setMeetupSettingVisible(false)}
            title="待ち合わせ詳細設定"
            icon="location-outline"
          >
            {/* さっき作った別ファイルの部品をここで呼び出す */}
            <MeetupSettingForm 
              onSave={(data: any) => {
                console.log("保存されたデータ:", data);
                setMeetupSettingVisible(false); // 保存したら閉じる
              }} 
            />

          </Popup>

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

          <Popup
            visible={isSystemVisible}
            onClose={() => setSystemVisible(false)}
            title="システム設定"
            icon="settings-outline"
            slideDirection="right"
            showBackButton
          >
            <View style={styles.popupBody}>
              <Text style={styles.popupLabel}>メールアドレス</Text>
              <TextInput
                style={styles.emailInput}
                value={profile?.email || ''}
                editable={false}
              />

              <Text style={styles.deleteTitle}>アカウントを削除</Text>
              <TouchableOpacity style={styles.deleteButton} onPress={handleLogout}>
                <Ionicons name="trash-outline" size={18} color="#b71c1c" />
                <Text style={styles.deleteButtonText}>削除する</Text>
              </TouchableOpacity>
            </View>
          </Popup>

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
                    {isSelected && (
                      <Ionicons
                        name="checkmark"
                        size={16}
                        color="#4d6048"
                        style={styles.checkIcon}
                      />
                    )}
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
            onPressCalendar={() => setCalendarPopupVisible(true)}
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
    width: 54,
    height: 54,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#515151',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  profileAvatar: {
    borderRadius: 25,
  },
  mainContent: {
    flex: 1,
  },
  selectButton: {
    backgroundColor: '#2330df',
    paddingVertical: 12,
    width: '80%',
    alignSelf: 'center',
    borderRadius: 25,
    marginTop: 10,
    alignItems: 'center',
  },
  selectButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
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