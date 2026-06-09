import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform } from 'react-native';
// 先ほど作成・修正したPopupコンポーネントをインポート
import { Popup } from '../components/Popup';

// 通知データの型
interface NotificationItem {
  id: string;
  title: string;
  message: string;
  date: string;
}

// 確認用のダミーデータ
const DUMMY_NOTIFICATIONS: NotificationItem[] = [
  { 
    id: '1', 
    title: 'システムメンテナンスのお知らせ', 
    message: '明日深夜2時から4時までシステムメンテナンスを行います。メンテナンス中はアプリをご利用いただけません。', 
    date: '2026/06/09' 
  },
  { 
    id: '2', 
    title: '新しいメッセージが届きました', 
    message: '運営チームからのメッセージがあります。ご確認ください。', 
    date: '2026/06/08' 
  },
  { 
    id: '3', 
    title: 'アップデート完了', 
    message: 'アプリが最新バージョンにアップデートされました。新機能をお試しください！', 
    date: '2026/06/07' 
  },
];

export default function NotificationsScreen() {
  // ポップアップの表示状態
  const [isPopupVisible, setPopupVisible] = useState(false);
  // 選択された通知データ
  const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);

  // 通知がタップされたときの処理
  const handlePressNotification = (item: NotificationItem) => {
    setSelectedNotification(item);
    setPopupVisible(true); // ポップアップを開く
  };

  // リストの各アイテムを描画
  const renderItem = ({ item }: { item: NotificationItem }) => (
    <TouchableOpacity 
      style={styles.notificationCard} 
      onPress={() => handlePressNotification(item)}
    >
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardDate}>{item.date}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>通知一覧</Text>
      
      <FlatList
        data={DUMMY_NOTIFICATIONS}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
      />

      {/* ポップアップコンポーネントの呼び出し */}
      <Popup
        visible={isPopupVisible}
        onClose={() => setPopupVisible(false)}
        title={selectedNotification?.title}
        message={selectedNotification?.message}
      >
        {/* 必要に応じて、ここに「既読にする」などのボタンを配置できます */}
      </Popup>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    padding: 16,
    paddingTop: 48, // ヘッダーの余白
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  listContainer: {
    padding: 16,
  },
  notificationCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    // Webの警告を回避するため、端末ごとに影の付け方を分ける
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.1)' as any,
      },
    }),
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  cardDate: {
    fontSize: 12,
    color: '#888',
    textAlign: 'right',
  },
});