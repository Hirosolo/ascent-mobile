import AsyncStorage from '@react-native-async-storage/async-storage';

type CachedValue<T> = {
  value: T;
  updatedAt: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getCachedValue<T>(key: string, ttlMs = DAY_MS): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as CachedValue<T>;
    if (Date.now() - parsed.updatedAt > ttlMs) {
      await AsyncStorage.removeItem(key);
      return null;
    }
    return parsed.value;
  } catch {
    await AsyncStorage.removeItem(key);
    return null;
  }
}

export async function setCachedValue<T>(key: string, value: T): Promise<void> {
  const payload: CachedValue<T> = { value, updatedAt: Date.now() };
  await AsyncStorage.setItem(key, JSON.stringify(payload));
}

export async function clearCache(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}
