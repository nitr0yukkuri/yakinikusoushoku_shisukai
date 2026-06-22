import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle, ActivityIndicator } from 'react-native';
import { getAvatarInitials } from '../utils/avatar';
import { getApiUrl, getWebSocketUrl } from '../utils/api-url';
import { getProfileImageSignature } from '../utils/profile-image';

const INITIAL_REGION = { lat: 35.681236, lng: 139.767125 };
const GOOGLE_MAPS_SCRIPT_ID = 'google-maps-javascript-api';
const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

const WS_URL = getWebSocketUrl();
const API_URL = getApiUrl();

let googleMapsScriptPromise: Promise<void> | null = null;
const markerUrlCache = new Map<string, Promise<string>>();
const markerIconVersions = new WeakMap<object, string>();
const CURRENT_LOCATION_RING = '#000000';
const DEMO_LOCATION_STEP_METERS = 25;
const keyboardLocationControlsEnabled = process.env.NODE_ENV !== 'production';

type AppMapProps = {
  style?: StyleProp<ViewStyle>;
  roomId?: string;
  wsTicket?: string;
  userId?: string;
  userName?: string;
  profileImage?: string;
  followCurrentLocation?: boolean;
  selectedLocation?: {
    latitude: number;
    longitude: number;
  } | null;
  locationQuery?: string;
  onLocationSelect?: (coordinate: { latitude: number; longitude: number }, address?: string) => void;
  onCurrentLocationChange?: (
    coordinate: { latitude: number; longitude: number },
    options?: { forceETARefresh?: boolean },
  ) => void;
  onWebSocketDisconnect?: () => void;
};

type RemoteLocationMessage = {
  type: 'LOCATION_UPDATE';
  userId: string;
  userName?: string;
  profileVersion?: string;
  profileImage?: string;
  lat: number;
  lng: number;
  timestamp: number;
};

const fallbackMarkerUrl = (name: string, size = 48, ringColor?: string) => {
  const inset = ringColor ? 4 : 2;
  const diameter = size - inset * 2;
  const initials = getAvatarInitials(name)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 1.5}" fill="#ffffff"
        ${ringColor ? `stroke="${ringColor}" stroke-width="3"` : ''} />
      <circle cx="${size / 2}" cy="${size / 2}" r="${diameter / 2}" fill="#208AEF" />
      <text x="${size / 2}" y="${size / 2}" text-anchor="middle" dominant-baseline="central"
        fill="#ffffff" font-family="Arial, sans-serif" font-size="${Math.round(size * 0.38)}"
        font-weight="700">${initials}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const blankMarkerUrl = (size = 48, ringColor?: string) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 1.5}" fill="#ffffff"
        ${ringColor ? `stroke="${ringColor}" stroke-width="3"` : ''} />
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const circularMarkerUrl = (name: string, profileImage?: string, size = 48, ringColor?: string) => {
  if (!profileImage) {
    return Promise.resolve(fallbackMarkerUrl(name, size, ringColor));
  }
  if (profileImage.startsWith('data:image/') !== true || typeof document === 'undefined') {
    return Promise.resolve(blankMarkerUrl(size, ringColor));
  }

  const cacheKey = `${size}:${ringColor || 'none'}:${getProfileImageSignature(profileImage)}`;
  const cached = markerUrlCache.get(cacheKey);
  if (cached) return cached;

  const promise = new Promise<string>((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d');
      if (!context) {
        resolve(blankMarkerUrl(size, ringColor));
        return;
      }

      const inset = ringColor ? 4 : 2;
      const diameter = size - inset * 2;
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.arc(size / 2, size / 2, size / 2 - 1.5, 0, Math.PI * 2);
      context.fill();
      if (ringColor) {
        context.strokeStyle = ringColor;
        context.lineWidth = 3;
        context.stroke();
      }
      context.save();
      context.beginPath();
      context.arc(size / 2, size / 2, diameter / 2, 0, Math.PI * 2);
      context.clip();

      const scale = Math.max(diameter / image.width, diameter / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      const x = inset + (diameter - width) / 2;
      const y = inset + (diameter - height) / 2;
      context.drawImage(image, x, y, width, height);
      context.restore();
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => resolve(blankMarkerUrl(size, ringColor));
    image.src = profileImage;
  });

  markerUrlCache.set(cacheKey, promise);
  return promise;
};

const setMarkerIcon = (
  browserWindow: any,
  marker: any,
  name: string,
  profileImage?: string,
  size = 48,
  ringColor?: string,
) => {
  const signature = `${name}:${size}:${ringColor || 'none'}:${getProfileImageSignature(profileImage)}`;
  markerIconVersions.set(marker, signature);

  circularMarkerUrl(name, profileImage, size, ringColor).then((url) => {
    if (markerIconVersions.get(marker) !== signature) return;
    marker.setIcon({
      url,
      scaledSize: new browserWindow.google.maps.Size(size, size),
      anchor: new browserWindow.google.maps.Point(size / 2, size / 2),
    });
  });
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
  wsTicket,
  userId: propUserId,
  userName: propUserName,
  profileImage,
  followCurrentLocation = false,
  selectedLocation,
  locationQuery,
  onLocationSelect,
  onCurrentLocationChange,
  onWebSocketDisconnect,
}: AppMapProps) => {
  const [fallbackUserId] = useState(() => `user_${Math.floor(Math.random() * 10000)}`);
  const userId = propUserId || fallbackUserId;
  const userName = propUserName || userId;
  const profileRef = useRef({ userName, profileImage });

  const mapElementRef = useRef<HTMLElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const currentPositionRef = useRef<{ lat: number; lng: number } | null>(null);
  const demoPositionActiveRef = useRef(false);

  const otherMarkersRef = useRef<Record<string, any>>({});
  const markerProfileVersionsRef = useRef<Record<string, string>>({});
  const pendingLocationsRef = useRef<Record<string, RemoteLocationMessage>>({});
  const myMarkerRef = useRef<any>(null);
  const selectedMarkerRef = useRef<any>(null);
  const selectedLocationRef = useRef(selectedLocation);
  const onLocationSelectRef = useRef(onLocationSelect);
  const onCurrentLocationChangeRef = useRef(onCurrentLocationChange);
  const onWebSocketDisconnectRef = useRef(onWebSocketDisconnect);

  const [isInitialized, setIsInitialized] = useState(false);
  const [isCurrentLocationResolved, setIsCurrentLocationResolved] = useState(!followCurrentLocation);

  useEffect(() => {
    selectedLocationRef.current = selectedLocation;
  }, [selectedLocation]);

  useEffect(() => {
    onLocationSelectRef.current = onLocationSelect;
  }, [onLocationSelect]);

  useEffect(() => {
    onCurrentLocationChangeRef.current = onCurrentLocationChange;
    const currentPosition = currentPositionRef.current;
    if (!currentPosition || !onCurrentLocationChange) return;
    const timer = window.setTimeout(() => {
      onCurrentLocationChangeRef.current?.({
        latitude: currentPosition.lat,
        longitude: currentPosition.lng,
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [onCurrentLocationChange]);

  useEffect(() => {
    onWebSocketDisconnectRef.current = onWebSocketDisconnect;
  }, [onWebSocketDisconnect]);

  useEffect(() => {
    profileRef.current = { userName, profileImage };

    const browserWindow = window as any;
    if (!myMarkerRef.current || !browserWindow.google?.maps) return;

    myMarkerRef.current.setTitle(userName);
    setMarkerIcon(browserWindow, myMarkerRef.current, userName, profileImage, 48, CURRENT_LOCATION_RING);

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

  const applyRemoteLocation = useCallback((data: RemoteLocationMessage) => {
    const browserWindow = window as any;
    if (!browserWindow.google?.maps?.Marker || !mapInstanceRef.current) return false;

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
      });
      setMarkerIcon(browserWindow, otherMarkersRef.current[data.userId], markerName, data.profileImage, 40);
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
          setMarkerIcon(browserWindow, marker, profile.name || data.userId, profile.profileImage, 40);
        })
        .catch((error) => {
          delete markerProfileVersionsRef.current[data.userId];
          console.warn('Failed to load marker profile:', error);
        });
    }

    return true;
  }, []);

  useEffect(() => {
    if (!isInitialized) return;

    Object.entries(pendingLocationsRef.current).forEach(([remoteUserId, location]) => {
      if (applyRemoteLocation(location)) {
        delete pendingLocationsRef.current[remoteUserId];
      }
    });
  }, [applyRemoteLocation, isInitialized]);

  useEffect(() => {
    if (!wsTicket) return;
    let disposed = false;
    let reconnectTimer: number | undefined;
    const ws = new WebSocket(`${WS_URL}?ticket=${encodeURIComponent(wsTicket)}`);
    wsRef.current = ws;

    ws.onopen = () => {
      const currentPosition = currentPositionRef.current;
      if (!currentPosition) return;
      ws.send(JSON.stringify({
        type: 'LOCATION_UPDATE',
        userId,
        userName: profileRef.current.userName,
        profileVersion: `${profileRef.current.userName}:${profileRef.current.profileImage?.length || 0}:${profileRef.current.profileImage?.slice(-16) || ''}`,
        ...currentPosition,
        timestamp: Date.now(),
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as RemoteLocationMessage;
        if (data.type === 'LOCATION_UPDATE' && data.userId !== userId) {
          pendingLocationsRef.current[data.userId] = data;
          if (applyRemoteLocation(data)) {
            delete pendingLocationsRef.current[data.userId];
          }
        }
      } catch (error) {
        console.warn('Invalid message format', error);
      }
    };

    ws.onclose = () => {
      if (disposed) return;
      onWebSocketDisconnectRef.current?.();
      reconnectTimer = window.setInterval(() => {
        onWebSocketDisconnectRef.current?.();
      }, 3000);
    };

    return () => {
      disposed = true;
      if (reconnectTimer !== undefined) window.clearInterval(reconnectTimer);
      ws.close();
      Object.values(otherMarkersRef.current).forEach((marker: any) => marker.setMap(null));
      otherMarkersRef.current = {};
      markerProfileVersionsRef.current = {};
      pendingLocationsRef.current = {};
    };
  }, [applyRemoteLocation, roomId, userId, wsTicket]);

  const moveSelectedMarker = (position: { lat: number; lng: number }, shouldPan = true) => {
    const browserWindow = window as any;
    if (!browserWindow.google?.maps?.Marker || !mapInstanceRef.current) return;

    if (selectedMarkerRef.current) {
      selectedMarkerRef.current.setPosition(position);
    } else {
      selectedMarkerRef.current = new browserWindow.google.maps.Marker({
        position,
        map: mapInstanceRef.current,
        title: '待ち合わせ場所',
      });
    }

    if (shouldPan) mapInstanceRef.current.panTo(position);
  };

  useEffect(() => {
    if (!selectedLocation) {
      selectedMarkerRef.current?.setMap(null);
      selectedMarkerRef.current = null;
      return;
    }

    moveSelectedMarker({
      lat: selectedLocation.latitude,
      lng: selectedLocation.longitude,
    }, !followCurrentLocation);
  }, [followCurrentLocation, isInitialized, selectedLocation]);

  useEffect(() => {
    const browserWindow = window as any;
    const query = locationQuery?.trim();
    if (!query || selectedLocation || !isInitialized || !browserWindow.google?.maps?.Geocoder) return;

    const timer = setTimeout(() => {
      const geocoder = new browserWindow.google.maps.Geocoder();
      geocoder.geocode({ address: query }, (results: any[], status: string) => {
        if (status !== 'OK' || !results?.[0]?.geometry?.location) return;
        const location = results[0].geometry.location;
        moveSelectedMarker({
          lat: location.lat(),
          lng: location.lng(),
        });
      });
    }, 600);

    return () => clearTimeout(timer);
  }, [isInitialized, locationQuery, selectedLocation]);

  useEffect(() => {
    if (!keyboardLocationControlsEnabled || !followCurrentLocation) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (target?.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select') return;

      const currentPosition = currentPositionRef.current;
      if (!currentPosition || !mapInstanceRef.current || !myMarkerRef.current) return;

      event.preventDefault();
      demoPositionActiveRef.current = true;

      const stepMeters = event.shiftKey ? DEMO_LOCATION_STEP_METERS * 4 : DEMO_LOCATION_STEP_METERS;
      const latitudeStep = stepMeters / 111320;
      const longitudeScale = Math.max(Math.cos(currentPosition.lat * Math.PI / 180), 0.01);
      const longitudeStep = stepMeters / (111320 * longitudeScale);
      const nextPosition = {
        lat: currentPosition.lat
          + (event.key === 'ArrowUp' ? latitudeStep : event.key === 'ArrowDown' ? -latitudeStep : 0),
        lng: currentPosition.lng
          + (event.key === 'ArrowRight' ? longitudeStep : event.key === 'ArrowLeft' ? -longitudeStep : 0),
      };

      currentPositionRef.current = nextPosition;
      myMarkerRef.current.setPosition(nextPosition);
      mapInstanceRef.current.panTo(nextPosition);
      onCurrentLocationChangeRef.current?.(
        { latitude: nextPosition.lat, longitude: nextPosition.lng },
        { forceETARefresh: true },
      );

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'LOCATION_UPDATE',
          userId,
          userName: profileRef.current.userName,
          profileVersion: `${profileRef.current.userName}:${profileRef.current.profileImage?.length || 0}:${profileRef.current.profileImage?.slice(-16) || ''}`,
          ...nextPosition,
          timestamp: Date.now(),
        }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [followCurrentLocation, userId]);

  useEffect(() => {
    let watchId: number | null = null;
    let mapClickListener: { remove: () => void } | null = null;
    let isMounted = true;

    const initMapAndLocation = async () => {
      try {
        await loadGoogleMapsScript();
        if (!isMounted || !mapElementRef.current) return;

        const browserWindow = window as any;
        if (!browserWindow.google?.maps?.Map) return;

        mapInstanceRef.current = new browserWindow.google.maps.Map(mapElementRef.current, {
          center: INITIAL_REGION,
          zoom: 16,
          disableDefaultUI: true,
          zoomControl: true,
        });
        Object.values(otherMarkersRef.current).forEach((marker: any) => {
          marker.setMap(mapInstanceRef.current);
        });
        selectedMarkerRef.current?.setMap(mapInstanceRef.current);
        setIsInitialized(true);

        mapClickListener = mapInstanceRef.current.addListener('click', (event: any) => {
          if (!event.latLng || !onLocationSelectRef.current) return;
          const coordinate = {
            latitude: event.latLng.lat(),
            longitude: event.latLng.lng(),
          };
          selectedLocationRef.current = coordinate;
          moveSelectedMarker({ lat: coordinate.latitude, lng: coordinate.longitude });
          onLocationSelectRef.current(coordinate);

          const geocoder = new browserWindow.google.maps.Geocoder();
          geocoder.geocode({ location: event.latLng }, (results: any[], status: string) => {
            if (status !== 'OK' || !results?.[0]?.formatted_address) return;
            onLocationSelectRef.current?.(coordinate, results[0].formatted_address);
          });
        });

        if (!navigator.geolocation) {
          console.warn('Geolocation is not supported by this browser.');
          setIsCurrentLocationResolved(true);
          return;
        }

        let hasCurrentPosition = false;
        const applyCurrentPosition = (position: GeolocationPosition) => {
          if (!isMounted || !mapInstanceRef.current) return;
          if (demoPositionActiveRef.current) return;
          const currentPos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          currentPositionRef.current = currentPos;
          setIsCurrentLocationResolved(true);
          onCurrentLocationChangeRef.current?.({ latitude: currentPos.lat, longitude: currentPos.lng });

          if (myMarkerRef.current) {
            myMarkerRef.current.setMap(mapInstanceRef.current);
            myMarkerRef.current.setPosition(currentPos);
          } else {
            myMarkerRef.current = new browserWindow.google.maps.Marker({
              position: currentPos,
              map: mapInstanceRef.current,
              title: profileRef.current.userName,
            });
            setMarkerIcon(
              browserWindow,
              myMarkerRef.current,
              profileRef.current.userName,
              profileRef.current.profileImage,
              48,
              CURRENT_LOCATION_RING,
            );
          }

          if (followCurrentLocation || (!hasCurrentPosition && !selectedLocationRef.current)) {
            mapInstanceRef.current.panTo(currentPos);
            if (!hasCurrentPosition) mapInstanceRef.current.setZoom(16);
          }
          hasCurrentPosition = true;

          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'LOCATION_UPDATE',
              userId,
              userName: profileRef.current.userName,
              profileVersion: `${profileRef.current.userName}:${profileRef.current.profileImage?.length || 0}:${profileRef.current.profileImage?.slice(-16) || ''}`,
              ...currentPos,
              timestamp: position.timestamp,
            }));
          }
        };

        navigator.geolocation.getCurrentPosition(
          applyCurrentPosition,
          (error) => {
            console.warn('Initial geolocation failed:', error);
            setIsCurrentLocationResolved(true);
          },
          { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 },
        );
        watchId = navigator.geolocation.watchPosition(
          applyCurrentPosition,
          (error) => console.warn('Watch Position Error:', error),
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
        );
      } catch (error) {
        console.error('Google Maps init failed:', error);
        setIsInitialized(true);
        setIsCurrentLocationResolved(true);
      }
    };

    initMapAndLocation();

    return () => {
      isMounted = false;
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
      mapClickListener?.remove();
      if (myMarkerRef.current) {
        myMarkerRef.current.setMap(null);
        myMarkerRef.current = null;
      }
    };
  }, [followCurrentLocation, userId]);

  return (
    <View style={[styles.map, style]}>
      {React.createElement('div', {
        ref: mapElementRef,
        style: styles.mapCanvas,
      })}

      {(!isInitialized || (followCurrentLocation && !isCurrentLocationResolved)) && (
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
