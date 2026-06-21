import { Stack } from 'expo-router';
import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';

import { FriendPanel } from '../components/FriendPanel';

export default function FriendScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: 'フレンド' }} />
      <FriendPanel />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#e2fbe2',
  },
});
