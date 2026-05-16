import { ApiEnvelope } from '@/types/api';
import { getSecureItem, SECURE_KEYS } from '@/lib/storage/secure';

const API_BASE = 'https://ascent-backend-j6ke.vercel.app/api';

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

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');

  let result: any;
  if (isJson) {
    try {
      result = await response.json();
    } catch (e) {
      const text = await response.text();
      throw new Error(`Failed to parse JSON response: ${text.slice(0, 100)}`);
    }
  } else {
    const text = await response.text();
    throw new Error(`Expected JSON response but received ${contentType}. Body: ${text.slice(0, 100)}`);
  }

  if (!response.ok || !result.success) {
    const message =
      result.message ?? result.errors?.[0]?.message ?? `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return result.data;
}
