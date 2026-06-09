import React, { useEffect, useRef } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

const TOKYO_STATION = {
  lat: 35.681236,
  lng: 139.767125,
};

const GOOGLE_MAPS_SCRIPT_ID = 'google-maps-javascript-api';
const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

let googleMapsScriptPromise: Promise<void> | null = null;

type AppMapProps = {
  style?: StyleProp<ViewStyle>;
};

const loadGoogleMapsScript = () => {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  const browserWindow = window as typeof window & {
    google?: {
      maps?: {
        Map: new (element: HTMLElement, options: Record<string, unknown>) => unknown;
      };
    };
  };

  if (browserWindow.google?.maps?.Map) {
    return Promise.resolve();
  }

  if (!googleMapsApiKey) {
    return Promise.reject(new Error('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is not configured.'));
  }

  if (googleMapsScriptPromise) {
    return googleMapsScriptPromise;
  }

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

export const AppMap = ({ style }: AppMapProps) => {
  const mapElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let isMounted = true;

    loadGoogleMapsScript()
      .then(() => {
        if (!isMounted || !mapElementRef.current) return;

        const browserWindow = window as typeof window & {
          google?: {
            maps?: {
              Map: new (element: HTMLElement, options: Record<string, unknown>) => unknown;
            };
          };
        };

        if (!browserWindow.google?.maps?.Map) return;

        new browserWindow.google.maps.Map(mapElementRef.current, {
          center: TOKYO_STATION,
          zoom: 16,
          disableDefaultUI: true,
          clickableIcons: false,
        });
      })
      .catch((error: Error) => {
        console.error('Google Maps failed to load:', error.message);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <View style={[styles.map, style]}>
      {React.createElement('div', {
        ref: mapElementRef,
        style: styles.mapCanvas,
      })}
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
});
