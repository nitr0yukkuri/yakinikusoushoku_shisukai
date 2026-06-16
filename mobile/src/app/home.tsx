import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, SafeAreaView, Image , Text}  from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppMap } from '../components/AppMap';
import { Footer } from '../components/Footer';
import { Popup } from '../components/Popup';
// ★追加：プロフィール編集フォームの部品を読み込む
import ProfileEditSection from '../components/ProfileEditSection';

import { CalendarView } from '../components/CalendarView';

export default function HomeScreen() {
  // 通知用のポップアップ状態
  const [isPopupVisible, setPopupVisible] = useState(false);
  // ★追加：プロフィール用のポップアップ状態
  const [isProfilePopupVisible, setProfilePopupVisible] = useState(false);

  const [isCalendarPopupVisible, setCalendarPopupVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [markedDates, setMarkedDates] = useState({});
  const handleDayPress = (day: any) => {
    setSelectedDate(day.dateString);
    setMarkedDates({ 
      [day.dateString]: { selected: true, selectedColor: '#2330df' } 
    });
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

            {/* ★修正：onPressを追加してプロフィールポップアップを開くようにした */}
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

          {/* ★追加：プロフィール設定用のポップアップ */}
          <Popup
            visible={isProfilePopupVisible}
            onClose={() => setProfilePopupVisible(false)}
            title="プロフィール設定"
            icon="person-outline"
          >
            <ProfileEditSection onSaveSuccess={() => setProfilePopupVisible(false)} />
          </Popup>

          <Popup
          visible={isCalendarPopupVisible}
          onClose={() => setCalendarPopupVisible(false)}
          title="日付を選択"
        >
          <CalendarView 
            selectedDate={selectedDate}
            onDayPress={handleDayPress}
            markedDates={markedDates}
          />

          <TouchableOpacity 
              style={styles.selectButton} 
              onPress={() => setCalendarPopupVisible(false)}
            >
              <Text style={styles.selectButtonText}>選択</Text>
            </TouchableOpacity>
        </Popup>

        </View>

        <View style={styles.footerWrapper}>
          <Footer onPressNotification={() => setPopupVisible(true)} 
            onPressCalendar={() => setCalendarPopupVisible(true)}
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
  calendarPrompt: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#515151',
    marginBottom: 5,
    textAlign: 'center',
  },
  selectButton: {
    backgroundColor: '#2330df',
    paddingVertical: 12,
    width: '80%',         // ボタンの横幅をポップアップの80%にする
    alignSelf: 'center',
    borderRadius: 25, // 角を丸くする
    marginTop: 10,
    alignItems: 'center',
  },
  selectButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});