import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

const TOKYO_STATION_MAP_URL =
  'https://www.google.com/maps?q=Tokyo%20Station&z=16&output=embed';

type AppMapProps = {
  style?: StyleProp<ViewStyle>;
};

export const AppMap = ({ style }: AppMapProps) => {
  return (
    <View style={[styles.map, style]}>
      {React.createElement('iframe', {
        src: TOKYO_STATION_MAP_URL,
        style: styles.iframe,
        loading: 'lazy',
        referrerPolicy: 'no-referrer-when-downgrade',
        title: 'Tokyo Station map',
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  map: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  iframe: {
    borderWidth: 0,
    height: '100%',
    width: '100%',
  },
});
