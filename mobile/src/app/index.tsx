import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, Image, TouchableOpacity, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Popup } from '../components/Popup';
import ProfileEditSection from '../components/ProfileEditSection';

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

// ★修正箇所：.envの設定に合わせて EXPO_PUBLIC_GOOGLE_CLIENT_ID を読み込む
const webClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '';
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '';
const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

export default function LoginScreen() {
  const router = useRouter();

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: webClientId,
    iosClientId: iosClientId,
    androidClientId: androidClientId,
    selectAccount: true,
  });

  const canLogin = Boolean(request);

  const [isProfileOpen, setIsProfileOpen] = useState(false);

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
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => setIsProfileOpen(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.iconText}>👤</Text>
        </TouchableOpacity>
      </View>

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

      <Popup
        visible={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        title="プロフィール設定"
        icon="person-outline"
      >
        <ProfileEditSection onSaveSuccess={() => setIsProfileOpen(false)} />
      </Popup>
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
  header: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 10,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  iconText: {
    fontSize: 22,
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