import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
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

const dismissAuthBrowser = async () => {
  try {
    await Promise.resolve(WebBrowser.dismissBrowser());
  } catch {
    // Expo Go on Android may already have closed the browser when the deep link arrives.
  }
};

export default function OAuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string | string[]; error?: string | string[] }>();
  const { setSession } = useProfile();
  const handledCodeRef = useRef<string | null>(null);

  const handleResult = useCallback((codeValue: unknown, errorValue: unknown) => {
    const error = Array.isArray(errorValue) ? errorValue[0] : errorValue;
    if (typeof error === 'string') {
      console.error('Google Login Failed:', error);
      void dismissAuthBrowser();
      router.replace('/');
      return;
    }
    const code = Array.isArray(codeValue) ? codeValue[0] : codeValue;
    if (typeof code !== 'string' || handledCodeRef.current === code) return;
    handledCodeRef.current = code;

    fetch(`${apiUrl}/auth/google/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
      .then(async (res) => {
        const body = (await res.json()) as AuthResponse | { error?: string };
        if (!res.ok) {
          throw new Error('error' in body ? body.error : 'Googleログインに失敗しました');
        }
        return body as AuthResponse;
      })
      .then(async (body) => {
        await dismissAuthBrowser();
        await setSession({ token: body.token, profile: body.user });
        router.replace(body.user.userId ? '/home' : '/signup');
      })
      .catch((error: Error) => {
        handledCodeRef.current = null;
        console.error('Google Login Failed:', error.message);
        void dismissAuthBrowser();
        router.replace('/');
      });
  }, [router, setSession]);

  const handleURL = useCallback((url: string | null) => {
    if (!url) return;
    const parsed = Linking.parse(url);
    handleResult(parsed.queryParams?.code, parsed.queryParams?.error);
  }, [handleResult]);

  useEffect(() => {
    handleResult(params.code, params.error);
  }, [handleResult, params.code, params.error]);

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
