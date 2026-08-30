import { useCallback, useEffect, useRef, useState } from 'react';

import { getApiUrl } from '../utils/api-url';

export type AppNotification = {
  id: number;
  type: 'friend_request_received' | 'friend_request_accepted' | 'meetup_invitation_received';
  actor: {
    userId: string;
    name: string;
    profileImage: string;
  };
  friendRequestId?: number;
  friendRequestStatus?: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  meetupId?: number;
  meetupPlaceName?: string;
  meetupScheduledAt?: string;
  meetupInvitationStatus?: 'invited' | 'accepted' | 'declined';
  read: boolean;
  createdAt: string;
};

const apiUrl = getApiUrl();

export function useNotifications(token: string | null, isVisible = false) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(Boolean(token));
  const [error, setError] = useState('');
  const profileImagesRef = useRef<Record<string, string>>({});
  const hasLoadedProfileImagesRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const query = !isVisible
        ? '?summary=true'
        : hasLoadedProfileImagesRef.current ? '?includeProfileImages=false' : '';
      const response = await fetch(`${apiUrl}/notifications${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error('通知を読み込めませんでした');
      }
      setUnreadCount(body.unreadCount || 0);
      if (isVisible) {
        const nextItems = (body.notifications || []).map((item: AppNotification) => {
          const image = item.actor.profileImage || profileImagesRef.current[item.actor.userId] || '';
          if (image) profileImagesRef.current[item.actor.userId] = image;
          return {
            ...item,
            actor: { ...item.actor, profileImage: image },
          };
        });
        hasLoadedProfileImagesRef.current = true;
        setItems(nextItems);
      }
      setError('');
    } catch {
      setError('');
    } finally {
      setIsLoading(false);
    }
  }, [isVisible, token]);

  useEffect(() => {
    if (isVisible) return;
    profileImagesRef.current = {};
    hasLoadedProfileImagesRef.current = false;
  }, [isVisible, token]);

  useEffect(() => {
    if (!token) return;
    Promise.resolve().then(refresh);
    const timer = setInterval(refresh, isVisible ? 15000 : 30000);
    return () => clearInterval(timer);
  }, [isVisible, refresh, token]);

  const markAllRead = useCallback(async () => {
    if (!token) return;
    const response = await fetch(`${apiUrl}/notifications`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ all: true }),
    });
    const body = await response.json();
    if (!response.ok) {
      console.warn('Failed to mark notifications read:', body.error);
      throw new Error('通知を既読にできませんでした');
    }
    setItems((current) => current.map((item) => ({ ...item, read: true })));
    setUnreadCount(0);
  }, [token]);

  const respondToFriendRequest = useCallback(async (
    requestId: number,
    action: 'accept' | 'reject',
  ) => {
    if (!token) return;
    const response = await fetch(`${apiUrl}/friends/requests`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ requestId, action }),
    });
    const body = await response.json();
    if (!response.ok) {
      console.warn('Failed to respond to friend request:', body.error);
      throw new Error(action === 'accept' ? '申請を承認できませんでした' : '申請を拒否できませんでした');
    }
    await refresh();
  }, [refresh, token]);

  return {
    error,
    isLoading,
    markAllRead,
    notifications: token ? items : [],
    refresh,
    respondToFriendRequest,
    unreadCount: token ? unreadCount : 0,
  };
}
