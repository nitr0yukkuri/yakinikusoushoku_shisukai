import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useProfile } from '../contexts/profile-context';

export default function SystemSettingsPanel() {
  const router = useRouter();
  const { profile, logout } = useProfile();

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  return (
    <View style={styles.popupBody}>
      <Text style={styles.popupLabel}>メールアドレス</Text>
      <View style={styles.emailDisplay}>
        <Ionicons name="lock-closed-outline" size={16} color="#6b706b" />
        <Text style={styles.emailText} numberOfLines={1}>
          {profile?.email || ''}
        </Text>
      </View>

      <Text style={styles.deleteTitle}>アカウントを削除</Text>
      <TouchableOpacity style={styles.deleteButton} onPress={handleLogout}>
        <Ionicons name="trash-outline" size={18} color="#b71c1c" />
        <Text style={styles.deleteButtonText}>削除する</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  popupBody: {
    width: '100%',
    alignItems: 'center',
    marginTop: 40,
  },
  popupLabel: {
    alignSelf: 'flex-start',
    fontSize: 14,
    color: '#333333',
    marginBottom: 8,
  },
  emailDisplay: {
    width: '100%',
    height: 38,
    borderWidth: 1,
    borderColor: '#b7bdb7',
    backgroundColor: '#e6e9e6',
    paddingHorizontal: 10,
    marginBottom: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emailText: {
    color: '#6b706b',
    fontSize: 14,
    flex: 1,
  },
  deleteTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f1f1f',
    marginBottom: 14,
  },
  deleteButton: {
    minWidth: 150,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: '#e57373',
    backgroundColor: '#ffcdd2',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  deleteButtonText: {
    color: '#b71c1c',
    fontSize: 15,
    fontWeight: '700',
  },
});