import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const pastimeOptions = [
  'カフェ',
  'カラオケ',
  '公園',
  'ゲーセン',
  '本屋',
  '服屋',
  '飲食店',
];

export default function PastimeSettingsPanel() {
  const [selectedPastimes, setSelectedPastimes] = useState<string[]>([]);

  const togglePastime = (option: string) => {
    setSelectedPastimes((prev) =>
      prev.includes(option)
        ? prev.filter((item) => item !== option)
        : [...prev, option]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.promptText}>興味があるものを選択してください</Text>
      <View style={styles.chipGrid}>
        {pastimeOptions.map((option) => {
          const isSelected = selectedPastimes.includes(option);
          return (
            <TouchableOpacity
              key={option}
              style={[styles.chip, isSelected && styles.chipSelected]}
              onPress={() => togglePastime(option)}
              activeOpacity={0.7}
            >
                {isSelected && (
                    <Ionicons
                        name="checkmark"
                        size={19}
                        color="#1f1f1f"
                        style={styles.checkIcon}
                    />
                )}
                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                    {option}
                </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  promptText: {
    fontSize: 15,
    color: '#333333',
    marginBottom: 12,
    paddingHorizontal: 6,
    fontWeight: '600',
    width: '100%',
    textAlign: 'left',
    marginTop: 20,
  },
  chipGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    columnGap: 11, // 横方向の余白
    rowGap: 16,    // 縦方向の余白
    paddingHorizontal: 6,
    marginTop: 17,
  },
  chip: {
    width: '31%',
    height: 38,
    borderWidth: 1,
    borderColor: '#4d6048',
    backgroundColor: '#F8FFF5',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderRadius: 20,
  },
  chipSelected: {
    backgroundColor: '#a3ff72', // 選択時の背景色
    borderColor: '#4d6048',
  },
  chipText: {
    fontSize: 15,
    color: '#1f1f1f',
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#1f1f1f',
  },
  checkIcon: {
    position: 'absolute',
    left: 9,
  },
});