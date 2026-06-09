import React, { useState } from 'react';
import { View, Text, StyleSheet, ImageBackground, TouchableOpacity, SafeAreaView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Footer } from '../components/Footer';
import { Popup } from '../components/Popup';

export default function HomeScreen() {
  const [isPopupVisible, setPopupVisible] = useState(false);

  return (
    <View style={styles.container}>
      <ImageBackground 
        source={require('../../assets/images/googlemap.png')} 
        style={styles.mapBackground}
        resizeMode="cover"
      >
        <SafeAreaView style={styles.safeArea}>
          
          {/* ▼▼▼ ここから：ヘッダーとメインコンテンツを1つのグループにまとめる ▼▼▼ */}
          <View style={styles.contentWrapper}>
            
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

            {/* 中央の空間 */}
            <View style={styles.mainContent} />

            {/* ポップアップをこのグループ内に配置することで、フッターには絶対に被らなくなります */}
            <Popup
              visible={isPopupVisible}
              onClose={() => setPopupVisible(false)}
              title="通知"
              message="新着の通知はありません。"
            />

          </View>
          {/* ▲▲▲ ここまで ▲▲▲ */}


          {/* ▼▼▼ フッターを完全に独立させ、常に一番手前に表示させる設定 ▼▼▼ */}
          <View style={styles.footerWrapper}>
            <Footer onPressNotification={() => setPopupVisible(true)} />
          </View>

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
  // 👇 今回追加した強力なレイアウト設定 👇
  contentWrapper: {
    flex: 1, // フッター以外の上の空間（ヘッダー＋メイン）をすべて埋める
    zIndex: 1,
    elevation: 1,
    overflow: 'hidden', // ポップアップがフッター側にはみ出すのを強制的にカット！
  },
  footerWrapper: {
    zIndex: 10, // フッターをポップアップよりも手前のレイヤーに強制設定！
    elevation: 10,
    backgroundColor: 'transparent',
  },
  // 👆 追加ここまで 👆
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,  //ロゴとアイコンのの左端からの距離
    paddingTop: 5,         //ロゴとアイコンの画面上部からの距離
  },
  logoImage: {
    width: 260,   //横幅
    height: 90,   //縦幅

    marginLeft: -35,   //ロゴ単体の左端からの距離
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