import React from 'react';
import { StyleSheet, View, Image, TouchableOpacity, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

//プレビュー用ボタンのための処理
import { useRouter } from 'expo-router';

export default function LoginScreen() {

  //プレビュー用ボタンのための処理
  const router = useRouter();
  
  // Googleログインボタンが押された時の処理
  const handleGoogleLogin = () => {
    console.log('Google Login Button Pressed');
    // TODO: OAuth認証ロジックをここに実装
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 画面上部〜中央：ロゴエリア */}
      <View style={styles.logoContainer}>
        
        {/* ▼▼▼ 画像が完成したらここから削除 ▼▼▼ */}
        <View style={styles.logoMock}>
          <View style={styles.iconCircle}>
            <View style={[styles.eye, { left: 6, top: 8, backgroundColor: '#FFF500' }]} />
            <View style={[styles.eye, { right: 6, bottom: 8, backgroundColor: '#0044FF' }]} />
          </View>
          <Text style={styles.logoText}>待つん屋</Text>
        </View>
        {/* ▲▲▲ 画像が完成したらここまで削除 ▲▲▲ */}

        {/* ▼▼▼ 画像が完成したら下の行のコメント化を外してください ▼▼▼ */}
        {/*
        <Image 
          source={require('../../assets/images/logo.png')} 
          style={styles.logoImage}
          resizeMode="contain"
        /> 
        */}
      </View>

      {/* 画面下部：ログインボタンエリア */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          onPress={handleGoogleLogin} 
          activeOpacity={0.8}
        >
          {/* 丸ごと持ってきた公式のボタン画像を表示 */}
          <Image 
            source={require('../../assets/images/googleLoginButton.png')} 
            style={styles.googleButtonImage}
            resizeMode="contain"
          />
        </TouchableOpacity>

        {/* ▼▼▼ ここからプレビュー用ボタン ▼▼▼ */}
        <TouchableOpacity 
          onPress={() => router.push('/signup')} 
          style={{ marginTop: 30, padding: 10 }}
        >
          <Text style={{ color: '#004499', fontWeight: 'bold' }}>
            【開発用】新規登録画面を確認する →
          </Text>
        </TouchableOpacity>
        {/* ▲▲▲ プレビュー用ボタンここまで ▲▲▲ */}

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ==========================================
  // 共通・本番用のスタイル（残す部分）
  // ==========================================
  container: {
    flex: 1,
    backgroundColor: '#E2FBE2', // 背景の淡いグリーン
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    flex: 5,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  logoImage: {
    width: '85%',
    height: 120,
  },
  buttonContainer: {
    flex: 4,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 10,
  },
  
  // --- 今回追加：Googleボタン画像のスタイル ---
  googleButtonImage: {
    width: 240,   // ボタンの横幅（いい感じのサイズに調整してください）
    height: 48,   // ボタンの縦幅
  },

  // ==========================================
  // 【不要になるCSS】画像ができたら丸ごと削除OK！
  // ==========================================
  logoMock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FF4500',
    marginRight: 12,
  },
  eye: {
    width: 14,
    height: 14,
    borderRadius: 7,
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: '#000',
  },
  logoText: {
    fontSize: 38,
    fontWeight: 'bold',
    color: '#004499',
  },
});