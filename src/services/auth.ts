import { apiFetch } from '@/lib/api/client';
import { LoginResponse } from '@/types/api';

export type LoginPayload = { email: string; password: string };
export type SignupPayload = { fullname: string; email: string; password: string; phone: string };

export function login(payload: LoginPayload): Promise<LoginResponse> {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function signup(payload: SignupPayload): Promise<{ message?: string }> {
  return apiFetch('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function verifyEmail(token: string): Promise<{ message?: string }> {
  return apiFetch('/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export function forgotPassword(email: string): Promise<{ message?: string }> {
  return apiFetch('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}
