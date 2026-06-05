import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useMemo } from 'react';
import { StyleSheet, View, Image, TouchableOpacity, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

//プレビュー用ボタンのための処理
import { useRouter } from 'expo-router';

WebBrowser.maybeCompleteAuthSession();

type AuthResponse = {
  token: string;
  user: {
    id: number;
    email: string;
    name: string;
    pictureUrl: string;
    emailVerified: boolean;
  };
};

const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '';
const googleAuthClientId = googleClientId || 'missing-google-client-id';
const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

export default function LoginScreen() {
  const redirectUri = useMemo(
    () => AuthSession.makeRedirectUri({ scheme: 'frontend', path: 'auth' }),
    []
  );

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(
    {
      clientId: googleAuthClientId,
      redirectUri,
      webClientId: googleAuthClientId,
      selectAccount: true,
    },
    { scheme: 'frontend', path: 'auth' }
  );

  const canLogin = Boolean(googleClientId && request);

  //プレビュー用ボタンのための処理
  const router = useRouter();

  const loginWithBackend = useCallback((idToken: string) => {
    fetch(`${apiUrl}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    })
      .then(async (res) => {
        const body = (await res.json()) as AuthResponse | { error?: string };
        if (!res.ok) {
          throw new Error('error' in body ? body.error : 'ログインに失敗しました。');
        }
        return body as AuthResponse;
      })
      .then((body) => {
        console.log('Google Login Success:', body.user.email);
        router.push('/signup');
      })
      .catch((error: Error) => {
        console.error('Google Login Failed:', error.message);
      });
  }, [router]);

  useEffect(() => {
    console.log('Google redirect URI:', redirectUri);
  }, [redirectUri]);

  useEffect(() => {
    if (response?.type !== 'success') {
      if (response?.type === 'error') {
        console.error('Google Login Failed:', response.error);
      }
      return;
    }

    const idToken = response.params.id_token;
    if (!idToken) {
      console.error('Google Login Failed: id_token was not returned.');
      return;
    }

    loginWithBackend(idToken);
  }, [loginWithBackend, response]);

  // Googleログインボタンが押された時の処理
  const handleGoogleLogin = () => {
    console.log('Google Login Button Pressed');
    if (!canLogin) {
      console.error('Google Login Failed: EXPO_PUBLIC_GOOGLE_CLIENT_ID is not configured.');
      return;
    }
    promptAsync();
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
        <TouchableOpacity onPress={handleGoogleLogin} activeOpacity={0.8}>
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
    width: 240, // ボタンの横幅（いい感じのサイズに調整してください）
    height: 48, // ボタンの縦幅
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
