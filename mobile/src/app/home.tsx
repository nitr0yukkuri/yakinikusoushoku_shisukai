import React, { useState } from 'react';
import { View, Text, StyleSheet, ImageBackground, TouchableOpacity, SafeAreaView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Footer } from '../components/Footer';
import { Popup } from '../components/Popup';

export default function HomeScreen() {
  // ポップアップの表示・非表示を管理する状態
  const [isPopupVisible, setPopupVisible] = useState(false);

  return (
    <View style={styles.container}>
      {/* 背景の地図画像（仮） */}
      <ImageBackground 
        source={require('../../assets/images/googlemap.png')} 
        style={styles.mapBackground}
        resizeMode="cover"
      >
        <SafeAreaView style={styles.safeArea}>
          
          {/* ヘッダー領域 */}
          <View style={styles.header}>
            {/* 左上：ロゴ */}
            <Image
              source={require('../../assets/images/Matsunya_logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            
            {/* 右上：アイコンボタン（挙動を元に戻しました） */}
            <TouchableOpacity style={styles.iconContainer}>
              <Ionicons name="person" size={26} color="#2330df" />
            </TouchableOpacity>
          </View>

          {/* メインコンテンツエリア */}
          <View style={styles.mainContent} />

          {/* 修正：フッターにポップアップを開く関数を渡す */}
          <Footer onPressNotification={() => setPopupVisible(true)} />

          {/* ポップアップコンポーネント */}
          <Popup
            visible={isPopupVisible}
            onClose={() => setPopupVisible(false)}
            title="通知"
            message="新着の通知はありません。"
          />

        </SafeAreaView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  mapBackground: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  logoImage: {
    width: 220,
    height: 60,
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
});