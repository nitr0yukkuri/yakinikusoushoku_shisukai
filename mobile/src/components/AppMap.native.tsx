import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { StyleProp, StyleSheet, ViewStyle, ActivityIndicator, View, Alert, Platform } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Region, Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { ProfileAvatar } from './ProfileAvatar';
import { getProfileImageSignature } from '../utils/profile-image';
import { getApiUrl, getWebSocketUrl } from '../utils/api-url';

const WS_URL = getWebSocketUrl();
const API_URL = getApiUrl();
const demoLocationEditingEnabled = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';

const INITIAL_REGION: Region = {
  latitude: 35.681236,
  longitude: 139.767125,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

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
  routePolyline?: string;
  hideSharedLocations?: boolean;
  onLocationSelect?: (coordinate: { latitude: number; longitude: number }, address?: string) => void;
  onCurrentLocationChange?: (
    coordinate: { latitude: number; longitude: number },
    options?: { forceETARefresh?: boolean },
  ) => void;
  onWebSocketDisconnect?: () => void;
};

interface UserLocation {
  userId: string;
  userName: string;
  profileImage?: string;
  profileVersion: string;
  latitude: number;
  longitude: number;
  timestamp: number;
}

const decodePolyline = (encoded: string) => {
  const points: { latitude: number; longitude: number }[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);

    latitude += (result & 1) ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);

    longitude += (result & 1) ? ~(result >> 1) : result >> 1;
    points.push({ latitude: latitude / 1e5, longitude: longitude / 1e5 });
  }

  return points;
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
  routePolyline,
  hideSharedLocations = false,
  onLocationSelect,
  onCurrentLocationChange,
  onWebSocketDisconnect,
}: AppMapProps) => {
  const [fallbackUserId] = useState(() => `user_${Math.floor(Math.random() * 10000)}`);
  const userId = propUserId || fallbackUserId;
  const userName = propUserName || userId;
  const profileRef = useRef({ userName, profileImage });

  const [locations, setLocations] = useState<Record<string, UserLocation>>({});
  const [myLocation, setMyLocation] = useState<Location.LocationObject | null>(null);
  const [isManualLocationMode, setIsManualLocationMode] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const mapRef = useRef<MapView | null>(null);
  const currentPositionRef = useRef<{ lat: number; lng: number } | null>(null);
  const manualLocationModeRef = useRef(false);
  const markerProfileVersionsRef = useRef<Record<string, string>>({});
  const hasCenteredOnCurrentLocationRef = useRef(false);
  const onCurrentLocationChangeRef = useRef(onCurrentLocationChange);
  const onWebSocketDisconnectRef = useRef(onWebSocketDisconnect);
  const routeCoordinates = useMemo(
    () => (routePolyline ? decodePolyline(routePolyline) : []),
    [routePolyline],
  );

  const publishManualPosition = useCallback((coordinate: { latitude: number; longitude: number }) => {
    const timestamp = Date.now();
    currentPositionRef.current = {
      lat: coordinate.latitude,
      lng: coordinate.longitude,
    };
    setMyLocation((current) => current ? {
      ...current,
      coords: {
        ...current.coords,
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
      },
      timestamp,
    } : current);
    onCurrentLocationChangeRef.current?.(coordinate, { forceETARefresh: true });

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'LOCATION_UPDATE',
        userId,
        userName: profileRef.current.userName,
        profileVersion: `${profileRef.current.userName}:${profileRef.current.profileImage?.length || 0}:${profileRef.current.profileImage?.slice(-16) || ''}`,
        lat: coordinate.latitude,
        lng: coordinate.longitude,
        timestamp,
      }));
    }
  }, [userId]);

  useEffect(() => {
    onCurrentLocationChangeRef.current = onCurrentLocationChange;
    const currentPosition = currentPositionRef.current;
    if (!currentPosition || !onCurrentLocationChange) return;
    const timer = setTimeout(() => {
      onCurrentLocationChangeRef.current?.({
        latitude: currentPosition.lat,
        longitude: currentPosition.lng,
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [onCurrentLocationChange]);

  useEffect(() => {
    onWebSocketDisconnectRef.current = onWebSocketDisconnect;
  }, [onWebSocketDisconnect]);

  useEffect(() => {
    profileRef.current = { userName, profileImage };

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
    if (!wsTicket) return;
    let disposed = false;
    let reconnectTimer: ReturnType<typeof setInterval> | undefined;
    const ws = new WebSocket(`${WS_URL}?ticket=${encodeURIComponent(wsTicket)}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected to room:', roomId);
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
        const data = JSON.parse(event.data);
        if (data.type === 'LOCATION_UPDATE' && !hideSharedLocations) {
          if (data.userId !== userId) {
            setLocations((prev) => ({
              ...prev,
              [data.userId]: {
                userId: data.userId,
                userName: data.userName || data.userId,
                profileImage: prev[data.userId]?.profileImage,
                profileVersion: data.profileVersion || data.userName || data.userId,
                latitude: data.lat,
                longitude: data.lng,
                timestamp: data.timestamp,
              },
            }));

            const nextVersion = data.profileVersion || data.userName || data.userId;
            if (markerProfileVersionsRef.current[data.userId] !== nextVersion) {
              markerProfileVersionsRef.current[data.userId] = nextVersion;
              fetch(`${API_URL}/profiles?userId=${encodeURIComponent(data.userId)}`)
                .then(async (response) => {
                  if (!response.ok) throw new Error('Profile fetch failed.');
                  return response.json();
                })
                .then(({ profile }) => {
                  setLocations((prev) => {
                    const current = prev[data.userId];
                    if (!current) return prev;
                    return {
                      ...prev,
                      [data.userId]: {
                        ...current,
                        userName: profile.name || data.userId,
                        profileImage: profile.profileImage,
                        profileVersion: nextVersion,
                      },
                    };
                  });
                })
                .catch((error) => {
                  delete markerProfileVersionsRef.current[data.userId];
                  console.warn('Failed to load marker profile:', error);
                });
            }
          }
        }
      } catch (error) {
        console.warn('Invalid message format', error);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      if (disposed) return;
      onWebSocketDisconnectRef.current?.();
      reconnectTimer = setInterval(() => {
        onWebSocketDisconnectRef.current?.();
      }, 3000);
    };

    return () => {
      disposed = true;
      if (reconnectTimer) clearInterval(reconnectTimer);
      ws.close();
      setLocations({});
      markerProfileVersionsRef.current = {};
    };
  }, [hideSharedLocations, roomId, userId, wsTicket]);

  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;
    let isMounted = true;

    const applyLocation = (location: Location.LocationObject, shareLocation: boolean) => {
      if (!isMounted) return;
      if (demoLocationEditingEnabled && manualLocationModeRef.current) return;

      setMyLocation(location);
      if (!shareLocation) return;

      currentPositionRef.current = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      };
      onCurrentLocationChangeRef.current?.({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'LOCATION_UPDATE',
          userId,
          userName: profileRef.current.userName,
          profileVersion: `${profileRef.current.userName}:${profileRef.current.profileImage?.length || 0}:${profileRef.current.profileImage?.slice(-16) || ''}`,
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          timestamp: location.timestamp,
        }));
      }
    };

    const startLocationTracking = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!isMounted) return;
        if (status !== 'granted') {
          Alert.alert(
            "位置情報がオフになっています",
            "相手と現在地を共有するには、スマートフォンの「設定」から位置情報を許可してください。",
            [{ text: "OK" }]
          );
          setIsInitialized(true);
          return;
        }

        if (Platform.OS === 'android') {
          try {
            await Location.enableNetworkProviderAsync();
          } catch (error) {
            console.warn('High-accuracy location provider was not enabled:', error);
          }
        }

        try {
          const lastKnownLocation = await Location.getLastKnownPositionAsync({
            maxAge: 120000,
            requiredAccuracy: 100,
          });
          if (lastKnownLocation) {
            // Use the cached position for a quick map center, but do not share it as current.
            applyLocation(lastKnownLocation, false);
          }
        } catch (error) {
          console.warn('Last known location is unavailable:', error);
        }
        setIsInitialized(true);

        void Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            mayShowUserSettingsDialog: true,
            distanceInterval: 10,
            timeInterval: 5000,
          },
          (location) => applyLocation(location, true),
          (error) => console.warn('Location watch error:', error),
        ).then((subscription) => {
          if (!isMounted) {
            subscription.remove();
            return;
          }
          locationSubscription = subscription;
        }).catch((error) => {
          console.warn('Failed to start watching position:', error);
        });

        try {
          const currentLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
            mayShowUserSettingsDialog: true,
          });
          applyLocation(currentLocation, true);
        } catch (error) {
          console.warn('Current location fetch failed:', error);
        }
      } catch (error) {
        console.warn('Location setup failed:', error);
        if (isMounted) setIsInitialized(true);
      }
    };

    void startLocationTracking();

    return () => {
      isMounted = false;
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [userId]);

  useEffect(() => {
    if (!selectedLocation || !isInitialized || followCurrentLocation) return;
    mapRef.current?.animateToRegion({
      latitude: selectedLocation.latitude,
      longitude: selectedLocation.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }, 300);
  }, [followCurrentLocation, isInitialized, selectedLocation]);

  useEffect(() => {
    if (
      !myLocation
      || !isInitialized
      || (!followCurrentLocation && selectedLocation)
      || (!followCurrentLocation && hasCenteredOnCurrentLocationRef.current)
    ) return;
    if (!followCurrentLocation) hasCenteredOnCurrentLocationRef.current = true;
    mapRef.current?.animateToRegion({
      latitude: myLocation.coords.latitude,
      longitude: myLocation.coords.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }, 300);
  }, [followCurrentLocation, isInitialized, myLocation, selectedLocation]);

  useEffect(() => {
    const query = locationQuery?.trim();
    if (!query || selectedLocation || !isInitialized) return;

    const timer = setTimeout(() => {
      Location.geocodeAsync(query)
        .then((results) => {
          const firstResult = results[0];
          if (!firstResult) return;
          mapRef.current?.animateToRegion({
            latitude: firstResult.latitude,
            longitude: firstResult.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }, 300);
        })
        .catch((error) => {
          console.warn('Failed to geocode selected map location:', error);
        });
    }, 600);

    return () => clearTimeout(timer);
  }, [isInitialized, locationQuery, selectedLocation]);

  if (!isInitialized) {
    return (
      <View style={[styles.map, style, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#00aa00" />
      </View>
    );
  }

  const selfMarkerId = `self-${userId}`;
  const selfMarkerImageKey = `${userName}:${getProfileImageSignature(profileImage)}`;

  return (
    <MapView
      ref={mapRef}
      provider={PROVIDER_GOOGLE}
      style={[styles.map, style]}
      initialRegion={followCurrentLocation && myLocation ? {
        latitude: myLocation.coords.latitude,
        longitude: myLocation.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      } : selectedLocation ? {
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      } : myLocation ? {
        latitude: myLocation.coords.latitude,
        longitude: myLocation.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      } : INITIAL_REGION}
      minZoomLevel={8}
      maxZoomLevel={18}
      showsUserLocation={false}
      showsMyLocationButton={true}
      onPress={(event) => onLocationSelect?.(event.nativeEvent.coordinate)}
    >
      {myLocation && (
        <Marker
          key={selfMarkerId}
          identifier={selfMarkerId}
          coordinate={{
            latitude: myLocation.coords.latitude,
            longitude: myLocation.coords.longitude,
          }}
          title={userName}
          draggable={demoLocationEditingEnabled && isManualLocationMode}
          onPress={() => {
            if (!demoLocationEditingEnabled) return;
            manualLocationModeRef.current = true;
            setIsManualLocationMode(true);
          }}
          onDragEnd={(event) => {
            const { latitude, longitude } = event.nativeEvent.coordinate;
            publishManualPosition({ latitude, longitude });
          }}
          tracksViewChanges={Boolean(profileImage)}
        >
          <View style={styles.markerBorder}>
            <ProfileAvatar
              key={selfMarkerImageKey}
              name={userName}
              profileImage={profileImage}
              size={34}
              style={styles.avatar}
              resizeMode="contain"
            />
          </View>
        </Marker>
      )}
      {!hideSharedLocations && Object.values(locations).map((loc) => {
        const markerId = loc.userId;
        const markerImageKey = `${loc.userName}:${getProfileImageSignature(loc.profileImage)}`;

        return (
          <Marker
            key={markerId}
            identifier={markerId}
            coordinate={{ latitude: loc.latitude, longitude: loc.longitude }}
            title={loc.userName}
            tracksViewChanges={Boolean(loc.profileImage)}
          >
            <View style={styles.markerBorder}>
              <ProfileAvatar
                key={markerImageKey}
                name={loc.userName}
                profileImage={loc.profileImage}
                size={34}
                style={styles.avatar}
                resizeMode="contain"
              />
            </View>
          </Marker>
        );
      })}
      {routeCoordinates.length > 1 && (
        <>
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#111111"
            strokeWidth={5}
          />
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#4285F4"
            strokeWidth={3}
          />
        </>
      )}
      {selectedLocation && (
        <Marker
          coordinate={selectedLocation}
          pinColor="#ff4500"
          title="待ち合わせ場所"
        />
      )}
    </MapView>
  );
};

const styles = StyleSheet.create({
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E2FBE2',
  },
  markerBorder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#000000',
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
    overflow: 'hidden',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
});
