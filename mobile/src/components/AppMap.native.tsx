import React, { useEffect, useState, useRef } from 'react';
import { StyleProp, StyleSheet, ViewStyle, ActivityIndicator, View, Alert, Image } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Region, Marker } from 'react-native-maps';
import * as Location from 'expo-location';

const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'ws://localhost:8080/ws';

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
};

interface UserLocation {
  userId: string;
  latitude: number;
  longitude: number;
  timestamp: number;
}

export const AppMap = ({
  style,
  roomId = 'global',
  userId: propUserId
}: AppMapProps) => {
  const [userId] = useState(() => propUserId || `user_${Math.floor(Math.random() * 10000)}`);

  const [locations, setLocations] = useState<Record<string, UserLocation>>({});
  const [myLocation, setMyLocation] = useState<Location.LocationObject | null>(null);

  const [isInitialized, setIsInitialized] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

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
                latitude: data.lat,
                longitude: data.lng,
                timestamp: data.timestamp,
              },
            }));
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

            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                type: 'LOCATION_UPDATE',
                userId: userId,
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
      showsUserLocation={true}
      showsMyLocationButton={true}
    >
      {Object.values(locations).map((loc) => (
        <Marker
          key={loc.userId}
          coordinate={{ latitude: loc.latitude, longitude: loc.longitude }}
          title={`User: ${loc.userId}`}
          tracksViewChanges={false}
        >
          <View style={styles.markerBorder}>
            <Image
              source={{ uri: `https://ui-avatars.com/api/?name=${loc.userId}&background=random&color=fff&rounded=true&size=80` }}
              style={styles.avatar}
            />
          </View>
        </Marker>
      ))}
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
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
});