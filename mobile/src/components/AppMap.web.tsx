import React, { useEffect, useRef, useState } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle, ActivityIndicator } from 'react-native';

const INITIAL_REGION = { lat: 35.681236, lng: 139.767125 };
const GOOGLE_MAPS_SCRIPT_ID = 'google-maps-javascript-api';
const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'ws://localhost:8080/ws';

let googleMapsScriptPromise: Promise<void> | null = null;

type AppMapProps = {
  style?: StyleProp<ViewStyle>;
  roomId?: string;
  userId?: string;
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
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(googleMapsApiKey)}&loading=async`;
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
  userId: propUserId
}: AppMapProps) => {
  // ★ 解決策：userIdを毎回生成するのではなく、マウント時に1回だけ生成して保持する
  const [userId] = useState(() => propUserId || `user_${Math.floor(Math.random() * 10000)}`);

  const mapElementRef = useRef<HTMLElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const otherMarkersRef = useRef<Record<string, any>>({});
  const myMarkerRef = useRef<any>(null);

  const [isInitialized, setIsInitialized] = useState(false);

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

          if (otherMarkersRef.current[data.userId]) {
            otherMarkersRef.current[data.userId].setPosition(position);
          } else {
            otherMarkersRef.current[data.userId] = new browserWindow.google.maps.Marker({
              position,
              map: mapInstanceRef.current,
              title: `User: ${data.userId}`,
              icon: {
                url: `https://ui-avatars.com/api/?name=${data.userId}&background=random&color=fff&rounded=true&size=40`,
                scaledSize: new browserWindow.google.maps.Size(40, 40),
                anchor: new browserWindow.google.maps.Point(20, 20),
              }
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
    };
  }, [roomId, userId]);

  useEffect(() => {
    let watchId: number | null = null;
    let isMounted = true;

    const initMapAndLocation = async () => {
      try {
        await loadGoogleMapsScript();

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

            mapInstanceRef.current = new browserWindow.google.maps.Map(mapElementRef.current, {
              center: currentPos,
              zoom: 16,
              disableDefaultUI: true,
              zoomControl: true,
            });

            myMarkerRef.current = new browserWindow.google.maps.Marker({
              position: currentPos,
              map: mapInstanceRef.current,
              title: '現在地',
              icon: {
                url: `https://ui-avatars.com/api/?name=Me&background=208AEF&color=fff&rounded=true&size=48`,
                scaledSize: new browserWindow.google.maps.Size(48, 48),
                anchor: new browserWindow.google.maps.Point(24, 24),
              }
            });

            setIsInitialized(true);

            watchId = navigator.geolocation.watchPosition(
              (newPos) => {
                const newLatLng = { lat: newPos.coords.latitude, lng: newPos.coords.longitude };
                myMarkerRef.current?.setPosition(newLatLng);

                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({
                    type: 'LOCATION_UPDATE',
                    userId: userId,
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