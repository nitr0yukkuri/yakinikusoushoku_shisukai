import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface SettingsPanelProps {
  onOpenSystem: () => void;
  onOpenPastime: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ onOpenSystem, onOpenPastime }) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.settingRow} onPress={onOpenSystem}>
        <Text style={styles.settingText}>システム設定</Text>
        <Text style={styles.settingArrow}>＞</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.settingRow} onPress={onOpenPastime}>
        <Text style={styles.settingText}>好きな暇つぶし</Text>
        <Text style={styles.settingArrow}>＞</Text>
      </TouchableOpacity>
    </View>
  );
};

export default SettingsPanel;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingTop: 8,
  },
  settingRow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  settingText: {
    fontSize: 15,
    color: '#1f1f1f',
  },
  settingArrow: {
    fontSize: 15,
    color: '#666666',
  },
});
