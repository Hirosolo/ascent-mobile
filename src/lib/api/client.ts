import { ApiEnvelope } from '@/types/api';
import { getSecureItem, SECURE_KEYS } from '@/lib/storage/secure';

const API_BASE = 'https://traindiary-refactor-backend.vercel.app/api';

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getSecureItem(SECURE_KEYS.authToken);
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;

  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  const result = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !result.success) {
    const message =
      result.message ?? result.errors?.[0]?.message ?? `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return result.data;
}
