import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo } from 'react';
import { StyleSheet, View, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';




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
  const router = useRouter();
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
        router.replace('/signup');
        // モバイルアプリの場合はAsyncStorageの使用を推奨します
        // localStorage.setItem('matsunya_auth_token', body.token); 
      })
      .catch((error: Error) => {
        console.error('Google Login Failed:', error.message);
      });
  }, [router]);

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = response.params.id_token;
      if (idToken) loginWithBackend(idToken);
    }
  }, [loginWithBackend, response]);

  const handleGoogleLogin = () => {
    if (!canLogin) return;
    promptAsync();
  };

  return (
    <SafeAreaView style={styles.container}>
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
    justifyContent: 'flex-end', // ロゴを下に寄せる
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
    justifyContent: 'flex-start', // ボタンを上に寄せる
    paddingTop: 20,
  },
  googleButtonImage: {
    width: 240,
    height: 48,
  },
});
