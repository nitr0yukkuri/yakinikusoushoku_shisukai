import React from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Region } from 'react-native-maps';

const TOKYO_STATION_REGION: Region = {
  latitude: 35.681236,
  longitude: 139.767125,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

type AppMapProps = {
  style?: StyleProp<ViewStyle>;
};

export const AppMap = ({ style }: AppMapProps) => {
  return (
    <MapView
      provider={PROVIDER_GOOGLE}
      style={[styles.map, style]}
      initialRegion={TOKYO_STATION_REGION}
    />
  );
};

const styles = StyleSheet.create({
  map: {
    ...StyleSheet.absoluteFillObject,
  },
});
