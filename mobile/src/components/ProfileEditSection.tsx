import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ProfileAvatar } from './ProfileAvatar';
import { useProfile } from '../contexts/profile-context';
import { getPersistableProfileImage, getProfileImageSignature } from '../utils/profile-image';
import { getApiUrl } from '../utils/api-url';
import { toUserErrorMessage } from '../utils/user-error';

const apiUrl = getApiUrl();

interface ProfileEditSectionProps {
  onSaveSuccess: () => void; // 保存が成功したときにポップアップを閉じるための関数
}

export default function ProfileEditSection({ onSaveSuccess }: ProfileEditSectionProps) {
  const { profile, avatarUrl, saveProfile } = useProfile();
  const [userId, setUserId] = useState<string>(profile?.userId || '');
  const [userIdError, setUserIdError] = useState('');
  const [isCheckingUserId, setIsCheckingUserId] = useState(false);
  const [isDuplicateUserId, setIsDuplicateUserId] = useState(false);
  const [name, setName] = useState<string>(profile?.name || '');
  // ★自己紹介用の状態（初期値）を追加
  const [bio, setBio] = useState<string>(profile?.bio || '');
  const [imageUri, setImageUri] = useState<string | null>(avatarUrl);
  const imageUriRef = useRef<string | null>(avatarUrl);
  const [isSaving, setIsSaving] = useState(false);
  const hasOverLimitValue = userId.length > 20 || name.length > 20;

  useEffect(() => {
    const trimmedUserId = userId.trim();
    if (
      !trimmedUserId ||
      trimmedUserId === profile?.userId ||
      trimmedUserId.length > 20 ||
      !/^[a-zA-Z0-9_]+$/.test(trimmedUserId)
    ) {
      return;
    }

    let isActive = true;
    const timer = setTimeout(async () => {
      if (isActive) setIsCheckingUserId(true);
      try {
        const response = await fetch(`${apiUrl}/profiles?userId=${encodeURIComponent(trimmedUserId)}`);
        if (!isActive) return;
        setIsDuplicateUserId(response.ok);
      } catch (error) {
        console.warn('Failed to check user ID availability:', error);
      } finally {
        if (isActive) setIsCheckingUserId(false);
      }
    }, 500);

    return () => {
      isActive = false;
      clearTimeout(timer);
    };
  }, [profile?.userId, userId]);

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert('エラー', '画像を選択するにはカメラロールへのアクセス許可が必要です。');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const nextImage = getPersistableProfileImage(result.assets[0]);
      if (!nextImage) {
        Alert.alert('エラー', 'この環境では選択した画像を保存できませんでした。別の画像を選んでください。');
        return;
      }
      imageUriRef.current = nextImage;
      setImageUri(nextImage);
    }
  };

  const handleSave = async () => {
    const trimmedUserId = userId.trim();
    if (!trimmedUserId) {
      Alert.alert('エラー', 'ユーザーIDを入力してください。');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmedUserId)) {
      Alert.alert('エラー', 'ユーザーIDは半角英数字またはアンダースコアで入力してください。');
      return;
    }
    if (trimmedUserId.length > 20) {
      Alert.alert('エラー', 'ユーザーIDを20文字以内に修正してください。');
      return;
    }
    if (isDuplicateUserId) {
      Alert.alert('エラー', 'このユーザーIDはすでに使われています。');
      return;
    }
    if (!name.trim()) {
      Alert.alert('エラー', 'ユーザーネームを入力してください。');
      return;
    }
    if (name.trim().length > 20) {
      Alert.alert('エラー', 'ユーザーネームを20文字以内に修正してください。');
      return;
    }

    try {
      if (!profile) {
        throw new Error('プロフィール登録が完了していません。');
      }

      setIsSaving(true);
      await saveProfile({
        userId: trimmedUserId,
        userName: name.trim(),
        profileImage: imageUriRef.current ?? imageUri ?? avatarUrl ?? profile.profileImage ?? '',
        bio,
      });
      Alert.alert('成功', 'プロフィールを更新しました。');
      onSaveSuccess();
    } catch (error) {
      Alert.alert('エラー', toUserErrorMessage(error, 'プロフィールの更新に失敗しました。'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    // キーボードが出たり項目が増えたりしてもスクロールできるようにScrollViewにしています
    <ScrollView 
      style={styles.scrollView} 
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>アイコン設定</Text>

      {/* アイコン画像 */}
      <TouchableOpacity onPress={pickImage} style={styles.avatarButton}>
        <ProfileAvatar
          key={`${name}:${getProfileImageSignature(imageUri)}`}
          name={name}
          profileImage={imageUri}
          size={98}
          style={styles.avatar}
        />
      </TouchableOpacity>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>ユーザーID</Text>
        <TextInput
          style={[styles.input, userIdError ? styles.inputError : null]}
          value={userId}
          onChangeText={(value) => {
            setUserId(value);
            setIsCheckingUserId(false);
            setIsDuplicateUserId(false);
            setUserIdError(value && !/^[a-zA-Z0-9_]*$/.test(value) ? '半角英数字またはアンダースコアで入力してください' : '');
          }}
          placeholder="半角英数字・_で入力"
          placeholderTextColor="rgba(51, 51, 51, 0.45)"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
        />
        {userIdError ? <Text style={styles.errorText}>{userIdError}</Text> : null}
        {isDuplicateUserId ? <Text style={styles.errorText}>このユーザーIDはすでに使われています</Text> : null}
        {userId.length > 20 ? (
          <Text style={styles.limitWarning}>20文字を超えています。20文字以内に修正してください</Text>
        ) : userId.length === 20 ? (
          <Text style={styles.limitWarning}>ユーザーIDは20文字までです</Text>
        ) : null}
        <Text style={styles.charCount}>{userId.length} / 20</Text>
      </View>

      {/* ユーザーネーム入力 */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>ユーザーネーム</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="アプリ内で表示される名前"
          placeholderTextColor="rgba(51, 51, 51, 0.45)"
          maxLength={20}
        />
        {name.length > 20 ? (
          <Text style={styles.limitWarning}>20文字を超えています。20文字以内に修正してください</Text>
        ) : name.length === 20 ? (
          <Text style={styles.limitWarning}>ユーザーネームは20文字までです</Text>
        ) : null}
        <Text style={styles.charCount}>{name.length} / 20</Text>
      </View>

      {/* ★追加：自己紹介入力 */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>自己紹介</Text>
        <TextInput
          style={[styles.input, styles.textArea]} // 複数行用のスタイルを適用
          value={bio}
          onChangeText={setBio}
          placeholder="簡単な自己紹介を入力してください"
          placeholderTextColor="rgba(51, 51, 51, 0.45)"
          maxLength={100} // 最大100文字
          multiline={true} // 複数行入力を有効にする
          numberOfLines={4} // Android用のおおよその行数目安
          textAlignVertical="top" // iOS/Androidで文字が上から始まるようにする
        />
        <Text style={styles.charCount}>{bio.length} / 100</Text>
      </View>

      {/* 保存ボタン */}
      <TouchableOpacity
        style={[styles.saveButton, (isSaving || hasOverLimitValue || isCheckingUserId || isDuplicateUserId) && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={isSaving || hasOverLimitValue || isCheckingUserId || isDuplicateUserId}
      >
        <Text style={styles.saveButtonText}>保存する</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    width: '100%',
  },
  container: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  avatarButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 20,
  },
  avatar: {
    borderRadius: 49,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fafafa',
    color: '#333',
  },
  inputError: {
    borderColor: '#c62828',
  },
  errorText: {
    color: '#c62828',
    fontSize: 12,
    marginTop: 4,
  },
  limitWarning: {
    color: '#c62828',
    fontSize: 12,
    marginTop: 4,
  },
  // ★自己紹介用の長方形の枠スタイル
  textArea: {
    height: 100, // 高さを広げる
    paddingTop: 12, // 上側の余白を調整
  },
  // ★右下に文字数を表示するスタイル
  charCount: {
    textAlign: 'right',
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  saveButton: {
    width: '100%',
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
