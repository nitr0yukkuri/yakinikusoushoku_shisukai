// components/MeetupSettingForm.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import { AppMap } from './AppMap';
import { useProfile } from '../contexts/profile-context';
import { getApiUrl } from '../utils/api-url';

export interface MeetupData {
  meetupId: number;
  scheduledAt: string;
  placeName: string;
  selectedFriends: string[];
}

interface Props {
  onSave: (data: MeetupData) => void;
  selectedDate: string;
}

type MapCoordinate = {
  latitude: number;
  longitude: number;
};

type Friend = { userId: string; name: string; profileImage: string };

const apiUrl = getApiUrl();

export default function MeetupSettingForm({ onSave, selectedDate }: Props) {
  const { profile, avatarUrl, token } = useProfile();
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<MapCoordinate | null>(null);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [friendSearch, setFriendSearch] = useState('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const friendSearchQuery = friendSearch.trim().toLowerCase();
  const filteredFriends = friendSearchQuery
    ? friends.filter((friend) => friend.name.toLowerCase().includes(friendSearchQuery) || friend.userId.toLowerCase().includes(friendSearchQuery))
    : [];
  const selectedFriendItems = friends.filter((friend) => selectedFriends.includes(friend.userId));

  useEffect(() => {
    if (!token) return;
    fetch(`${apiUrl}/friends`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'フレンドを取得できませんでした');
        setFriends(body.friends || []);
      })
      .catch((error) => setSaveError(error.message));
  }, [token]);

  useEffect(() => {
    const query = location.trim();
    if (!query) {
      return;
    }

    const timer = setTimeout(() => {
      Location.geocodeAsync(query)
        .then((results) => {
          const firstResult = results[0];
          if (!firstResult) return;
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
  }, [location]);

  const handleLocationChange = (value: string) => {
    setLocation(value);
    if (!value.trim()) setSelectedLocation(null);
  };

  const toggleFriend = (userId: string) => {
    if (selectedFriends.includes(userId)) {
      setSelectedFriends(selectedFriends.filter((fId) => fId !== userId));
    } else {
      setSelectedFriends([...selectedFriends, userId]);
      setFriendSearch('');
    }
  };

  const handleSave = async () => {
    setSaveError('');
    if (!token) {
      setSaveError('ログインが必要です');
      return;
    }
    if (!selectedDate || !/^\d{2}:\d{2}$/.test(time) || !location.trim() || !selectedLocation) {
      setSaveError('日付・時刻・待ち合わせ場所を入力してください');
      return;
    }
    const scheduledAt = new Date(`${selectedDate}T${time}:00`);
    if (Number.isNaN(scheduledAt.getTime())) {
      setSaveError('日時の形式が正しくありません');
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch(`${apiUrl}/meetups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          scheduledAt: scheduledAt.toISOString(),
          placeName: location.trim(),
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
          friendUserIds: selectedFriends,
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
      setSaveError(error instanceof Error ? error.message : '待ち合わせを保存できませんでした');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. 時間 */}
      <Text style={styles.label}>時間</Text>
      <TextInput
        style={styles.input}
        placeholder="例: 19:00"
        value={time}
        onChangeText={setTime}
      />

      {/* 2. フレンド選択 */}
      <Text style={styles.label}>待ち合わせるフレンド</Text>
      <View style={styles.friendInputBox}>
        {selectedFriendItems.map((friend) => (
          <TouchableOpacity
            key={friend.userId}
            style={styles.selectedFriendItem}
            onPress={() => toggleFriend(friend.userId)}
            activeOpacity={0.7}
          >
            <Text style={styles.selectedFriendText}>✓ {friend.name}</Text>
            <Text style={styles.removeFriendText}>×</Text>
          </TouchableOpacity>
        ))}
        <TextInput
          style={styles.friendInput}
          placeholder={selectedFriendItems.length > 0 ? '' : '名前を入力'}
          value={friendSearch}
          onChangeText={setFriendSearch}
        />
      </View>
      <View style={styles.friendsContainer}>
        {filteredFriends.map((friend) => {
          return (
            <TouchableOpacity
              key={friend.userId}
              style={styles.friendChip}
              onPress={() => toggleFriend(friend.userId)}
            >
              <Text style={styles.friendText}>{friend.name}</Text>
            </TouchableOpacity>
          );
        })}
        {friendSearchQuery && filteredFriends.length === 0 && (
          <Text style={styles.noFriendText}>該当するフレンドはいません</Text>
        )}
      </View>

      {/* 3. 場所 */}
      <Text style={styles.label}>待ち合わせ場所</Text>
      <TextInput
        style={styles.input}
        placeholder="住所を入力"
        value={location}
        onChangeText={handleLocationChange}
      />

      {/* 4. 地図 (仮の白い四角) */}
      <Text style={styles.label}>地図から選ぶ</Text>
      <View style={styles.mapWindow}>
        <AppMap
          style={styles.map}
          userId={profile?.userId}
          userName={profile?.name}
          profileImage={avatarUrl || undefined}
          selectedLocation={selectedLocation}
          locationQuery={location}
        />
      </View>

      {/* 保存ボタン */}
      {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
      <TouchableOpacity style={[styles.saveButton, isSaving && styles.saveButtonDisabled]} onPress={handleSave} disabled={isSaving}>
        <Text style={styles.saveButtonText}>{isSaving ? '保存中...' : '保存'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', marginTop: 10 },
  label: { fontSize: 14, color: '#333', marginBottom: 8, marginTop: 16 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, backgroundColor: '#fff' },
  friendInputBox: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#fff', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, minHeight: 46 },
  friendInput: { flex: 1, minWidth: 96, paddingVertical: 6, fontSize: 14 },
  selectedFriendItem: { borderWidth: 1, borderColor: 'rgba(51, 51, 51, 0.25)', borderRadius: 16, paddingVertical: 5, paddingLeft: 10, paddingRight: 8, flexDirection: 'row', alignItems: 'center', maxWidth: '100%' },
  selectedFriendText: { color: 'rgba(51, 51, 51, 0.55)', fontSize: 14, fontWeight: '600' },
  removeFriendText: { color: 'rgba(51, 51, 51, 0.5)', fontSize: 15, fontWeight: '700', marginLeft: 8, lineHeight: 16 },
  friendsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  friendChip: { borderWidth: 1, borderColor: '#ccc', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16, marginBottom: 8, marginRight: 8, flexDirection: 'row', alignItems: 'center' },
  friendText: { color: '#333' },
  noFriendText: { color: '#888', fontSize: 13, marginTop: 8 },
  
  // ▼ 追加：地図の仮置き用のスタイル
  mapWindow: {
    height: 220, // 四角の高さを指定
    backgroundColor: '#ffffff', // 白い背景
    borderWidth: 1,
    borderColor: '#ccc', // 枠線を少しグレーに
    borderRadius: 8,
    marginTop: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  
  saveButton: { backgroundColor: '#007AFF', paddingVertical: 15, borderRadius: 25, alignItems: 'center', marginTop: 30 },
  saveButtonDisabled: { opacity: 0.55 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  errorText: { color: '#b3261e', fontSize: 13, marginTop: 12 },
});
