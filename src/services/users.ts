import { apiFetch } from '@/lib/api/client';
import { User } from '@/types/api';

export function getCurrentUser(): Promise<User> {
  return apiFetch('/users/me');
}

export function updateUserProfile(updates: { username?: string; email?: string; phone?: string }): Promise<User> {
  const body = {
    username: updates.username,
    email: updates.email,
    phone_number: updates.phone,
  };
  return apiFetch('/users/me', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}
