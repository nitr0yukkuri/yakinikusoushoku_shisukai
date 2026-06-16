// components/MeetupSettingForm.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';

export interface MeetupData {
  time: string;
  location: string;
  selectedFriends: string[];
}

interface Props {
  onSave: (data: MeetupData) => void;
}

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
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);

  const toggleFriend = (id: string) => {
    if (selectedFriends.includes(id)) {
      setSelectedFriends(selectedFriends.filter((fId) => fId !== id));
    } else {
      setSelectedFriends([...selectedFriends, id]);
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
      <View style={styles.friendsContainer}>
        {DUMMY_FRIENDS.map((friend) => {
          const isSelected = selectedFriends.includes(friend.id);
          return (
            <TouchableOpacity
              key={friend.id}
              style={[styles.friendChip, isSelected && styles.friendChipSelected]}
              onPress={() => toggleFriend(friend.id)}
            >
              <Text style={[styles.friendText, isSelected && styles.friendTextSelected]}>
                {friend.name}
              </Text>
            </TouchableOpacity>
          );
        })}
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
      <TouchableOpacity 
        style={styles.mapPlaceholder} 
        activeOpacity={0.7}
        onPress={() => console.log('地図を開く処理をここに書きます')}
      >
        <Text style={styles.mapPlaceholderText}>📍 ここに地図が表示されます</Text>
      </TouchableOpacity>

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
  friendsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  friendChip: { borderWidth: 1, borderColor: '#ccc', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16, marginBottom: 8, marginRight: 8 },
  friendChipSelected: { backgroundColor: '#2330df', borderColor: '#2330df' },
  friendText: { color: '#333' },
  friendTextSelected: { color: '#fff', fontWeight: 'bold' },
  
  // ▼ 追加：地図の仮置き用のスタイル
  mapPlaceholder: {
    height: 150, // 四角の高さを指定
    backgroundColor: '#ffffff', // 白い背景
    borderWidth: 1,
    borderColor: '#ccc', // 枠線を少しグレーに
    borderStyle: 'dashed', // 点線にして「仮」っぽさを出す（お好みで solid に変更可）
    borderRadius: 8,
    justifyContent: 'center', // 縦の真ん中に文字を配置
    alignItems: 'center', // 横の真ん中に文字を配置
    marginTop: 4,
  },
  mapPlaceholderText: {
    color: '#888',
    fontSize: 14,
    fontWeight: 'bold',
  },
  
  saveButton: { backgroundColor: '#007AFF', paddingVertical: 15, borderRadius: 25, alignItems: 'center', marginTop: 30 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});