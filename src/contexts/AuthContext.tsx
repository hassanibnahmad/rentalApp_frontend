import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import axios from "axios";
import { apiClient, setApiClientAuthToken } from "@/lib/api-client";

const STORAGE_KEY = "julia-auth-session";
const useMockAuth = import.meta.env.VITE_ENABLE_MOCK_AUTH === "true";
const SESSION_TTL_MS = 30 * 60 * 1000;

type UserRole = "admin" | "client";

type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

type AuthSession = {
  token: string;
  user: AuthUser;
  expiresAt: number;
};

type LoginCredentials = {
  email: string;
  password: string;
};

type LoginResponse = AuthSession;

type ApiLoginResponse = {
  token: string;
  expiresAt?: string;
  email: string;
  fullName?: string | null;
  roles?: string[];
};

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<AuthUser>;
  logout: () => void;
  hasRole: (roles?: UserRole[]) => boolean;
  updateUser: (changes: Partial<AuthUser>) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const readStoredSession = (): AuthSession | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as AuthSession;
    if (parsed?.token && parsed?.user) {
      if (!parsed.expiresAt || parsed.expiresAt <= Date.now()) {
        window.localStorage.removeItem(STORAGE_KEY);
        setApiClientAuthToken(null);
        return null;
      }
      setApiClientAuthToken(parsed.token);
      return parsed;
    }
  } catch (error) {
    console.warn("Session auth invalide. Nettoyage.", error);
    window.localStorage.removeItem(STORAGE_KEY);
  }
  return null;
};

const mockUsers: Array<AuthUser & { password: string }> = [
  {
    id: "admin-1",
    email: "admin@julia.cars",
    name: "Julia Admin",
    role: "admin",
    password: "admin123",
  },
  {
    id: "client-1",
    email: "client@julia.cars",
    name: "Client Demo",
    role: "client",
    password: "client123",
  },
];

const createMockToken = (user: AuthUser) => {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  return btoa(JSON.stringify(payload));
};

const mockLogin = async (credentials: LoginCredentials): Promise<LoginResponse> => {
  const match = mockUsers.find(
    (candidate) => candidate.email === credentials.email && candidate.password === credentials.password,
  );
  if (!match) {
    throw new Error("Identifiants invalides.");
  }
  const { password, ...user } = match;
  return {
    token: createMockToken(user),
    user,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
};

const resolveRoleFromApi = (roles?: string[]): UserRole => {
  const primary = roles?.[0]?.toLowerCase();
  if (primary === "admin") {
    return "admin";
  }
  return "client";
};

const resolveSessionExpiry = (serverExpiresAt?: string) => {
  const fallback = Date.now() + SESSION_TTL_MS;
  if (!serverExpiresAt) {
    return fallback;
  }
  const parsed = Date.parse(serverExpiresAt);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.min(parsed, fallback);
};

const performLogin = async (credentials: LoginCredentials): Promise<LoginResponse> => {
  if (useMockAuth) {
    return mockLogin(credentials);
  }
  const { data } = await apiClient.post<ApiLoginResponse>("/auth/login", credentials);
  const normalizedUser: AuthUser = {
    id: data.email,
    email: data.email,
    name: data.fullName?.trim() || data.email,
    role: resolveRoleFromApi(data.roles),
  };
  return {
    token: data.token,
    user: normalizedUser,
    expiresAt: resolveSessionExpiry(data.expiresAt),
  };
};

const AUTH_ERROR_COPY = {
  wrongCredentials: "Email ou mot de passe incorrect",
  wrongPassword: "Mot de passe incorrect",
  accountMissing: "Votre compte n'existe pas",
  rateLimited: "Trop de tentatives, réessayez plus tard",
  generic: "Connexion impossible pour le moment.",
};

const interpretTextError = (message: string) => {
  const normalized = message.toLowerCase();
  if (normalized.includes("mot de passe") || normalized.includes("password")) {
    return AUTH_ERROR_COPY.wrongPassword;
  }
  if (normalized.includes("identifiants") || normalized.includes("credential") || normalized.includes("unauthorized")) {
    return AUTH_ERROR_COPY.wrongCredentials;
  }
  if (normalized.includes("not exist") || normalized.includes("introuvable")) {
    return AUTH_ERROR_COPY.accountMissing;
  }
  if (normalized.includes("too many") || normalized.includes("429")) {
    return AUTH_ERROR_COPY.rateLimited;
  }
  return AUTH_ERROR_COPY.generic;
};

const resolveErrorMessage = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const serverMessage = (error.response?.data as { message?: string } | undefined)?.message;
    if (typeof serverMessage === "string" && serverMessage.trim().length > 0) {
      return serverMessage;
    }
    switch (status) {
      case 401:
        return AUTH_ERROR_COPY.wrongCredentials;
      case 403:
        return AUTH_ERROR_COPY.wrongPassword;
      case 404:
        return AUTH_ERROR_COPY.accountMissing;
      case 429:
        return AUTH_ERROR_COPY.rateLimited;
      default:
        break;
    }
    if (error.message) {
      return interpretTextError(error.message);
    }
  }
  if (error instanceof Error && error.message) {
    return interpretTextError(error.message);
  }
  if (typeof error === "string" && error.trim().length > 0) {
    return interpretTextError(error);
  }
  return AUTH_ERROR_COPY.generic;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<AuthSession | null>(() => readStoredSession());
  const [isLoading, setIsLoading] = useState(false);

  const persistSession = useCallback((next: AuthSession | null) => {
    setSession(next);
    if (typeof window === "undefined") {
      return;
    }
    if (next) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setApiClientAuthToken(next.token);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
      setApiClientAuthToken(null);
    }
  }, []);

  const login = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try {
      const data = await performLogin(credentials);
      persistSession(data);
      return data.user;
    } catch (error) {
      throw new Error(resolveErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const logout = useCallback(() => {
    persistSession(null);
  }, [persistSession]);

  useEffect(() => {
    if (!session?.expiresAt) {
      return;
    }
    const remaining = session.expiresAt - Date.now();
    if (remaining <= 0) {
      persistSession(null);
      return;
    }
    const timer = window.setTimeout(() => {
      persistSession(null);
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [session, persistSession]);

  const updateUser = useCallback((changes: Partial<AuthUser>) => {
    setSession((previous) => {
      if (!previous || !previous.user) {
        return previous;
      }
      const nextSession: AuthSession = {
        ...previous,
        user: { ...previous.user, ...changes },
      };
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
      }
      return nextSession;
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      isAuthenticated: Boolean(session?.token),
      isLoading,
      login,
      logout,
      hasRole: (roles) => {
        if (!roles || roles.length === 0) {
          return true;
        }
        if (!session?.user) {
          return false;
        }
        return roles.includes(session.user.role);
      },
      updateUser,
    }),
    [session, isLoading, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth doit être utilisé dans un AuthProvider");
  }
  return context;
};

export type { AuthUser, UserRole, LoginCredentials };
