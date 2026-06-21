import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useProfile, UserProfile } from '../contexts/profile-context';
import { getApiUrl } from '../utils/api-url';

WebBrowser.maybeCompleteAuthSession();

type AuthResponse = {
  token: string;
  user: UserProfile;
};

// .envの設定に合わせて EXPO_PUBLIC_GOOGLE_CLIENT_ID を読み込む
const webClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '';
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '';
const apiUrl = getApiUrl();

export default function LoginScreen() {
  const router = useRouter();
  const { profile, isHydrated, setSession } = useProfile();
  const isOAuthLoginRef = useRef(false);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: webClientId,
    iosClientId: iosClientId,
    androidClientId: androidClientId,
    selectAccount: true,
  });

  const canLogin = Boolean(request);

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
      .then(async (body) => {
        isOAuthLoginRef.current = true;
        await setSession({ token: body.token, profile: body.user });
        console.log('Google Login Success:', body.user.email);
        router.replace(body.user.userId ? '/home' : '/signup');
      })
      .catch((error: Error) => {
        isOAuthLoginRef.current = false;
        console.error('Google Login Failed:', error.message);
      });
  }, [router, setSession]);

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = response.params.id_token;
      if (idToken) loginWithBackend(idToken);
    }
  }, [loginWithBackend, response]);

  useEffect(() => {
    if (!isHydrated || !profile || isOAuthLoginRef.current) return;
    router.replace(profile.userId ? '/home' : '/signup');
  }, [isHydrated, profile, router]);

  const handleGoogleLogin = () => {
    if (!canLogin) return;
    promptAsync();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 右上のアイコンを削除しました */}

      <View style={styles.logoContainer}>
        <Image
          source={require('../../assets/images/matsunya-logo.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity onPress={handleGoogleLogin} activeOpacity={0.8}>
          <Image
            source={require('../../assets/images/googleLoginButton.png')}
            style={styles.googleButtonImage}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>
      
      {/* ここにあったPopupも削除しました */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E2FBE2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
    paddingBottom: 20,
  },
  logoImage: {
    width: '85%',
    height: 120,
  },
  buttonContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 20,
  },
  googleButtonImage: {
    width: 240,
    height: 48,
  },
});