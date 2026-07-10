import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { getApiUrl } from '../utils/api-url';

const apiUrl = getApiUrl();
const SESSION_STORAGE_KEY = 'matsunya.session';

const getStoredSession = async () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  }
  return AsyncStorage.getItem(SESSION_STORAGE_KEY);
};

const setStoredSession = async (value: string) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, value);
    return;
  }
  await AsyncStorage.setItem(SESSION_STORAGE_KEY, value);
};

const removeStoredSession = async () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }
  await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
};


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
    throw new Error(body.error || 'プロフィールを取得できませんでした。');
  }
  return body.user;
};

export function ProfileProvider({ children }: React.PropsWithChildren) {
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const sessionRevisionRef = useRef(0);

  const persistSession = useCallback(async (nextToken: string, nextProfile: UserProfile) => {
    setToken(nextToken);
    setProfile(nextProfile);
    await setStoredSession(
      JSON.stringify({ token: nextToken, profile: nextProfile } satisfies StoredSession),
    );
  }, []);

  const setSession = useCallback(async (session: StoredSession) => {
    sessionRevisionRef.current += 1;
    await persistSession(session.token, session.profile);
  }, [persistSession]);

  useEffect(() => {
    let isMounted = true;
    const restoreRevision = sessionRevisionRef.current;

    const hydrate = async () => {
      try {
        const stored = await getStoredSession();
        if (!stored) return;

        const session = JSON.parse(stored) as StoredSession;
        if (!session.token || !session.profile) return;
        if (!isMounted || restoreRevision !== sessionRevisionRef.current) return;

        setToken(session.token);
        setProfile(session.profile);

        const response = await fetch(`${apiUrl}/auth/profile`, {
          headers: { Authorization: `Bearer ${session.token}` },
        });
        if (!isMounted || restoreRevision !== sessionRevisionRef.current) return;
        if (response.status === 401) {
          await removeStoredSession();
          setToken(null);
          setProfile(null);
          return;
        }
        const freshProfile = await readResponse(response);
        if (!isMounted || restoreRevision !== sessionRevisionRef.current) return;
        await persistSession(session.token, freshProfile);
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
    if (!token) throw new Error('ログインが必要です。');
    sessionRevisionRef.current += 1;

    const response = await fetch(`${apiUrl}/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    });
    const savedProfile = await readResponse(response);
    if ((savedProfile.profileImage || '') !== (input.profileImage || '')) {
      throw new Error('プロフィール画像を保存できませんでした。もう一度お試しください。');
    }
    await persistSession(token, savedProfile);
    return savedProfile;
  }, [persistSession, token]);

  const logout = useCallback(async () => {
    sessionRevisionRef.current += 1;
    setToken(null);
    setProfile(null);
    try {
      await removeStoredSession();
    } catch (error) {
      console.warn('Failed to remove profile session:', error);
    }
  }, []);

  const value = useMemo<ProfileContextValue>(() => ({
    token,
    profile,
    isHydrated,
    avatarUrl: profile?.profileImage || profile?.pictureUrl || null,
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
