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
      .catch((error) => console.warn('Failed to load ETAs:', error));
    if (!activeMeetup) return;
    const timer = setInterval(() => {
      setClock(Date.now());
      refreshETAs().catch((error) => console.warn('Failed to refresh ETAs:', error));
    }, etaRefreshInterval);
    return () => clearInterval(timer);
  }, [activeMeetup, refreshETAs]);

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
          travelMode: 'DRIVE',
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

  const etaMinutes = useMemo(() => {
    const others = etas.filter((eta) => eta.user?.userId !== userId);
    if (others.length === 0) return null;
    const latestArrival = Math.max(...others.map((eta) => new Date(eta.arrivalAt).getTime()));
    return Math.max(0, Math.ceil((latestArrival - clock) / 60000));
  }, [clock, etas, userId]);

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

  return { activeMeetup, etaMinutes, meetups, reconnectWebSocket, refreshMeetups, reportCurrentLocation, respondToInvite, scheduleData, wsTicket };
}
