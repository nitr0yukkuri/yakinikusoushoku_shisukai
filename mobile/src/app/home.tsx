import React from 'react';
import { View, Text, StyleSheet, ImageBackground, TouchableOpacity, SafeAreaView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Footer } from '../components/Footer';

export default function HomeScreen() {
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
                resizeMode="contain" // 画像の縦横比を崩さずに枠内に収める設定
              />
            
            {/* 本来ここアイコンの画像*/}
            <TouchableOpacity style={styles.iconContainer}>
              <Ionicons name="person" size={26} color="#2330df" />
            </TouchableOpacity>
          </View>

          {/* メインコンテンツエリア（将来地図のピンなどが表示される場所） */}
          <View style={styles.mainContent} />

          {/* 修正した緑色の5ボタンフッター */}
          <Footer />

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
    width: 220,  // ロゴ画像の横幅
    height: 60, // ロゴ画像の縦幅
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