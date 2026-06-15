import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';
const SESSION_STORAGE_KEY = 'matsunya.session';

export type UserProfile = {
  id: number;
  googleSub: string;
  userId: string;
  email: string;
  name: string;
  pictureUrl: string;
  profileImage: string;
  bio: string;
  emailVerified: boolean;
};

type StoredSession = {
  token: string;
  profile: UserProfile;
};

type SaveProfileInput = {
  userId: string;
  userName: string;
  profileImage: string;
  bio: string;
};

type ProfileContextValue = {
  token: string | null;
  profile: UserProfile | null;
  isHydrated: boolean;
  avatarUrl: string | null;
  setSession: (session: StoredSession) => Promise<void>;
  saveProfile: (input: SaveProfileInput) => Promise<UserProfile>;
  logout: () => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

const readResponse = async (response: Response) => {
  const body = await response.json() as { user?: UserProfile; error?: string };
  if (!response.ok || !body.user) {
    throw new Error(body.error || 'Profile request failed.');
  }
  return body.user;
};

export function ProfileProvider({ children }: React.PropsWithChildren) {
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  const persistSession = useCallback(async (nextToken: string, nextProfile: UserProfile) => {
    setToken(nextToken);
    setProfile(nextProfile);
    await AsyncStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ token: nextToken, profile: nextProfile } satisfies StoredSession),
    );
  }, []);

  const setSession = useCallback(async (session: StoredSession) => {
    await persistSession(session.token, session.profile);
  }, [persistSession]);

  useEffect(() => {
    let isMounted = true;

    const hydrate = async () => {
      try {
        const stored = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
        if (!stored) return;

        const session = JSON.parse(stored) as StoredSession;
        if (!session.token || !session.profile) return;

        if (isMounted) {
          setToken(session.token);
          setProfile(session.profile);
        }

        const response = await fetch(`${apiUrl}/auth/profile`, {
          headers: { Authorization: `Bearer ${session.token}` },
        });
        if (response.status === 401) {
          await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
          if (isMounted) {
            setToken(null);
            setProfile(null);
          }
          return;
        }
        const freshProfile = await readResponse(response);
        if (isMounted) {
          await persistSession(session.token, freshProfile);
        }
      } catch (error) {
        console.warn('Failed to restore profile session:', error);
      } finally {
        if (isMounted) setIsHydrated(true);
      }
    };

    hydrate();
    return () => {
      isMounted = false;
    };
  }, [persistSession]);

  const saveProfile = useCallback(async (input: SaveProfileInput) => {
    if (!token) throw new Error('Login is required.');

    const response = await fetch(`${apiUrl}/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    });
    const savedProfile = await readResponse(response);
    await persistSession(token, savedProfile);
    return savedProfile;
  }, [persistSession, token]);

  const logout = useCallback(async () => {
    setToken(null);
    setProfile(null);
    try {
      await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to remove profile session:', error);
    }
  }, []);

  const value = useMemo<ProfileContextValue>(() => ({
    token,
    profile,
    isHydrated,
    avatarUrl: profile?.profileImage || null,
    setSession,
    saveProfile,
    logout,
  }), [isHydrated, logout, profile, saveProfile, setSession, token]);

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const value = useContext(ProfileContext);
  if (!value) {
    throw new Error('useProfile must be used within ProfileProvider.');
  }
  return value;
}
