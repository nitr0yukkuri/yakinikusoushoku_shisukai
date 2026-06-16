import React, { useRef, useState } from 'react';
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

interface ProfileEditSectionProps {
  onSaveSuccess: () => void; // 保存が成功したときにポップアップを閉じるための関数
}

export default function ProfileEditSection({ onSaveSuccess }: ProfileEditSectionProps) {
  const { profile, avatarUrl, saveProfile } = useProfile();
  const [name, setName] = useState<string>(profile?.name || '');
  // ★自己紹介用の状態（初期値）を追加
  const [bio, setBio] = useState<string>(profile?.bio || '');
  const [imageUri, setImageUri] = useState<string | null>(avatarUrl);
  const imageUriRef = useRef<string | null>(avatarUrl);
  const [isSaving, setIsSaving] = useState(false);

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
    if (!name.trim()) {
      Alert.alert('エラー', '名前を入力してください。');
      return;
    }

    try {
      if (!profile?.userId) {
        throw new Error('プロフィール登録が完了していません。');
      }

      setIsSaving(true);
      await saveProfile({
        userId: profile.userId,
        userName: name,
        profileImage: imageUriRef.current ?? imageUri ?? avatarUrl ?? profile.profileImage ?? '',
        bio,
      });
      Alert.alert('成功', 'プロフィールを更新しました。');
      onSaveSuccess();
    } catch (error) {
      Alert.alert(
        'エラー',
        error instanceof Error ? error.message : 'プロフィールの更新に失敗しました。',
      );
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

      {/* 名前入力 */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>名前</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="名前を入力"
          maxLength={20}
        />
      </View>

      {/* ★追加：自己紹介入力 */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>自己紹介</Text>
        <TextInput
          style={[styles.input, styles.textArea]} // 複数行用のスタイルを適用
          value={bio}
          onChangeText={setBio}
          placeholder="簡単な自己紹介を入力してください"
          maxLength={100} // 最大100文字
          multiline={true} // 複数行入力を有効にする
          numberOfLines={4} // Android用のおおよその行数目安
          textAlignVertical="top" // iOS/Androidで文字が上から始まるようにする
        />
        <Text style={styles.charCount}>{bio.length} / 100</Text>
      </View>

      {/* 保存ボタン */}
      <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={isSaving}>
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
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
