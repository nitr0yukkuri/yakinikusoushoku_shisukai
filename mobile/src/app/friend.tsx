import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import Popup from '@/components/Popup'; // 実際のパスに合わせてください

export default function FriendRegistrationScreen() {
  const [isPopupVisible, setPopupVisible] = useState(false);
  const [friendId, setFriendId] = useState('');

  // フレンド追加処理
  const handleAddFriend = () => {
    if (!friendId.trim()) return;
    
    // TODO: ここにバックエンド（API）へのフレンド登録リクエストを実装します
    console.log('登録リクエスト:', friendId);

    // 処理完了後にポップアップを閉じ、入力をリセットする
    setPopupVisible(false);
    setFriendId('');
  };

  return (
    <View style={styles.container}>
      {/* ポップアップを開くトリガーボタン */}
      <TouchableOpacity style={styles.openButton} onPress={() => setPopupVisible(true)}>
        <Text style={styles.buttonText}>フレンドを追加する</Text>
      </TouchableOpacity>

      {/* フレンド登録用ポップアップ */}
      <Popup visible={isPopupVisible} onClose={() => setPopupVisible(false)}>
        <View style={styles.popupContent}>
          <Text style={styles.title}>フレンド登録</Text>
          <Text style={styles.description}>追加したいユーザーのIDを入力してください。</Text>
          
          <TextInput
            style={styles.input}
            placeholder="ユーザーID (例: user_123)"
            value={friendId}
            onChangeText={setFriendId}
            autoCapitalize="none"
            autoCorrect={false}
          />
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.cancelButton} 
              onPress={() => setPopupVisible(false)}
            >
              <Text style={styles.cancelButtonText}>キャンセル</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.submitButton, !friendId.trim() && styles.submitButtonDisabled]} 
              onPress={handleAddFriend}
              disabled={!friendId.trim()}
            >
              <Text style={styles.submitButtonText}>追加</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Popup>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  openButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  popupContent: {
    width: '100%',
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: '#f9f9f9',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    marginRight: 10,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: 'bold',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 12,
    marginLeft: 10,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#99c7ff',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});