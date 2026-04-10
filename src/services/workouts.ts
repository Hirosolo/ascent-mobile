import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';
import { apiFetch } from '@/lib/api/client';
import { getSecureItem, SECURE_KEYS } from '@/lib/storage/secure';
import { invalidateAllSummaryCaches, invalidateSummaryCache } from '@/services/summary';
import { Exercise, ExerciseLog, WorkoutSession } from '@/types/api';

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

function buildWorkoutsMonthCacheKeys(month: string, userId: string) {
  return {
    data: `workouts_month_${month}_${userId}`,
    fetched: `workouts_fetched_${month}_${userId}`,
  };
}

function buildExercisesCacheKeys(userId: string) {
  return {
    data: `exercises_data_${userId}`,
    fetched: `exercises_fetched_${userId}`,
  };
}

async function invalidateAllWorkoutCaches(): Promise<void> {
  const userId = await getCacheUserId();
  const allKeys = await AsyncStorage.getAllKeys();
  const targetKeys = allKeys.filter(
    (key) =>
      (key.startsWith('workouts_month_') ||
        key.startsWith('workouts_fetched_') ||
        key.startsWith('exercises_data_') ||
        key.startsWith('exercises_fetched_')) &&
      key.endsWith(`_${userId}`),
  );

  if (targetKeys.length > 0) {
    await AsyncStorage.multiRemove(targetKeys);
  }
}

async function invalidateWorkoutMonthCache(month: string): Promise<void> {
  const userId = await getCacheUserId();
  const keys = buildWorkoutsMonthCacheKeys(month, userId);
  await AsyncStorage.multiRemove([keys.data, keys.fetched]);
}

export async function getWorkouts(month = format(new Date(), 'yyyy-MM'), forceRefresh = false): Promise<WorkoutSession[]> {
  const userId = await getCacheUserId();
  const today = getTodayCacheDate();
  const keys = buildWorkoutsMonthCacheKeys(month, userId);

  if (forceRefresh) {
    await AsyncStorage.multiRemove([keys.data, keys.fetched]);
  }

  const [cachedDataRaw, fetchedDayRaw] = await AsyncStorage.multiGet([keys.data, keys.fetched]);
  const cachedData = cachedDataRaw?.[1];
  const cachedFetchedDay = fetchedDayRaw?.[1];

  if (cachedData && cachedFetchedDay === today) {
    try {
      return JSON.parse(cachedData) as WorkoutSession[];
    } catch {
      await AsyncStorage.multiRemove([keys.data, keys.fetched]);
    }
  }

  const payload = await apiFetch<WorkoutSession[]>(`/workouts?month=${month}`);
  await AsyncStorage.multiSet([
    [keys.data, JSON.stringify(payload)],
    [keys.fetched, today],
  ]);

  return payload;
}

export function getWorkoutById(sessionId: number | string): Promise<WorkoutSession> {
  return apiFetch(`/workouts/${sessionId}`);
}

export async function getExercises(forceRefresh = false): Promise<Exercise[]> {
  const userId = await getCacheUserId();
  const today = getTodayCacheDate();
  const keys = buildExercisesCacheKeys(userId);

  if (forceRefresh) {
    await AsyncStorage.multiRemove([keys.data, keys.fetched]);
  }

  const [cachedDataRaw, fetchedDayRaw] = await AsyncStorage.multiGet([keys.data, keys.fetched]);
  const cachedData = cachedDataRaw?.[1];
  const cachedFetchedDay = fetchedDayRaw?.[1];

  if (cachedData && cachedFetchedDay === today) {
    try {
      return JSON.parse(cachedData) as Exercise[];
    } catch {
      await AsyncStorage.multiRemove([keys.data, keys.fetched]);
    }
  }

  const raw = await apiFetch<unknown>('/exercises');
  let resolved: Exercise[] = [];

  if (Array.isArray(raw)) {
    resolved = raw as Exercise[];
  } else if (raw && typeof raw === 'object') {
    const asRecord = raw as Record<string, unknown>;
    const nested = asRecord.exercises ?? asRecord.items ?? asRecord.data;
    if (Array.isArray(nested)) {
      resolved = nested as Exercise[];
    }
  }

  await AsyncStorage.multiSet([
    [keys.data, JSON.stringify(resolved)],
    [keys.fetched, today],
  ]);

  return resolved;
}

async function invalidateWorkoutRelatedCaches(month?: string): Promise<void> {
  await invalidateAllWorkoutCaches();
  if (month) {
    await invalidateSummaryCache(month);
  } else {
    await invalidateAllSummaryCaches();
  }
}

export async function createWorkout(payload: {
  scheduled_date: string;
  type?: string;
  notes?: string;
  exercises?: Array<{ exercise_id: number; actual_sets: number; actual_reps?: number }>;
}): Promise<WorkoutSession> {
  const created = await apiFetch<WorkoutSession>('/workouts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  await invalidateWorkoutRelatedCaches(payload.scheduled_date.slice(0, 7));
  return created;
}

export async function completeWorkout(sessionId: number): Promise<{ success: boolean }> {
  const result = await apiFetch<{ success: boolean }>(`/workouts/${sessionId}/complete`, {
    method: 'PATCH',
  });
  await invalidateWorkoutRelatedCaches();
  return result;
}

export async function updateWorkout(
  sessionId: number | string,
  payload: {
    status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'UNFINISHED' | 'MISSED';
    notes?: string;
    type?: string;
    scheduled_date?: string;
  },
): Promise<WorkoutSession> {
  const updated = await apiFetch<WorkoutSession>(`/workouts/${sessionId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  await invalidateWorkoutRelatedCaches(payload.scheduled_date?.slice(0, 7));
  return updated;
}

export async function addExercisesToWorkout(
  sessionId: number | string,
  exercises: Array<{ exercise_id: number; planned_sets: number; planned_reps: number }>,
): Promise<{ session_id: number; added_exercises: number }> {
  const result = await apiFetch<{ session_id: number; added_exercises: number }>(`/workouts/${sessionId}/session-details`, {
    method: 'POST',
    body: JSON.stringify({ exercises }),
  });
  await invalidateWorkoutRelatedCaches();
  return result;
}

export async function removeExerciseFromWorkout(
  sessionId: number | string,
  sessionDetailId: number | string,
): Promise<{ message: string }> {
  const result = await apiFetch<{ message: string }>(`/workouts/${sessionId}/session-details`, {
    method: 'DELETE',
    body: JSON.stringify({ session_detail_id: Number(sessionDetailId) }),
  });
  await invalidateWorkoutRelatedCaches();
  return result;
}

export async function createExerciseLog(payload: {
  session_detail_id: number;
  actual_reps?: number;
  reps?: number;
  weight_kg?: number;
  duration?: number;
  status?: boolean;
  notes?: string;
}): Promise<ExerciseLog> {
  const created = await apiFetch<ExerciseLog>(`/workouts/logs`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  await invalidateWorkoutRelatedCaches();
  return created;
}

export async function updateExerciseLog(payload: {
  log_id: number;
  actual_reps?: number;
  reps?: number;
  weight_kg?: number;
  duration?: number;
  status?: boolean;
  notes?: string;
}): Promise<ExerciseLog> {
  const updated = await apiFetch<ExerciseLog>(`/workouts/logs`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  await invalidateWorkoutRelatedCaches();
  return updated;
}

export async function deleteExerciseLog(setId: number | string): Promise<{ message: string }> {
  const result = await apiFetch<{ message: string }>(`/workouts/logs`, {
    method: 'DELETE',
    body: JSON.stringify({ set_id: Number(setId) }),
  });
  await invalidateWorkoutRelatedCaches();
  return result;
}

export async function deleteWorkout(sessionId: number): Promise<{ success: boolean }> {
  const result = await apiFetch<{ success: boolean }>(`/workouts/${sessionId}`, {
    method: 'DELETE',
  });
  await invalidateWorkoutRelatedCaches();
  return result;
}
