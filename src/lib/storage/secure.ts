import AsyncStorage from '@react-native-async-storage/async-storage';

export const SECURE_KEYS = {
  authToken: 'auth_token',
  authUser: 'auth_user',
} as const;

export async function setSecureItem(key: string, value: string): Promise<void> {
  await AsyncStorage.setItem(key, value);
}

export async function getSecureItem(key: string): Promise<string | null> {
  return AsyncStorage.getItem(key);
}

export async function deleteSecureItem(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}
