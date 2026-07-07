import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getApiUrl } from '../utils/api-url';

export type MeetupSummary = {
  id: number;
  ownerUserId: string;
  scheduledAt: string;
  placeName: string;
  googlePlaceId?: string;
  latitude: number;
  longitude: number;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  membershipStatus: 'invited' | 'accepted' | 'declined';
};

type ETA = {
  arrivalAt: string;
  durationSeconds: number;
  routePolyline?: string;
  travelMode?: string;
  user?: { userId: string };
};

const apiUrl = getApiUrl();
const normalETAUpdateInterval = 120000;
const demoETADebounceDelay = 350;
const etaRefreshInterval = process.env.NODE_ENV === 'production' ? 5000 : 1000;

export function useMeetupSession(token: string | null, userId?: string) {
  const [meetups, setMeetups] = useState<MeetupSummary[]>([]);
  const [issuedWSTicket, setIssuedWSTicket] = useState<{ meetupId: number; ticket: string }>();
  const [etas, setEtas] = useState<ETA[]>([]);
  const [clock, setClock] = useState(() => Date.now());
  const lastETAUpdateRef = useRef(0);
  const demoETATimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const etaUpdateQueueRef = useRef<Promise<void>>(Promise.resolve());
  const etaGenerationRef = useRef(0);
  const wsTicketRequestVersionRef = useRef(0);

  // ★追加：到着したユーザー一覧を保存するステート
  const [arrivedUsers, setArrivedUsers] = useState<string[]>([]);

  const refreshMeetups = useCallback(async () => {
    if (!token) {
      setMeetups([]);
      return;
    }
    const response = await fetch(`${apiUrl}/meetups`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || '待ち合わせを取得できませんでした');
    setMeetups(body.meetups || []);
  }, [token]);

  useEffect(() => {
    Promise.resolve()
      .then(refreshMeetups)
      .catch((error) => console.warn('Failed to load meetups:', error));
  }, [refreshMeetups]);

  const activeMeetup = useMemo(() => {
    return meetups
      .filter((item) => item.membershipStatus === 'accepted'
        && (item.status === 'scheduled' || item.status === 'active'))
      .sort((left, right) => {
        const leftTime = new Date(left.scheduledAt).getTime();
        const rightTime = new Date(right.scheduledAt).getTime();
        const leftRank = leftTime >= clock ? leftTime : Number.MAX_SAFE_INTEGER - leftTime;
        const rightRank = rightTime >= clock ? rightTime : Number.MAX_SAFE_INTEGER - rightTime;
        return leftRank - rightRank;
      })[0] || null;
  }, [clock, meetups]);

  useEffect(() => {
    lastETAUpdateRef.current = 0;
    etaGenerationRef.current += 1;
    if (demoETATimerRef.current) {
      clearTimeout(demoETATimerRef.current);
      demoETATimerRef.current = null;
    }

    return () => {
      if (demoETATimerRef.current) {
        clearTimeout(demoETATimerRef.current);
        demoETATimerRef.current = null;
      }
    };
  }, [activeMeetup?.id]);

  const refreshETAs = useCallback(async () => {
    if (!token || !activeMeetup) {
      setEtas([]);
      return;
    }
    const response = await fetch(`${apiUrl}/meetups/${activeMeetup.id}/eta`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || '到着時間を取得できませんでした');
    setEtas(body.etas || []);
  }, [activeMeetup, token]);

  // ★追加：バックエンドから最新の到着者一覧を取得する関数
  const refreshArrivedStatus = useCallback(async () => {
    if (!token || !activeMeetup) return;
    try {
      const response = await fetch(`${apiUrl}/meetups/arrive_status?meetupId=${activeMeetup.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const body = await response.json();
      if (response.ok) {
        setArrivedUsers(body.arrivedUsers || []);
      }
    } catch (error) {
      console.warn('Failed to fetch arrived status:', error);
    }
  }, [activeMeetup, token]);

  const requestWSTicket = useCallback(async () => {
    const requestVersion = ++wsTicketRequestVersionRef.current;
    if (!token || !activeMeetup) {
      setIssuedWSTicket(undefined);
      return;
    }
    const meetupId = activeMeetup.id;
    const response = await fetch(`${apiUrl}/ws/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ meetupId }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || '位置共有を開始できませんでした');
    if (requestVersion !== wsTicketRequestVersionRef.current) return;
    setIssuedWSTicket({ meetupId, ticket: body.ticket });
  }, [activeMeetup, token]);

  useEffect(() => {
    Promise.resolve()
      .then(requestWSTicket)
      .catch((error) => console.warn('Failed to create WebSocket ticket:', error));
  }, [requestWSTicket]);

  const reconnectWebSocket = useCallback(() => {
    requestWSTicket().catch((error) => console.warn('Failed to reconnect WebSocket:', error));
  }, [requestWSTicket]);

  useEffect(() => {
    Promise.resolve()
      .then(refreshETAs)
      .then(refreshArrivedStatus) // ★追加
      .catch((error) => console.warn('Failed to load ETAs:', error));
      
    if (!activeMeetup) return;
    
    // 定期的なポーリング（タイマー）
    const timer = setInterval(() => {
      setClock(Date.now());
      refreshETAs().catch((error) => console.warn('Failed to refresh ETAs:', error));
      refreshArrivedStatus().catch((error) => console.warn('Failed to refresh arrive status:', error)); // ★追加
    }, etaRefreshInterval);
    return () => clearInterval(timer);
  }, [activeMeetup, refreshETAs, refreshArrivedStatus]);

  const updateETA = useCallback(async (coordinate: { latitude: number; longitude: number }) => {
    if (!token || !activeMeetup) return;
    lastETAUpdateRef.current = Date.now();
    try {
      const response = await fetch(`${apiUrl}/meetups/${activeMeetup.id}/eta`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
          travelMode: 'TRANSIT',
          bufferMinutes: 5,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || '到着時間を計算できませんでした');
      await refreshETAs();
      setClock(Date.now());
    } catch (error) {
      lastETAUpdateRef.current = 0;
      console.warn('Failed to update ETA:', error);
    }
  }, [activeMeetup, refreshETAs, token]);

  const enqueueETAUpdate = useCallback((coordinate: { latitude: number; longitude: number }) => {
    const generation = etaGenerationRef.current;
    etaUpdateQueueRef.current = etaUpdateQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        if (generation !== etaGenerationRef.current) return;
        await updateETA(coordinate);
      });
  }, [updateETA]);

  const reportCurrentLocation = useCallback((
    coordinate: { latitude: number; longitude: number },
    options?: { forceETARefresh?: boolean },
  ) => {
    if (!token || !activeMeetup) return;

    if (options?.forceETARefresh) {
      if (demoETATimerRef.current) clearTimeout(demoETATimerRef.current);
      demoETATimerRef.current = setTimeout(() => {
        demoETATimerRef.current = null;
        lastETAUpdateRef.current = Date.now();
        enqueueETAUpdate(coordinate);
      }, demoETADebounceDelay);
      return;
    }

    if (Date.now() - lastETAUpdateRef.current < normalETAUpdateInterval) return;
    lastETAUpdateRef.current = Date.now();
    enqueueETAUpdate(coordinate);
  }, [activeMeetup, enqueueETAUpdate, token]);

  const respondToInvite = useCallback(async (meetupId: number, action: 'accept' | 'decline') => {
    if (!token) return;
    const response = await fetch(`${apiUrl}/meetups/${meetupId}/members`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || '招待を更新できませんでした');
    await refreshMeetups();
  }, [refreshMeetups, token]);

  // ★追加：到着したことをサーバーに知らせる関数
  const sendArrival = useCallback(async () => {
    if (!token || !activeMeetup || !userId) return;
    try {
      await fetch(`${apiUrl}/meetups/arrive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          meetupId: activeMeetup.id,
          userId: userId
        })
      });
      await refreshArrivedStatus();
    } catch (e) {
      console.error(e);
    }
  }, [activeMeetup, token, userId, refreshArrivedStatus]);

  // ★追加：全員到着したかどうかを判定
  const allArrived = useMemo(() => {
    if (!activeMeetup || !userId) return false;
    // 自分も含めた参加者のリストを生成
    const otherUserIds = etas.map(e => e.user?.userId).filter(Boolean) as string[];
    const participants = [userId, ...otherUserIds];
    
    // ぼっち（一人だけ）の場合は自分が到着したらtrueにする
    if (participants.length === 1 && arrivedUsers.includes(userId)) return true;
    
    // 参加者全員が到着記録（arrivedUsers）に入っているか確認
    if (participants.length > 0) {
      return participants.every(id => arrivedUsers.includes(id));
    }
    return false;
  }, [activeMeetup, etas, arrivedUsers, userId]);

  const etaMinutes = useMemo(() => {
    const others = etas.filter((eta) => eta.user?.userId !== userId && eta.travelMode === 'TRANSIT');
    if (others.length === 0) return null;
    const latestArrival = Math.max(...others.map((eta) => new Date(eta.arrivalAt).getTime()));
    return Math.max(0, Math.ceil((latestArrival - clock) / 60000));
  }, [clock, etas, userId]);

  const routePolyline = useMemo(() => {
    const transitETAs = etas.filter((eta) => eta.travelMode === 'TRANSIT');
    const ownRoute = transitETAs.find((eta) => eta.user?.userId === userId)?.routePolyline;
    if (ownRoute) return ownRoute;
    return transitETAs
      .filter((eta) => eta.user?.userId !== userId)
      .sort((left, right) => new Date(right.arrivalAt).getTime() - new Date(left.arrivalAt).getTime())[0]
      ?.routePolyline;
  }, [etas, userId]);

  const scheduleData = useMemo(() => meetups.reduce<Record<string, { id: string; title: string }[]>>(
    (result, item) => {
      if (item.status === 'cancelled' || item.membershipStatus === 'declined') return result;
      const date = new Date(item.scheduledAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const time = date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
      (result[key] ||= []).push({ id: String(item.id), title: `${time} ${item.placeName}` });
      return result;
    },
    {},
  ), [meetups]);

  const wsTicket = activeMeetup && issuedWSTicket?.meetupId === activeMeetup.id
    ? issuedWSTicket.ticket
    : undefined;

  return { 
    activeMeetup, 
    routePolyline: allArrived ? undefined : routePolyline,
    etaMinutes: allArrived ? null : etaMinutes, // ★全員到着ならタイマーを強制的にnullにして非表示に
    allArrived,   // ★追加
    arrivedUsers, // ★追加
    sendArrival,  // ★追加
    meetups, 
    reconnectWebSocket, 
    refreshMeetups, 
    reportCurrentLocation, 
    respondToInvite, 
    scheduleData, 
    wsTicket 
  };
}
