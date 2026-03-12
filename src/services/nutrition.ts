import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';
import { apiFetch } from '@/lib/api/client';
import { getSecureItem, SECURE_KEYS } from '@/lib/storage/secure';
import { invalidateAllSummaryCaches, invalidateSummaryCache } from '@/services/summary';
import { NutritionGoal } from '@/types/api';

export type MacroTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  water: number;
};

export type NormalisedMeal = {
  id: number;
  meal_id: number;
  name: string;
  mealType: string;
  time: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  raw: ApiMeal;
};

export type MealFoodItem = {
  meal_detail_id?: number;
  food_id?: number;
  name: string;
  unit_type?: string;
  numbers_of_serving?: number;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  sugars?: number;
  zinc?: number;
  magnesium?: number;
  calcium?: number;
  iron?: number;
  vitamin_a?: number;
  vitamin_c?: number;
  vitamin_b12?: number;
  vitamin_d?: number;
};

export type MealDetail = {
  meal_id: number;
  meal_type: string;
  log_date: string;
  foods: MealFoodItem[];
};

type MealDetailApi = {
  meal_id?: number;
  meal_type?: string;
  log_date?: string;
  foods?: Array<Record<string, unknown>>;
  details?: Array<Record<string, unknown>>;
  meal_details?: Array<Record<string, unknown>>;
};

export type FoodItem = {
  food_id: number;
  name: string;
  calories_per_serving: number;
  protein_per_serving: number;
  carbs_per_serving: number;
  fat_per_serving: number;
  fibers_per_serving?: number;
  sugars_per_serving?: number;
  zincs_per_serving?: number;
  magnesiums_per_serving?: number;
  calciums_per_serving?: number;
  irons_per_serving?: number;
  vitamin_a_per_serving?: number;
  vitamin_c_per_serving?: number;
  vitamin_b12_per_serving?: number;
  vitamin_d_per_serving?: number;
  unit_type?: string;
  serving_type?: string;
};

type WaterResponse = {
  total_ml: number;
  goal_ml: number;
};

type ApiMeal = {
  meal_id: number;
  meal_type: string;
  log_date: string;
  total_calories?: number;
  total_protein?: number;
  total_carbs?: number;
  total_fat?: number;
  total_fibers?: number;
  total_fiber?: number;
};

type FoodsSyncResponse = {
  changed: 0 | 1;
  version: string;
  data?: FoodItem[];
};

const CACHE_DATE_FORMAT = 'dd-MM-yyyy';

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function resolveServingAmount(item: Record<string, unknown>): number {
  const direct = toNumber(item.numbers_of_serving ?? item.servings ?? item.quantity ?? item.qty);
  if (direct > 0) return direct;
  return 1;
}

function resolveNutrientTotal(
  item: Record<string, unknown>,
  servingAmount: number,
  totalKey: string,
  perServingKey: string,
): number {
  const total = toNumber(item[totalKey]);
  if (total > 0) return total;

  const perServing = toNumber(item[perServingKey]);
  if (perServing > 0) return perServing * servingAmount;

  return 0;
}

function normaliseMealFoodsFromRows(rows: Array<Record<string, unknown>>): MealFoodItem[] {
  return rows.map((item) => {
    const nestedFood =
      item.food && typeof item.food === 'object' && !Array.isArray(item.food)
        ? (item.food as Record<string, unknown>)
        : undefined;

    const servings = resolveServingAmount(item);
    const servingAmount = servings > 0 ? servings : resolveServingAmount(nestedFood ?? {});

    return {
      meal_detail_id: toNumber(item.meal_detail_id),
      food_id: toNumber(item.food_id ?? nestedFood?.food_id),
      name: String(item.food_name ?? item.name ?? nestedFood?.name ?? 'Food'),
      unit_type: String(item.unit_type ?? item.serving_type ?? nestedFood?.unit_type ?? nestedFood?.serving_type ?? 'serving'),
      numbers_of_serving: servingAmount,
      calories:
        resolveNutrientTotal(item, servingAmount, 'total_calories', 'calories_per_serving') ||
        resolveNutrientTotal(nestedFood ?? {}, servingAmount, 'total_calories', 'calories_per_serving'),
      protein:
        resolveNutrientTotal(item, servingAmount, 'total_protein', 'protein_per_serving') ||
        resolveNutrientTotal(nestedFood ?? {}, servingAmount, 'total_protein', 'protein_per_serving'),
      carbs:
        resolveNutrientTotal(item, servingAmount, 'total_carbs', 'carbs_per_serving') ||
        resolveNutrientTotal(nestedFood ?? {}, servingAmount, 'total_carbs', 'carbs_per_serving'),
      fats:
        resolveNutrientTotal(item, servingAmount, 'total_fat', 'fat_per_serving') ||
        resolveNutrientTotal(nestedFood ?? {}, servingAmount, 'total_fat', 'fat_per_serving'),
      fiber:
        resolveNutrientTotal(item, servingAmount, 'total_fibers', 'fibers_per_serving') ||
        resolveNutrientTotal(item, servingAmount, 'total_fiber', 'fiber_per_serving') ||
        resolveNutrientTotal(nestedFood ?? {}, servingAmount, 'total_fibers', 'fibers_per_serving') ||
        resolveNutrientTotal(nestedFood ?? {}, servingAmount, 'total_fiber', 'fiber_per_serving'),
      sugars:
        resolveNutrientTotal(item, servingAmount, 'total_sugars', 'sugars_per_serving') ||
        resolveNutrientTotal(nestedFood ?? {}, servingAmount, 'total_sugars', 'sugars_per_serving'),
      zinc:
        resolveNutrientTotal(item, servingAmount, 'total_zincs', 'zincs_per_serving') ||
        resolveNutrientTotal(nestedFood ?? {}, servingAmount, 'total_zincs', 'zincs_per_serving'),
      magnesium:
        resolveNutrientTotal(item, servingAmount, 'total_magnesiums', 'magnesiums_per_serving') ||
        resolveNutrientTotal(nestedFood ?? {}, servingAmount, 'total_magnesiums', 'magnesiums_per_serving'),
      calcium:
        resolveNutrientTotal(item, servingAmount, 'total_calciums', 'calciums_per_serving') ||
        resolveNutrientTotal(nestedFood ?? {}, servingAmount, 'total_calciums', 'calciums_per_serving'),
      iron:
        resolveNutrientTotal(item, servingAmount, 'total_irons', 'irons_per_serving') ||
        resolveNutrientTotal(nestedFood ?? {}, servingAmount, 'total_irons', 'irons_per_serving'),
      vitamin_a:
        resolveNutrientTotal(item, servingAmount, 'total_vitamin_a', 'vitamin_a_per_serving') ||
        resolveNutrientTotal(nestedFood ?? {}, servingAmount, 'total_vitamin_a', 'vitamin_a_per_serving'),
      vitamin_c:
        resolveNutrientTotal(item, servingAmount, 'total_vitamin_c', 'vitamin_c_per_serving') ||
        resolveNutrientTotal(nestedFood ?? {}, servingAmount, 'total_vitamin_c', 'vitamin_c_per_serving'),
      vitamin_b12:
        resolveNutrientTotal(item, servingAmount, 'total_vitamin_b12', 'vitamin_b12_per_serving') ||
        resolveNutrientTotal(nestedFood ?? {}, servingAmount, 'total_vitamin_b12', 'vitamin_b12_per_serving'),
      vitamin_d:
        resolveNutrientTotal(item, servingAmount, 'total_vitamin_d', 'vitamin_d_per_serving') ||
        resolveNutrientTotal(nestedFood ?? {}, servingAmount, 'total_vitamin_d', 'vitamin_d_per_serving'),
    };
  });
}

function titleizeMealType(rawType: string | null | undefined): string {
  const normalized = (rawType ?? 'other').trim().toLowerCase();
  switch (normalized) {
    case 'breakfast':
      return 'Breakfast';
    case 'lunch':
      return 'Lunch';
    case 'dinner':
      return 'Dinner';
    case 'snack':
    case 'snacks':
      return 'Snacks';
    case 'supplement':
    case 'supplements':
      return 'Supplements';
    case 'pre-workout':
      return 'Pre-Workout';
    case 'post-workout':
      return 'Post-Workout';
    default:
      return 'Other';
  }
}

function getTodayCacheDate(): string {
  return format(new Date(), CACHE_DATE_FORMAT);
}

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

function buildMealMonthCacheKeys(month: string, userId: string) {
  return {
    data: `meals_month_${month}_${userId}`,
    fetched: `meals_fetched_${month}_${userId}`,
  };
}

function buildGoalDateCacheKey(dateStr: string, userId: string) {
  return `goal_date_${dateStr}_${userId}`;
}

function buildWaterDateCacheKey(dateStr: string, userId: string) {
  return `water_date_${dateStr}_${userId}`;
}

function parseDateKey(logDate: string): string {
  return (logDate || '').slice(0, 10);
}

export function normaliseMeals(rawMeals: ApiMeal[]): NormalisedMeal[] {
  return rawMeals.map((meal) => {
    const time = meal.log_date && meal.log_date.length >= 16 ? meal.log_date.slice(11, 16) : '--:--';
    const calories = toNumber(meal.total_calories);
    const protein = toNumber(meal.total_protein);
    const carbs = toNumber(meal.total_carbs);
    const fats = toNumber(meal.total_fat);
    const fiber = toNumber(meal.total_fibers ?? meal.total_fiber);

    return {
      id: meal.meal_id,
      meal_id: meal.meal_id,
      name: `${titleizeMealType(meal.meal_type)} Meal`,
      mealType: titleizeMealType(meal.meal_type),
      time,
      calories,
      protein,
      carbs,
      fats,
      fiber,
      raw: meal,
    };
  });
}

export function reduceDailyMacros(meals: NormalisedMeal[], waterMl: number): MacroTotals {
  const totals = meals.reduce<MacroTotals>(
    (acc, meal) => ({
      calories: acc.calories + meal.calories,
      protein: acc.protein + meal.protein,
      carbs: acc.carbs + meal.carbs,
      fats: acc.fats + meal.fats,
      fiber: acc.fiber + meal.fiber,
      water: acc.water,
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0, water: waterMl },
  );

  totals.water = waterMl;
  return totals;
}

export async function fetchNutritionGoal(dateStr: string, forceRefresh = false): Promise<NutritionGoal> {
  const userId = await getCacheUserId();
  const cacheKey = buildGoalDateCacheKey(dateStr, userId);

  if (forceRefresh) {
    await AsyncStorage.removeItem(cacheKey);
  }

  const cached = await AsyncStorage.getItem(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached) as NutritionGoal;
    } catch {
      await AsyncStorage.removeItem(cacheKey);
    }
  }

  const goal = await apiFetch<NutritionGoal>(`/nutrition/goals?date=${dateStr}`);
  await AsyncStorage.setItem(cacheKey, JSON.stringify(goal));
  return goal;
}

export async function fetchMealsByDate(dateStr: string, month: string, forceRefresh = false): Promise<NormalisedMeal[]> {
  const userId = await getCacheUserId();
  const keys = buildMealMonthCacheKeys(month, userId);
  const today = getTodayCacheDate();

  if (forceRefresh) {
    await AsyncStorage.multiRemove([keys.data, keys.fetched]);
  }

  const [cachedDataRaw, fetchedDayRaw] = await AsyncStorage.multiGet([keys.data, keys.fetched]);
  const cachedMeals = cachedDataRaw?.[1];
  const cachedFetchedDay = fetchedDayRaw?.[1];

  if (cachedMeals && cachedFetchedDay === today) {
    try {
      const parsed = JSON.parse(cachedMeals) as ApiMeal[];
      return normaliseMeals(parsed).filter((meal) => parseDateKey(meal.raw.log_date) === dateStr);
    } catch {
      await AsyncStorage.multiRemove([keys.data, keys.fetched]);
    }
  }

  const monthlyMeals = await apiFetch<ApiMeal[]>(`/meals?month=${month}`);
  await AsyncStorage.multiSet([
    [keys.data, JSON.stringify(monthlyMeals)],
    [keys.fetched, today],
  ]);

  return normaliseMeals(monthlyMeals).filter((meal) => parseDateKey(meal.raw.log_date) === dateStr);
}

export async function updateMealsMonthCacheAfterCreate(month: string, appendedMeal: ApiMeal): Promise<void> {
  const userId = await getCacheUserId();
  const keys = buildMealMonthCacheKeys(month, userId);
  const current = await AsyncStorage.getItem(keys.data);
  if (!current) return;

  try {
    const parsed = JSON.parse(current) as ApiMeal[];
    parsed.push(appendedMeal);
    await AsyncStorage.setItem(keys.data, JSON.stringify(parsed));
  } catch {
    await AsyncStorage.removeItem(keys.data);
  }
}

export async function updateMealsMonthCacheAfterDelete(month: string, mealId: number): Promise<void> {
  const userId = await getCacheUserId();
  const keys = buildMealMonthCacheKeys(month, userId);
  const current = await AsyncStorage.getItem(keys.data);
  if (!current) return;

  try {
    const parsed = JSON.parse(current) as ApiMeal[];
    const next = parsed.filter((meal) => meal.meal_id !== mealId);
    await AsyncStorage.setItem(keys.data, JSON.stringify(next));
  } catch {
    await AsyncStorage.removeItem(keys.data);
  }
}

export async function fetchWaterDaily(dateStr: string, forceRefresh = false): Promise<WaterResponse> {
  const userId = await getCacheUserId();
  const key = buildWaterDateCacheKey(dateStr, userId);

  if (forceRefresh) {
    await AsyncStorage.removeItem(key);
  }

  const cached = await AsyncStorage.getItem(key);
  if (cached) {
    try {
      return JSON.parse(cached) as WaterResponse;
    } catch {
      await AsyncStorage.removeItem(key);
    }
  }

  const response = await apiFetch<WaterResponse>(`/nutrition/water?date=${dateStr}`);
  await AsyncStorage.setItem(key, JSON.stringify(response));
  return response;
}

export async function invalidateDailyCaches(dateStr: string, month: string): Promise<void> {
  const userId = await getCacheUserId();
  const goalKey = buildGoalDateCacheKey(dateStr, userId);
  const waterKey = buildWaterDateCacheKey(dateStr, userId);
  const mealsKeys = buildMealMonthCacheKeys(month, userId);
  await AsyncStorage.multiRemove([goalKey, waterKey, mealsKeys.data, mealsKeys.fetched]);
}

export async function logWater(amount_ml: number, date: string): Promise<void> {
  await apiFetch('/nutrition/water', {
    method: 'POST',
    body: JSON.stringify({ amount_ml, date }),
  });

  const userId = await getCacheUserId();
  await AsyncStorage.removeItem(buildWaterDateCacheKey(date, userId));
  await invalidateSummaryCache(date.slice(0, 7));
}

export async function fetchFoods(searchQuery = ''): Promise<FoodItem[]> {
  const userId = await getCacheUserId();
  const foodsVersionKey = `foods_version_${userId}`;
  const foodsDataKey = `foods_data_${userId}`;
  const query = searchQuery.trim();
  if (query.length > 1) {
    return apiFetch<FoodItem[]>(`/foods?search=${encodeURIComponent(query)}`);
  }

  const storedVersion = await AsyncStorage.getItem(foodsVersionKey);
  const storedFoodsRaw = await AsyncStorage.getItem(foodsDataKey);

  const currentFoods = (() => {
    if (!storedFoodsRaw) return [] as FoodItem[];
    try {
      return JSON.parse(storedFoodsRaw) as FoodItem[];
    } catch {
      return [] as FoodItem[];
    }
  })();

  const syncPath = storedVersion ? `/foods?version=${storedVersion}` : '/foods';
  const syncResponse = await apiFetch<FoodsSyncResponse | FoodItem[]>(syncPath);

  if (Array.isArray(syncResponse)) {
    await AsyncStorage.setItem(foodsDataKey, JSON.stringify(syncResponse));
    return syncResponse;
  }

  if (syncResponse.changed === 0) {
    return currentFoods;
  }

  const updates = syncResponse.data ?? [];
  const byId = new Map<number, FoodItem>();
  currentFoods.forEach((food) => byId.set(food.food_id, food));
  updates.forEach((food) => byId.set(food.food_id, food));
  const merged = Array.from(byId.values());

  await AsyncStorage.multiSet([
    [foodsDataKey, JSON.stringify(merged)],
    [foodsVersionKey, syncResponse.version],
  ]);

  return merged;
}

export function createMeal(payload: {
  meal_type: string;
  log_date: string;
  details: Array<{ food_id: number; numbers_of_serving: number }>;
}): Promise<{ meal_id: number }> {
  return apiFetch<{ meal_id: number }>('/meals', {
    method: 'POST',
    body: JSON.stringify(payload),
  }).then(async (result) => {
    await invalidateSummaryCache(payload.log_date.slice(0, 7));
    return result;
  });
}

export function deleteMeal(mealId: number): Promise<{ message?: string }> {
  return apiFetch<{ message?: string }>(`/meals/${mealId}`, {
    method: 'DELETE',
  }).then(async (result) => {
    await invalidateAllSummaryCaches();
    return result;
  });
}

export async function getMealDetail(mealId: number): Promise<MealDetail> {
  const detail = await apiFetch<MealDetailApi>(`/meals/${mealId}`);
  const rows = detail.foods ?? detail.details ?? detail.meal_details ?? [];
  const foods = normaliseMealFoodsFromRows(rows);

  return {
    meal_id: detail.meal_id,
    meal_type: detail.meal_type,
    log_date: detail.log_date,
    foods,
  };
}

export async function getMealDetailsFallback(mealId: number): Promise<MealFoodItem[]> {
  const detail = await apiFetch<MealDetailApi>(`/meals/${mealId}`);
  const rows = detail.foods ?? detail.details ?? detail.meal_details ?? [];
  return normaliseMealFoodsFromRows(rows);
}

// ─── Metrics & Goal ──────────────────────────────────────────────────────────

import type { MetricData, GoalCalculationParams, GoalCalculationResult } from '@/types/api';

export async function fetchLatestMetrics(): Promise<MetricData | null> {
  try {
    return await apiFetch<MetricData>('/nutrition/metrics/latest');
  } catch {
    return null;
  }
}

export async function saveUserMetric(metrics: Partial<MetricData>): Promise<void> {
  await apiFetch('/nutrition/metrics', {
    method: 'POST',
    body: JSON.stringify(metrics),
  });
}

export async function calculateGoalTargets(params: GoalCalculationParams): Promise<GoalCalculationResult> {
  return apiFetch<GoalCalculationResult>('/nutrition/goals/calculate', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function saveNutritionGoalTargets(
  params: GoalCalculationParams & GoalCalculationResult,
): Promise<void> {
  await apiFetch('/nutrition/goals', {
    method: 'POST',
    body: JSON.stringify({
      ...params,
      calories_target: params.daily_calories,
      protein_target_g: params.protein_g,
      carbs_target_g: params.carbs_g,
      fat_target_g: params.fat_g,
      hydration_target_ml: params.hydration_ml,
    }),
  });
}
