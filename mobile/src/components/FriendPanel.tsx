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

export const FriendPanel: React.FC = () => {
  const { token } = useProfile();
  const [activeTab, setActiveTab] = useState<'list' | 'search' | 'qr'>('list');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [showRequests, setShowRequests] = useState(false);
  const [searchId, setSearchId] = useState('');
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [qrValue, setQrValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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
      await loadFriends();
    } catch (error) {
      setMessage(toUserErrorMessage(error, '申請を更新できませんでした'));
    } finally {
      setIsLoading(false);
    }
  };

  const openQR = async () => {
    setActiveTab('qr');
    if (!token) return;
    setMessage('');
    try {
      const response = await fetch(`${apiUrl}/friends/qr`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'QRコードを取得できませんでした');
      setQrValue(body.value);
    } catch (error) {
      setMessage(toUserErrorMessage(error, 'QRコードを取得できませんでした'));
    }
  };

  if (activeTab === 'search') {
    const requestLabel = searchResult?.relationship === 'none' ? '申請' : searchResult?.relationship === 'friends'
      ? 'フレンド' : searchResult?.relationship === 'self' ? '自分' : '申請中';
    return (
      <View style={styles.container}>
        <View style={styles.subHeader}>
          <TouchableOpacity onPress={() => setActiveTab('list')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color="#4d6048" />
            <Text style={styles.backButtonText}>戻る</Text>
          </TouchableOpacity>
          <Text style={styles.subHeaderTitle}>ID検索</Text>
        </View>
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
  }

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
  }

  return (
    <View style={styles.container}>
      <View style={styles.topActionContainer}>
        <TouchableOpacity style={styles.topActionButton} onPress={() => setActiveTab('search')}>
          <Ionicons name="person-add-outline" size={24} color="#333" />
          <Text style={styles.topActionText}>ID検索</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.topActionButton} onPress={openQR}>
          <Ionicons name="qr-code-outline" size={24} color="#333" />
          <Text style={styles.topActionText}>QRコード</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.pendingRequestButton} onPress={() => setShowRequests((value) => !value)}>
        <Text style={styles.pendingRequestText}>保留中の申請 {incoming.length > 0 ? `(${incoming.length})` : ''}</Text>
        <Ionicons name={showRequests ? 'chevron-up' : 'chevron-down'} size={20} color="#666" />
      </TouchableOpacity>
      {showRequests ? incoming.map((request) => (
        <View key={request.id} style={styles.requestRow}>
          <ProfileAvatar profileImage={request.user.profileImage} name={request.user.name} size={36} />
          <View style={styles.friendTextArea}>
            <Text style={styles.friendName}>{request.user.name}</Text>
            <Text style={styles.userId}>@{request.user.userId}</Text>
          </View>
          <TouchableOpacity onPress={() => respondRequest(request.id, 'accept')} disabled={isLoading}>
            <Ionicons name="checkmark-circle" size={27} color="#267a3f" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => respondRequest(request.id, 'reject')} disabled={isLoading}>
            <Ionicons name="close-circle-outline" size={27} color="#8b4a48" />
          </TouchableOpacity>
        </View>
      )) : null}
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
  requestRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#d2dfd2' },
  subHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, position: 'relative' },
  backButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#c5e8c5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#4d6048', position: 'absolute', left: 0, zIndex: 1 },
  backButtonText: { fontSize: 12, color: '#4d6048', fontWeight: 'bold', marginLeft: 2 },
  subHeaderTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: 'bold', color: '#333' },
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
