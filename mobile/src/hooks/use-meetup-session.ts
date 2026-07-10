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

type MeetupMember = {
  userId: string;
  status: 'invited' | 'accepted' | 'declined';
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
const meetupRefreshInterval = 20000;
const routeTravelModes = new Set(['WALK', 'TRANSIT']);
const walkRouteThresholdMeters = 10000;

const distanceMeters = (
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
) => {
  const earthRadiusMeters = 6371000;
  const originLat = origin.latitude * Math.PI / 180;
  const destinationLat = destination.latitude * Math.PI / 180;
  const latitudeDelta = (destination.latitude - origin.latitude) * Math.PI / 180;
  const longitudeDelta = (destination.longitude - origin.longitude) * Math.PI / 180;
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(originLat) * Math.cos(destinationLat) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const selectRouteTravelMode = (
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
) => (distanceMeters(origin, destination) <= walkRouteThresholdMeters ? 'WALK' : 'TRANSIT');

export function useMeetupSession(token: string | null, userId?: string) {
  const [meetups, setMeetups] = useState<MeetupSummary[]>([]);
  const [issuedWSTicket, setIssuedWSTicket] = useState<{ meetupId: number; ticket: string }>();
  const [etas, setEtas] = useState<ETA[]>([]);
  const [clock, setClock] = useState(() => Date.now());
  const [etaAccessDeniedMeetupIds, setEtaAccessDeniedMeetupIds] = useState<Set<number>>(() => new Set());
  const [wsAccessDeniedMeetupIds, setWSAccessDeniedMeetupIds] = useState<Set<number>>(() => new Set());
  const [activeMeetupMembers, setActiveMeetupMembers] = useState<{
    meetupId?: number;
    loaded: boolean;
    members: MeetupMember[];
  }>({ loaded: false, members: [] });
  const lastETAUpdateRef = useRef(0);
  const demoETATimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const etaUpdateQueueRef = useRef<Promise<void>>(Promise.resolve());
  const etaGenerationRef = useRef(0);
  const currentCoordinateRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const initialETAReportedMeetupIdRef = useRef<number | null>(null);
  const etaAccessDeniedMeetupIdsRef = useRef<Set<number>>(new Set());
  const wsAccessDeniedMeetupIdsRef = useRef<Set<number>>(new Set());
  const lastRouteTravelModeRef = useRef<string | null>(null);
  const wsTicketRequestVersionRef = useRef(0);

  // ★追加：到着したユーザー一覧を保存するステート
  const [arrivedMeetupStatus, setArrivedMeetupStatus] = useState<{ meetupId?: number; users: string[] }>({ users: [] });

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
        if (left.status !== right.status) {
          if (left.status === 'active') return -1;
          if (right.status === 'active') return 1;
        }
        const leftTime = new Date(left.scheduledAt).getTime();
        const rightTime = new Date(right.scheduledAt).getTime();
        const leftRank = leftTime >= clock ? leftTime : Number.MAX_SAFE_INTEGER - leftTime;
        const rightRank = rightTime >= clock ? rightTime : Number.MAX_SAFE_INTEGER - rightTime;
        return leftRank