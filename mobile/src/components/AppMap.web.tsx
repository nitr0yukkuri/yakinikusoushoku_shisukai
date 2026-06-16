import React, { useEffect, useRef, useState } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle, ActivityIndicator } from 'react-native';
import { getAvatarInitials } from '../utils/avatar';

const INITIAL_REGION = { lat: 35.681236, lng: 139.767125 };
const GOOGLE_MAPS_SCRIPT_ID = 'google-maps-javascript-api';
const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'ws://localhost:8080/ws';
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

let googleMapsScriptPromise: Promise<void> | null = null;

type AppMapProps = {
  style?: StyleProp<ViewStyle>;
  roomId?: string;
  userId?: string;
  userName?: string;
  profileImage?: string;
};

const circularMarkerUrl = (name: string, profileImage?: string, size = 48) => {
  const source = (profileImage ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
  const inset = 2;
  const diameter = size - inset * 2;
  const initials = getAvatarInitials(name)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
  const avatar =
    profileImage?.startsWith('data:image/') === true
      ? `<image href="${source}" x="${inset}" y="${inset}" width="${diameter}" height="${diameter}"
        preserveAspectRatio="xMidYMid slice" clip-path="url(#avatar)" />`
      : `<circle cx="${size / 2}" cy="${size / 2}" r="${diameter / 2}" fill="#208AEF" />
        <text x="${size / 2}" y="${size / 2}" text-anchor="middle" dominant-baseline="central"
          fill="#ffffff" font-family="Arial, sans-serif" font-size="${Math.round(size * 0.38)}"
          font-weight="700">${initials}</text>`;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <defs>
        <clipPath id="avatar">
          <circle cx="${size / 2}" cy="${size / 2}" r="${diameter / 2}" />
        </clipPath>
      </defs>
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#ffffff" />
      ${avatar}
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const loadGoogleMapsScript = () => {
  if (typeof window === 'undefined') return Promise.resolve();

  const browserWindow = window as any;
  if (browserWindow.google?.maps?.Map) return Promise.resolve();

  if (!googleMapsApiKey) {
    return Promise.reject(new Error('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is not configured.'));
  }

  if (googleMapsScriptPromise) return googleMapsScriptPromise;

  googleMapsScriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById(GOOGLE_MAPS_SCRIPT_ID);
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Google Maps.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(googleMapsApiKey)}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps.'));
    document.head.appendChild(script);
  });

  return googleMapsScriptPromise;
};

export const AppMap = ({
  style,
  roomId = 'global',
  userId: propUserId,
  userName: propUserName,
  profileImage,
}: AppMapProps) => {
  const [fallbackUserId] = useState(() => `user_${Math.floor(Math.random() * 10000)}`);
  const userId = propUserId || fallbackUserId;
  const userName = propUserName || userId;
  const profileRef = useRef({ userName, profileImage });

  const mapElementRef = useRef<HTMLElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const currentPositionRef = useRef<{ lat: number; lng: number } | null>(null);

  const otherMarkersRef = useRef<Record<string, any>>({});
  const markerProfileVersionsRef = useRef<Record<string, string>>({});
  const myMarkerRef = useRef<any>(null);

  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    profileRef.current = { userName, profileImage };

    const browserWindow = window as any;
    if (!myMarkerRef.current || !browserWindow.google?.maps) return;

    myMarkerRef.current.setTitle(userName);
    myMarkerRef.current.setIcon({
      url: circularMarkerUrl(userName, profileImage),
      scaledSize: new browserWindow.google.maps.Size(48, 48),
      anchor: new browserWindow.google.maps.Point(24, 24),
    });

    if (wsRef.current?.readyState === WebSocket.OPEN && currentPositionRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'LOCATION_UPDATE',
        userId,
        userName,
        profileVersion: `${userName}:${profileImage?.length || 0}:${profileImage?.slice(-16) || ''}`,
        ...currentPositionRef.current,
        timestamp: Date.now(),
      }));
    }
  }, [profileImage, userId, userName]);

  useEffect(() => {
    const ws = new WebSocket(`${WS_URL}?room=${roomId}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'LOCATION_UPDATE' && data.userId !== userId) {
          const browserWindow = window as any;
          if (!browserWindow.google?.maps?.Marker || !mapInstanceRef.current) return;

          const position = { lat: data.lat, lng: data.lng };
          const markerName = data.userName || data.userId;
          const profileVersion = data.profileVersion || markerName;

          if (otherMarkersRef.current[data.userId]) {
            otherMarkersRef.current[data.userId].setPosition(position);
            otherMarkersRef.current[data.userId].setTitle(markerName);
          } else {
            otherMarkersRef.current[data.userId] = new browserWindow.google.maps.Marker({
              position,
              map: mapInstanceRef.current,
              title: markerName,
              icon: {
                url: circularMarkerUrl(markerName, data.profileImage, 40),
                scaledSize: new browserWindow.google.maps.Size(40, 40),
                anchor: new browserWindow.google.maps.Point(20, 20),
              }
            });
          }

          if (markerProfileVersionsRef.current[data.userId] !== profileVersion) {
            markerProfileVersionsRef.current[data.userId] = profileVersion;
            fetch(`${API_URL}/profiles?userId=${encodeURIComponent(data.userId)}`)
              .then(async (response) => {
                if (!response.ok) throw new Error('Profile fetch failed.');
                return response.json();
              })
              .then(({ profile }) => {
                const marker = otherMarkersRef.current[data.userId];
                if (!marker) return;
                marker.setTitle(profile.name || data.userId);
                marker.setIcon({
                  url: circularMarkerUrl(profile.name || data.userId, profile.profileImage, 40),
                  scaledSize: new browserWindow.google.maps.Size(40, 40),
                  anchor: new browserWindow.google.maps.Point(20, 20),
                });
              })
              .catch((error) => {
                delete markerProfileVersionsRef.current[data.userId];
                console.warn('Failed to load marker profile:', error);
              });
          }
        }
      } catch (error) {
        console.warn('Invalid message format', error);
      }
    };

    return () => {
      ws.close();
      Object.values(otherMarkersRef.current).forEach((marker: any) => marker.setMap(null));
      otherMarkersRef.current = {};
      markerProfileVersionsRef.current = {};
    };
  }, [roomId, userId]);

  useEffect(() => {
    let watchId: number | null = null;
    let isMounted = true;

    const initMapAndLocation = async () => {
      try {
        await loadGoogleMapsScript();
        console.log('mapElementRef', mapElementRef.current);

        if (!isMounted || !mapElementRef.current) return;

        const browserWindow = window as any;
        if (!browserWindow.google?.maps?.Map) return;

        const fetchLocation = () => new Promise<any>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Location fetch timeout')), 5000);
          navigator.geolocation.getCurrentPosition(
            (pos) => { clearTimeout(timer); resolve(pos); },
            (err) => { clearTimeout(timer); reject(err); },
            { enableHighAccuracy: true, maximumAge: 0 }
          );
        });

        if (navigator.geolocation) {
          try {
            const position = await fetchLocation();
            const currentPos = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };
            currentPositionRef.current = currentPos;

            mapInstanceRef.current = new browserWindow.google.maps.Map(mapElementRef.current, {
              center: currentPos,
              zoom: 16,
              disableDefaultUI: true,
              zoomControl: true,
            });

            myMarkerRef.current = new browserWindow.google.maps.Marker({
              position: currentPos,
              map: mapInstanceRef.current,
              title: profileRef.current.userName,
              icon: {
                url: circularMarkerUrl(profileRef.current.userName, profileRef.current.profileImage),
                scaledSize: new browserWindow.google.maps.Size(48, 48),
                anchor: new browserWindow.google.maps.Point(24, 24),
              }
            });

            setIsInitialized(true);

            watchId = navigator.geolocation.watchPosition(
              (newPos) => {
                const newLatLng = { lat: newPos.coords.latitude, lng: newPos.coords.longitude };
                currentPositionRef.current = newLatLng;
                myMarkerRef.current?.setPosition(newLatLng);

                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({
                    type: 'LOCATION_UPDATE',
                    userId: userId,
                    userName: profileRef.current.userName,
                    profileVersion: `${profileRef.current.userName}:${profileRef.current.profileImage?.length || 0}:${profileRef.current.profileImage?.slice(-16) || ''}`,
                    lat: newPos.coords.latitude,
                    lng: newPos.coords.longitude,
                    timestamp: newPos.timestamp,
                  }));
                }
              },
              (error) => console.warn('Watch Position Error:', error),
              { enableHighAccuracy: true, maximumAge: 5000, timeout: 5000 }
            );
          } catch (error) {
            console.warn('Geolocation failed or timed out:', error);
            mapInstanceRef.current = new browserWindow.google.maps.Map(mapElementRef.current, {
              center: INITIAL_REGION,
              zoom: 16,
              disableDefaultUI: true,
              zoomControl: true,
            });
            setIsInitialized(true);
          }
        } else {
          mapInstanceRef.current = new browserWindow.google.maps.Map(mapElementRef.current, {
            center: INITIAL_REGION,
            zoom: 16,
            disableDefaultUI: true,
            zoomControl: true,
          });
          setIsInitialized(true);
        }
      } catch (error) {
        console.error('Google Maps init failed:', error);
        setIsInitialized(true);
      }
    };

    initMapAndLocation();

    return () => {
      isMounted = false;
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (myMarkerRef.current) {
        myMarkerRef.current.setMap(null);
      }
    };
  }, [userId]);

  return (
    <View style={[styles.map, style]}>
      {React.createElement('div', {
        ref: mapElementRef,
        style: styles.mapCanvas,
      })}

      {!isInitialized && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#00aa00" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  map: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  mapCanvas: {
    height: '100%',
    width: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E2FBE2',
    zIndex: 10,
  },
});
