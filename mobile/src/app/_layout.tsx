import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useColorScheme } from 'react-native';
import { Stack, usePathname, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { AnimatedSplashOverlay } from '../components/animated-icon';
import { ProfileProvider, useProfile } from '../contexts/profile-context';

function ProfileSetupGate({ children }: React.PropsWithChildren) {
  const pathname = usePathname();
  const router = useRouter();
  const { token, profile, isHydrated } = useProfile();
  const isLoginRoute = pathname === '/' || pathname === '/index';
  const isOAuthRoute = pathname === '/oauth';
  const isSignupRoute = pathname === '/signup';
  const hasCompletedProfile = Boolean(profile?.userId?.trim());

  useEffect(() => {
    if (!isHydrated) return;

    if (!token || !profile) {
      if (!isLoginRoute && !isOAuthRoute) router.replace('/');
      return;
    }

    if (!hasCompletedProfile) {
      if (!isSignupRoute && !isOAuthRoute) router.replace('/signup');
      return;
    }

    if (isLoginRoute || isSignupRoute) router.replace('/home');
  }, [hasCompletedProfile, isHydrated, isLoginRoute, isOAuthRoute, isSignupRoute, profile, router, token]);

  if (!isHydrated) return null;
  if (!token || !profile) return isLoginRoute || isOAuthRoute ? children : null;
  if (!hasCompletedProfile) return isSignupRoute || isOAuthRoute ? children : null;
  return children;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  
  return (
    <ProfileProvider>
      <ProfileSetupGate>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AnimatedSplashOverlay />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="oauth" />
            <Stack.Screen name="signup" />
            <Stack.Screen name="home" />
            <Stack.Screen name="settings" options={{ animation: 'slide_from_bottom' }} />
          </Stack>
        </ThemeProvider>
      </ProfileSetupGate>
    </ProfileProvider>
  );
}
