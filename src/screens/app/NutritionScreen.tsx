import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
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

  const groupedMeals = useMemo(() => {
    const map = new Map<MealGroupName, NormalisedMeal[]>();
    MEAL_GROUP_ORDER.forEach((group) => map.set(group, []));

    meals.forEach((meal) => {
      const group = mapMealTypeToGroup(meal.mealType);
      map.get(group)?.push(meal);
    });

    return MEAL_GROUP_ORDER.map((group) => ({ group, items: map.get(group) ?? [] }));
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
  }

  function removeFood(foodId: number) {
    setSelectedFoods((prev) => prev.filter((item) => item.food_id !== foodId));
  }

  function updateServings(foodId: number, nextValue: number) {
    const safe = Math.max(0.5, Math.round(nextValue * 2) / 2);
    setSelectedFoods((prev) => prev.map((item) => (item.food_id === foodId ? { ...item, servings: safe } : item)));
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
          <Text style={styles.title}>NUTRITION TERMINAL</Text>
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
            <Text style={styles.smallDim}>Goal {Math.round(goals.calories)}</Text>
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

      <View style={styles.waterCard}>
        <Text style={styles.waterTitle}>HYDRATION MATRIX</Text>
        <View style={styles.waterCircle}>
          <Animated.View
            style={[
              styles.waterFill,
              {
                height: waterAnim.interpolate({ inputRange: [0, 100], outputRange: [0, 128] }),
              },
            ]}
          />
          <View style={styles.waterCenter}>
            {isLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Text style={styles.waterValue}>{Math.round(macros.water)}</Text>
                <Text style={styles.waterGoal}>/ {Math.round(goals.water)} ML</Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.waterPresetRow}>
          <Pressable style={styles.waterPresetBtn} onPress={() => void executeAddWater(250)}>
            <MaterialCommunityIcons color={colors.primary} name="cup-water" size={20} />
            <Text style={styles.waterPresetLabel}>+250</Text>
          </Pressable>
          <Pressable style={styles.waterPresetBtn} onPress={() => void executeAddWater(500)}>
            <MaterialCommunityIcons color={colors.primary} name="water" size={20} />
            <Text style={styles.waterPresetLabel}>+500</Text>
          </Pressable>
        </View>

        <View style={styles.customWaterRow}>
          <TextInput
            keyboardType="number-pad"
            onChangeText={setCustomWater}
            onSubmitEditing={() => void executeAddWater(Number(customWater))}
            placeholder="Custom ML"
            placeholderTextColor="rgba(255,255,255,0.35)"
            style={styles.customWaterInput}
            value={customWater}
          />
          <Pressable style={styles.customWaterAdd} onPress={() => void executeAddWater(Number(customWater))}>
            <MaterialCommunityIcons color={colors.textPrimary} name="plus" size={20} />
          </Pressable>
        </View>

        <Text style={styles.waterStatus}>
          {clampPercent(macros.water, goals.water) >= 100 ? 'FULLY HYDRATED' : 'FUELING REQUIRED'}
        </Text>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>DAILY MEALS</Text>
      </View>

      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}

      {!isLoading && meals.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons color="rgba(255,255,255,0.12)" name="silverware-variant" size={52} />
          <Text style={styles.emptyTitle}>No Fuel Logged Today</Text>
          <Text style={styles.emptySubtitle}>Initialize performance tracking...</Text>
        </View>
      ) : null}

      {groupedMeals.map(({ group, items }) => {
        if (items.length === 0) return null;
        return (
          <View key={group} style={styles.groupWrap}>
            <View style={styles.groupHeader}>
              <Text style={styles.groupTitle}>{group}</Text>
              <View style={styles.groupLine} />
            </View>

            {items.map((meal, idx) => (
              <Pressable key={meal.meal_id} style={[styles.mealCard, idx > 0 && styles.mealCardGap]} onPress={() => void openMealDetail(meal)}>
                <View style={styles.mealTop}>
                  <View>
                    <Text style={styles.mealMeta}>{meal.time}</Text>
                    <Text style={styles.mealName}>{meal.name}</Text>
                  </View>
                  <View style={styles.kcalBadge}>
                    <Text style={styles.kcalBadgeText}>{Math.round(meal.calories)} KCAL</Text>
                  </View>
                </View>

                <View style={styles.macroRow}>
                  <MiniMetric label="Protein" value={`${Math.round(meal.protein)}g`} />
                  <MiniMetric label="Carbs" value={`${Math.round(meal.carbs)}g`} />
                  <MiniMetric label="Fats" value={`${Math.round(meal.fats)}g`} />
                  <MiniMetric label="Fiber" value={`${Math.round(meal.fiber)}g`} />
                </View>
              </Pressable>
            ))}
          </View>
        );
      })}

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
                  {selectedMealFoods.map((food, idx) => (
                    <View key={`${food.food_id ?? 'food'}-${idx}`} style={styles.foodCard}>
                      <View style={styles.foodHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.foodName}>{food.name}</Text>
                          <Text style={styles.foodServing}>
                            {food.numbers_of_serving ? `${food.numbers_of_serving} ${food.unit_type || 'unit'}` : food.unit_type || 'unit'}
                          </Text>
                        </View>
                        <Text style={styles.foodKcal}>{Math.round(food.calories)} KCAL</Text>
                      </View>

                      <View style={styles.foodNutrientGrid}>
                        <Nutrient label="Protein" value={fmtNutrient(food.protein, true)} />
                        <Nutrient label="Carbs" value={fmtNutrient(food.carbs, true)} />
                        <Nutrient label="Fats" value={fmtNutrient(food.fats, true)} />
                        <Nutrient label="Fiber" value={fmtNutrient(food.fiber, true)} />
                        <Nutrient label="Sugars" value={fmtNutrient(food.sugars, true)} />
                        <Nutrient label="Zinc" value={fmtNutrient(food.zinc)} />
                        <Nutrient label="Mag" value={fmtNutrient(food.magnesium)} />
                        <Nutrient label="Calcium" value={fmtNutrient(food.calcium)} />
                        <Nutrient label="Iron" value={fmtNutrient(food.iron)} />
                        <Nutrient label="Vit A" value={fmtNutrient(food.vitamin_a)} />
                        <Nutrient label="Vit C" value={fmtNutrient(food.vitamin_c)} />
                        <Nutrient label="B12" value={fmtNutrient(food.vitamin_b12)} />
                        <Nutrient label="Vit D" value={fmtNutrient(food.vitamin_d)} />
                      </View>
                    </View>
                  ))}
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
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${(step / 4) * 100}%` }]} />
            </View>

            <View style={styles.logHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepLabel}>Step {String(step).padStart(2, '0')} of 04</Text>
                <Text style={styles.stepTitle}>{STEP_TITLES[step - 1]}</Text>
                <Text style={styles.stepDate}>{format(selectedDate, 'MMM dd, yyyy')}</Text>
              </View>
              <Pressable style={styles.closeCircle} onPress={() => setIsLogModalOpen(false)}>
                <MaterialCommunityIcons color={colors.textPrimary} name="close" size={20} />
              </Pressable>
            </View>

            <View style={styles.logBody}>
              {step === 1 ? (
                <View style={{ gap: 12 }}>
                  <Text style={styles.blockLabel}>Select Target Meal</Text>
                  <View style={styles.mealTypeGrid}>
                    {STEP_MEAL_OPTIONS.map((option) => {
                      const active = option === mealType;
                      return (
                        <Pressable key={option} style={[styles.mealTypeBtn, active && styles.mealTypeBtnActive]} onPress={() => setMealType(option)}>
                          <MaterialCommunityIcons color={active ? colors.textPrimary : colors.textDim} name={mealTypeIcon(option)} size={18} />
                          <Text style={[styles.mealTypeTxt, active && styles.mealTypeTxtActive]}>{option}</Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={styles.blockLabel}>Performance Notes</Text>
                  <TextInput
                    multiline
                    onChangeText={setNotes}
                    placeholder="Add details about session timing or fueling feel..."
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    style={styles.notesInput}
                    value={notes}
                  />
                </View>
              ) : null}

              {step === 2 ? (
                <View style={{ gap: 10, flex: 1 }}>
                  <View style={styles.searchWrap}>
                    <TextInput
                      autoFocus
                      onChangeText={setSearchQuery}
                      placeholder="Search foods"
                      placeholderTextColor="rgba(255,255,255,0.4)"
                      style={styles.searchInput}
                      value={searchQuery}
                    />
                    <MaterialCommunityIcons color={colors.textDim} name="magnify" size={20} />
                  </View>

                  {foodsLoading ? <ActivityIndicator color={colors.primary} /> : null}

                  <FlatList
                    data={foodCandidates}
                    keyExtractor={(item) => String(item.food_id)}
                    renderItem={({ item }) => (
                      <Pressable style={styles.foodPickRow} onPress={() => addFood(item)}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.foodPickName}>{item.name}</Text>
                          <Text style={styles.foodPickMeta}>
                            {Math.round(toNumber(item.calories_per_serving))} KCAL per 1 {item.unit_type || item.serving_type || 'unit'}
                          </Text>
                        </View>
                        <MaterialCommunityIcons color={colors.primary} name="plus-circle-outline" size={22} />
                      </Pressable>
                    )}
                    style={{ maxHeight: 280 }}
                  />

                  {selectedFoods.length > 0 ? (
                    <View style={styles.stagedWrap}>
                      <Text style={styles.stagedTitle}>Staged Items ({selectedFoods.length})</Text>
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
                <ScrollView contentContainerStyle={{ gap: 10 }}>
                  {selectedFoods.map((food) => (
                    <View key={`ratio-${food.food_id}`} style={styles.ratioCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.ratioName}>{food.name}</Text>
                        <Text style={styles.ratioUnit}>UNIT: {food.unit_type || food.serving_type || 'unit'}</Text>
                      </View>

                      <View style={styles.stepperRow}>
                        <Pressable style={styles.stepperBtn} onPress={() => updateServings(food.food_id, food.servings - 0.5)}>
                          <Text style={styles.stepperBtnTxt}>-</Text>
                        </Pressable>
                        <TextInput
                          keyboardType="decimal-pad"
                          onChangeText={(v) => updateServings(food.food_id, Number(v) || 0.5)}
                          style={styles.servingInput}
                          value={String(food.servings)}
                        />
                        <Pressable style={styles.stepperBtn} onPress={() => updateServings(food.food_id, food.servings + 0.5)}>
                          <Text style={styles.stepperBtnTxt}>+</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              ) : null}

              {step === 4 ? (
                <View style={{ gap: 12 }}>
                  <View style={styles.aggregateBox}>
                    <Text style={styles.aggregateLabel}>Aggregate Nutrition</Text>
                    <View style={styles.aggregateGrid}>
                      <DetailMetric label="Calories" value={Math.round(totals.calories)} />
                      <DetailMetric color={MACRO_COLORS.protein} label="Protein" value={Math.round(totals.protein)} />
                      <DetailMetric color={MACRO_COLORS.carbs} label="Carbs" value={Math.round(totals.carbs)} />
                      <DetailMetric color={MACRO_COLORS.fats} label="Fats" value={Math.round(totals.fats)} />
                    </View>
                  </View>

                  <Text style={styles.blockLabel}>Summary for {mealType}</Text>
                  {selectedFoods.map((food) => (
                    <View key={`summary-${food.food_id}`} style={styles.summaryRow}>
                      <Text style={styles.summaryName}>{food.name}</Text>
                      <Text style={styles.summaryQty}>
                        {food.servings} {food.unit_type || 'units'}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            <View style={styles.logFooter}>
              {step > 1 ? (
                <Pressable style={styles.prevBtn} onPress={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4) : s))}>
                  <Text style={styles.prevBtnText}>Previous Phase</Text>
                </Pressable>
              ) : null}

              {step < 4 ? (
                <Pressable
                  style={[styles.nextBtn, step === 2 && selectedFoods.length === 0 && styles.disabledBtn]}
                  onPress={() => setStep((s) => (s < 4 ? ((s + 1) as 1 | 2 | 3 | 4) : s))}
                  disabled={step === 2 && selectedFoods.length === 0}
                >
                  <Text style={styles.nextBtnText}>Iterate Next</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={[styles.finalBtn, (selectedFoods.length === 0 || submittingMeal) && styles.disabledBtn]}
                  onPress={() => void handleCreateMeal()}
                  disabled={selectedFoods.length === 0 || submittingMeal}
                >
                  <Text style={styles.nextBtnText}>{submittingMeal ? 'Finalising...' : 'Finalise Data Entry'}</Text>
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
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  dateText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  dateStrip: {
    gap: 8,
    paddingVertical: 4,
    paddingRight: 8,
  },
  dayBtn: {
    minWidth: 60,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 16,
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
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  dayLabelActive: {
    color: '#fff',
  },
  dayNumber: {
    marginTop: 4,
    color: colors.textPrimary,
    fontSize: 20,
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
    padding: 14,
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0c0c0c',
  },
  waterTitle: {
    color: colors.textDim,
    letterSpacing: 3,
    fontSize: 10,
    fontWeight: '800',
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
    color: colors.textPrimary,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    fontWeight: '800',
    fontSize: 12,
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
    backgroundColor: '#121212',
    gap: 10,
  },
  mealCardGap: {
    marginTop: 8,
  },
  mealTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  mealMeta: {
    color: colors.textDim,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
  },
  mealName: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginTop: 3,
  },
  kcalBadge: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.35)',
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderRadius: 10,
  },
  kcalBadgeText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
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
  foodNutrientGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  stepLabel: {
    color: colors.primary,
    letterSpacing: 2,
    fontWeight: '800',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  stepTitle: {
    color: colors.textPrimary,
    fontSize: 30,
    fontWeight: '900',
    marginTop: 2,
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
    gap: 8,
  },
  mealTypeBtn: {
    width: '31%',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#121212',
    alignItems: 'center',
    gap: 4,
  },
  mealTypeBtnActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(59,130,246,0.12)',
  },
  mealTypeTxt: {
    color: colors.textDim,
    fontWeight: '700',
    fontSize: 11,
  },
  mealTypeTxtActive: {
    color: colors.textPrimary,
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
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    paddingVertical: 12,
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
  ratioName: {
    color: colors.textPrimary,
    fontWeight: '900',
    fontSize: 18,
    textTransform: 'uppercase',
  },
  ratioUnit: {
    color: colors.textDim,
    fontSize: 10,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 1,
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
  aggregateLabel: {
    color: colors.primary,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 2.4,
    fontSize: 10,
    textAlign: 'center',
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
    backgroundColor: '#fff',
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
    color: '#000',
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
