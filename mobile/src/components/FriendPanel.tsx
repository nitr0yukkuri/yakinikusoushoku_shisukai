import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { useProfile } from '../contexts/profile-context';
import { getApiUrl } from '../utils/api-url';
import { toUserErrorMessage } from '../utils/user-error';
import { ProfileAvatar } from './ProfileAvatar';

type Friend = { userId: string; name: string; profileImage: string };
type SearchResult = { profile: Friend; relationship: 'self' | 'friends' | 'outgoing_pending' | 'incoming_pending' | 'none' };
type FriendRequest = { id: number; user: Friend; createdAt: string };

const apiUrl = getApiUrl();

// ==========================================
// ① メインのフレンド一覧コンポーネント
// ==========================================
interface FriendPanelProps {
  onOpenSearch: () => void;
  onOpenQR: () => void;
  onOpenRequests: () => void; // ★追加
}

export const FriendPanel: React.FC<FriendPanelProps> = ({ onOpenSearch, onOpenQR, onOpenRequests }) => {
  const { token } = useProfile();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [message, setMessage] = useState('');

  const loadFriends = useCallback(async () => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    const [friendsResponse, requestsResponse] = await Promise.all([
      fetch(`${apiUrl}/friends`, { headers }),
      fetch(`${apiUrl}/friends/requests`, { headers }),
    ]);
    const friendsBody = await friendsResponse.json();
    const requestsBody = await requestsResponse.json();
    if (!friendsResponse.ok) throw new Error(friendsBody.error || 'フレンドを取得できませんでした');
    if (!requestsResponse.ok) throw new Error(requestsBody.error || '申請を取得できませんでした');
    setFriends(friendsBody.friends || []);
    setIncoming(requestsBody.incoming || []);
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;

    const refreshFriends = async () => {
      try {
        await loadFriends();
      } catch (error) {
        if (!cancelled) setMessage(toUserErrorMessage(error, 'フレンドを取得できませんでした'));
      } finally {
        if (!cancelled) refreshTimer = setTimeout(refreshFriends, 3000);
      }
    };

    refreshFriends();
    return () => {
      cancelled = true;
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, [loadFriends]);

  return (
    <View style={styles.container}>
      <View style={styles.topActionContainer}>
        <TouchableOpacity style={styles.topActionButton} onPress={onOpenSearch}>
          <Ionicons name="person-add-outline" size={24} color="#333" />
          <Text style={styles.topActionText}>ID検索</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.topActionButton} onPress={onOpenQR}>
          <Ionicons name="qr-code-outline" size={24} color="#333" />
          <Text style={styles.topActionText}>QRコード</Text>
        </TouchableOpacity>
      </View>
      
      {/* ★変更: タップでポップアップを開くようにし、アイコンを横矢印に変更 */}
      <TouchableOpacity style={styles.pendingRequestButton} onPress={onOpenRequests}>
        <Text style={styles.pendingRequestText}>保留中の申請 {incoming.length > 0 ? `(${incoming.length})` : ''}</Text>
        <Ionicons name="chevron-forward" size={20} color="#666" />
      </TouchableOpacity>

      <View style={styles.friendListSection}>
        <Text style={styles.sectionTitle}>フレンド</Text>
        <FlatList
          data={friends}
          keyExtractor={(item) => item.userId}
          scrollEnabled={false}
          ListEmptyComponent={<Text style={styles.emptyText}>フレンドがいません</Text>}
          renderItem={({ item }) => (
            <View style={styles.friendListItem}>
              <ProfileAvatar profileImage={item.profileImage} name={item.name} size={40} />
              <View style={styles.friendTextArea}>
                <Text style={styles.friendName}>{item.name}</Text>
                <Text style={styles.userId}>@{item.userId}</Text>
              </View>
            </View>
          )}
        />
      </View>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
};

// ==========================================
// ② ID検索用のコンポーネント
// ==========================================
export const FriendSearchPanel: React.FC = () => {
  const { token } = useProfile();
  const [searchId, setSearchId] = useState('');
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const searchUser = async () => {
    if (!token || !searchId.trim()) return;
    setIsLoading(true);
    setMessage('');
    setSearchResult(null);
    try {
      const response = await fetch(`${apiUrl}/friends/search?userId=${encodeURIComponent(searchId.trim())}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json();
      if (response.status === 404) throw new Error('そのユーザーはいません');
      if (!response.ok) throw new Error(body.error || 'ユーザーが見つかりませんでした');
      setSearchResult(body);
    } catch (error) {
      setMessage(toUserErrorMessage(error, '検索できませんでした'));
    } finally {
      setIsLoading(false);
    }
  };

  const sendRequest = async () => {
    if (!token || !searchResult) return;
    setIsLoading(true);
    setMessage('');
    try {
      const response = await fetch(`${apiUrl}/friends/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: searchResult.profile.userId }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || '申請を送信できませんでした');
      setSearchResult({ ...searchResult, relationship: 'outgoing_pending' });
      setMessage('フレンド申請を送信しました');
    } catch (error) {
      setMessage(toUserErrorMessage(error, '申請を送信できませんでした'));
    } finally {
      setIsLoading(false);
    }
  };

  const requestLabel = searchResult?.relationship === 'none' ? '申請' : searchResult?.relationship === 'friends'
    ? 'フレンド' : searchResult?.relationship === 'self' ? '自分' : '申請中';

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="IDを入力"
          placeholderTextColor="#999"
          value={searchId}
          onChangeText={setSearchId}
          onSubmitEditing={searchUser}
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.searchButton} onPress={searchUser} disabled={isLoading}>
          <Ionicons name="search" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
      <Text style={styles.sectionTitle}>検索結果</Text>
      {isLoading ? <ActivityIndicator color="#267a3f" /> : null}
      {searchResult ? (
        <View style={styles.searchResultItem}>
          <ProfileAvatar profileImage={searchResult.profile.profileImage} name={searchResult.profile.name} size={40} />
          <View style={styles.friendTextArea}>
            <Text style={styles.searchResultName}>{searchResult.profile.name}</Text>
            <Text style={styles.userId}>@{searchResult.profile.userId}</Text>
          </View>
          <TouchableOpacity
            style={[styles.requestButton, searchResult.relationship !== 'none' && styles.disabledButton]}
            onPress={sendRequest}
            disabled={searchResult.relationship !== 'none' || isLoading}
          >
            <Text style={styles.requestButtonText}>{requestLabel}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
};

// ==========================================
// ③ QRコード用のコンポーネント
// ==========================================
export const FriendQRPanel: React.FC = () => {
  const { token } = useProfile();
  const [qrValue, setQrValue] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    const fetchQR = async () => {
      if (!token) return;
      try {
        const response = await fetch(`${apiUrl}/friends/qr`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'QRコードを取得できませんでした');
        if (isMounted) setQrValue(body.value);
      } catch (error) {
        if (isMounted) setMessage(toUserErrorMessage(error, 'QRコードを取得できませんでした'));
      }
    };

    fetchQR();

    return () => {
      isMounted = false;
    };
  }, [token]);

  return (
    <View style={styles.container}>
      <View style={styles.qrContainer}>
        {qrValue ? (
          <View style={styles.qrCodeWrapper}>
            <QRCode value={qrValue} size={180} color="#1f1f1f" backgroundColor="#FFFFFF" />
          </View>
        ) : <ActivityIndicator color="#267a3f" />}
        <Text style={styles.qrDescription}>相手に読み取ってもらい{`\n`}フレンドを追加してください</Text>
      </View>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
};

// ==========================================
// ④ 保留中の申請一覧用コンポーネント (新規追加)
// ==========================================
export const FriendRequestsPanel: React.FC = () => {
  const { token } = useProfile();
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const loadRequests = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${apiUrl}/friends/requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || '申請を取得できませんでした');
      setIncoming(body.incoming || []);
    } catch (error) {
      setMessage(toUserErrorMessage(error, '申請を取得できませんでした'));
    }
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;

    const refreshRequests = async () => {
      try {
        await loadRequests();
      } finally {
        if (!cancelled) refreshTimer = setTimeout(refreshRequests, 3000);
      }
    };

    refreshRequests();
    return () => {
      cancelled = true;
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, [loadRequests]);

  const respondRequest = async (requestId: number, action: 'accept' | 'reject') => {
    if (!token) return;
    setIsLoading(true);
    setMessage('');
    try {
      const response = await fetch(`${apiUrl}/friends/requests`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ requestId, action }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || '申請を更新できませんでした');
      await loadRequests();
    } catch (error) {
      setMessage(toUserErrorMessage(error, '申請を更新できませんでした'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { flex: 1 }]}>
      <FlatList
        data={incoming}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={<Text style={styles.emptyText}>保留中の申請はありません</Text>}
        renderItem={({ item: request }) => (
          <View style={styles.requestRow}>
            <ProfileAvatar profileImage={request.user.profileImage} name={request.user.name} size={40} />
            <View style={styles.friendTextArea}>
              <Text style={styles.friendName}>{request.user.name}</Text>
              <Text style={styles.userId}>@{request.user.userId}</Text>
            </View>
            <TouchableOpacity onPress={() => respondRequest(request.id, 'accept')} disabled={isLoading}>
              <Ionicons name="checkmark-circle" size={32} color="#267a3f" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => respondRequest(request.id, 'reject')} disabled={isLoading}>
              <Ionicons name="close-circle-outline" size={32} color="#8b4a48" />
            </TouchableOpacity>
          </View>
        )}
      />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { width: '100%', padding: 16, backgroundColor: '#e2fbe2' },
  topActionContainer: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#ccc' },
  topActionButton: { alignItems: 'center', gap: 8 },
  topActionText: { fontSize: 14, color: '#333', fontWeight: '500' },
  pendingRequestButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#ccc' },
  pendingRequestText: { fontSize: 16, color: '#333' },
  friendListSection: { paddingTop: 16 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  friendListItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 12 },
  friendTextArea: { flex: 1, minWidth: 0 },
  friendName: { flex: 1, fontSize: 16, color: '#333' },
  userId: { fontSize: 12, color: '#737873', marginTop: 2 },
  emptyText: { fontSize: 14, color: '#707870', paddingVertical: 12 },
  requestRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#d2dfd2' },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  input: { flex: 1, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CCC', borderRadius: 8, padding: 12, fontSize: 16 },
  searchButton: { width: 48, borderRadius: 8, backgroundColor: '#267a3f', alignItems: 'center', justifyContent: 'center' },
  searchResultItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 12 },
  searchResultName: { fontSize: 16, color: '#333' },
  requestButton: { backgroundColor: '#bde0fe', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#64b5f6' },
  disabledButton: { opacity: 0.55 },
  requestButtonText: { color: '#1565c0', fontWeight: 'bold' },
  message: { color: '#6b4a3e', fontSize: 13, marginTop: 12, textAlign: 'center' },
  qrContainer: { alignItems: 'center', paddingVertical: 20 },
  qrCodeWrapper: { backgroundColor: '#FFF', padding: 16, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, marginBottom: 24 },
  qrDescription: { textAlign: 'center', fontSize: 15, color: '#4d6048', fontWeight: '600', lineHeight: 22 },
});