import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList, 
  TextInput,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProfileAvatar } from './ProfileAvatar';

// 動作確認用のダミーデータ
const DUMMY_FRIENDS = [
  { id: '1', name: '友達A', profileImage: null },
  { id: '2', name: '友達B', profileImage: null },
];

export const FriendPanel: React.FC = () => {
  // 現在表示している画面（タブ）を管理するState
  // 'list': フレンド一覧, 'search': ID検索, 'qr': QRコード
  const [activeTab, setActiveTab] = useState<'list' | 'search' | 'qr'>('list');
  const [searchId, setSearchId] = useState('');

  // 1. フレンド一覧画面
  if (activeTab === 'list') {
    return (
      <View style={styles.container}>
        <View style={styles.topActionContainer}>
          <TouchableOpacity style={styles.topActionButton} onPress={() => setActiveTab('search')}>
            <Ionicons name="person-add-outline" size={24} color="#333" />
            <Text style={styles.topActionText}>ID検索</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.topActionButton} onPress={() => setActiveTab('qr')}>
            <Ionicons name="qr-code-outline" size={24} color="#333" />
            <Text style={styles.topActionText}>QRコード</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.pendingRequestButton}>
          <Text style={styles.pendingRequestText}>保留中の申請</Text>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>

        <View style={styles.friendListSection}>
          <Text style={styles.sectionTitle}>フレンド</Text>
          <FlatList
            data={DUMMY_FRIENDS}
            keyExtractor={(item) => item.id}
            scrollEnabled={false} // ポップアップ内なのでスクロールは外側に任せる
            renderItem={({ item }) => (
              <View style={styles.friendListItem}>
                <ProfileAvatar profileImage={item.profileImage} name={item.name} size={40} />
                <Text style={styles.friendName}>{item.name}</Text>
              </View>
            )}
          />
        </View>
      </View>
    );
  }

  // 2. ID検索画面
  if (activeTab === 'search') {
    return (
      <View style={styles.container}>
        <View style={styles.subHeader}>
          <TouchableOpacity onPress={() => setActiveTab('list')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color="#4d6048" />
            <Text style={styles.backButtonText}>戻る</Text>
          </TouchableOpacity>
          <Text style={styles.subHeaderTitle}>ID検索</Text>
        </View>

        <TextInput
          style={styles.input}
          placeholder="IDを入力"
          placeholderTextColor="#999"
          value={searchId}
          onChangeText={setSearchId}
          autoCapitalize="none"
        />

        <Text style={styles.sectionTitle}>検索結果</Text>
        
        {/* 検索結果がある場合のみ表示する処理（今はダミーを固定表示） */}
        <View style={styles.searchResultItem}>
          <ProfileAvatar profileImage={null} name="ともだちA" size={40} />
          <Text style={styles.searchResultName}>ともだちA</Text>
          <TouchableOpacity style={styles.requestButton}>
            <Text style={styles.requestButtonText}>申請</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // 3. QRコード画面
  if (activeTab === 'qr') {
    return (
      <View style={styles.container}>
        <View style={styles.subHeader}>
          <TouchableOpacity onPress={() => setActiveTab('list')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color="#4d6048" />
            <Text style={styles.backButtonText}>戻る</Text>
          </TouchableOpacity>
          <Text style={styles.subHeaderTitle}>マイQRコード</Text>
        </View>

        <View style={styles.qrContainer}>
          <View style={styles.qrCodePlaceholder}>
            <Ionicons name="qr-code" size={150} color="#333" />
            {/* 本番では react-native-qrcode-svg などを使って本物のQRを生成します */}
          </View>
          <Text style={styles.qrDescription}>
            相手に読み取ってもらい、{'\n'}フレンドを追加してください
          </Text>
        </View>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    padding: 16,
    backgroundColor: '#e2fbe2', // 画面の背景色と統一
  },
  
  // --- リスト画面のスタイル ---
  topActionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  topActionButton: {
    alignItems: 'center',
    gap: 8,
  },
  topActionText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  pendingRequestButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  pendingRequestText: {
    fontSize: 16,
    color: '#333',
  },
  friendListSection: {
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  friendListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  friendName: {
    fontSize: 16,
    color: '#333',
  },

  // --- サブ画面（検索・QR）の共通スタイル ---
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#c5e8c5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4d6048',
    position: 'absolute',
    left: 0,
    zIndex: 1,
  },
  backButtonText: {
    fontSize: 12,
    color: '#4d6048',
    fontWeight: 'bold',
    marginLeft: 2,
  },
  subHeaderTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },

  // --- 検索画面のスタイル ---
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 24,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  searchResultName: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  requestButton: {
    backgroundColor: '#bde0fe',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#64b5f6',
  },
  requestButtonText: {
    color: '#1565c0',
    fontWeight: 'bold',
  },

  // --- QRコード画面のスタイル ---
  qrContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  qrCodePlaceholder: {
    width: 200,
    height: 200,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#000',
    marginBottom: 20,
  },
  qrDescription: {
    textAlign: 'center',
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
});