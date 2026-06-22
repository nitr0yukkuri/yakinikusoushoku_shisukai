import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { AppNotification } from '../hooks/use-notifications';
import { toUserErrorMessage } from '../utils/user-error';
import { ProfileAvatar } from './ProfileAvatar';

type NotificationPanelProps = {
  notifications: AppNotification[];
  isLoading?: boolean;
  error?: string;
  onOpenFriends?: () => void;
  onRespondRequest?: (requestId: number, action: 'accept' | 'reject') => Promise<void>;
  onRespondMeetup?: (meetupId: number, action: 'accept' | 'decline') => Promise<void>;
};

const formatDate = (value: string) => new Date(value).toLocaleString('ja-JP', {
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function NotificationPanel({
  notifications,
  isLoading,
  error,
  onOpenFriends,
  onRespondRequest,
  onRespondMeetup,
}: NotificationPanelProps) {
  const [respondingKey, setRespondingKey] = useState<string | null>(null);
  const [responseError, setResponseError] = useState('');

  const respond = async (requestId: number, action: 'accept' | 'reject') => {
    if (!onRespondRequest || respondingKey !== null) return;
    setRespondingKey(`friend:${requestId}`);
    setResponseError('');
    try {
      await onRespondRequest(requestId, action);
    } catch (reason) {
      setResponseError(toUserErrorMessage(reason, '申請を更新できませんでした'));
    } finally {
      setRespondingKey(null);
    }
  };

  const respondToMeetup = async (meetupId: number, action: 'accept' | 'decline') => {
    if (!onRespondMeetup || respondingKey !== null) return;
    setRespondingKey(`meetup:${meetupId}`);
    setResponseError('');
    try {
      await onRespondMeetup(meetupId, action);
    } catch (reason) {
      setResponseError(toUserErrorMessage(reason, '待ち合わせの招待を更新できませんでした'));
    } finally {
      setRespondingKey(null);
    }
  };

  if (isLoading) {
    return <ActivityIndicator style={styles.loading} color="#267a3f" />;
  }

  if (notifications.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="notifications-outline" size={36} color="#778078" />
        <Text style={styles.emptyText}>{error || '新着の通知はありません。'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {notifications.map((item) => {
        const accepted = item.type === 'friend_request_accepted';
        const actorName = item.actor.name.trim() || 'ユーザー';
        const canRespond = item.type === 'friend_request_received'
          && item.friendRequestStatus === 'pending'
          && item.friendRequestId !== undefined
          && Boolean(onRespondRequest);
        const canRespondMeetup = item.type === 'meetup_invitation_received'
          && item.meetupInvitationStatus === 'invited'
          && item.meetupId !== undefined
          && Boolean(onRespondMeetup);
        const message = item.type === 'meetup_invitation_received'
          ? `${actorName}さんから${item.meetupPlaceName || '待ち合わせ'}への招待が届きました`
          : accepted
            ? `${actorName}がフレンド申請を承認しました`
            : `${actorName}からフレンド申請が届きました`;
        return (
          <View
            key={item.id}
            style={[styles.row, !item.read && styles.unreadRow]}
          >
            <ProfileAvatar
              name={actorName}
              profileImage={item.actor.profileImage}
              size={40}
              style={[styles.avatar, accepted ? styles.acceptedAvatar : styles.receivedAvatar]}
            />
            <TouchableOpacity
              style={styles.textArea}
              onPress={item.type === 'friend_request_received' ? onOpenFriends : undefined}
              activeOpacity={item.type === 'friend_request_received' && onOpenFriends ? 0.7 : 1}
            >
              <Text style={styles.message}>
                {message}
              </Text>
              {item.meetupScheduledAt ? (
                <Text style={styles.meetupDate}>{formatDate(item.meetupScheduledAt)}</Text>
              ) : null}
              <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
            </TouchableOpacity>
            {canRespond ? (
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.acceptButton]}
                  onPress={() => respond(item.friendRequestId!, 'accept')}
                  disabled={respondingKey !== null}
                  accessibilityLabel="フレンド申請を承認"
                >
                  <Ionicons name="checkmark" size={19} color="#ffffff" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.rejectButton]}
                  onPress={() => respond(item.friendRequestId!, 'reject')}
                  disabled={respondingKey !== null}
                  accessibilityLabel="フレンド申請を拒否"
                >
                  <Ionicons name="close" size={19} color="#ffffff" />
                </TouchableOpacity>
              </View>
            ) : null}
            {canRespondMeetup ? (
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.acceptButton]}
                  onPress={() => respondToMeetup(item.meetupId!, 'accept')}
                  disabled={respondingKey !== null}
                  accessibilityLabel="待ち合わせの招待を承認"
                >
                  <Ionicons name="checkmark" size={19} color="#ffffff" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.rejectButton]}
                  onPress={() => respondToMeetup(item.meetupId!, 'decline')}
                  disabled={respondingKey !== null}
                  accessibilityLabel="待ち合わせの招待を拒否"
                >
                  <Ionicons name="close" size={19} color="#ffffff" />
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        );
      })}
      {responseError ? <Text style={styles.error}>{responseError}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', borderTopWidth: 1, borderTopColor: '#aebdaa' },
  row: {
    width: '100%', minHeight: 66, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1,
    borderBottomColor: '#aebdaa', backgroundColor: 'rgba(226, 251, 210, 0.72)',
  },
  unreadRow: { backgroundColor: '#ddffd1' },
  avatar: { marginRight: 10, borderWidth: 2 },
  acceptedAvatar: { borderColor: '#42cb68' },
  receivedAvatar: { borderColor: '#e8c72e' },
  textArea: { flex: 1, minWidth: 0 },
  message: { fontSize: 15, color: '#1d241f', lineHeight: 20 },
  date: { marginTop: 3, fontSize: 11, color: '#6e766f' },
  meetupDate: { marginTop: 2, fontSize: 12, color: '#4f5951' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 8 },
  actionButton: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
  },
  acceptButton: { backgroundColor: '#2f9e50' },
  rejectButton: { backgroundColor: '#bc4d4d' },
  loading: { paddingVertical: 36 },
  emptyState: { minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyText: { color: '#626b64', fontSize: 14 },
  error: { color: '#a33a32', fontSize: 12, paddingVertical: 10, textAlign: 'center' },
});
