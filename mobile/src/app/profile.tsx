import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export default function ProfileScreen() {
  // 初期値にはバックエンドから取得した既存のユーザー情報をセットする想定です
  const [name, setName] = useState<string>('現在のユーザー名');
  const [imageUri, setImageUri] = useState<string | null>(null);

  // 端末のギャラリーから画像を選択する関数
  const pickImage = async () => {
    // ギャラリーへのアクセス権限をリクエスト（初回のみ表示されます）
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('エラー', '画像を選択するにはカメラロールへのアクセス許可が必要です。');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1], // アイコン用に1:1の比率でトリミング
      quality: 0.8,   // 画質（0〜1）
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  // 保存ボタン押下時の処理
  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('エラー', '名前を入力してください。');
      return;
    }

    try {
      // TODO: ここでGoのバックエンドAPIにデータを送信します
      // 画像がある場合は FormData を使用してマルチパートリクエストを送信するのが一般的です
      /*
      const formData = new FormData();
      formData.append('name', name);
      if (imageUri) {
        formData.append('icon', {
          uri: imageUri,
          name: 'profile_icon.jpg',
          type: 'image/jpeg',
        } as any);
      }
      await api.patch('/users/me', formData);
      */

      Alert.alert('成功', 'プロフィールを更新しました。');
    } catch (error) {
      Alert.alert('エラー', 'プロフィールの更新に失敗しました。');
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* アイコン変更セクション */}
        <View style={styles.avatarContainer}>
          <TouchableOpacity onPress={pickImage} style={styles.avatarButton}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarPlaceholderText}>変更</Text>
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.hintText}>タップしてアイコンを変更</Text>
        </View>

        {/* 名前変更セクション */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>名前</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="名前を入力してください"
            maxLength={20}
          />
        </View>

        {/* 保存ボタン */}
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>保存する</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
  },
  avatarContainer: {
    alignItems: 'center',
    marginVertical: 32,
  },
  avatarButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e1e1e1',
  },
  avatarPlaceholderText: {
    color: '#666',
    fontWeight: 'bold',
  },
  hintText: {
    marginTop: 12,
    fontSize: 12,
    color: '#666',
  },
  inputContainer: {
    width: '100%',
    marginBottom: 32,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  saveButton: {
    width: '100%',
    backgroundColor: '#007AFF', // テーマカラーに合わせて変更してください
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});