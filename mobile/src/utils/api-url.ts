import Constants from 'expo-constants';
import { Platform } from 'react-native';

const defaultApiPort = '8080';

const getExpoHost = () => {
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.manifest2?.extra?.expoClient?.hostUri;
  return typeof hostUri === 'string' ? hostUri.split(':')[0] : '';
};

export const getApiUrl = () => {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

  if (Platform.OS === 'web') return configuredUrl;

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
