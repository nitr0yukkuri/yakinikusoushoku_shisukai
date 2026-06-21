import React, { useEffect } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { NotificationPanel } from '../components/NotificationPanel';
import { useProfile } from '../contexts/profile-context';
import { useNotifications } from '../hooks/use-notifications';

export default function NotificationsScreen() {
  const { token } = useProfile();
  const {
    error,
    isLoading,
    markAllRead,
    notifications,
    refresh,
    respondToFriendRequest,
  } = useNotifications(token);

  useEffect(() => {
    Promise.resolve()
      .then(markAllRead)
      .then(refresh)
      .catch((reason) => console.warn('Failed to mark notifications read:', reason));
  }, [markAllRead, refresh]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>通知一覧</Text>
      </View>
      <View style={styles.content}>
        <NotificationPanel
          notifications={notifications}
          isLoading={isLoading}
          error={error}
          onRespondRequest={respondToFriendRequest}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e2fbe2' },
  header: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#bed1ba' },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#26342a' },
  content: { flex: 1, paddingTop: 8 },
});
