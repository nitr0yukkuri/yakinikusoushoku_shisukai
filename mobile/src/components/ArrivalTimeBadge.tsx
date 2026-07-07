import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

type ArrivalTimeBadgeProps = {
  minutes?: number;
  label?: string;
  style?: StyleProp<ViewStyle>;
};

const formatArrivalTime = (minutes: number) => {
  const safeMinutes = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(remainingMinutes).padStart(2, '0')}`;
};

export function ArrivalTimeBadge({
  minutes = 50,
  label = '相手の到着まで',
  style,
}: ArrivalTimeBadgeProps) {
  return (
    <View style={[styles.container, style]} pointerEvents="none">
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.time}>{formatArrivalTime(minutes)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minWidth: 150,
    paddingHorizontal: 14,
    paddingTop: 7,
    paddingBottom: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(226, 251, 210, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  label: {
    color: '#1f1f1f',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  time: {
    color: '#000000',
    fontSize: 42,
    fontWeight: '300',
    lineHeight: 46,
  },
});
