import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { login as loginRequest, LoginPayload, signup as signupRequest, SignupPayload } from '@/services/auth';
import { User } from '@/types/api';
import {
  deleteSecureItem,
  getSecureItem,
  SECURE_KEYS,
  setSecureItem,
} from '@/lib/storage/secure';

type AuthContextValue = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  signup: (payload: SignupPayload) => Promise<void>;
  logout: () => Promise<void>;
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
          if (storedUser) setUser(JSON.parse(storedUser) as User);
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
    setToken(result.token);
    setUser(result.user);
    await setSecureItem(SECURE_KEYS.authToken, result.token);
    await setSecureItem(SECURE_KEYS.authUser, JSON.stringify(result.user));
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

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated: Boolean(token),
      login,
      signup,
      logout,
    }),
    [isLoading, login, logout, signup, token, user],
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
