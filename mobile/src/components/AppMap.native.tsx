import React, { useEffect, useState, useRef } from 'react';
import { StyleProp, StyleSheet, ViewStyle, ActivityIndicator, View, Alert } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Region, Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { ProfileAvatar } from './ProfileAvatar';
import { getProfileImageSignature } from '../utils/profile-image';

const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'ws://localhost:8080/ws';
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

const INITIAL_REGION: Region = {
  latitude: 35.681236,
  longitude: 139.767125,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

type AppMapProps = {
  style?: StyleProp<ViewStyle>;
  roomId?: string;
  userId?: string;
  userName?: string;
  profileImage?: string;
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

  const [locations, setLocations] = useState<Record<string, UserLocation>>({});
  const [myLocation, setMyLocation] = useState<Location.LocationObject | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const currentPositionRef = useRef<{ lat: number; lng: number } | null>(null);
  const markerProfileVersionsRef = useRef<Record<string, string>>({});

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
    const ws = new WebSocket(`${WS_URL}?room=${roomId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected to room:', roomId);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'LOCATION_UPDATE') {
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
    };

    return () => {
      ws.close();
      markerProfileVersionsRef.current = {};
    };
  }, [roomId, userId]);

  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            "位置情報がオフになっています",
            "相手と現在地を共有するには、スマートフォンの「設定」から位置情報を許可してください。",
            [{ text: "OK" }]
          );
          setIsInitialized(true);
          return;
        }

        const initialLocation = await Promise.race([
          Location.getCurrentPositionAsync({}),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ]);
        setMyLocation(initialLocation);
        currentPositionRef.current = {
          lat: initialLocation.coords.latitude,
          lng: initialLocation.coords.longitude,
        };
      } catch (error) {
        console.warn('Location fetch timed out or failed:', error);
      } finally {
        setIsInitialized(true);
      }

      try {
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 10,
            timeInterval: 5000,
          },
          (location) => {
            setMyLocation(location);
            currentPositionRef.current = {
              lat: location.coords.latitude,
              lng: location.coords.longitude,
            };

            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                type: 'LOCATION_UPDATE',
                userId: userId,
                userName: profileRef.current.userName,
                profileVersion: `${profileRef.current.userName}:${profileRef.current.profileImage?.length || 0}:${profileRef.current.profileImage?.slice(-16) || ''}`,
                lat: location.coords.latitude,
                lng: location.coords.longitude,
                timestamp: location.timestamp,
              }));
            }
          }
        );
      } catch (error) {
        console.warn('Failed to start watching position:', error);
      }
    })();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [userId]);

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
      provider={PROVIDER_GOOGLE}
      style={[styles.map, style]}
      initialRegion={myLocation ? {
        latitude: myLocation.coords.latitude,
        longitude: myLocation.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      } : INITIAL_REGION}
      showsUserLocation={false}
      showsMyLocationButton={true}
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
          tracksViewChanges={Boolean(profileImage)}
        >
          <View style={styles.markerBorder}>
            <ProfileAvatar
              key={selfMarkerImageKey}
              name={userName}
              profileImage={profileImage}
              size={38}
              style={styles.avatar}
            />
          </View>
        </Marker>
      )}
      {Object.values(locations).map((loc) => {
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
                size={38}
                style={styles.avatar}
              />
            </View>
          </Marker>
        );
      })}
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
    width: 38,
    height: 38,
    borderRadius: 19,
  },
});
