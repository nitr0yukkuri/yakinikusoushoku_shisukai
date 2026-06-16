import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useColorScheme } from 'react-native';
import { Stack } from 'expo-router';
import { AnimatedSplashOverlay } from '../components/animated-icon';
import { ProfileProvider } from '../contexts/profile-context';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  
  return (
    <ProfileProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="signup" />
          <Stack.Screen name="home" />
          <Stack.Screen name="settings" options={{ animation: 'slide_from_bottom' }} />
        </Stack>
      </ThemeProvider>
    </ProfileProvider>
  );
}
