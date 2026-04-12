import { apiFetch } from '@/lib/api/client';
import { User } from '@/types/api';

export function getCurrentUser(): Promise<User> {
  return apiFetch('/users/me');
}
