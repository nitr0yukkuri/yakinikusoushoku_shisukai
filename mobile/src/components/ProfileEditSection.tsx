import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

interface ProfileEditSectionProps {
  onSaveSuccess: () => void; // 保存が成功したときにポップアップを閉じるための関数
}

const [imageBase64, setImageBase64] = useState<string | null>(null);

export default function ProfileEditSection({ onSaveSuccess }: ProfileEditSectionProps) {
  const [name, setName] = useState<string>('現在のユーザー名');
  // ★自己紹介用の状態（初期値）を追加
  const [bio, setBio] = useState<string>('よろしくお願いします！');
  const [imageUri, setImageUri] = useState<string | null>(null);

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
      quality: 0.3,   // データサイズを小さくするために画質を下げます
      base64: true,   // ★追加: 画像を文字列(Base64)として取得します
    });

if (!result.canceled) {
      setImageUri(result.assets[0].uri);
      // JSONで送るためにBase64形式のデータを保存します
      setImageBase64(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('エラー', '名前を入力してください。');
      return;
    }

   try {
      // APIエンドポイント (ローカル開発環境の場合は自分のPCのIPアドレス等に書き換えてください)
      const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';
      
      // ★注意★
      // 現在のバックエンドは「ログイン済みのユーザーのみ」がプロファイルを更新できる仕様です。
      // そのため、実際にはGoogleログイン時に取得した "token" をヘッダーにセットする必要があります。
      // const token = '取得したトークン'; 

      const response = await fetch(`${apiUrl}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          // 'Authorization': `Bearer ${token}` // ★実装が進んだらコメントアウトを外してトークンを入れてください
        },
        body: JSON.stringify({
          userName: name,
          bio: bio,
          profileImage: imageBase64 // Base64文字列を送る
        }),
      });

      if (!response.ok) {
        throw new Error('バックエンドのエラー');
      }

      Alert.alert('成功', 'プロフィールを更新しました。');
      onSaveSuccess(); 
    } catch (error) {
      console.error(error);
      Alert.alert('エラー', 'プロフィールの更新に失敗しました。');
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
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarPlaceholderText}>変更</Text>
          </View>
        )}
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
      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
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
    fontSize: 14,
    fontWeight: 'bold',
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