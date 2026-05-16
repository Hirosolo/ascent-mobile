import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { login as loginRequest, LoginPayload, signup as signupRequest, SignupPayload } from '@/services/auth';
import { updateUserProfile } from '@/services/users';
import { User } from '@/types/api';
import {
  deleteSecureItem,
  getSecureItem,
  SECURE_KEYS,
  setSecureItem,
} from '@/lib/storage/secure';

function normalizeUser(user: User): User {
  // Map phone_number to phone if present
  if (user.phone_number && !user.phone) {
    user.phone = user.phone_number;
  }
  return user;
}

type AuthContextValue = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  signup: (payload: SignupPayload) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: { username?: string; email?: string; phone?: string }) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function bootstrapAuth() {
      try {
        const storedToken = await getSecureItem(SECURE_KEYS.authToken);
        const storedUser = await getSecureItem(SECURE_KEYS.authUser);

        if (mounted && storedToken) {
          setToken(storedToken);
          if (storedUser) {
            const user = normalizeUser(JSON.parse(storedUser) as User);
            setUser(user);
          }
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    void bootstrapAuth();
    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const result = await loginRequest(payload);
    const normalizedUser = normalizeUser(result.user);
    setToken(result.token);
    setUser(normalizedUser);
    await setSecureItem(SECURE_KEYS.authToken, result.token);
    await setSecureItem(SECURE_KEYS.authUser, JSON.stringify(normalizedUser));
  }, []);

  const signup = useCallback(async (payload: SignupPayload) => {
    await signupRequest(payload);
  }, []);

  const logout = useCallback(async () => {
    setToken(null);
    setUser(null);
    await deleteSecureItem(SECURE_KEYS.authToken);
    await deleteSecureItem(SECURE_KEYS.authUser);
  }, []);

  const updateProfile = useCallback(async (updates: { username?: string; email?: string; phone?: string }) => {
    const updatedUser = await updateUserProfile(updates);
    const normalizedUser = normalizeUser(updatedUser);
    setUser(normalizedUser);
    await setSecureItem(SECURE_KEYS.authUser, JSON.stringify(normalizedUser));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated: Boolean(token),
      login,
      signup,
      logout,
      updateProfile,
    }),
    [isLoading, login, logout, signup, token, user, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
