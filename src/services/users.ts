import { apiFetch } from '@/lib/api/client';
import { User } from '@/types/api';

async function normalizeUser(user: User): Promise<User> {
  // Map phone_number to phone if present
  if (user.phone_number && !user.phone) {
    user.phone = user.phone_number;
  }
  return user;
}

export async function getCurrentUser(): Promise<User> {
  const user = await apiFetch<User>('/users/me');
  return normalizeUser(user);
}

export async function updateUserProfile(updates: { username?: string; email?: string; phone?: string }): Promise<User> {
  const body = {
    username: updates.username,
    email: updates.email,
    phone_number: updates.phone,
  };
  const user = await apiFetch<User>('/users/me', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return normalizeUser(user);
}
