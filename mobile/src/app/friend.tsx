import { Stack } from 'expo-router';
import React, { useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';

import {
  FriendPanel,
  FriendQRPanel,
  FriendRequestsPanel,
  FriendSearchPanel,
} from '../components/FriendPanel';
import { Popup } from '../components/Popup';

export default function FriendScreen() {
  const [isSearchVisible, setSearchVisible] = useState(false);
  const [isQRVisible, setQRVisible] = useState(false);
  const [isRequestsVisible, setRequestsVisible] = useState(false);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: 'フレンド' }} />
      <FriendPanel
        onOpenSearch={() => setSearchVisible(true)}
        onOpenQR={() => setQRVisible(true)}
        onOpenRequests={() => setRequestsVisible(true)}
        pauseAutoRefresh={isSearchVisible || isQRVisible || isRequestsVisible}
      />

      <Popup
        visible={isSearchVisible}
        onClose={() => setSearchVisible(false)}
        title="ID検索"
        sheetHeight={650}
        slideDirection="right"
        showBackButton
      >
        <FriendSearchPanel />
      </Popup>

      <Popup
        visible={isQRVisible}
        onClose={() => setQRVisible(false)}
        title="QRコード"
        sheetHeight={650}
        slideDirection="right"
        showBackButton
      >
        <FriendQRPanel />
      </Popup>

      <Popup
        visible={isRequestsVisible}
        onClose={() => setRequestsVisible(false)}
        title="保留中の申請"
        sheetHeight={650}
        slideDirection="right"
        showBackButton
      >
        <FriendRequestsPanel />
      </Popup>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#e2fbe2',
  },
});
