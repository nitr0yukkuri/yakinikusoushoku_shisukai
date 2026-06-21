import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getApiUrl } from '../utils/api-url';

export type MeetupSummary = {
  id: number;
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

export function useMeetupSession(token: string | null, userId?: string) {
  const [meetups, setMeetups] = useState<MeetupSummary[]>([]);
  const [issuedWSTicket, setIssuedWSTicket] = useState<{ meetupId: number; ticket: string }>();
  const [etas, setEtas] = useState<ETA[]>([]);
  const [clock, setClock] = useState(() => Date.now());
  const lastETAUpdateRef = useRef(0);

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

  useEffect(() => {
    if (!token || !activeMeetup) return;
    let cancelled = false;
    fetch(`${apiUrl}/ws/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ meetupId: activeMeetup.id }),
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || '位置共有を開始できませんでした');
        if (!cancelled) setIssuedWSTicket({ meetupId: activeMeetup.id, ticket: body.ticket });
      })
      .catch((error) => console.warn('Failed to create WebSocket ticket:', error));
    return () => { cancelled = true; };
  }, [activeMeetup, token]);

  useEffect(() => {
    Promise.resolve()
      .then(refreshETAs)
      .catch((error) => console.warn('Failed to load ETAs:', error));
    if (!activeMeetup) return;
    const timer = setInterval(() => {
      setClock(Date.now());
      refreshETAs().catch((error) => console.warn('Failed to refresh ETAs:', error));
    }, 30000);
    return () => clearInterval(timer);
  }, [activeMeetup, refreshETAs]);

  const reportCurrentLocation = useCallback(async (coordinate: { latitude: number; longitude: number }) => {
    if (!token || !activeMeetup || Date.now() - lastETAUpdateRef.current < 120000) return;
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
    } catch (error) {
      lastETAUpdateRef.current = 0;
      console.warn('Failed to update ETA:', error);
    }
  }, [activeMeetup, refreshETAs, token]);

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
    const candidates = others.length > 0 ? others : etas;
    if (candidates.length === 0) return null;
    const latestArrival = Math.max(...candidates.map((eta) => new Date(eta.arrivalAt).getTime()));
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

  return { activeMeetup, etaMinutes, meetups, refreshMeetups, reportCurrentLocation, respondToInvite, scheduleData, wsTicket };
}
