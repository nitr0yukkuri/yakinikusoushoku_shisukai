import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useProfile } from '../contexts/profile-context';
import { getApiUrl } from '../utils/api-url';
import { toUserErrorMessage } from '../utils/user-error';
import { AppMap } from './AppMap';

type Meetup = {
  id: number;
  scheduledAt: string;
  placeName: string;
  latitude: number;
  longitude: number;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  membershipStatus: 'invited' | 'accepted' | 'declined';
};

type Spot = {
  placeId: string;
  name: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  primaryType: string;
  rating?: number;
};

const categories = [
  { label: 'カフェ', types: 'cafe,bakery', icon: 'cafe-outline' as const },
  { label: 'ごはん', types: 'restaurant', icon: 'restaurant-outline' as const },
  { label: '買い物', types: 'shopping_mall', icon: 'bag-handle-outline' as const },
  { label: '公園', types: 'park', icon: 'leaf-outline' as const },
];

const apiUrl = getApiUrl();

const distanceInMeters = (meetup: Meetup, spot: Spot) => {
  const toRadians = (value: number) => value * Math.PI / 180;
  const latitudeDelta = toRadians(spot.latitude - meetup.latitude);
  const longitudeDelta = toRadians(spot.longitude - meetup.longitude);
  const latitude1 = toRadians(meetup.latitude);
  const latitude2 = toRadians(spot.latitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const formatDistance = (meters: number) => meters < 1000
  ? `${meters}m`
  : `${(meters / 1000).toFixed(1)}km`;

export default function PastimeSpotPanel() {
  const { token, profile, avatarUrl } = useProfile();
  const [meetup, setMeetup] = useState<Meetup | null>(null);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [isLoadingMeetup, setIsLoadingMeetup] = useState(Boolean(token));
  const [isLoadingSpots, setIsLoadingSpots] = useState(false);
  const [error, setError] = useState(token ? '' : 'ログインが必要です');

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;
    fetch(`${apiUrl}/meetups`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || '待ち合わせを取得できませんでした');
        return (body.meetups || []) as Meetup[];
      })
      .then((items) => {
        if (cancelled) return;
        const now = Date.now();
        const available = items
          .filter((item) => item.membershipStatus === 'accepted'
            && (item.status === 'scheduled' || item.status === 'active'))
          .sort((left, right) => {
            const leftTime = new Date(left.scheduledAt).getTime();
            const rightTime = new Date(right.scheduledAt).getTime();
            const leftRank = leftTime >= now ? leftTime : Number.MAX_SAFE_INTEGER - leftTime;
            const rightRank = rightTime >= now ? rightTime : Number.MAX_SAFE_INTEGER - rightTime;
            return leftRank - rightRank;
          });
        setError('');
        setSelectedSpot(null);
        setSpots([]);
        setIsLoadingSpots(Boolean(available[0]));
        setMeetup(available[0] || null);
      })
      .catch((reason) => {
        if (!cancelled) setError(toUserErrorMessage(reason, '待ち合わせを取得できませんでした'));
      })
      .finally(() => {
        if (!cancelled) setIsLoadingMeetup(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token || !meetup) return;
    let cancelled = false;
    const category = categories[categoryIndex];
    const params = new URLSearchParams({
      latitude: String(meetup.latitude),
      longitude: String(meetup.longitude),
      radius: '1500',
      limit: '12',
      types: category.types,
    });

    fetch(`${apiUrl}/spots/nearby?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || '周辺スポットを取得できませんでした');
        return (body.spots || []) as Spot[];
      })
      .then((items) => {
        if (cancelled) return;
        setSpots(items);
        setSelectedSpot(items[0] || null);
      })
      .catch((reason) => {
        if (cancelled) return;
        setSpots([]);
        setError(toUserErrorMessage(reason, '周辺スポットを取得できませんでした'));
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSpots(false);
      });

    return () => {
      cancelled = true;
    };
  }, [categoryIndex, meetup, token]);

  const selectCategory = (index: number) => {
    if (index === categoryIndex) return;
    setError('');
    setSpots([]);
    setSelectedSpot(null);
    setIsLoadingSpots(true);
    setCategoryIndex(index);
  };

  const mapLocation = useMemo(() => {
    if (selectedSpot) {
      return { latitude: selectedSpot.latitude, longitude: selectedSpot.longitude };
    }
    if (meetup) {
      return { latitude: meetup.latitude, longitude: meetup.longitude };
    }
    return null;
  }, [meetup, selectedSpot]);

  if (isLoadingMeetup) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator color="#267a3f" />
        <Text style={styles.stateText}>待ち合わせを確認中...</Text>
      </View>
    );
  }

  if (!meetup) {
    return (
      <View style={styles.centerState}>
        <Ionicons name="location-outline" size={34} color="#607064" />
        <Text style={styles.stateTitle}>待ち合わせがありません</Text>
        <Text style={styles.stateText}>カレンダーから待ち合わせ場所を設定してください</Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.meetupBar}>
        <Ionicons name="location" size={20} color="#267a3f" />
        <View style={styles.meetupTextArea}>
          <Text style={styles.caption}>待ち合わせ場所の近く</Text>
          <Text style={styles.meetupName} numberOfLines={1}>{meetup.placeName}</Text>
        </View>
      </View>

      <View style={styles.categories}>
        {categories.map((category, index) => {
          const selected = index === categoryIndex;
          return (
            <TouchableOpacity
              key={category.label}
              style={[styles.category, selected && styles.categorySelected]}
              onPress={() => selectCategory(index)}
              activeOpacity={0.75}
            >
              <Ionicons name={category.icon} size={17} color={selected ? '#ffffff' : '#4e5e52'} />
              <Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>{category.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.mapWindow}>
        <AppMap
          style={styles.map}
          userId={profile?.userId}
          userName={profile?.name}
          profileImage={avatarUrl || undefined}
          selectedLocation={mapLocation}
        />
        {selectedSpot ? (
          <View style={styles.mapLabel}>
            <Text style={styles.mapLabelName} numberOfLines={1}>{selectedSpot.name}</Text>
            <Text style={styles.mapLabelMeta}>
              {formatDistance(distanceInMeters(meetup, selectedSpot))}
              {selectedSpot.rating ? `  ★ ${selectedSpot.rating.toFixed(1)}` : ''}
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.sectionTitle}>近くのスポット</Text>
      {isLoadingSpots ? (
        <View style={styles.inlineState}>
          <ActivityIndicator size="small" color="#267a3f" />
          <Text style={styles.stateText}>検索中...</Text>
        </View>
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : spots.length === 0 ? (
        <Text style={styles.stateText}>近くに候補が見つかりませんでした</Text>
      ) : (
        <View style={styles.spotList}>
          {spots.map((spot) => {
            const selected = spot.placeId === selectedSpot?.placeId;
            return (
              <TouchableOpacity
                key={spot.placeId}
                style={[styles.spotRow, selected && styles.spotRowSelected]}
                onPress={() => setSelectedSpot(spot)}
                activeOpacity={0.75}
              >
                <View style={[styles.spotIcon, selected && styles.spotIconSelected]}>
                  <Ionicons name={categories[categoryIndex].icon} size={20} color={selected ? '#ffffff' : '#267a3f'} />
                </View>
                <View style={styles.spotTextArea}>
                  <Text style={styles.spotName} numberOfLines={1}>{spot.name}</Text>
                  <Text style={styles.spotAddress} numberOfLines={1}>{spot.formattedAddress}</Text>
                </View>
                <Text style={styles.distance}>{formatDistance(distanceInMeters(meetup, spot))}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  meetupBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%',
    paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#f6fff2',
    borderWidth: 1, borderColor: '#b9d8b6', borderRadius: 8,
  },
  meetupTextArea: { flex: 1, minWidth: 0 },
  caption: { fontSize: 11, color: '#667068', marginBottom: 2 },
  meetupName: { fontSize: 15, color: '#1f3023', fontWeight: '700' },
  categories: { flexDirection: 'row', gap: 7, marginVertical: 12 },
  category: {
    flex: 1, minHeight: 42, borderWidth: 1, borderColor: '#aebcaf', backgroundColor: '#ffffff',
    borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4,
  },
  categorySelected: { backgroundColor: '#267a3f', borderColor: '#267a3f' },
  categoryText: { fontSize: 12, color: '#4e5e52', fontWeight: '600' },
  categoryTextSelected: { color: '#ffffff' },
  mapWindow: {
    height: 230, width: '100%', overflow: 'hidden', position: 'relative',
    borderRadius: 8, borderWidth: 1, borderColor: '#b9c5bb', backgroundColor: '#edf3ed',
  },
  map: { ...StyleSheet.absoluteFillObject },
  mapLabel: {
    position: 'absolute', left: 10, right: 54, bottom: 10, backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: '#d9dfd9',
  },
  mapLabelName: { fontSize: 14, color: '#1f2821', fontWeight: '700' },
  mapLabelMeta: { fontSize: 12, color: '#5c675f', marginTop: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#26352a', marginTop: 16, marginBottom: 8 },
  spotList: { width: '100%', gap: 7 },
  spotRow: {
    minHeight: 62, width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d6ddd7', borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 10,
  },
  spotRowSelected: { borderColor: '#267a3f', backgroundColor: '#f3fff2' },
  spotIcon: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#e3f3e3',
    alignItems: 'center', justifyContent: 'center',
  },
  spotIconSelected: { backgroundColor: '#267a3f' },
  spotTextArea: { flex: 1, minWidth: 0 },
  spotName: { fontSize: 14, color: '#222b24', fontWeight: '700' },
  spotAddress: { fontSize: 11, color: '#707971', marginTop: 3 },
  distance: { fontSize: 12, color: '#48574c', fontWeight: '700' },
  centerState: { minHeight: 260, width: '100%', alignItems: 'center', justifyContent: 'center', padding: 24 },
  inlineState: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 18 },
  stateTitle: { fontSize: 16, color: '#2d3830', fontWeight: '700', marginTop: 10 },
  stateText: { fontSize: 13, color: '#6b746d', marginTop: 6, textAlign: 'center' },
  errorText: { fontSize: 13, color: '#b3261e', paddingVertical: 12, textAlign: 'center' },
});
