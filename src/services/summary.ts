import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';
import { apiFetch } from '@/lib/api/client';
import { getSecureItem, SECURE_KEYS } from '@/lib/storage/secure';
import { SummaryData } from '@/types/api';

const CACHE_DATE_FORMAT = 'dd-MM-yyyy';

async function getCacheUserId(): Promise<string> {
  const authUserRaw = await getSecureItem(SECURE_KEYS.authUser);
  if (!authUserRaw) return 'guest';

  try {
    const parsed = JSON.parse(authUserRaw) as { user_id?: number; id?: number };
    return String(parsed.user_id ?? parsed.id ?? 'guest');
  } catch {
    return 'guest';
  }
}

function getTodayCacheDate(): string {
  return format(new Date(), CACHE_DATE_FORMAT);
}

function buildSummaryMonthCacheKeys(month: string, userId: string) {
  return {
    data: `summary_month_${month}_${userId}`,
    fetched: `summary_fetched_${month}_${userId}`,
  };
}

export async function getSummary(month = format(new Date(), 'yyyy-MM'), forceRefresh = false): Promise<SummaryData> {
  const userId = await getCacheUserId();
  const today = getTodayCacheDate();
  const keys = buildSummaryMonthCacheKeys(month, userId);

  if (forceRefresh) {
    await AsyncStorage.multiRemove([keys.data, keys.fetched]);
  }

  const [cachedDataRaw, fetchedDayRaw] = await AsyncStorage.multiGet([keys.data, keys.fetched]);
  const cachedData = cachedDataRaw?.[1];
  const cachedFetchedDay = fetchedDayRaw?.[1];

  if (cachedData && cachedFetchedDay === today) {
    try {
      return JSON.parse(cachedData) as SummaryData;
    } catch {
      await AsyncStorage.multiRemove([keys.data, keys.fetched]);
    }
  }

  const payload = await apiFetch<SummaryData>(`/summary?month=${month}`);
  await AsyncStorage.multiSet([
    [keys.data, JSON.stringify(payload)],
    [keys.fetched, today],
  ]);

  return payload;
}

export async function invalidateSummaryCache(month: string): Promise<void> {
  const userId = await getCacheUserId();
  const keys = buildSummaryMonthCacheKeys(month, userId);
  await AsyncStorage.multiRemove([keys.data, keys.fetched]);
}

export async function invalidateAllSummaryCaches(): Promise<void> {
  const userId = await getCacheUserId();
  const allKeys = await AsyncStorage.getAllKeys();
  const summaryKeys = allKeys.filter(
    (key) =>
      (key.startsWith('summary_month_') || key.startsWith('summary_fetched_')) &&
      key.endsWith(`_${userId}`),
  );

  if (summaryKeys.length > 0) {
    await AsyncStorage.multiRemove(summaryKeys);
  }
}
