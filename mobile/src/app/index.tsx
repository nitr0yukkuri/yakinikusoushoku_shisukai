import { makeRedirectUri } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef } from 'react';
import { Platform, StyleSheet, View, Image, TouchableOpacity } from 'react-native';
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
const PKCE_VERIFIER_STORAGE_KEY = '@matsunya/google-oauth-pkce-verifier';

const readWebIdTokenFromLocation = () => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return '';

  const params = new URLSearchParams(
    window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.search.slice(1),
  );
  return params.get('id_token') ?? '';
};

const toBase64Url = (value: string) => value
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/, '');

const createPKCEPair = async () => {
  const verifier = `${Crypto.randomUUID()}${Crypto.randomUUID()}`.replace(/-/g, '');
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: Crypto.CryptoEncoding.BASE64 },
  );
  return { verifier, challenge: toBase64Url(digest) };
};

export default function LoginScreen() {
  const router = useRouter();
  const { profile, isHydrated, setSession } = useProfile();
  const isOAuthLoginRef = useRef(false);
  const isExpoGo =
    Platform.OS !== 'web' &&
    (Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
      Constants.appOwnership === 'expo');
  const authRedirectUri = makeRedirectUri({ path: 'oauth' });

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: webClientId,
    iosClientId: iosClientId,
    androidClientId: androidClientId || webClientId,
    selectAccount: true,
  });

  const canLogin = isExpoGo || Boolean(request);

  const completeLogin = useCallback(async (body: AuthResponse) => {
    isOAuthLoginRef.current = true;
    await setSession({ token: body.token, profile: body.user });
    console.log('Google Login Success:', body.user.email);
    router.replace(body.user.userId ? '/home' : '/signup');
  }, [router, setSession]);

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
      .then(completeLogin)
      .catch((error: Error) => {
        isOAuthLoginRef.current = false;
        console.error('Google Login Failed:', error.message);
      });
  }, [completeLogin]);

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = response.params.id_token;
      if (idToken) loginWithBackend(idToken);
    }
  }, [loginWithBackend, response]);

  useEffect(() => {
    const idToken = readWebIdTokenFromLocation();
    if (!idToken) return;

    window.history.replaceState(null, '', window.location.pathname);
    loginWithBackend(idToken);
  }, [loginWithBackend]);

  useEffect(() => {
    if (!isHydrated || !profile || isOAuthLoginRef.current) return;
    router.replace(profile.userId ? '/home' : '/signup');
  }, [isHydrated, profile, router]);

  const handleGoogleLogin = async () => {
    if (!canLogin) return;

    if (isExpoGo || Platform.OS === 'android') {
      try {
        const { verifier, challenge } = await createPKCEPair();
        await AsyncStorage.setItem(PKCE_VERIFIER_STORAGE_KEY, verifier);
        const authURL = `${apiUrl}/auth/google/start?redirect_uri=${encodeURIComponent(authRedirectUri)}&code_challenge=${encodeURIComponent(challenge)}&code_challenge_method=S256`;
        const result = await WebBrowser.openAuthSessionAsync(authURL, authRedirectUri);
        if (result.type !== 'success') {
          await AsyncStorage.removeItem(PKCE_VERIFIER_STORAGE_KEY);
          return;
        }
        const parsed = Linking.parse(result.url);
        const code = parsed.queryParams?.code;
        const error = parsed.queryParams?.error;
        const queryParams = typeof code === 'string'
          ? { code, verifier }
          : typeof error === 'string'
            ? { error }
            : undefined;
        if (queryParams) router.replace({ pathname: './oauth', params: queryParams });
        else await AsyncStorage.removeItem(PKCE_VERIFIER_STORAGE_KEY);
      } catch (error) {
        await AsyncStorage.removeItem(PKCE_VERIFIER_STORAGE_KEY);
        console.error('Google Login Failed:', (error as Error).message);
      }
      return;
    }

    if (Platform.OS === 'web' && request?.url && typeof window !== 'undefined') {
      window.location.assign(request.url);
      return;
    }

    promptAsync().catch((error: Error) => {
      console.error('Google Login Failed:', error.message);
    });
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
