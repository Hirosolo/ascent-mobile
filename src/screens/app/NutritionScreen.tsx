import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Svg, { Circle } from 'react-native-svg';
import { addDays, format, subDays } from 'date-fns';
import { Screen } from '@/components/ui/Screen';
import {
  createMeal,
  deleteMeal,
  fetchFoods,
  fetchMealsByDate,
  fetchNutritionGoal,
  fetchWaterDaily,
  FoodItem,
  getMealDetail,
  getMealDetailsFallback,
  invalidateDailyCaches,
  logWater,
  MacroTotals,
  MealFoodItem,
  NormalisedMeal,
  reduceDailyMacros,
  updateMealsMonthCacheAfterCreate,
  updateMealsMonthCacheAfterDelete,
} from '@/services/nutrition';
import { colors } from '@/theme/tokens';

type GoalTargets = {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  water: number;
};

type MealGroupName = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snacks' | 'Supplements' | 'Other';

type SelectedFood = FoodItem & { servings: number };

const MEAL_GROUP_ORDER: MealGroupName[] = ['Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Supplements', 'Other'];
const STEP_TITLES = ['Initialization', 'Database Search', 'Performance Ratio', 'Final Review'] as const;
const STEP_MEAL_OPTIONS = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Pre-Workout', 'Post-Workout'];
const STEP_EVENT_META: Record<string, { icon: string; image: string }> = {
  Breakfast: {
    icon: 'weather-sunset-up',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDgdqc0WJb67k-Lk2SkrgUMnqDOGg4lks-MC2QWv7fVgF7eS6njGvu7M26BFuWNR4T3ZCmmbHBlNLyvz6_xmsqFb9I4FOOegO-dNgwv9hLFc5Lb5-TpRl29YD5Qtfm2eVOuWvg75aDm1hIWFKoX_DUFKt7Zo6jyaOJayZvk0f8NZWvNfj60PTtjxsdh2wv5UD4iot1fuB0CXFKrB_nGKjLMGYDXF8End_zHoOIYMO_s5dVFjire4JmVJ58THLeJ7SpmAXXD3-gFqm_u',
  },
  Lunch: {
    icon: 'white-balance-sunny',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuB7RTGx-haivlIzYN-GKA4tudhpDXa8_zqAW7IELUJvYeayqgv2IBTN_PsVdeOZsE040aGxi5zWBOhfg3QK_rGmsrA_NwFyRIbP_WbqEZGiWA_Cf53muXrPNMU2RUjhZPLlSxZzgKuCAIZ9MkHU9HLpwYcIutNo1UiX6iLpsvK2OX52qq5NWXeY8MLRikgTAsr_J2-Y4O76jG8BGi48QOkj204mLGNEMt50Dn3W2GpZFfHTPM7lqwZwL22l-fAIbhrMf9gL67Sdi4ih',
  },
  Dinner: {
    icon: 'moon-waning-crescent',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBBNv7NdQhHW9Mmr4luevSTmgubXcTOQU085nPgmsWuwNn0opurEybl9mt6uvmD9BPnDxCn9DtFikhNicEWRGjiE-t_GxxogXW1WA0AjybDdi0bcJITiZwVWmoonQ2ZgH9klYg5lCP0MtYyplWaTwokxeCd9NKfl3hPlQkmQaJMbPhRtVzVc7o7hib_Y5eIae8lsPvKojR0X6mV_o0oE5WmHOUgIqZiAmQWWXlQJ40-qOGMLK_NT5xdPC_dJODolF-ex9tLbplQWZ11',
  },
  Snack: {
    icon: 'cookie',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDBcvLLIUvt0v1b6uYCI9ITVah1CcnXf3x8Xj77kbfpIcZ9F_Y8jIapZo3TC1FjR6RSTBKj0nSkY3jkQ8RmL_8_kX-knX0d-ZMEYxhzSrxmqnksRRnX0sd9aiJnqZX3dCerV-zxQgDYz-xzzS0SE9aR8Ixal3f6G1DSNjl_rVam7vzBBcQ2lM6RzdQ1XxpNcYL--2_4ltgn2ax5kMGJ5nnKXlTBFYYUOKtatk9TjzjMt0cnweBFjTCP4cP1KY6NjMGoCT6dT9RIzIh5',
  },
  'Pre-Workout': {
    icon: 'dumbbell',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDalhGRl600dVhYAwlRVq1WS4Of6h9k0DluR4wmfWCpBsaSlV1v67SopZgZ6Zm_jkX2GdZhYAlqjjTIqmZHj03IEDC6Ip1Lmxyxo5sky6rCi4EZcuerv_MAiPqUKDm98jxI2oHQplcZo0GqXiM9npSNymYNj-Qe9-Zu7sUpnzehdtMt7Ufw4EmKtEv3ec_9EyGNxRgVa4rLsX_Xkk9Jp0IDcM_rxdGx3o6cNEm7RiWTlWcH7KYoJZo7qbSOnKYq2Rah6YrTMhWDBl55',
  },
  'Post-Workout': {
    icon: 'lightning-bolt',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDakWqgSuWBryTK-AxEBHwJ0NudM8PZNcB-ZkSCszNuF65e_IC6eq9iUtFisGSL82xfBZt5ppCvAuQrs_9Ml-T2dgQ_m_Ov1fI5DiMkKjFOUGyc1vnn1foErFoLBicJ2VTEdqwZ3rM7ChIeU4ucKhvTekGPgalMVqC3kDiYsc7mBfmonKkKZ2wq0nONJXs5O1BzjYKgfKXQCfFkIWAYH3R8i4mIbr4wxwwOY4wFj95WQFW3x1CsjQfMXKcQ0-Lquxhlftt8Hs8DdxAw',
  },
};

const MEAL_TYPE_IMAGES: Record<string, string> = {
  breakfast:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDqRlv8L2zEpHtf3c3-ETR1Az3kROVigYRT0YyRQzQqJJpsJjbrAd7tFFqcpmgYjj1Z4E32oxqvx3YYURB7G19MvmWLfEYpSSmDvuTKic5mYxB661852ydnP6nzIHnY1mKXsuM0Ue_WD4EX-hm65nhx0UTjU6PI2f9Vq3UT98zSaytA8EdeOWtBuxBuh7ou7vnWQz0W1zX3Fjlu7CKgQNSvHHrJOW05UA_65YPb1CGiSii0NrUiL_K7PFKe9Go6m190Uua_dpzQm4uj',
  lunch:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDnY9mtKYMdisJDfAKYpRsmXxsWa2Ai0iK8QL9-O3gsNuWzBhZSYOS8VQ5mlFEBG1EmzvPqR53Ao-YnRpkibV5bHSVtwVRpHAD2QoYmmASYBQB_KcxYwEAX5vlb1uCrxPXYDoe2EPdi8ReEGHvFAWdYUhqfD8vkyPWgMBbq2ShecwHTAfyyVYojyDkwN2-Wqt3ljW2l_cE_y4k5WNbFTJhbGffQi-H4CWTiVOpuP0HFHne37GFHrbe1PoJOofKOFQ9zSdSkBNEIgyi1',
  dinner:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCYdFbkdWOIZ38h_vXDkJH4ALlZ-4dc9vguNr6slSQOrh4BjCR-b-Sp_x6Gtjuz9BEpAcwiwCekkK7p9CHMG0QA7c-vbS7K_wHN0-6mDEzItsgrLo66N2u93S2pqRxWoBHGEQCmKlXjkCLrCw8bIhAslIoBNFjORQvxqkezph6pMT5cFYepCfb6mROfe6_K66PcpuO6ENfxsa7cYmcuZmZKgZfqUxtS10gl-M_GB2eJwwQZJUznnaH9ck5aZsrCz4uQQRamKY7Qk4C6',
  snack:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDBcvLLIUvt0v1b6uYCI9ITVah1CcnXf3x8Xj77kbfpIcZ9F_Y8jIapZo3TC1FjR6RSTBKj0nSkY3jkQ8RmL_8_kX-knX0d-ZMEYxhzSrxmqnksRRnX0sd9aiJnqZX3dCerV-zxQgDYz-xzzS0SE9aR8Ixal3f6G1DSNjl_rVam7vzBBcQ2lM6RzdQ1XxpNcYL--2_4ltgn2ax5kMGJ5nnKXlTBFYYUOKtatk9TjzjMt0cnweBFjTCP4cP1KY6NjMGoCT6dT9RIzIh5',
  'pre-workout':
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDalhGRl600dVhYAwlRVq1WS4Of6h9k0DluR4wmfWCpBsaSlV1v67SopZgZ6Zm_jkX2GdZhYAlqjjTIqmZHj03IEDC6Ip1Lmxyxo5sky6rCi4EZcuerv_MAiPqUKDm98jxI2oHQplcZo0GqXiM9npSNymYNj-Qe9-Zu7sUpnzehdtMt7Ufw4EmKtEv3ec_9EyGNxRgVa4rLsX_Xkk9Jp0IDcM_rxdGx3o6cNEm7RiWTlWcH7KYoJZo7qbSOnKYq2Rah6YrTMhWDBl55',
  'post-workout':
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDalhGRl600dVhYAwlRVq1WS4Of6h9k0DluR4wmfWCpBsaSlV1v67SopZgZ6Zm_jkX2GdZhYAlqjjTIqmZHj03IEDC6Ip1Lmxyxo5sky6rCi4EZcuerv_MAiPqUKDm98jxI2oHQplcZo0GqXiM9npSNymYNj-Qe9-Zu7sUpnzehdtMt7Ufw4EmKtEv3ec_9EyGNxRgVa4rLsX_Xkk9Jp0IDcM_rxdGx3o6cNEm7RiWTlWcH7KYoJZo7qbSOnKYq2Rah6YrTMhWDBl55',
  supplement:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDakWqgSuWBryTK-AxEBHwJ0NudM8PZNcB-ZkSCszNuF65e_IC6eq9iUtFisGSL82xfBZt5ppCvAuQrs_9Ml-T2dgQ_m_Ov1fI5DiMkKjFOUGyc1vnn1foErFoLBicJ2VTEdqwZ3rM7ChIeU4ucKhvTekGPgalMVqC3kDiYsc7mBfmonKkKZ2wq0nONJXs5O1BzjYKgfKXQCfFkIWAYH3R8i4mIbr4wxwwOY4wFj95WQFW3x1CsjQfMXKcQ0-Lquxhlftt8Hs8DdxAw',
};

const MEAL_GROUP_COLORS: Record<MealGroupName, string> = {
  Breakfast: '#3b82f6',
  Lunch: '#a855f7',
  Dinner: '#6366f1',
  Snacks: '#f59e0b',
  Supplements: '#10b981',
  Other: '#64748b',
};

const MACRO_COLORS = {
  protein: '#3b82f6',
  carbs: '#ef4444',
  fats: '#10b981',
  fiber: '#f59e0b',
};

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function clampPercent(current: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.max(0, Math.min(100, (current / goal) * 100));
}

function mapMealTypeToGroup(raw: string): MealGroupName {
  const value = raw.trim().toLowerCase();
  if (value === 'breakfast') return 'Breakfast';
  if (value === 'lunch') return 'Lunch';
  if (value === 'dinner') return 'Dinner';
  if (value === 'snack' || value === 'snacks') return 'Snacks';
  if (value === 'supplement' || value === 'supplements' || value === 'pre-workout' || value === 'post-workout') {
    return 'Supplements';
  }
  return 'Other';
}

function mealTypeIcon(name: string): string {
  const key = name.toLowerCase();
  if (key === 'breakfast') return 'white-balance-sunny';
  if (key === 'lunch') return 'food';
  if (key === 'dinner') return 'silverware-fork-knife';
  if (key === 'snack') return 'cookie';
  if (key === 'pre-workout') return 'lightning-bolt';
  if (key === 'post-workout') return 'dumbbell';
  return 'silverware';
}

function mealTypeAccent(name: string): string {
  const key = name.toLowerCase();
  if (key === 'breakfast') return '#3b82f6';
  if (key === 'lunch') return '#8b5cf6';
  if (key === 'dinner') return '#6366f1';
  if (key === 'snack') return '#f59e0b';
  if (key === 'pre-workout' || key === 'post-workout') return '#06b6d4';
  return '#64748b';
}

function mealTypeImage(name: string): string | undefined {
  return MEAL_TYPE_IMAGES[name.trim().toLowerCase()];
}

function fmtNutrient(value: number | null | undefined, withUnit = false): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const out = Number.isInteger(n) ? String(n) : n.toFixed(2);
  return withUnit ? `${out}g` : out;
}

export function NutritionScreen() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [meals, setMeals] = useState<NormalisedMeal[]>([]);
  const [selectedMeal, setSelectedMeal] = useState<NormalisedMeal | null>(null);
  const [selectedMealFoods, setSelectedMealFoods] = useState<MealFoodItem[]>([]);
  const [expandedFoodRows, setExpandedFoodRows] = useState<Record<string, boolean>>({});
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const errorAnim = useRef(new Animated.Value(120)).current;
  const waterAnim = useRef(new Animated.Value(0)).current;

  const [goals, setGoals] = useState<GoalTargets>({
    calories: 2200,
    protein: 140,
    carbs: 220,
    fats: 70,
    fiber: 28,
    water: 2500,
  });

  const [macros, setMacros] = useState<MacroTotals>({
    calories: 0,
    protein: 0,
    carbs: 0,
    fats: 0,
    fiber: 0,
    water: 0,
  });

  const [detailLoading, setDetailLoading] = useState(false);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [mealType, setMealType] = useState('Breakfast');
  const [notes, setNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [availableFoods, setAvailableFoods] = useState<FoodItem[]>([]);
  const [foodsLoading, setFoodsLoading] = useState(false);
  const [selectedFoods, setSelectedFoods] = useState<SelectedFood[]>([]);
  const [servingDrafts, setServingDrafts] = useState<Record<number, string>>({});
  const [submittingMeal, setSubmittingMeal] = useState(false);
  const [customWater, setCustomWater] = useState('');

  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const currentMonth = format(selectedDate, 'yyyy-MM');

  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = -3; i <= 3; i += 1) days.push(addDays(selectedDate, i));
    return days;
  }, [selectedDate]);

  const selectedFoodIds = useMemo(() => new Set(selectedFoods.map((f) => f.food_id)), [selectedFoods]);

  const orderedMeals = useMemo(() => {
    const rank: Record<MealGroupName, number> = {
      Breakfast: 0,
      Lunch: 1,
      Dinner: 2,
      Snacks: 3,
      Supplements: 4,
      Other: 5,
    };

    return [...meals].sort((a, b) => {
      const gA = mapMealTypeToGroup(a.mealType);
      const gB = mapMealTypeToGroup(b.mealType);
      const byGroup = rank[gA] - rank[gB];
      if (byGroup !== 0) return byGroup;
      return a.time.localeCompare(b.time);
    });
  }, [meals]);

  const totals = useMemo(() => {
    return selectedFoods.reduce(
      (acc, food) => ({
        calories: acc.calories + toNumber(food.calories_per_serving) * food.servings,
        protein: acc.protein + toNumber(food.protein_per_serving) * food.servings,
        carbs: acc.carbs + toNumber(food.carbs_per_serving) * food.servings,
        fats: acc.fats + toNumber(food.fat_per_serving) * food.servings,
        fiber: acc.fiber + toNumber(food.fibers_per_serving) * food.servings,
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0 },
    );
  }, [selectedFoods]);

  useEffect(() => {
    void loadDailyData(false);
  }, [dateStr]);

  useEffect(() => {
    Animated.spring(waterAnim, {
      toValue: clampPercent(macros.water, goals.water),
      useNativeDriver: false,
      damping: 20,
      stiffness: 50,
    }).start();
  }, [goals.water, macros.water, waterAnim]);

  useEffect(() => {
    if (!errorMessage) return;

    Animated.sequence([
      Animated.timing(errorAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.delay(2600),
      Animated.timing(errorAnim, { toValue: 120, duration: 200, useNativeDriver: true }),
    ]).start(() => setErrorMessage(null));
  }, [errorAnim, errorMessage]);

  async function loadDailyData(forceRefresh: boolean) {
    try {
      if (!isRefreshing) setIsLoading(true);

      if (forceRefresh) {
        await invalidateDailyCaches(dateStr, currentMonth);
      }

      const [goalData, mealData, waterData] = await Promise.all([
        fetchNutritionGoal(dateStr, forceRefresh),
        fetchMealsByDate(dateStr, currentMonth, forceRefresh),
        fetchWaterDaily(dateStr, forceRefresh),
      ]);

      const nextGoals: GoalTargets = {
        calories: toNumber((goalData as any).calories_target),
        protein: toNumber((goalData as any).protein_target_g),
        carbs: toNumber((goalData as any).carbs_target_g),
        fats: toNumber((goalData as any).fat_target_g),
        fiber: toNumber((goalData as any).fiber_target_g ?? 28),
        water: toNumber((goalData as any).hydration_target_ml),
      };

      const merged = reduceDailyMacros(mealData, toNumber(waterData.total_ml));

      setGoals((prev) => ({
        ...prev,
        calories: nextGoals.calories || prev.calories,
        protein: nextGoals.protein || prev.protein,
        carbs: nextGoals.carbs || prev.carbs,
        fats: nextGoals.fats || prev.fats,
        fiber: nextGoals.fiber || prev.fiber,
        water: nextGoals.water || prev.water,
      }));
      setMeals(mealData);
      setMacros(merged);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed loading nutrition data';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  async function handleRefresh() {
    setIsRefreshing(true);
    await loadDailyData(true);
  }

  async function executeAddWater(amount: number) {
    if (!amount || amount <= 0) return;

    try {
      await logWater(amount, dateStr);
      await loadDailyData(false);
      setCustomWater('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to log water';
      setErrorMessage(message);
    }
  }

  async function openMealDetail(meal: NormalisedMeal) {
    setSelectedMeal(meal);
    setExpandedFoodRows({});
    setDetailLoading(true);

    try {
      const primary = await getMealDetail(meal.meal_id);
      if (primary.foods.length > 0) {
        setSelectedMealFoods(primary.foods);
      } else {
        const fallback = await getMealDetailsFallback(meal.meal_id);
        setSelectedMealFoods(fallback);
      }
    } catch {
      try {
        const fallback = await getMealDetailsFallback(meal.meal_id);
        setSelectedMealFoods(fallback);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load meal details';
        setErrorMessage(message);
        setSelectedMealFoods([]);
      }
    } finally {
      setDetailLoading(false);
    }
  }

  async function removeMeal(meal: NormalisedMeal) {
    try {
      await deleteMeal(meal.meal_id);
      await updateMealsMonthCacheAfterDelete(currentMonth, meal.meal_id);
      setSelectedMeal(null);
      setSelectedMealFoods([]);
      setExpandedFoodRows({});
      await loadDailyData(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete meal';
      setErrorMessage(message);
    }
  }

  async function openLogModal() {
    setIsLogModalOpen(true);
    setStep(1);
    setMealType('Breakfast');
    setNotes('');
    setSearchQuery('');
    setSelectedFoods([]);
    setServingDrafts({});

    setFoodsLoading(true);
    try {
      const foods = await fetchFoods('');
      setAvailableFoods(foods);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load food database';
      setErrorMessage(message);
    } finally {
      setFoodsLoading(false);
    }
  }

  useEffect(() => {
    if (!isLogModalOpen) return;
    const q = searchQuery.trim();
    if (q.length <= 1) return;

    const timer = setTimeout(async () => {
      setFoodsLoading(true);
      try {
        const foods = await fetchFoods(q);
        setAvailableFoods(foods);
      } catch {
        setAvailableFoods([]);
      } finally {
        setFoodsLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [isLogModalOpen, searchQuery]);

  async function handleCreateMeal() {
    if (selectedFoods.length === 0) return;
    setSubmittingMeal(true);

    try {
      const payload = {
        meal_type: mealType.toLowerCase(),
        log_date: dateStr,
        details: selectedFoods.map((food) => ({ food_id: food.food_id, numbers_of_serving: food.servings })),
      };

      const created = await createMeal(payload);

      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const time = `${hh}:${mm}`;

      const stubName = selectedFoods.length > 1 ? `${selectedFoods[0].name} +${selectedFoods.length - 1}` : selectedFoods[0].name;

      await updateMealsMonthCacheAfterCreate(currentMonth, {
        meal_id: created.meal_id,
        meal_type: mealType.toLowerCase(),
        log_date: `${dateStr}T${time}:00.000Z`,
        total_calories: totals.calories,
        total_protein: totals.protein,
        total_carbs: totals.carbs,
        total_fat: totals.fats,
        total_fibers: totals.fiber,
      } as any);

      setIsLogModalOpen(false);
      setStep(1);
      setSelectedFoods([]);
      setServingDrafts({});
      setNotes('');
      await loadDailyData(false);

      if (stubName.length === 0) {
        setErrorMessage('Meal logged');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create meal';
      setErrorMessage(message);
    } finally {
      setSubmittingMeal(false);
    }
  }

  function addFood(food: FoodItem) {
    if (selectedFoodIds.has(food.food_id)) return;
    setSelectedFoods((prev) => [...prev, { ...food, servings: 1 }]);
    setServingDrafts((prev) => ({ ...prev, [food.food_id]: '1' }));
  }

  function removeFood(foodId: number) {
    setSelectedFoods((prev) => prev.filter((item) => item.food_id !== foodId));
    setServingDrafts((prev) => {
      const next = { ...prev };
      delete next[foodId];
      return next;
    });
  }

  function updateServings(foodId: number, nextValue: number) {
    const safe = Math.max(0.5, Math.round(nextValue * 2) / 2);
    setSelectedFoods((prev) => prev.map((item) => (item.food_id === foodId ? { ...item, servings: safe } : item)));
    setServingDrafts((prev) => ({ ...prev, [foodId]: String(safe) }));
  }

  function handleServingDraftChange(foodId: number, value: string) {
    const cleaned = value.replace(/[^0-9.]/g, '');
    setServingDrafts((prev) => ({ ...prev, [foodId]: cleaned }));
  }

  function commitServingDraft(foodId: number) {
    const raw = servingDrafts[foodId];
    if (raw == null) return;

    if (raw.trim() === '') {
      const current = selectedFoods.find((item) => item.food_id === foodId)?.servings ?? 1;
      setServingDrafts((prev) => ({ ...prev, [foodId]: String(current) }));
      return;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      const current = selectedFoods.find((item) => item.food_id === foodId)?.servings ?? 1;
      setServingDrafts((prev) => ({ ...prev, [foodId]: String(current) }));
      return;
    }

    updateServings(foodId, parsed);
  }

  const foodCandidates = useMemo(
    () => availableFoods.filter((item) => !selectedFoodIds.has(item.food_id)),
    [availableFoods, selectedFoodIds],
  );

  const donutSegments = useMemo(() => {
    const p = macros.protein * 4;
    const c = macros.carbs * 4;
    const f = macros.fats * 9;
    const total = p + c + f;

    return [
      { color: MACRO_COLORS.protein, pct: total > 0 ? p / total : 0 },
      { color: MACRO_COLORS.carbs, pct: total > 0 ? c / total : 0 },
      { color: MACRO_COLORS.fats, pct: total > 0 ? f / total : 0 },
    ];
  }, [macros]);

  return (
    <Screen scroll refreshing={isRefreshing} onRefresh={handleRefresh} contentStyle={styles.screen}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.systemStatus}>Ascent</Text>
          <Text style={styles.title}>NUTRITION</Text>
          <Text style={styles.dateText}>{format(selectedDate, 'MMM dd, yyyy')}</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateStrip}>
        {weekDays.map((day) => {
          const active = format(day, 'yyyy-MM-dd') === dateStr;
          return (
            <Pressable
              key={format(day, 'yyyy-MM-dd')}
              style={[styles.dayBtn, active && styles.dayBtnActive]}
              onPress={() => setSelectedDate(day)}
            >
              <Text style={[styles.dayLabel, active && styles.dayLabelActive]}>{format(day, 'EEE').toUpperCase()}</Text>
              <Text style={[styles.dayNumber, active && styles.dayNumberActive]}>{format(day, 'd')}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.overviewCard}>
        <View style={styles.donutWrap}>
          <Svg width={120} height={120}>
            {(() => {
              const radius = 44;
              const circ = 2 * Math.PI * radius;
              let offset = 0;
              return donutSegments.map((segment, idx) => {
                const dash = segment.pct * circ;
                const circle = (
                  <Circle
                    key={`${segment.color}-${idx}`}
                    cx={60}
                    cy={60}
                    r={radius}
                    stroke={segment.color}
                    strokeWidth={12}
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${dash} ${circ}`}
                    strokeDashoffset={-offset}
                    rotation={-90}
                    origin="60,60"
                  />
                );
                offset += dash;
                return circle;
              });
            })()}
            <Circle cx={60} cy={60} r={30} fill={colors.surfaceDark} />
          </Svg>
          <View style={styles.donutCenter}>
            <Text style={styles.smallDim}>Calories</Text>
            <Text style={styles.calorieValue}>{Math.round(macros.calories)}</Text>
          </View>
        </View>

        <View style={styles.progressCol}>
          <MacroProgress
            color={MACRO_COLORS.protein}
            current={macros.protein}
            goal={goals.protein}
            label="Protein"
            unit="g"
          />
          <MacroProgress
            color={MACRO_COLORS.carbs}
            current={macros.carbs}
            goal={goals.carbs}
            label="Carbohydrates"
            unit="g"
          />
          <MacroProgress color={MACRO_COLORS.fats} current={macros.fats} goal={goals.fats} label="Total Fats" unit="g" />
          <MacroProgress
            color={MACRO_COLORS.fiber}
            current={macros.fiber}
            goal={goals.fiber}
            label="Dietary Fiber"
            unit="g"
          />
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Nutrition Log</Text>
      </View>

      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}

      {!isLoading && meals.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons color="rgba(255,255,255,0.12)" name="silverware-variant" size={52} />
          <Text style={styles.emptyTitle}>No Fuel Logged Today</Text>
          <Text style={styles.emptySubtitle}>Initialize performance tracking...</Text>
        </View>
      ) : null}

      {orderedMeals.map((meal, idx) => {
        const group = mapMealTypeToGroup(meal.mealType);
        const groupColor = MEAL_GROUP_COLORS[group];
        const imageUri = mealTypeImage(meal.mealType);

        return (
          <Pressable
            key={meal.meal_id}
            style={[styles.mealCard, idx > 0 && styles.mealCardGap, { borderLeftColor: groupColor }]}
            onPress={() => void openMealDetail(meal)}
          >
            <View style={styles.mealRow}>
              <View style={styles.mealThumbWrap}>
                {imageUri ? <Image source={{ uri: imageUri }} style={styles.mealThumb} /> : null}
                <View style={styles.mealThumbShade} />
                <MaterialCommunityIcons color={groupColor} name={mealTypeIcon(meal.mealType)} size={20} style={styles.mealThumbIcon} />
              </View>

              <View style={styles.mealContent}>
                <View style={styles.mealTop}>
                  <Text style={styles.mealName} numberOfLines={1}>{meal.name}</Text>
                  <Text style={styles.mealMeta}>{meal.time}</Text>
                </View>

                <View style={styles.macroPills}>
                  <View style={[styles.macroPill, styles.pillProtein]}>
                    <Text style={styles.macroPillText}>P: {Math.round(meal.protein)}g</Text>
                  </View>
                  <View style={[styles.macroPill, styles.pillCarbs]}>
                    <Text style={styles.macroPillText}>C: {Math.round(meal.carbs)}g</Text>
                  </View>
                  <View style={[styles.macroPill, styles.pillFats]}>
                    <Text style={styles.macroPillText}>F: {Math.round(meal.fats)}g</Text>
                  </View>
                </View>
              </View>
            </View>
          </Pressable>
        );
      })}

      <Pressable style={styles.pendingMealCard} onPress={() => void openLogModal()}>
        <View style={styles.pendingMealIconWrap}>
          <MaterialCommunityIcons color="rgba(148,163,184,0.7)" name="plus" size={28} />
        </View>
        <View style={styles.pendingMealCopy}>
          <Text style={styles.pendingMealTitle}>Pending Dinner</Text>
          <Text style={styles.pendingMealSubtitle}>Tap to record next meal terminal</Text>
        </View>
      </Pressable>

      <Pressable style={styles.fab} onPress={() => void openLogModal()}>
        <MaterialCommunityIcons color={colors.textPrimary} name="silverware-fork-knife" size={22} />
      </Pressable>

      <Modal animationType="fade" transparent visible={Boolean(selectedMeal)} onRequestClose={() => setSelectedMeal(null)}>
        <View style={styles.overlay}>
          <View style={styles.detailModal}>
            <View style={styles.detailHeader}>
              <View>
                <Text style={styles.detailType}>{selectedMeal?.mealType}</Text>
                <Text style={styles.detailName}>{selectedMeal?.name}</Text>
              </View>
              <Pressable style={styles.closeCircle} onPress={() => setSelectedMeal(null)}>
                <MaterialCommunityIcons color={colors.textPrimary} name="close" size={20} />
              </Pressable>
            </View>

            {detailLoading ? (
              <View style={styles.detailLoading}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              <>
                <View style={styles.detailMacroRow}>
                  <DetailMetric label="KCAL" value={Math.round(selectedMeal?.calories ?? 0)} />
                  <DetailMetric color={MACRO_COLORS.protein} label="PRO" value={Math.round(selectedMeal?.protein ?? 0)} />
                  <DetailMetric color={MACRO_COLORS.carbs} label="CHO" value={Math.round(selectedMeal?.carbs ?? 0)} />
                  <DetailMetric color={MACRO_COLORS.fats} label="FAT" value={Math.round(selectedMeal?.fats ?? 0)} />
                </View>

                <ScrollView style={styles.foodList}>
                  {selectedMealFoods.length === 0 ? (
                    <View style={styles.noFoodWrap}>
                      <Text style={styles.noFoodText}>No foods found for this meal entry.</Text>
                    </View>
                  ) : null}

                  {selectedMealFoods.map((food, idx) => {
                    const foodKey = `${food.food_id ?? 'food'}-${idx}`;
                    const isExpanded = Boolean(expandedFoodRows[foodKey]);
                    const extras = [
                      { label: 'Sugars', value: food.sugars, unit: 'g' },
                      { label: 'Zinc', value: food.zinc, unit: '' },
                      { label: 'Magnesium', value: food.magnesium, unit: '' },
                      { label: 'Calcium', value: food.calcium, unit: '' },
                      { label: 'Iron', value: food.iron, unit: '' },
                      { label: 'Vitamin A', value: food.vitamin_a, unit: '' },
                      { label: 'Vitamin C', value: food.vitamin_c, unit: '' },
                      { label: 'Vitamin B12', value: food.vitamin_b12, unit: '' },
                      { label: 'Vitamin D', value: food.vitamin_d, unit: '' },
                    ].filter((item) => {
                      const n = Number(item.value);
                      return Number.isFinite(n) && n > 0;
                    });

                    return (
                    <Pressable
                      key={foodKey}
                      style={styles.foodCard}
                      onPress={() =>
                        setExpandedFoodRows((prev) => ({
                          ...prev,
                          [foodKey]: !prev[foodKey],
                        }))
                      }
                    >
                      <View style={styles.foodHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.foodName}>{food.name}</Text>
                          <Text style={styles.foodServing}>
                            {food.numbers_of_serving ? `${food.numbers_of_serving} ${food.unit_type || 'unit'}` : food.unit_type || 'unit'}
                          </Text>
                        </View>
                        <View style={styles.foodHeaderRight}>
                          <Text style={styles.foodKcal}>{Math.round(food.calories)} KCAL</Text>
                          <MaterialCommunityIcons
                            color={colors.textDim}
                            name={isExpanded ? 'chevron-up' : 'chevron-down'}
                            size={16}
                          />
                        </View>
                      </View>

                      <View style={styles.foodNutrientGrid}>
                        <Nutrient label="Protein" value={fmtNutrient(food.protein, true)} />
                        <Nutrient label="Carbs" value={fmtNutrient(food.carbs, true)} />
                        <Nutrient label="Fats" value={fmtNutrient(food.fats, true)} />
                        <Nutrient label="Fiber" value={fmtNutrient(food.fiber, true)} />
                      </View>

                      {isExpanded ? (
                        <View style={styles.foodExtraWrap}>
                          {extras.length === 0 ? (
                            <Text style={styles.foodExtraEmpty}>No additional nutrients.</Text>
                          ) : (
                            <View style={styles.foodNutrientGrid}>
                              {extras.map((extra) => (
                                <Nutrient
                                  key={`${foodKey}-${extra.label}`}
                                  label={extra.label}
                                  value={fmtNutrient(extra.value, extra.unit === 'g')}
                                />
                              ))}
                            </View>
                          )}
                        </View>
                      ) : null}
                    </Pressable>
                    );
                  })}
                </ScrollView>

                <View style={styles.detailFooter}>
                  <Pressable style={styles.deleteBtn} onPress={() => selectedMeal && void removeMeal(selectedMeal)}>
                    <Text style={styles.deleteBtnText}>Deconstruct Meal</Text>
                  </Pressable>
                  <Pressable style={styles.returnBtn} onPress={() => setSelectedMeal(null)}>
                    <Text style={styles.returnBtnText}>Return</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" transparent visible={isLogModalOpen} onRequestClose={() => setIsLogModalOpen(false)}>
        <View style={styles.overlayStrong}>
          <View style={styles.logSheet}>
            <View style={styles.logTopBar}>
              <Pressable style={styles.logTopIconBtn} onPress={() => (step === 1 ? setIsLogModalOpen(false) : setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4) : s)))}>
                <MaterialCommunityIcons color={colors.textPrimary} name="arrow-left" size={20} />
              </Pressable>
              <Text style={styles.logTopTitle}>Log Nutrition</Text>
              <Pressable style={styles.logTopIconBtn} onPress={() => setIsLogModalOpen(false)}>
                <MaterialCommunityIcons color={colors.textDim} name="help-circle-outline" size={20} />
              </Pressable>
            </View>

            <View style={styles.stepBarsRow}>
              {[1, 2, 3, 4].map((stepIndex) => (
                <View key={`step-${stepIndex}`} style={styles.stepBarCol}>
                  <View style={[styles.stepBarTrack, step >= stepIndex ? styles.stepBarTrackActive : null]} />
                  <Text style={[styles.stepBarLabel, step === stepIndex ? styles.stepBarLabelActive : null]}>Step {stepIndex}</Text>
                </View>
              ))}
            </View>

            <View style={styles.logHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepLabel}>{STEP_TITLES[step - 1]}</Text>
                <Text style={styles.stepDate}>{format(selectedDate, 'MMM dd, yyyy')}</Text>
              </View>
            </View>

            <View style={styles.logBody}>
              {step === 1 ? (
                <ScrollView contentContainerStyle={styles.stepScrollBody}>
                  <Text style={styles.stepSectionHeading}>Choose Event</Text>
                  <View style={styles.mealTypeGrid}>
                    {STEP_MEAL_OPTIONS.map((option) => {
                      const active = option === mealType;
                      const accent = mealTypeAccent(option);
                      const meta = STEP_EVENT_META[option] ?? STEP_EVENT_META.Breakfast;
                      return (
                        <Pressable key={option} style={[styles.eventCard, active && { borderColor: accent }]} onPress={() => setMealType(option)}>
                          <Image source={{ uri: meta.image }} style={styles.eventCardImage} />
                          <View style={styles.eventCardOverlay} />
                          <View style={styles.eventCardBody}>
                            <MaterialCommunityIcons color={active ? colors.primary : 'rgba(255,255,255,0.75)'} name={meta.icon} size={20} />
                            <Text style={[styles.eventCardTitle, active && styles.eventCardTitleActive]}>{option}</Text>
                          </View>
                          {active ? (
                            <View style={styles.eventCardCheck}>
                              <MaterialCommunityIcons color="#fff" name="check" size={14} />
                            </View>
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={styles.blockLabel}>Meal Notes</Text>
                  <TextInput
                    multiline
                    onChangeText={setNotes}
                    placeholder="Add meal context, timing, or notes..."
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    style={styles.notesInput}
                    value={notes}
                  />
                </ScrollView>
              ) : null}

              {step === 2 ? (
                <View style={{ gap: 10, flex: 1 }}>
                  <View style={styles.searchWrapHero}>
                    <MaterialCommunityIcons color={colors.textDim} name="magnify" size={20} />
                    <TextInput
                      autoFocus
                      onChangeText={setSearchQuery}
                      placeholder="Search for food or scan barcode..."
                      placeholderTextColor="rgba(255,255,255,0.4)"
                      style={styles.searchInput}
                      value={searchQuery}
                    />
                    <MaterialCommunityIcons color={colors.primary} name="barcode-scan" size={20} />
                  </View>

                  {foodsLoading ? <ActivityIndicator color={colors.primary} /> : null}

                  <FlatList
                    data={foodCandidates}
                    keyExtractor={(item) => String(item.food_id)}
                    renderItem={({ item }) => (
                      <Pressable style={styles.foodPickRow} onPress={() => addFood(item)}>
                        <View style={styles.foodPickImageStub}>
                          <MaterialCommunityIcons color={colors.primary} name="food-steak" size={20} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.foodPickName}>{item.name}</Text>
                          <Text style={styles.foodPickMeta}>
                            {Math.round(toNumber(item.calories_per_serving))} kcal, {Math.round(toNumber(item.protein_per_serving))} P, {Math.round(toNumber(item.carbs_per_serving))} C, {Math.round(toNumber(item.fat_per_serving))} F / 1 {item.unit_type || item.serving_type || 'g'}
                          </Text>
                        </View>
                        <MaterialCommunityIcons color={colors.primary} name="plus-circle-outline" size={22} />
                      </Pressable>
                    )}
                    style={{ maxHeight: 280 }}
                  />

                  {selectedFoods.length > 0 ? (
                    <View style={styles.stagedWrap}>
                      <Text style={styles.stagedTitle}>Selected Foods ({selectedFoods.length})</Text>
                      <View style={styles.stagedList}>
                        {selectedFoods.map((food) => (
                          <Pressable key={`staged-${food.food_id}`} style={styles.stagedChip} onPress={() => removeFood(food.food_id)}>
                            <Text style={styles.stagedChipText}>{food.name} ×</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {step === 3 ? (
                <ScrollView contentContainerStyle={styles.stepScrollBody}>
                  {selectedFoods.map((food) => (
                    <View key={`ratio-${food.food_id}`} style={styles.ratioCardModern}>
                      <View style={styles.ratioCardHead}>
                        <View style={styles.foodPickImageStub}>
                          <MaterialCommunityIcons color={colors.primary} name="food-apple" size={20} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.ratioName}>{food.name}</Text>
                          <Text style={styles.ratioUnit}>{Math.round(toNumber(food.calories_per_serving))} kcal/{food.unit_type || food.serving_type || 'serving'}</Text>
                        </View>
                      </View>

                      <View style={styles.stepperRow}>
                        <Pressable style={styles.stepperBtn} onPress={() => updateServings(food.food_id, food.servings - 0.5)}>
                          <MaterialCommunityIcons color={colors.textPrimary} name="minus" size={16} />
                        </Pressable>
                        <TextInput
                          keyboardType="decimal-pad"
                          onBlur={() => commitServingDraft(food.food_id)}
                          onChangeText={(v) => handleServingDraftChange(food.food_id, v)}
                          onSubmitEditing={() => commitServingDraft(food.food_id)}
                          style={styles.servingInput}
                          value={servingDrafts[food.food_id] ?? String(food.servings)}
                        />
                        <Pressable style={styles.stepperBtn} onPress={() => updateServings(food.food_id, food.servings + 0.5)}>
                          <MaterialCommunityIcons color="#fff" name="plus" size={16} />
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              ) : null}

              {step === 4 ? (
                <ScrollView contentContainerStyle={styles.stepScrollBody}>
                  <View style={styles.aggregateHeroBox}>
                    <Text style={styles.aggregateLabel}>Meal Total</Text>
                    <View style={styles.aggregateHeroValueRow}>
                      <Text style={styles.aggregateHeroValue}>{Math.round(totals.calories)}</Text>
                      <Text style={styles.aggregateHeroUnit}>kcal</Text>
                    </View>
                    <View style={styles.aggregateMacroBars}>
                      <MacroBar label="Protein" value={Math.round(totals.protein)} color={MACRO_COLORS.protein} pct={clampPercent(totals.protein, Math.max(1, goals.protein))} />
                      <MacroBar label="Carbs" value={Math.round(totals.carbs)} color={MACRO_COLORS.carbs} pct={clampPercent(totals.carbs, Math.max(1, goals.carbs))} />
                      <MacroBar label="Fat" value={Math.round(totals.fats)} color={MACRO_COLORS.fats} pct={clampPercent(totals.fats, Math.max(1, goals.fats))} />
                    </View>
                  </View>

                  <Text style={styles.blockLabel}>Summary for {mealType}</Text>
                  {selectedFoods.map((food) => (
                    <View key={`summary-${food.food_id}`} style={styles.summaryRow}>
                      <Text style={styles.summaryName}>{food.name}</Text>
                      <Text style={styles.summaryQty}>
                        {food.servings} {food.unit_type || food.serving_type || 'serving'}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              ) : null}
            </View>

            <View style={styles.logFooter}>
              <Pressable style={styles.prevBtn} onPress={() => (step === 1 ? setIsLogModalOpen(false) : setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4) : s)))}>
                <Text style={styles.prevBtnText}>{step === 1 ? 'Save Draft' : 'Back'}</Text>
              </Pressable>

              {step < 4 ? (
                <Pressable
                  style={[styles.nextBtn, step === 2 && selectedFoods.length === 0 && styles.disabledBtn]}
                  onPress={() => setStep((s) => (s < 4 ? ((s + 1) as 1 | 2 | 3 | 4) : s))}
                  disabled={step === 2 && selectedFoods.length === 0}
                >
                  <Text style={styles.nextBtnText}>Continue</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={[styles.finalBtn, (selectedFoods.length === 0 || submittingMeal) && styles.disabledBtn]}
                  onPress={() => void handleCreateMeal()}
                  disabled={selectedFoods.length === 0 || submittingMeal}
                >
                  <Text style={styles.finalBtnText}>{submittingMeal ? 'Saving...' : 'Log Meal'}</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {errorMessage ? (
        <Animated.View style={[styles.errorToast, { transform: [{ translateY: errorAnim }] }]}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </Animated.View>
      ) : null}
    </Screen>
  );
}

function MacroProgress({
  label,
  current,
  goal,
  unit,
  color,
}: {
  label: string;
  current: number;
  goal: number;
  unit: string;
  color: string;
}) {
  const width = `${clampPercent(current, goal)}%` as `${number}%`;
  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressHead}>
        <Text style={styles.progressLabel}>{label}</Text>
        <Text style={styles.progressValue}>
          {Math.round(current)} / {Math.round(goal)} {unit}
        </Text>
      </View>
      <View style={styles.progressTrackBar}>
        <View style={[styles.progressFillBar, { width, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniMetric}>
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={styles.miniValue}>{value}</Text>
    </View>
  );
}

function DetailMetric({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <View style={styles.detailMetric}>
      <Text style={[styles.detailMetricValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.detailMetricLabel}>{label}</Text>
    </View>
  );
}

function Nutrient({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.nutrientCell}>
      <Text style={styles.nutrientLabel}>{label}</Text>
      <Text style={styles.nutrientValue}>{value}</Text>
    </View>
  );
}

function MacroBar({ label, value, color, pct }: { label: string; value: number; color: string; pct: number }) {
  return (
    <View style={styles.aggregateMacroItem}>
      <Text style={styles.aggregateMacroLabel}>{label}</Text>
      <View style={styles.aggregateMacroValueRow}>
        <Text style={styles.aggregateMacroValue}>{value}</Text>
        <Text style={styles.aggregateMacroUnit}>g</Text>
      </View>
      <View style={styles.aggregateMacroTrack}>
        <View style={[styles.aggregateMacroFill, { width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#050505',
    gap: 14,
    paddingHorizontal: 14,
    paddingBottom: 96,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  systemStatus: {
    color: colors.primary,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.8,
    fontWeight: '800',
    marginBottom: 3,
  },
  dateText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(17,17,17,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateStrip: {
    gap: 8,
    paddingVertical: 4,
    paddingRight: 8,
  },
  dayBtn: {
    minWidth: 60,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  dayBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    transform: [{ scale: 1.06 }],
  },
  dayLabel: {
    color: colors.textDim,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  dayLabelActive: {
    color: '#fff',
  },
  dayNumber: {
    marginTop: 1,
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  dayNumberActive: {
    color: '#fff',
  },
  overviewCard: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#0c0c0c',
    borderRadius: 26,
    padding: 12,
    flexDirection: 'row',
    gap: 12,
  },
  donutWrap: {
    width: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  smallDim: {
    color: colors.textDim,
    textTransform: 'uppercase',
    fontSize: 9,
    fontWeight: '700',
  },
  calorieValue: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '900',
  },
  progressCol: {
    flex: 1,
    justifyContent: 'center',
    gap: 8,
  },
  progressWrap: {
    gap: 5,
  },
  progressHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    color: colors.textDim,
    fontSize: 10,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  progressValue: {
    color: colors.textPrimary,
    fontSize: 10,
    fontWeight: '800',
  },
  progressTrackBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFillBar: {
    height: '100%',
    borderRadius: 999,
  },
  waterCard: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 26,
    padding: 18,
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0c0c0c',
    overflow: 'hidden',
  },
  waterHeroIcon: {
    position: 'absolute',
    right: 16,
    top: 12,
  },
  waterTitle: {
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 2.4,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  waterCircle: {
    width: 136,
    height: 136,
    borderRadius: 68,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
  },
  waterFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(59,130,246,0.45)',
  },
  waterCenter: {
    alignItems: 'center',
  },
  waterValue: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '900',
  },
  waterGoal: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '700',
  },
  waterMetaRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  waterMetaText: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  waterProgressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  waterProgressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  waterPresetRow: {
    flexDirection: 'row',
    gap: 10,
  },
  waterPresetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  waterPresetLabel: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  customWaterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 8,
  },
  customWaterInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.textPrimary,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  customWaterAdd: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waterStatus: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionHeader: {
    marginTop: 2,
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.62)',
    fontWeight: '800',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.8,
  },
  emptyState: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.02)',
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '900',
  },
  emptySubtitle: {
    color: colors.textDim,
    fontSize: 12,
  },
  groupWrap: {
    gap: 8,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groupTitle: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  groupLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  mealCard: {
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderLeftWidth: 4,
    backgroundColor: '#11182766',
  },
  mealCardGap: {
    marginTop: 8,
  },
  mealRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  mealThumbWrap: {
    width: 64,
    height: 64,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  mealThumb: {
    width: '100%',
    height: '100%',
  },
  mealThumbShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  mealThumbIcon: {
    position: 'absolute',
  },
  mealContent: {
    flex: 1,
    gap: 4,
  },
  mealTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 6,
  },
  mealMeta: {
    color: 'rgba(148,163,184,0.9)',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
  },
  mealName: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
    marginRight: 8,
  },
  macroPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  macroPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillProtein: {
    borderColor: 'rgba(168,85,247,0.35)',
    backgroundColor: 'rgba(168,85,247,0.12)',
  },
  pillCarbs: {
    borderColor: 'rgba(59,130,246,0.35)',
    backgroundColor: 'rgba(59,130,246,0.12)',
  },
  pillFats: {
    borderColor: 'rgba(236,72,153,0.35)',
    backgroundColor: 'rgba(236,72,153,0.12)',
  },
  macroPillText: {
    color: colors.textPrimary,
    fontSize: 9,
    fontWeight: '800',
  },
  kcalBadge: {
    display: 'none',
  },
  kcalBadgeText: {
    display: 'none',
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  miniMetric: {
    minWidth: '22%',
  },
  miniLabel: {
    color: colors.textDim,
    fontSize: 9,
    textTransform: 'uppercase',
  },
  miniValue: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 18,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 7,
  },
  pendingMealCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  pendingMealIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(148,163,184,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.5)',
  },
  pendingMealCopy: {
    flex: 1,
  },
  pendingMealTitle: {
    color: 'rgba(148,163,184,0.9)',
    fontWeight: '800',
    fontSize: 14,
  },
  pendingMealSubtitle: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 3,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    padding: 16,
  },
  overlayStrong: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'flex-end',
  },
  detailModal: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: '#0c0c0c',
    maxHeight: '86%',
    overflow: 'hidden',
  },
  detailHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailType: {
    color: colors.primary,
    textTransform: 'uppercase',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  detailName: {
    color: colors.textPrimary,
    fontWeight: '900',
    fontSize: 24,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  closeCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailLoading: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailMacroRow: {
    paddingHorizontal: 12,
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailMetric: {
    alignItems: 'center',
    flex: 1,
  },
  detailMetricValue: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '900',
  },
  detailMetricLabel: {
    color: colors.textDim,
    fontSize: 10,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  foodList: {
    maxHeight: 320,
    marginTop: 8,
    paddingHorizontal: 12,
  },
  noFoodWrap: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  noFoodText: {
    color: colors.textDim,
    textAlign: 'center',
    fontSize: 12,
  },
  foodCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: 8,
    gap: 8,
  },
  foodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  foodName: {
    color: colors.textPrimary,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  foodServing: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 2,
  },
  foodKcal: {
    color: colors.primary,
    fontWeight: '900',
    fontSize: 10,
    marginTop: 1,
  },
  foodHeaderRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  foodNutrientGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  foodExtraWrap: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 8,
    marginTop: 2,
  },
  foodExtraEmpty: {
    color: colors.textDim,
    fontSize: 11,
  },
  nutrientCell: {
    width: '30%',
  },
  nutrientLabel: {
    color: colors.textDim,
    fontSize: 10,
  },
  nutrientValue: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 11,
  },
  detailFooter: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  deleteBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
    backgroundColor: 'rgba(239,68,68,0.1)',
    paddingVertical: 12,
    alignItems: 'center',
  },
  deleteBtnText: {
    color: '#ef4444',
    fontWeight: '800',
  },
  returnBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 12,
    alignItems: 'center',
  },
  returnBtnText: {
    color: colors.textPrimary,
    fontWeight: '800',
  },
  logSheet: {
    width: '100%',
    height: '93%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: '#0c0c0c',
    overflow: 'hidden',
  },
  logTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  logTopIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  logTopTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  stepBarsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  stepBarCol: {
    flex: 1,
    gap: 6,
  },
  stepBarTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  stepBarTrackActive: {
    backgroundColor: colors.primary,
  },
  stepBarLabel: {
    color: 'rgba(255,255,255,0.32)',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  stepBarLabelActive: {
    color: colors.primary,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 8,
  },
  stepLabel: {
    color: colors.primary,
    letterSpacing: 1.2,
    fontWeight: '800',
    fontSize: 16,
  },
  stepDate: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    marginTop: 2,
  },
  logBody: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  stepScrollBody: {
    gap: 12,
    paddingBottom: 12,
  },
  stepSectionHeading: {
    color: colors.textPrimary,
    fontSize: 32,
    fontWeight: '800',
  },
  blockLabel: {
    color: colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1.3,
    fontWeight: '700',
    fontSize: 11,
  },
  mealTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  eventCard: {
    width: '31.5%',
    minHeight: 114,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(17,24,39,0.55)',
    justifyContent: 'flex-end',
    position: 'relative',
    overflow: 'hidden',
  },
  eventCardImage: {
    ...StyleSheet.absoluteFillObject,
  },
  eventCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  eventCardBody: {
    padding: 10,
    gap: 6,
  },
  eventCardIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  eventCardTitle: {
    color: 'rgba(255,255,255,0.82)',
    fontWeight: '700',
    fontSize: 11,
  },
  eventCardTitleActive: {
    color: colors.textPrimary,
  },
  eventCardCheck: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesInput: {
    minHeight: 110,
    textAlignVertical: 'top',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: '#121212',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.textPrimary,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 22,
    paddingHorizontal: 14,
    backgroundColor: '#121212',
  },
  searchWrapHero: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 18,
    paddingHorizontal: 14,
    backgroundColor: '#111827',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    paddingVertical: 12,
  },
  foodPickImageStub: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(30,41,59,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  foodPickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  foodPickName: {
    color: colors.textPrimary,
    fontWeight: '800',
    fontSize: 16,
  },
  foodPickMeta: {
    color: colors.textDim,
    fontSize: 10,
    marginTop: 2,
  },
  stagedWrap: {
    gap: 6,
  },
  stagedTitle: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 11,
  },
  stagedList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stagedChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.3)',
    backgroundColor: 'rgba(59,130,246,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  stagedChipText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 10,
  },
  ratioCard: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    padding: 12,
    backgroundColor: '#121212',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  ratioCardModern: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    padding: 12,
    backgroundColor: '#121212',
    gap: 12,
  },
  ratioCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ratioName: {
    color: colors.textPrimary,
    fontWeight: '800',
    fontSize: 15,
  },
  ratioUnit: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 2,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepperBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnActive: {
    backgroundColor: colors.primary,
  },
  stepperBtnTxt: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    marginTop: -1,
  },
  servingInput: {
    width: 58,
    textAlign: 'center',
    color: colors.primary,
    fontWeight: '900',
    fontSize: 22,
    paddingVertical: 2,
  },
  aggregateBox: {
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.28)',
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderRadius: 20,
    padding: 14,
    gap: 10,
  },
  aggregateHeroBox: {
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.3)',
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderRadius: 22,
    padding: 18,
    gap: 14,
  },
  aggregateLabel: {
    color: colors.primary,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 2.4,
    fontSize: 10,
    textAlign: 'center',
  },
  aggregateHeroValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 8,
  },
  aggregateHeroValue: {
    color: colors.textPrimary,
    fontSize: 56,
    fontWeight: '900',
    lineHeight: 56,
  },
  aggregateHeroUnit: {
    color: colors.textDim,
    fontSize: 18,
    fontStyle: 'italic',
  },
  aggregateMacroBars: {
    flexDirection: 'row',
    gap: 10,
  },
  aggregateMacroItem: {
    flex: 1,
    gap: 6,
  },
  aggregateMacroLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  aggregateMacroValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  aggregateMacroValue: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  aggregateMacroUnit: {
    color: colors.textDim,
    fontSize: 11,
  },
  aggregateMacroTrack: {
    width: '100%',
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  aggregateMacroFill: {
    height: '100%',
    borderRadius: 999,
  },
  aggregateGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryRow: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  summaryName: {
    color: colors.textPrimary,
    fontWeight: '800',
    textTransform: 'uppercase',
    flex: 1,
  },
  summaryQty: {
    color: colors.textDim,
    fontSize: 12,
  },
  logFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  prevBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingVertical: 12,
  },
  prevBtnText: {
    color: colors.textDim,
    fontWeight: '700',
    fontSize: 12,
  },
  nextBtn: {
    flex: 2,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
  },
  finalBtn: {
    flex: 2,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
  },
  nextBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  finalBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  disabledBtn: {
    opacity: 0.4,
  },
  errorToast: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 20,
    borderRadius: 14,
    backgroundColor: '#ef4444',
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  errorText: {
    color: '#fff',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    fontWeight: '900',
    textAlign: 'center',
  },
});
