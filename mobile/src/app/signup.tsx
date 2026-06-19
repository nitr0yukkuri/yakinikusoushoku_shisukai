import React, { useEffect, useRef, useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useProfile } from '../contexts/profile-context';
import { getPersistableProfileImage } from '../utils/profile-image';

export default function SignUpScreen() {
  const router = useRouter();
  const { profile, avatarUrl, saveProfile } = useProfile();
  const [userId, setUserId] = useState(profile?.userId || '');
  const [userIdError, setUserIdError] = useState(''); 
  const [userName, setUserName] = useState(profile?.name || '');
  const [iconUri, setIconUri] = useState<string | null>(avatarUrl);
  const iconUriRef = useRef<string | null>(avatarUrl);
  const hasNavigatedRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!profile?.userId || hasNavigatedRef.current) return;
    hasNavigatedRef.current = true;
    router.replace('/home');
  }, [profile?.userId, router]);

  const handleSignUp = async () => {
    try {
      setIsSubmitting(true);
      const trimmedUserId = userId.trim();
      const trimmedUserName = userName.trim();
      await saveProfile({
        userId: trimmedUserId,
        userName: trimmedUserName,
        profileImage: iconUriRef.current ?? iconUri ?? avatarUrl ?? profile?.profileImage ?? '',
        bio: profile?.bio || '',
      });
      if (!hasNavigatedRef.current) {
        hasNavigatedRef.current = true;
        router.replace('/home');
      }
    } catch (error) {
      Alert.alert('エラー', error instanceof Error ? error.message : 'プロフィールの保存に失敗しました。');
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
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const nextImage = getPersistableProfileImage(result.assets[0]);
        if (!nextImage) {
          Alert.alert('エラー', 'この環境では選択した画像を保存できませんでした。別の画像を選んでください。');
          return;
        }
        iconUriRef.current = nextImage;
        setIconUri(nextImage);
      }
    } catch (error) {
      console.error("画像選択エラー:", error);
    }
  };

  const handleUserIdChange = (text: string) => {
    setUserId(text);
    const isValid = /^[a-zA-Z0-9]*$/.test(text);
    setUserIdError(!isValid && text.length > 0 ? '半角英数字のみで入力してください' : '');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        style={styles.keyboardView} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          
          <View style={styles.logoContainer}>
            <Image 
              source={require('../../assets/images/matsunya-logo.png')} 
              style={styles.logoImage}
              resizeMode="contain"
            /> 
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
  safeArea: { flex: 1, backgroundColor: '#E2FBE2' },
  keyboardView: { flex: 1 },
  scrollContainer: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40, paddingBottom: 40 },
  logoContainer: { marginBottom: 40 },
  logoImage: { width: 300, height: 90 },
  iconSection: { alignItems: 'center', marginBottom: 40 },
  iconPreview: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: '#FFFFFF',
    borderWidth: 2, borderColor: '#004499', borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center', marginBottom: 10, overflow: 'hidden',
  },
  hasImageIcon: { width: '100%', height: '100%', borderRadius: 50 },
  iconAddText: { fontSize: 40, color: '#004499', fontWeight: '300' },
  iconLabel: { fontSize: 14, color: '#333333', fontWeight: '500' },
  formSection: { width: '85%', maxWidth: 340, marginBottom: 40 },
  inputContainer: { marginBottom: 20 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#1F1F1F', marginBottom: 8, marginLeft: 4 },
  input: {
    backgroundColor: '#FFFFFF', height: 52, borderRadius: 8, paddingHorizontal: 16,
    fontSize: 16, borderWidth: 1, borderColor: '#E1E4E8', color: '#333333',
  },
  inputError: { borderColor: '#FF0000', borderWidth: 1.5 },
  errorText: { color: '#FF0000', fontSize: 12, marginTop: 6, marginLeft: 4 },
  buttonSection: { width: '85%', maxWidth: 340 },
  submitButton: {
    backgroundColor: '#FF4500', height: 52, borderRadius: 26, justifyContent: 'center',
    alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 3, elevation: 3,
  },
  submitButtonDisabled: { backgroundColor: '#FFAB91' },
  submitButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', letterSpacing: 1 },
});
