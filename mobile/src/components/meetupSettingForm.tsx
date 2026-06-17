// components/MeetupSettingForm.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import { AppMap } from './AppMap';
import { useProfile } from '../contexts/profile-context';

export interface MeetupData {
  time: string;
  location: string;
  selectedFriends: string[];
}

interface Props {
  onSave: (data: MeetupData) => void;
}

type MapCoordinate = {
  latitude: number;
  longitude: number;
};

// フレンドのダミーデータ
const DUMMY_FRIENDS = [
  { id: '1', name: '太郎' },
  { id: '2', name: '花子' },
  { id: '3', name: '次郎' },
  { id: '4', name: 'a郎' },
  { id: '5', name: 'b郎' },
  { id: '6', name: 'c郎' },
  { id: '7', name: 'd郎' },
  { id: '8', name: 'emiyasi郎' },
//   { id: '9', name: 'f郎' },
//   { id: '10', name: 'gj郎' },
//   { id: '11', name: 'h郎' },
//   { id: '12', name: 'i郎' },
//   { id: '13', name: 'j郎' },
//   { id: '14', name: 'k郎' },
//   { id: '15', name: 'l郎' },
//   { id: '16', name: 'm郎' },
//   { id: '17', name: 'n郎' },
//   { id: '18', name: 'o郎' },
//   { id: '19', name: 'p郎' },
//   { id: '20', name: 'q郎' },
//   { id: '21', name: 'r郎' },
//   { id: '22', name: 's郎' },
//   { id: '23', name: 't郎' },
//   { id: '24', name: 'u郎' },
//   { id: '25', name: 'v郎' },
//   { id: '26', name: 'w郎' },
//   { id: '27', name: 'x郎' },
//   { id: '28', name: 'y郎' },
//   { id: '29', name: 'z郎' },
//   { id: '30', name: 'い郎はにほへと' },
];

export default function MeetupSettingForm({ onSave }: Props) {
  const { profile, avatarUrl } = useProfile();
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<MapCoordinate | null>(null);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [friendSearch, setFriendSearch] = useState('');

  const friendSearchQuery = friendSearch.trim().toLowerCase();
  const filteredFriends = friendSearchQuery
    ? DUMMY_FRIENDS.filter((friend) => friend.name.toLowerCase().includes(friendSearchQuery))
    : [];
  const selectedFriendItems = DUMMY_FRIENDS.filter((friend) => selectedFriends.includes(friend.id));

  useEffect(() => {
    const query = location.trim();
    if (!query) {
      setSelectedLocation(null);
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

  const toggleFriend = (id: string) => {
    if (selectedFriends.includes(id)) {
      setSelectedFriends(selectedFriends.filter((fId) => fId !== id));
    } else {
      setSelectedFriends([...selectedFriends, id]);
      setFriendSearch('');
    }
  };

  const handleSave = () => {
    onSave({ time, location, selectedFriends });
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
            key={friend.id}
            style={styles.selectedFriendItem}
            onPress={() => toggleFriend(friend.id)}
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
              key={friend.id}
              style={styles.friendChip}
              onPress={() => toggleFriend(friend.id)}
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
        onChangeText={setLocation}
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
      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>保存</Text>
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
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
