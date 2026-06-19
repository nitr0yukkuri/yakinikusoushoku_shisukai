import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProfileAvatar } from './ProfileAvatar';

// 動作確認用のダミーデータ
const DUMMY_FRIENDS = [
  { id: '1', name: '焼肉 太郎', bio: 'カルビしか勝たん' },
  { id: '2', name: 'ホルモン 花子', bio: '週末はいつも焼肉です！' },
];

interface FriendPanelProps {
  onOpenAddFriend: () => void; // 追加ボタンが押された時の処理を受け取る
}

export default function FriendPanel({ onOpenAddFriend }: FriendPanelProps) {
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
    <View style={styles.container}>
      {/* フレンド追加ボタン */}
      <TouchableOpacity style={styles.addButton} onPress={onOpenAddFriend}>
        <Ionicons name="person-add" size={20} color="#FFF" />
        <Text style={styles.addButtonText}>新しいフレンドを追加</Text>
      </TouchableOpacity>

      {/* フレンド一覧 */}
      <FlatList
        data={DUMMY_FRIENDS}
        keyExtractor={(item) => item.id}
        renderItem={renderFriendItem}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={60} color="#DDD" />
            <Text style={styles.emptyText}>まだフレンドがいません</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flex: 1,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B6B',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
    marginHorizontal: 4,
  },
  addButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  listContainer: {
    paddingBottom: 40,
    paddingHorizontal: 4,
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f6fff1',
    borderWidth: 1,
    borderColor: '#4d6048',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  friendInfo: {
    flex: 1,
    marginLeft: 16,
  },
  friendName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f1f1f',
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
    paddingTop: 40,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
  },
});