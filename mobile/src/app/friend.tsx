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
import { Footer } from '../components/Footer';

// 動作確認用のダミーデータ
const DUMMY_FRIENDS = [
  { id: '1', name: '焼肉 太郎', bio: 'カルビしか勝たん' },
  { id: '2', name: 'ホルモン 花子', bio: '週末はいつも焼肉です！' },
];

export default function FriendScreen() {
  const [isAddPopupVisible, setIsAddPopupVisible] = useState(false);
  const [searchId, setSearchId] = useState('');

  const renderFriendItem = ({ item }: { item: typeof DUMMY_FRIENDS[0] }) => (
    <View style={styles.friendCard}>
      <ProfileAvatar profileImage={null} name={item.name} size={50} />
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

      {/* 修正箇所：Popup.tsx の機能を正しく使うように変更 */}
      <Popup 
        visible={isAddPopupVisible} 
        onClose={() => setIsAddPopupVisible(false)}
        title="フレンド追加"
        message="ユーザーIDを入力してフレンドを検索します。"
        icon="person-add-outline" // ヘッダー左のアイコンを指定
      >
        {/* titleやmessageはPopup側が描画してくれるので、ここには入力欄とボタンだけ置く */}
        <View style={styles.popupFormContainer}>
          <TextInput
            style={styles.input}
            placeholder="ユーザーID (例: user_1234)"
            placeholderTextColor="#999"
            value={searchId}
            onChangeText={setSearchId}
            autoCapitalize="none"
          />
          
          <View style={styles.popupActionRow}>
            <TouchableOpacity style={styles.qrButton}>
              <Ionicons name="qr-code-outline" size={24} color="#666" />
              <Text style={styles.qrButtonText}>QR読取</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.searchButton, !searchId && styles.searchButtonDisabled]}
              disabled={!searchId}
              onPress={() => {
                console.log('検索実行:', searchId);
              }}
            >
              <Text style={styles.searchButtonText}>検索</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Popup>

      <Footer />
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
    paddingBottom: 100, // フッターに隠れないように余白を追加
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
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
  
  // --- ポップアップの中身専用のスタイル ---
  popupFormContainer: {
    width: '100%',
    paddingHorizontal: 10,
    marginTop: 20, // メッセージと入力欄の間を開ける
  },
  input: {
    backgroundColor: '#FFFFFF', // ポップアップの背景(緑)に対して目立つように白に
    borderWidth: 1,
    borderColor: '#CCC',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DDD',
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
    backgroundColor: '#FFBABA',
  },
  searchButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});