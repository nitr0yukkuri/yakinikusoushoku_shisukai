import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

const defaultApiPort = '8080';
const defaultExpoGoApiUrl = 'https://matsunya-backend.onrender.com';

const isExpoGo =
  Platform.OS !== 'web' &&
  (Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
    Constants.appOwnership === 'expo');

const getExpoHost = () => {
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.manifest2?.extra?.expoClient?.hostUri;
  return typeof hostUri === 'string' ? hostUri.split(':')[0] : '';
};

const isLocalUrl = (value: string) => {
  try {
    const hostname = new URL(value).hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
};

export const getApiUrl = () => {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

  // Google cannot redirect a server-side OAuth callback to a PC's localhost.
  // Use the public backend in Expo Go unless a separate endpoint is provided.
  if (isExpoGo) {
    const expoGoApiUrl = process.env.EXPO_PUBLIC_EXPO_GO_API_URL?.trim();
    if (expoGoApiUrl) return expoGoApiUrl.replace(/\/$/, '');

    try {
      const hostname = new URL(configuredUrl).hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
        return defaultExpoGoApiUrl;
      }
    } catch {
      return configuredUrl;
    }
  }

  if (Platform.OS === 'web') {
    try {
      const url = new URL(configuredUrl);
      const isLocalPage =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
      if (isLocalPage && url.hostname.endsWith('.loca.lt')) {
        return 'http://localhost:8080';
      }
    } catch {
      return configuredUrl;
    }
    return configuredUrl;
  }

  try {
    const url = new URL(configuredUrl);
    if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      return configuredUrl;
    }

    const expoHost = getExpoHost();
    if (!expoHost) return configuredUrl;

    url.hostname = expoHost;
    url.port = url.port || defaultApiPort;
    return url.toString().replace(/\/$/, '');
  } catch {
    return configuredUrl;
  }
};

export const getWebSocketUrl = () => {
  const configuredUrl = process.env.EXPO_PUBLIC_WS_URL;
  if (configuredUrl && Platform.OS === 'web') return configuredUrl;

  if (isExpoGo) {
    const expoGoWsUrl = process.env.EXPO_PUBLIC_EXPO_GO_WS_URL?.trim();
    if (expoGoWsUrl) return expoGoWsUrl.replace(/\/$/, '');
  }

  const apiUrl = getApiUrl();
  const websocketSource =
    isExpoGo && (!configuredUrl || isLocalUrl(configuredUrl)) ? apiUrl : configuredUrl || apiUrl;
  try {
    const url = new URL(websocketSource);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/ws';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return configuredUrl || 'ws://localhost:8080/ws';
  }
};
