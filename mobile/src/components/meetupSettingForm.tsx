// components/MeetupSettingForm.tsx
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import { AppMap } from './AppMap';
import { ProfileAvatar } from './ProfileAvatar';
import { useProfile } from '../contexts/profile-context';
import { getApiUrl } from '../utils/api-url';
import { toUserErrorMessage } from '../utils/user-error';

export interface MeetupData {
  meetupId: number;
  scheduledAt: string;
  placeName: string;
  selectedFriends: string[];
}

interface Props {
  onSave: (data: MeetupData) => void;
  onDelete?: (meetupId: number) => void;
  selectedDate: string;
  existingMeetup?: {
    id: number;
    ownerUserId: string;
    scheduledAt: string;
    placeName: string;
    googlePlaceId?: string;
    latitude: number;
    longitude: number;
    status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  } | null;
}

type MapCoordinate = {
  latitude: number;
  longitude: number;
};

type Friend = { userId: string; name: string; profileImage: string };
type Spot = {
  placeId: string;
  name: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
};

const apiUrl = getApiUrl();

export default function MeetupSettingForm({ onSave, onDelete, selectedDate, existingMeetup }: Props) {
  const { profile, avatarUrl, token } = useProfile();
  const isMeetupOwner = Boolean(existingMeetup && existingMeetup.ownerUserId === profile?.userId);
  const canEditMeetup = !existingMeetup || isMeetupOwner;
  const initialScheduledAt = existingMeetup ? new Date(existingMeetup.scheduledAt) : null;
  const initialTime = initialScheduledAt && !Number.isNaN(initialScheduledAt.getTime())
    ? `${String(initialScheduledAt.getHours()).padStart(2, '0')}:${String(initialScheduledAt.getMinutes()).padStart(2, '0')}`
    : '';
  const [time, setTime] = useState(initialTime);
  const [location, setLocation] = useState(existingMeetup?.placeName || '');
  const [selectedLocation, setSelectedLocation] = useState<MapCoordinate | null>(existingMeetup ? {
    latitude: existingMeetup.latitude,
    longitude: existingMeetup.longitude,
  } : null);
  const [googlePlaceId, setGooglePlaceId] = useState(existingMeetup?.googlePlaceId || '');
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [friendSearch, setFriendSearch] = useState('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loadedFriendsForToken, setLoadedFriendsForToken] = useState<string | null>(null);
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const mapSelectionRef = useRef(Boolean(existingMeetup));
  const [isFriendInputFocused, setIsFriendInputFocused] = useState(false);

  const friendSearchQuery = friendSearch.trim().toLowerCase();
  const filteredFriends = friendSearchQuery
    ? friends.filter((friend) => friend.name.toLowerCase().includes(friendSearchQuery) || friend.userId.toLowerCase().includes(friendSearchQuery))
    : [];
  const selectedFriendItems = friends.filter((friend) => selectedFriends.includes(friend.userId));
  const isLoadingFriends = Boolean(token) && loadedFriendsForToken !== token;

  useEffect(() => {
    if (!token || !existingMeetup) return;
    let cancelled = false;

    fetch(`${apiUrl}/meetups/${existingMeetup.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || '待ち合わせを取得できませんでした');
        return body.meetup;
      })
      .then((meetup) => {
        if (cancelled) return;
        setSelectedFriends((meetup.members || [])
          .filter((member: { role: string; status: string }) => member.role === 'member' && member.status !== 'declined')
          .map((member: { userId: string }) => member.userId));
      })
      .catch((error) => {
        if (!cancelled) setSaveError(toUserErrorMessage(error, '待ち合わせを取得できませんでした'));
      });

    return () => { cancelled = true; };
  }, [existingMeetup, token]);

  useEffect(() => {
    if (!token) return;
    fetch(`${apiUrl}/friends`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'フレンドを取得できませんでした');
        setFriends(body.friends || []);
      })
      .catch((error) => setSaveError(toUserErrorMessage(error, 'フレンドを取得できませんでした')))
      .finally(() => setLoadedFriendsForToken(token));
  }, [token]);

  useEffect(() => {
    const query = location.trim();
    if (!query || !token) {
      return;
    }
    if (mapSelectionRef.current) {
      mapSelectionRef.current = false;
      return;
    }

    const timer = setTimeout(() => {
      fetch(`${apiUrl}/spots/search?q=${encodeURIComponent(query)}&limit=1`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(async (response) => {
          const body = await response.json();
          if (!response.ok) throw new Error(body.error || '待ち合わせ場所を検索できませんでした');
          return (body.spots?.[0] || null) as Spot | null;
        })
        .then((firstResult) => {
          if (!firstResult) {
            setGooglePlaceId('');
            return;
          }
          setGooglePlaceId(firstResult.placeId);
          setSelectedLocation({
            latitude: firstResult.latitude,
            longitude: firstResult.longitude,
          });
        })
        .catch((error) => {
          console.warn('Failed to geocode meetup location:', error);
        });
    }, 600);

    return () => clearTimeout(timer);
  }, [location, token]);

  const handleLocationChange = (value: string) => {
    mapSelectionRef.current = false;
    setGooglePlaceId('');
    setLocation(value);
    if (!value.trim()) setSelectedLocation(null);
  };

  const handleMapLocationSelect = async (coordinate: MapCoordinate, address?: string) => {
    setSelectedLocation(coordinate);
    setGooglePlaceId('');
    mapSelectionRef.current = true;
    setLocation(address || `${coordinate.latitude.toFixed(6)}, ${coordinate.longitude.toFixed(6)}`);
    if (address) return;

    try {
      const [result] = await Location.reverseGeocodeAsync(coordinate);
      if (!result) return;
      const resolvedAddress = [result.region, result.city, result.district, result.street, result.name]
        .filter((part, index, parts) => part && parts.indexOf(part) === index)
        .join('');
      if (resolvedAddress) {
        mapSelectionRef.current = true;
        setLocation(resolvedAddress);
      }
    } catch (error) {
      console.warn('Failed to reverse geocode selected map location:', error);
    }
  };

  const toggleFriend = (userId: string) => {
    if (existingMeetup) return;
    if (selectedFriends.includes(userId)) {
      setSelectedFriends(selectedFriends.filter((fId) => fId !== userId));
    } else {
      setSelectedFriends([...selectedFriends, userId]);
      setFriendSearch('');
    }
  };

  const handleSave = async () => {
    setSaveError('');
    if (!canEditMeetup) return;
    if (!token) {
      setSaveError('ログインが必要です');
      return;
    }
    if (!selectedDate) {
      setSaveError('日付を選択してください');
      return;
    }
    const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
    const hours = timeMatch ? Number(timeMatch[1]) : -1;
    const minutes = timeMatch ? Number(timeMatch[2]) : -1;
    if (!timeMatch || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      setSaveError('時刻を「1:00」または「01:00」の形式で入力してください');
      return;
    }
    if (!location.trim()) {
      setSaveError('待ち合わせ場所を入力してください');
      return;
    }
    if (!selectedLocation) {
      setSaveError('待ち合わせ場所が地図に反映されるまでお待ちください');
      return;
    }
    const normalizedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    const scheduledAt = new Date(`${selectedDate}T${normalizedTime}:00`);
    if (Number.isNaN(scheduledAt.getTime())) {
      setSaveError('日時の形式が正しくありません');
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch(existingMeetup ? `${apiUrl}/meetups/${existingMeetup.id}` : `${apiUrl}/meetups`, {
        method: existingMeetup ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          scheduledAt: scheduledAt.toISOString(),
          placeName: location.trim(),
          googlePlaceId,
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
          ...(existingMeetup
            ? { status: existingMeetup.status }
            : { friendUserIds: selectedFriends }),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || '待ち合わせを保存できませんでした');
      onSave({
        meetupId: body.meetup.id,
        scheduledAt: body.meetup.scheduledAt,
        placeName: body.meetup.placeName,
        selectedFriends,
      });
    } catch (error) {
      setSaveError(toUserErrorMessage(error, '待ち合わせを保存できませんでした'));
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = () => {
    const message = isMeetupOwner
      ? 'この予定を削除すると、参加者のカレンダーからも表示されなくなります。'
      : 'この予定を自分のカレンダーから削除しますか？';
    if (Platform.OS === 'web') {
      return Promise.resolve(window.confirm(message));
    }

    return new Promise<boolean>((resolve) => {
      Alert.alert(
        '待ち合わせ予定を削除',
        message,
        [
          { text: 'キャンセル', style: 'cancel', onPress: () => resolve(false) },
          { text: '削除', style: 'destructive', onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
    });
  };

  const handleDelete = async () => {
    if (!token || !existingMeetup || isDeleting) return;
    if (!await confirmDelete()) return;

    setSaveError('');
    setIsDeleting(true);
    try {
      const response = await fetch(`${apiUrl}/meetups/${existingMeetup.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || '待ち合わせ予定を削除できませんでした');
      }
      onDelete?.(existingMeetup.id);
    } catch (error) {
      setSaveError(toUserErrorMessage(error, '待ち合わせ予定を削除できませんでした'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. 時間 */}
      <Text style={styles.label}>時間</Text>
      <TextInput
        style={styles.input}
        placeholder="例: 19:00"
        placeholderTextColor="rgba(51, 51, 51, 0.45)"
        value={time}
        onChangeText={setTime}
        editable={canEditMeetup}
      />

      {/* 2. フレンド選択 */}
      <Text style={styles.label}>待ち合わせるフレンド</Text>

      {/* 検索入力欄とドロップダウンをまとめるラッパー */}
      <View style={styles.searchSectionWrapper}>
        <View style={[styles.friendInputBox,isFriendInputFocused && styles.friendInputBoxFocused]}>
          <TextInput
            style={styles.friendInput}
            placeholder="名前を入力"
            placeholderTextColor="rgba(51, 51, 51, 0.45)"
            value={friendSearch}
            onChangeText={setFriendSearch}
            editable={!existingMeetup}
            onFocus={() => setIsFriendInputFocused(true)}
            onBlur={() => setIsFriendInputFocused(false)}
          />
        </View>

        {/* 検索結果をドロップダウンとして表示 (文字が入力されている時だけ) */}
        {friendSearchQuery.length > 0 && (
          <View style={styles.searchResultsDropdown}>
            <ScrollView keyboardShouldPersistTaps="handled">
              {filteredFriends.map((friend) => (
                <TouchableOpacity
                  key={friend.userId}
                  style={styles.searchResultItem}
                  onPress={() => toggleFriend(friend.userId)}
                >
                  <ProfileAvatar
                    name={friend.name}
                    profileImage={friend.profileImage}
                    size={28}
                  />
                  <Text style={styles.searchResultText}>{friend.name}</Text>
                </TouchableOpacity>
              ))}
              
              {isLoadingFriends && (
                <View style={styles.dropdownMessageContainer}>
                  <ActivityIndicator size="small" color="#267a3f" />
                  <Text style={styles.dropdownMessage}>読み込み中...</Text>
                </View>
              )}
              
              {!isLoadingFriends && filteredFriends.length === 0 && (
                <Text style={styles.dropdownMessage}>該当するフレンドはいません</Text>
              )}
            </ScrollView>
          </View>
        )}
      </View>

      {/* 選択済みのフレンド一覧（検索欄の下） */}
      {selectedFriendItems.length > 0 && (
        <View style={styles.selectedFriendsWrapper}>
          {selectedFriendItems.map((friend) => (
            <TouchableOpacity
              key={friend.userId}
              style={styles.selectedFriendItem}
              onPress={() => toggleFriend(friend.userId)}
              disabled={Boolean(existingMeetup)}
              activeOpacity={0.7}
            >
              <Text style={styles.selectedFriendText}>✓ {friend.name}</Text>
              <ProfileAvatar
                name={friend.name}
                profileImage={friend.profileImage}
                size={22}
                style={styles.selectedFriendAvatar}
              />
              <Text style={styles.removeFriendText}>×</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* 3. 場所 */}
      <Text style={styles.label}>待ち合わせ場所</Text>
      <TextInput
        style={styles.input}
        placeholder="住所を入力"
        placeholderTextColor="rgba(51, 51, 51, 0.45)"
        value={location}
        onChangeText={handleLocationChange}
        editable={canEditMeetup}
      />

      {/* 4. 地図 */}
      <Text style={styles.label}>地図から選ぶ</Text>
      <View style={styles.mapWindow}>
        <AppMap
          style={styles.map}
          userId={profile?.userId}
          userName={profile?.name}
          profileImage={avatarUrl || undefined}
          selectedLocation={selectedLocation}
          locationQuery={location}
          onLocationSelect={canEditMeetup ? handleMapLocationSelect : undefined}
        />
      </View>

      {/* 保存ボタン */}
      {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
      {canEditMeetup ? (
        <TouchableOpacity style={[styles.saveButton, isSaving && styles.saveButtonDisabled]} onPress={handleSave} disabled={isSaving}>
          <Text style={styles.saveButtonText}>{isSaving ? '保存中...' : '保存'}</Text>
        </TouchableOpacity>
      ) : null}
      {existingMeetup ? (
        <TouchableOpacity
          style={[styles.meetupDeleteButton, isDeleting && styles.saveButtonDisabled]}
          onPress={handleDelete}
          disabled={isDeleting || isSaving}
        >
          <Text style={styles.meetupDeleteButtonText}>{isDeleting ? '削除中...' : 'この予定を削除'}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', marginTop: 5 },
  label: { fontSize: 14, color: '#333', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, backgroundColor: '#fff', color: '#333' },
  friendInputBox: { 
    borderWidth: 1, 
    borderColor: '#ccc', 
    borderRadius: 8, 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    backgroundColor: '#fff', 
    minHeight: 40,
    justifyContent: 'center' 
  },
  friendInput: { 
    flex: 1, 
    paddingVertical: 4, 
    fontSize: 14, 
    color: '#333',
    // 内側のブラウザ標準枠は消す
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  friendInputBoxFocused: {
    borderColor: '#333',
    borderWidth: 2,
  },
  selectedFriendsWrapper: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 8, 
    marginTop: 8
  },
  selectedFriendItem: { borderWidth: 1, borderColor: 'rgba(51, 51, 51, 0.25)', borderRadius: 16, paddingVertical: 4, paddingLeft: 10, paddingRight: 8, flexDirection: 'row', alignItems: 'center', maxWidth: '100%' },
  selectedFriendText: { color: 'rgba(51, 51, 51, 0.55)', fontSize: 14, fontWeight: '600', flexShrink: 1 },
  selectedFriendAvatar: { marginLeft: 7 },
  removeFriendText: { color: 'rgba(51, 51, 51, 0.5)', fontSize: 15, fontWeight: '700', marginLeft: 8, lineHeight: 16 },
  // --- ドロップダウン検索用の追加スタイル ---
  searchSectionWrapper: {
    position: 'relative',
    zIndex: 100, // 地図などの他の要素より前面に出すため
    elevation: 100,
  },
  searchResultsDropdown: {
    position: 'absolute',
    top: '100%', // 入力欄の真下に配置
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 200, // 長すぎる場合はスクロールさせる
    zIndex: 101,
    elevation: 101,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    overflow: 'hidden',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchResultText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#333',
  },
  dropdownMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  dropdownMessage: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    padding: 16,
  },
  friendText: { color: '#333' },
  noFriendText: { color: '#888', fontSize: 13, marginTop: 4 },
  inlineLoadingState: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  
  mapWindow: {
    width: '100%',
    aspectRatio: 1.8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginTop: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  
  saveButton: { backgroundColor: '#007AFF', paddingVertical: 12, borderRadius: 25, alignItems: 'center', marginTop: 20 },
  saveButtonDisabled: { opacity: 0.55 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  meetupDeleteButton: { borderWidth: 1, borderColor: '#c84a4a', paddingVertical: 11, borderRadius: 25, alignItems: 'center', marginTop: 12 },
  meetupDeleteButtonText: { color: '#a72d2d', fontSize: 15, fontWeight: '700' },
  errorText: { color: '#b3261e', fontSize: 13, marginTop: 8 },
});
