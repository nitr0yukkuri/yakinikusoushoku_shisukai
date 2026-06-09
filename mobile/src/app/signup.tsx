import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform,
  ScrollView,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

export default function SignUpScreen() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [userIdError, setUserIdError] = useState(''); 
  const [userName, setUserName] = useState('');
  const [iconUri, setIconUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignUp = async () => {
    const token = localStorage.getItem('matsunya_auth_token');
    if (!token) {
      console.error('Sign Up Failed: login token was not found.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch(`${apiUrl}/auth/profile`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          userName,
          profileImage: iconUri ?? '',
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error ?? 'Sign up failed.');
      }
      console.log('Sign Up Success:', body.user);
      router.push('/home');
    } catch (error) {
      console.error('Sign Up Failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };
  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIconUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error("画像選択エラー:", error);
    }
  };

  const handleUserIdChange = (text: string) => {
    setUserId(text);
    const isValid = /^[a-zA-Z0-9]*$/.test(text);
    
    if (!isValid && text.length > 0) {
      setUserIdError('半角英数字のみで入力してください');
    } else {
      setUserIdError('');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        style={styles.keyboardView} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          
          <View style={styles.logoContainer}>
            {/* ▼▼▼ 画像が完成したらここから削除 ▼▼▼ */}
            <View style={styles.logoMock}>
              <View style={styles.iconCircle}>
                <View style={[styles.eye, { left: 4, top: 6, backgroundColor: '#FFF500' }]} />
                <View style={[styles.eye, { right: 4, bottom: 6, backgroundColor: '#0044FF' }]} />
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

          <View style={styles.iconSection}>
            <TouchableOpacity style={styles.iconPreview} onPress={handlePickImage} activeOpacity={0.8}>
              {iconUri ? (
                <Image source={{ uri: iconUri }} style={styles.hasImageIcon} />
              ) : (
                <Text style={styles.iconAddText}>+</Text>
              )}
            </TouchableOpacity>
            <Text style={styles.iconLabel}>アイコンを追加</Text>
          </View>

          <View style={styles.formSection}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>ユーザーID</Text>
              <TextInput
                style={[styles.input, userIdError ? styles.inputError : null]}
                placeholder="半角英数字で入力"
                placeholderTextColor="#A0A0A0"
                value={userId}
                onChangeText={handleUserIdChange}
                autoCapitalize="none"
              />
              {userIdError ? <Text style={styles.errorText}>{userIdError}</Text> : null}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>ユーザーネーム</Text>
              <TextInput
                style={styles.input}
                placeholder="アプリ内で表示される名前"
                placeholderTextColor="#A0A0A0"
                value={userName}
                onChangeText={setUserName}
              />
            </View>
          </View>

          <View style={styles.buttonSection}>
            <TouchableOpacity 
              style={[
                styles.submitButton,
                (!userId || !userName || userIdError !== '' || isSubmitting) && styles.submitButtonDisabled
              ]} 
              onPress={handleSignUp}
              disabled={!userId || !userName || userIdError !== '' || isSubmitting}
              activeOpacity={0.8}
            >
              <Text style={styles.submitButtonText}>新規登録</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ==========================================
  // 共通・本番用のスタイル（残す部分）
  // ==========================================
  safeArea: {
    flex: 1,
    backgroundColor: '#E2FBE2',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
    paddingBottom: 40,
  },
  logoContainer: {
    marginBottom: 40,
  },
  // 本番用：画像を貼る時のスタイル設定
  logoImage: {
    width: 200, 
    height: 60,
  },
  iconSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconPreview: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#004499',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    overflow: 'hidden',
  },
  hasImageIcon: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
  },
  iconAddText: {
    fontSize: 40,
    color: '#004499',
    fontWeight: '300',
  },
  iconLabel: {
    fontSize: 14,
    color: '#333333',
    fontWeight: '500',
  },
  formSection: {
    width: '85%',
    maxWidth: 340,
    marginBottom: 40,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F1F1F',
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#FFFFFF',
    height: 52,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E1E4E8',
    color: '#333333',
  },
  inputError: {
    borderColor: '#FF0000',
    borderWidth: 1.5,
  },
  errorText: {
    color: '#FF0000',
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
  buttonSection: {
    width: '85%',
    maxWidth: 340,
  },
  submitButton: {
    backgroundColor: '#FF4500',
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  submitButtonDisabled: {
    backgroundColor: '#FFAB91',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  // ==========================================
  // 【不要になるCSS】画像ができたら丸ごと削除OK！
  // ==========================================
  logoMock: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF4500',
    marginRight: 8,
  },
  eye: {
    width: 10,
    height: 10,
    borderRadius: 5,
    position: 'absolute',
    borderWidth: 1,
    borderColor: '#000',
  },
  logoText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#004499',
  },
});