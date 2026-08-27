import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useProfile, UserProfile } from '../contexts/profile-context';
import { getApiUrl } from '../utils/api-url';

type AuthResponse = {
  token: string;
  user: UserProfile;
};

const apiUrl = getApiUrl();
const PKCE_VERIFIER_STORAGE_KEY = '@matsunya/google-oauth-pkce-verifier';

const dismissAuthBrowser = async () => {
  try {
    await Promise.resolve(WebBrowser.dismissBrowser());
  } catch {
    // Expo Go on Android may already have closed the browser when the deep link arrives.
  }
};

export default function OAuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    code?: string | string[];
    error?: string | string[];
    verifier?: string | string[];
  }>();
  const { setSession } = useProfile();
  const handledCodeRef = useRef<string | null>(null);

  const handleResult = useCallback(async (codeValue: unknown, errorValue: unknown, verifierValue: unknown) => {
    const error = Array.isArray(errorValue) ? errorValue[0] : errorValue;
    if (typeof error === 'string') {
      await AsyncStorage.removeItem(PKCE_VERIFIER_STORAGE_KEY);
      console.error('Google Login Failed:', error);
      void dismissAuthBrowser();
      router.replace('/');
      return;
    }
    const code = Array.isArray(codeValue) ? codeValue[0] : codeValue;
    if (typeof code !== 'string' || handledCodeRef.current === code) return;
    handledCodeRef.current = code;

    const verifier = Array.isArray(verifierValue) ? verifierValue[0] : verifierValue;
    try {
      const storedVerifier = await AsyncStorage.getItem(PKCE_VERIFIER_STORAGE_KEY);
      const resolvedVerifier = typeof verifier === 'string' && verifier.length >= 43
        ? verifier
        : storedVerifier;
      await AsyncStorage.removeItem(PKCE_VERIFIER_STORAGE_KEY);

      if (!resolvedVerifier || resolvedVerifier.length < 43) {
        throw new Error('PKCE verifier is missing');
      }

      const res = await fetch(`${apiUrl}/auth/google/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, codeVerifier: resolvedVerifier }),
      });
      const body = (await res.json()) as AuthResponse | { error?: string };
      if (!res.ok) {
        throw new Error('error' in body ? body.error : 'Googleログインに失敗しました');
      }

      await dismissAuthBrowser();
      await setSession({ token: (body as AuthResponse).token, profile: (body as AuthResponse).user });
      router.replace((body as AuthResponse).user.userId ? '/home' : '/signup');
    } catch (error) {
      handledCodeRef.current = null;
      console.error('Google Login Failed:', (error as Error).message);
      void dismissAuthBrowser();
      router.replace('/');
    }
  }, [router, setSession]);

  const handleURL = useCallback((url: string | null) => {
    if (!url) return;
    const parsed = Linking.parse(url);
    void handleResult(parsed.queryParams?.code, parsed.queryParams?.error, parsed.queryParams?.verifier);
  }, [handleResult]);

  useEffect(() => {
    void handleResult(params.code, params.error, params.verifier);
  }, [handleResult, params.code, params.error, params.verifier]);

  useEffect(() => {
    let isMounted = true;
    const subscription = Linking.addEventListener('url', ({ url }) => handleURL(url));

    Linking.getInitialURL()
      .then((url) => {
        if (isMounted) handleURL(url);
      })
      .catch((error: Error) => {
        console.error('Google Login Callback Failed:', error.message);
        if (isMounted) router.replace('/');
      });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, [handleURL, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#4285F4" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2FBE2',
  },
});
