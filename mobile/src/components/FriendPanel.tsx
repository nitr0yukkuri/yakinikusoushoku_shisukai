import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
const friendRefreshInterval = 15000;

const mergeCachedProfileImage = (profile: Friend, cache: Record<string, string>): Friend => {
  if (profile.profileImage) cache[profile.userId] = profile.profileImage;
  return { ...profile, profileImage: profile.profileImage || cache[profile.userId] || '' };
};

// ==========================================
// ① メインのフレンド一覧コンポーネント
// ==========================================
interface FriendPanelProps {
  onOpenSearch: () => void;
  onOpenQR: () => void;
  onOpenRequests: () => void; // ★追加
  pauseAutoRefresh?: boolean;
}

export const FriendPanel: React.FC<FriendPanelProps> = ({ onOpenSearch, onOpenQR, onOpenRequests, pauseAutoRefresh = false }) => {
  const { token } = useProfile();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [loadedFriendsForToken, setLoadedFriendsForToken] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const profileImagesRef = useRef<Record<string, string>>({});
  const hasLoadedProfileImagesRef = useRef(false);
  const isLoadingFriends = Boolean(token) && loadedFriendsForToken !== token;

  useEffect(() => {
    profileImagesRef.current = {};
    hasLoadedProfileImagesRef.current = false;
  }, [token]);

  const loadFriends = useCallback(async () => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    const query = hasLoadedProfileImagesRef.current ? '?includeProfileImages=false' : '';
    const [friendsResponse, requestsResponse] = await Promise.all([
      fetch(`${apiUrl}/friends${query}`, { headers }),
      fetch(`${apiUrl}/friends/requests${query}`, { headers }),
    ]);
    const friendsBody = await friendsResponse.json();
    const requestsBody = await requestsResponse.json();
    if (!friendsResponse.ok) throw new Error(friendsBody.error || 'フレンドを取得できませんでした');
    if (!requestsResponse.ok) throw new Error(requestsBody.error || '申請を取得できませんでした');
    setFriends((friendsBody.friends || []).map((friend: Friend) => mergeCachedProfileImage(friend, profileImagesRef.current)));
    setIncoming((requestsBody.incoming || []).map((request: FriendRequest) => ({
      ...request,
      user: mergeCachedProfileImage(request.user, profileImagesRef.current),
    })));
    hasLoadedProfileImagesRef.current = true;
    setMessage('');
  }, [token]);

  useEffect(() => {
    if (pauseAutoRefresh) return;

    let cancelled = false;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;

    const refreshFriends = async () => {
      try {
        await loadFriends();
      } catch (error) {
        console.warn('Friend refresh failed:', error);
      } finally {
        if (!cancelled) setLoadedFriendsForToken(token ?? null);
        if (!cancelled) refreshTimer = setTimeout(refreshFriends, friendRefreshInterval);
      }
    };

    refreshFriends();
    return () => {
      cancelled = true;
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, [loadFriends, pauseAutoRefresh, token]);

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
        <Text style={styles.pendingRequestText}>
          {isLoadingFriends ? '保留中の申請を読み込み中...' : `保留中の申請 ${incoming.length > 0 ? `(${incoming.length})` : ''}`}
        </Text>
        <Ionicons name="chevron-forward" size={20} color="#666" />
      </TouchableOpacity>

      <View style={styles.friendListSection}>
        <Text style={styles.sectionTitle}>フレンド</Text>
        <FlatList
          data={friends}
          keyExtractor={(item) => item.userId}
          scrollEnabled={false}
          ListEmptyComponent={(
            <View style={styles.inlineLoadingState}>
              {isLoadingFriends ? <ActivityIndicator size="small" color="#267a3f" /> : null}
              <Text style={styles.emptyText}>
                {isLoadingFriends ? 'フレンドを読み込み中...' : 'フレンドがいません'}
              </Text>
            </View>
          )}
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
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const searchUser = async () => {
    const query = searchId.trim();
    if (!token || !query) {
      setSearchResults([]);
      return;
    }
    setIsLoading(true);
    setMessage('');
    setSearchResults([]);
    try {
      const response = await fetch(`${apiUrl}/friends/search?userId=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json();
      if (response.status === 404) throw new Error('そのユーザーはいません');
      if (!response.ok) throw new Error(body.error || 'ユーザーが見つかりませんでした');
      const results = Array.isArray(body.results)
        ? body.results as SearchResult[]
        : body.profile ? [body as SearchResult] : [];
      setSearchResults(results);
      if (results.length === 0) setMessage('そのユーザーはいません');
    } catch (error) {
      setMessage(toUserErrorMessage(error, '検索できませんでした'));
    } finally {
      setIsLoading(false);
    }
  };

  const sendRequest = async (result: SearchResult) => {
    if (!token) return;
    setIsLoading(true);
    setMessage('');
    try {
      const response = await fetch(`${apiUrl}/friends/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: result.profile.userId }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || '申請を送信できませんでした');
      setSearchResults((current) => current.map((item) => item.profile.userId === result.profile.userId
        ? { ...item, relationship: 'outgoing_pending' }
        : item));
      setMessage('フレンド申請を送信しました');
    } catch (error) {
      setMessage(toUserErrorMessage(error, '申請を送信できませんでした'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchIdChange = (value: string) => {
    setSearchId(value);
    if (!value.trim()) {
      setSearchResults([]);
      setMessage('');
    }
  };

  const requestLabel = (relationship: SearchResult['relationship']) => relationship === 'none' ? '申請'
    : relationship === 'friends' ? 'フレンド' : relationship === 'self' ? '自分' : '申請中';

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="IDを入力"
          placeholderTextColor="#999"
          value={searchId}
          onChangeText={handleSearchIdChange}
          onSubmitEditing={searchUser}
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.searchButton} onPress={searchUser} disabled={isLoading || !searchId.trim()}>
          <Ionicons name="search" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
      <Text style={styles.sectionTitle}>検索結果</Text>
      {isLoading ? (
        <View style={styles.inlineLoadingState}>
          <ActivityIndicator size="small" color="#267a3f" />
          <Text style={styles.emptyText}>検索中...</Text>
        </View>
      ) : null}
      {searchResults.map((result) => (
        <View key={result.profile.userId} style={styles.searchResultItem}>
          <ProfileAvatar profileImage={result.profile.profileImage} name={result.profile.name} size={40} />
          <View style={styles.friendTextArea}>
            <Text style={styles.searchResultName}>{result.profile.name}</Text>
            <Text style={styles.userId}>@{result.profile.userId}</Text>
          </View>
          <TouchableOpacity
            style={[styles.requestButton, result.relationship !== 'none' && styles.disabledButton]}
            onPress={() => sendRequest(result)}
            disabled={result.relationship !== 'none' || isLoading}
          >
            <Text style={styles.requestButtonText}>{requestLabel(result.relationship)}</Text>
          </TouchableOpacity>
        </View>
      ))}
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
        ) : (
          <View style={styles.centerLoadingState}>
            <ActivityIndicator color="#267a3f" />
            <Text style={styles.emptyText}>QRコードを読み込み中...</Text>
          </View>
        )}
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
  const [loadedRequestsForToken, setLoadedRequestsForToken] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const profileImagesRef = useRef<Record<string, string>>({});
  const hasLoadedProfileImagesRef = useRef(false);
  const isLoadingRequests = Boolean(token) && loadedRequestsForToken !== token;

  useEffect(() => {
    profileImagesRef.current = {};
    hasLoadedProfileImagesRef.current = false;
  }, [token]);

  const loadRequests = useCallback(async (showError = true) => {
    if (!token) return;
    try {
      const query = hasLoadedProfileImagesRef.current ? '?includeProfileImages=false' : '';
      const response = await fetch(`${apiUrl}/friends/requests${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || '申請を取得できませんでした');
      setIncoming((body.incoming || []).map((request: FriendRequest) => ({
        ...request,
        user: mergeCachedProfileImage(request.user, profileImagesRef.current),
      })));
      hasLoadedProfileImagesRef.current = true;
      setMessage('');
    } catch (error) {
      if (showError) {
        setMessage(toUserErrorMessage(error, '申請を取得できませんでした'));
      } else {
        console.warn('Friend requests refresh failed:', error);
      }
    } finally {
      setLoadedRequestsForToken(token ?? null);
    }
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;

    const refreshRequests = async () => {
      try {
        await loadRequests(false);
      } finally {
        if (!cancelled) refreshTimer = setTimeout(refreshRequests, friendRefreshInterval);
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
        ListEmptyComponent={(
          <View style={styles.inlineLoadingState}>
            {isLoadingRequests ? <ActivityIndicator size="small" color="#267a3f" /> : null}
            <Text style={styles.emptyText}>
              {isLoadingRequests ? '保留中の申請を読み込み中...' : '保留中の申請はありません'}
            </Text>
          </View>
        )}
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
  inlineLoadingState: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  centerLoadingState: { alignItems: 'center', gap: 8, paddingVertical: 12 },
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
