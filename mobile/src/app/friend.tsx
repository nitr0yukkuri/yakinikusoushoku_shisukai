import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList, 
  TextInput,
  SafeAreaView
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Popup } from '../components/Popup';
import { ProfileAvatar } from '../components/ProfileAvatar';

// 動作確認用のダミーデータ（後でバックエンドのAPIと連携させます）
const DUMMY_FRIENDS = [
  { id: '1', name: '焼肉 太郎', bio: 'カルビしか勝たん' },
  { id: '2', name: 'ホルモン 花子', bio: '週末はいつも焼肉です！' },
];

export default function FriendScreen() {
  // ポップアップの表示/非表示を管理するState
  const [isAddPopupVisible, setIsAddPopupVisible] = useState(false);
  // 入力された検索IDを管理するState
  const [searchId, setSearchId] = useState('');

  // フレンドリストの1行分を描画する関数
  const renderFriendItem = ({ item }: { item: typeof DUMMY_FRIENDS[0] }) => (
    <View style={styles.friendCard}>
      <ProfileAvatar url={null} size={50} />
      <View style={styles.friendInfo}>
        <Text style={styles.friendName}>{item.name}</Text>
        <Text style={styles.friendBio}>{item.bio}</Text>
      </View>
      <TouchableOpacity style={styles.actionButton}>
        <Ionicons name="chevron-forward" size={20} color="#CCC" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 画面上部のヘッダー設定 */}
      <Stack.Screen 
        options={{
          title: 'フレンド',
          headerRight: () => (
            <TouchableOpacity 
              onPress={() => setIsAddPopupVisible(true)} 
              style={styles.headerAddButton}
            >
              <Ionicons name="person-add" size={24} color="#FF6B6B" />
            </TouchableOpacity>
          )
        }} 
      />

      {/* フレンド一覧 */}
      <FlatList
        data={DUMMY_FRIENDS}
        keyExtractor={(item) => item.id}
        renderItem={renderFriendItem}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={60} color="#DDD" />
            <Text style={styles.emptyText}>まだフレンドがいません</Text>
          </View>
        }
      />

      {/* フレンド追加用のポップアップ（自作コンポーネントを使用） */}
      <Popup 
        visible={isAddPopupVisible} 
        onClose={() => setIsAddPopupVisible(false)}
      >
        <View style={styles.popupContent}>
          <View style={styles.popupHeader}>
            <Text style={styles.popupTitle}>フレンド追加</Text>
          </View>
          
          <Text style={styles.popupDescription}>
            ユーザーIDを入力してフレンドを検索します。
          </Text>
          
          <TextInput
            style={styles.input}
            placeholder="ユーザーID (例: user_1234)"
            placeholderTextColor="#999"
            value={searchId}
            onChangeText={setSearchId}
            autoCapitalize="none"
          />
          
          <View style={styles.popupActionRow}>
            {/* QRコード読み取りボタン */}
            <TouchableOpacity style={styles.qrButton}>
              <Ionicons name="qr-code-outline" size={24} color="#666" />
              <Text style={styles.qrButtonText}>QR読取</Text>
            </TouchableOpacity>

            {/* 検索ボタン（文字が入力されていない時は薄くする） */}
            <TouchableOpacity 
              style={[styles.searchButton, !searchId && styles.searchButtonDisabled]}
              disabled={!searchId}
              onPress={() => {
                console.log('検索実行:', searchId);
                // TODO: ここに検索APIを呼ぶ処理を追加
              }}
            >
              <Text style={styles.searchButtonText}>検索</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Popup>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  headerAddButton: {
    padding: 8,
  },
  listContainer: {
    padding: 16,
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    // iOS用の影
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    // Android用の影
    elevation: 2,
  },
  friendInfo: {
    flex: 1,
    marginLeft: 16,
  },
  friendName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  friendBio: {
    fontSize: 13,
    color: '#666',
  },
  actionButton: {
    padding: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
  },
  // --- ポップアップ内のスタイル ---
  popupContent: {
    padding: 24,
  },
  popupHeader: {
    marginBottom: 16,
    alignItems: 'center',
  },
  popupTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  popupDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 24,
  },
  popupActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  qrButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    gap: 8,
  },
  qrButtonText: {
    color: '#666',
    fontWeight: 'bold',
    fontSize: 15,
  },
  searchButton: {
    flex: 1,
    backgroundColor: '#FF6B6B',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  searchButtonDisabled: {
    backgroundColor: '#FFBABA', // 入力がない時は少し薄い赤色にする
  },
  searchButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});