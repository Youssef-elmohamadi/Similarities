export interface User {
  id: string;
  fullName: string;
  email: string;
  createdAt: string;
}

export interface AuthResponse {
  id: string;
  fullName: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
}

export interface UserSession {
  id: string;
  deviceLabel: string;
  ipAddress?: string;
  createdAt: string;
  lastUsedAt: string;
  isCurrent: boolean;
}

