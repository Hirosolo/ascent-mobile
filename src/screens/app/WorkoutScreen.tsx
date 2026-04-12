import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { addMonths, endOfMonth, format, startOfMonth, subDays, addDays } from 'date-fns';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Svg, { Circle } from 'react-native-svg';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Screen } from '@/components/ui/Screen';
import { getSummary } from '@/services/summary';
import { addExercisesToWorkout, createWorkout, deleteWorkout, getExercises, getWorkoutDayPlans, getWorkouts } from '@/services/workouts';
import { colors } from '@/theme/tokens';
import { Exercise, WorkoutDayPlan, WorkoutSession } from '@/types/api';

type CalendarCell = {
  key: string;
  day: number;
  date: string;
  currentMonth: boolean;
};

const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#A855F7', '#14B8A6', '#64748B'];
const SESSION_TYPE_OPTIONS = ['Strength', 'Push', 'Pull', 'Legs', 'Cardio', 'Full Body'];

type PlannedExercise = {
  exercise_id: number;
  name: string;
  planned_sets: number;
  planned_reps: number;
};

type ExerciseOption = {
  exercise_id: number;
  name: string;
  category?: string;
};

export function WorkoutScreen() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => todayKey);
  const [sessionType, setSessionType] = useState('Strength');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2>(1);
  const [createDate, setCreateDate] = useState(todayKey);
  const [createType, setCreateType] = useState('Strength');
  const [createNote, setCreateNote] = useState('');
  const [isCreateTypeOpen, setIsCreateTypeOpen] = useState(false);
  const [isPlanSelectorOpen, setIsPlanSelectorOpen] = useState(false);
  const [plannedExercises, setPlannedExercises] = useState<PlannedExercise[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const monthKey = format(currentMonth, 'yyyy-MM');

  const workoutsQuery = useQuery({
    queryKey: ['workouts', monthKey],
    queryFn: () => getWorkouts(monthKey),
  });

  const summaryQuery = useQuery({
    queryKey: ['summary', monthKey],
    queryFn: () => getSummary(monthKey),
  });

  const exercisesQuery = useQuery({
    queryKey: ['exercises-master'],
    queryFn: () => getExercises(),
    enabled: isCreateModalOpen,
  });

  const plansQuery = useQuery({
    queryKey: ['workout-day-plans'],
    queryFn: () => getWorkoutDayPlans(),
    enabled: isCreateModalOpen,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const created = await createWorkout({
        scheduled_date: createDate,
        type: createType || 'Strength',
        notes: createNote.trim() || undefined,
        exercises: [],
      });

      if (plannedExercises.length > 0) {
        await addExercisesToWorkout(
          created.session_id,
          plannedExercises.map((ex) => ({
            exercise_id: ex.exercise_id,
            planned_sets: ex.planned_sets,
            planned_reps: ex.planned_reps,
          })),
        );
      }
    },
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workouts', monthKey] }),
        queryClient.invalidateQueries({ queryKey: ['summary', monthKey] }),
      ]);
      setIsCreateModalOpen(false);
      setCreateStep(1);
      setCreateNote('');
      setPlannedExercises([]);
      setSelectedPlanId(null);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to create workout';
      Alert.alert('Create Session Failed', message);
    },
  });

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, WorkoutSession[]>();
    for (const session of workoutsQuery.data ?? []) {
      const key = session.scheduled_date.slice(0, 10);
      const existing = map.get(key) ?? [];
      existing.push(session);
      map.set(key, existing);
    }
    return map;
  }, [workoutsQuery.data]);

  const calendarCells = useMemo<CalendarCell[]>(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const dayCount = end.getDate();
    const firstWeekday = start.getDay();

    const cells: CalendarCell[] = [];

    for (let i = 0; i < firstWeekday; i += 1) {
      const prevDate = new Date(start);
      prevDate.setDate(start.getDate() - (firstWeekday - i));
      cells.push({
        key: `prev-${i}`,
        day: prevDate.getDate(),
        date: format(prevDate, 'yyyy-MM-dd'),
        currentMonth: false,
      });
    }

    for (let day = 1; day <= dayCount; day += 1) {
      const dateObj = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      cells.push({
        key: `curr-${day}`,
        day,
        date: format(dateObj, 'yyyy-MM-dd'),
        currentMonth: true,
      });
    }

    let nextOffset = 1;
    while (cells.length % 7 !== 0) {
      const nextDate = new Date(end);
      nextDate.setDate(end.getDate() + nextOffset);
      cells.push({
        key: `next-${cells.length}`,
        day: nextDate.getDate(),
        date: format(nextDate, 'yyyy-MM-dd'),
        currentMonth: false,
      });
      nextOffset += 1;
    }

    return cells;
  }, [currentMonth]);

  const selectedSessions = sessionsByDate.get(selectedDate) ?? [];

  const muscleSplit = useMemo(() => {
    return [...(summaryQuery.data?.muscle_split ?? [])].sort((a, b) => b.value - a.value);
  }, [summaryQuery.data?.muscle_split]);

  const focusItems = muscleSplit.slice(0, 3);
  const focusPrimary = focusItems[0];
  const focusLabel = focusItems.length > 1 ? `${focusItems[0].name}/${focusItems[1].name}` : focusItems[0]?.name ?? 'No data';
  const monthLabel = format(currentMonth, 'MMMM yyyy');
  const protocolSessions = selectedSessions;
  const grScore = summaryQuery.data?.gr_score ?? 0;
  const grChange = summaryQuery.data?.gr_score_change ?? 0;
  const selectedDateLabel = format(new Date(selectedDate), 'dd MMM yyyy');
  const totalWorkouts = summaryQuery.data?.total_workouts ?? 0;

  const deleteSessionMutation = useMutation({
    mutationFn: (sessionId: number) => deleteWorkout(sessionId),
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workouts', monthKey] }),
        queryClient.invalidateQueries({ queryKey: ['summary', monthKey] }),
      ]);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to delete workout session';
      Alert.alert('Delete Failed', message);
    },
  });

  const openCreateModal = () => {
    setCreateDate(selectedDate);
    setCreateType(sessionType);
    setCreateNote('');
    setCreateStep(1);
    setPlannedExercises([]);
    setSelectedPlanId(null);
    setExerciseSearch('');
    setIsCreateTypeOpen(false);
    setIsPlanSelectorOpen(false);
    setIsCreateModalOpen(true);
  };

  const applyPlan = (plan: WorkoutDayPlan) => {
    setSelectedPlanId(plan.plan_id);
    setIsPlanSelectorOpen(false);
    if (plan.type) {
      setCreateType(plan.type);
      setSessionType(plan.type);
    }

    const plannedFromTemplate = (plan.exercises || [])
      .map((item, index) => ({
        exercise_id: item.exercise_id,
        name: item.exercise?.name || `Exercise ${item.exercise_id}`,
        planned_sets: Math.max(1, Number(item.planned_sets || 1)),
        planned_reps: Math.max(1, Number(item.planned_reps || 1)),
        sort_order: item.sort_order ?? index,
      }))
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(({ sort_order: _sort, ...exercise }) => exercise);

    setPlannedExercises(plannedFromTemplate);
  };

  const addPlannedExercise = (exercise: ExerciseOption) => {
    setPlannedExercises((prev) => {
      if (prev.some((p) => p.exercise_id === exercise.exercise_id)) return prev;
      return [...prev, { exercise_id: exercise.exercise_id, name: exercise.name, planned_sets: 3, planned_reps: 10 }];
    });
  };

  const patchPlannedExercise = (exerciseId: number, patch: Partial<PlannedExercise>) => {
    setPlannedExercises((prev) => prev.map((item) => (item.exercise_id === exerciseId ? { ...item, ...patch } : item)));
  };

  const removePlannedExercise = (exerciseId: number) => {
    setPlannedExercises((prev) => prev.filter((item) => item.exercise_id !== exerciseId));
  };

  const exerciseOptions = useMemo<ExerciseOption[]>(() => {
    const rawList = Array.isArray(exercisesQuery.data) ? exercisesQuery.data : [];
    const seen = new Set<number>();

    return rawList
      .map((item, index) => {
        const source = item as Exercise & { id?: number; title?: string };
        const resolvedId = Number(source.exercise_id ?? source.id ?? 0) || index + 1;
        const resolvedName = source.name ?? source.title ?? `Exercise ${resolvedId}`;
        return { exercise_id: resolvedId, name: resolvedName, category: source.category || 'General' };
      })
      .filter((item) => {
        if (seen.has(item.exercise_id)) return false;
        seen.add(item.exercise_id);
        return true;
      });
  }, [exercisesQuery.data]);

  const groupedExerciseOptions = useMemo(() => {
    const query = exerciseSearch.trim().toLowerCase();
    const filtered = query
      ? exerciseOptions.filter((item) => item.name.toLowerCase().includes(query))
      : exerciseOptions;

    const groups = new Map<string, ExerciseOption[]>();
    filtered.forEach((item) => {
      const key = item.category || 'General';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    });

    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, items]) => ({
        category,
        items: items.sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [exerciseOptions, exerciseSearch]);

  const selectedPlan = useMemo(() => {
    if (!selectedPlanId) return null;
    return (plansQuery.data || []).find((plan) => plan.plan_id === selectedPlanId) ?? null;
  }, [plansQuery.data, selectedPlanId]);

  const confirmDeleteSession = (sessionId: number) => {
    Alert.alert('Delete Session', 'This will permanently delete this workout session.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteSessionMutation.mutate(sessionId) },
    ]);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([workoutsQuery.refetch(), summaryQuery.refetch()]);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Screen
      scroll
      contentStyle={styles.screen}
      refreshing={isRefreshing}
      onRefresh={handleRefresh}
      overlay={(
        <Pressable style={styles.fabButton} onPress={openCreateModal}>
          <MaterialCommunityIcons color="#ffffff" name="plus" size={30} />
        </Pressable>
      )}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>Command Center</Text>
          <Text style={styles.title}>ASCENT</Text>
        </View>
        <Pressable style={styles.profileBtn} onPress={() => navigation.navigate('PlanDayManager')}>
          <MaterialCommunityIcons color={colors.primary} name="clipboard-text-outline" size={24} />
        </Pressable>
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>GR</Text>
          <Text style={styles.metricValue}>
            {grScore}
          </Text>
          <View style={styles.metricTrendRow}>
            <MaterialCommunityIcons color={grChange >= 0 ? '#34d399' : '#f87171'} name={grChange >= 0 ? 'trending-up' : 'trending-down'} size={14} />
            <Text style={[styles.metricTrendText, grChange < 0 && styles.metricTrendTextDown]}>
              {grChange >= 0 ? '+' : ''}{grChange} GR vs last month
            </Text>
          </View>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Workouts</Text>
          <Text style={styles.metricValue}>
            {totalWorkouts}
            <Text style={styles.metricUnit}> this month</Text>
          </Text>
          <View style={styles.metricTrendRow}>
            <MaterialCommunityIcons color={colors.primary} name="fire" size={14} />
            <Text style={styles.metricTrendText}>Best streak {summaryQuery.data?.longest_streak ?? 0} days</Text>
          </View>
        </View>
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeaderRow}>
          <View>
            <Text style={styles.sectionHeading}>Muscle Focus</Text>
          </View>
          <View style={styles.panelBadge}>
            <Text style={styles.panelBadgeText}>{monthLabel}</Text>
          </View>
        </View>

        {focusItems.length === 0 ? (
          <Text style={styles.muted}>No completed sessions for this month yet.</Text>
        ) : (
          <View style={styles.focusRow}>
            <View style={styles.focusChartWrap}>
              <Svg height={160} viewBox="0 0 160 160" width={160}>
                <Circle cx="80" cy="80" fill="transparent" r="46" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
                {focusItems.map((item, idx) => {
                  const radius = 46 - idx * 8;
                  const circumference = 2 * Math.PI * radius;
                  const progress = Math.max(0, Math.min(100, item.value));
                  const offset = circumference * (1 - progress / 100);

                  return (
                    <Circle
                      key={item.name}
                      cx="80"
                      cy="80"
                      fill="transparent"
                      r={radius}
                      rotation="-90"
                      origin="80, 80"
                      stroke={PIE_COLORS[idx % PIE_COLORS.length]}
                      strokeDasharray={`${circumference} ${circumference}`}
                      strokeDashoffset={offset}
                      strokeLinecap="round"
                      strokeWidth="8"
                    />
                  );
                })}
              </Svg>

              <View style={styles.focusCenterLabel}>
                <Text style={styles.focusPercent}>{Math.round(focusPrimary?.value ?? 0)}%</Text>
                <Text style={styles.focusCaption}>{focusLabel}</Text>
              </View>
            </View>

            <View style={styles.focusLegend}>
              {focusItems.map((item, idx) => (
                <View key={item.name} style={styles.focusLegendRow}>
                  <View style={[styles.legendDotLarge, { backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }]} />
                  <View style={styles.focusLegendTextWrap}>
                    <Text style={styles.focusLegendTitle}>{item.name}</Text>
                    <Text style={styles.focusLegendSub}>{Math.round(item.value)}% split</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeaderRow}>
          <Text style={styles.sectionHeading}>Activity Grid</Text>
          <View style={styles.monthNav}>
            <Pressable onPress={() => setCurrentMonth((prev) => addMonths(prev, -1))}>
              <MaterialCommunityIcons color="rgba(244,244,245,0.55)" name="chevron-left" size={18} />
            </Pressable>
            <Text style={styles.monthLabel}>{format(currentMonth, 'MMMM')}</Text>
            <Pressable onPress={() => setCurrentMonth((prev) => addMonths(prev, 1))}>
              <MaterialCommunityIcons color="rgba(244,244,245,0.55)" name="chevron-right" size={18} />
            </Pressable>
          </View>
        </View>

        <View style={styles.weekRow}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, index) => (
            <Text key={`${d}-${index}`} style={styles.weekCell}>{d}</Text>
          ))}
        </View>

        <View style={styles.calendarGrid}>
          {calendarCells.map((cell) => {
            const isSelected = selectedDate === cell.date;
            const isToday = cell.date === todayKey;
            const hasSession = (sessionsByDate.get(cell.date) ?? []).length > 0;
            return (
              <Pressable
                key={cell.key}
                onPress={() => setSelectedDate(cell.date)}
                style={[
                  styles.dayCell,
                  !cell.currentMonth && styles.dayCellOutside,
                  isSelected && styles.daySelected,
                  hasSession && !isSelected && styles.dayHasSession,
                ]}
              >
                <Text style={[styles.dayText, !cell.currentMonth && styles.dayOut, isSelected && styles.dayTextSelected]}>{cell.day}</Text>
                {isToday ? <View style={styles.dot} /> : null}
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.selectedDayHint}>Selected: {selectedDateLabel}</Text>
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeaderRow}>
          <Text style={styles.sectionHeading}>Workout Sessions</Text>
          <Pressable style={styles.panelBadge} onPress={() => navigation.navigate('PlanDayManager')}>
            <Text style={styles.panelBadgeText}>{selectedDateLabel}</Text>
          </Pressable>
        </View>

        {protocolSessions.length === 0 ? <Text style={styles.muted}>No workout sessions on the selected day.</Text> : null}

        {protocolSessions.map((item, index) => {
          const iconTone = item.status === 'COMPLETED' ? '#10b981' : index % 2 === 0 ? colors.primary : '#60a5fa';
          const iconName = item.type?.toLowerCase() === 'cardio' ? 'run' : 'dumbbell';
          const sessionMeta = item.notes?.trim()
            ? item.notes.trim()
            : `${format(new Date(item.scheduled_date), 'MMM d')} • ${item.status}${item.gr_score ? ` • GR ${item.gr_score}` : ''}`;

          return (
            <Pressable
              key={item.session_id}
              onPress={() => navigation.navigate('WorkoutDetail', { sessionId: item.session_id })}
              onLongPress={() => confirmDeleteSession(item.session_id)}
              style={styles.sessionRow}
            >
              <View style={[styles.sessionIconBox, { borderColor: `${iconTone}55`, backgroundColor: `${iconTone}18` }]}>
                <MaterialCommunityIcons color={iconTone} name={iconName} size={20} />
              </View>
              <View style={styles.sessionContent}>
                <Text style={styles.sessionTitle}>{item.type ?? 'Workout Session'}</Text>
                <Text style={styles.sessionSub}>{sessionMeta}</Text>
              </View>
              <View style={styles.sessionRight}>
                <Text style={[styles.badge, item.status === 'COMPLETED' ? styles.done : styles.progress]}>{item.status}</Text>
                <MaterialCommunityIcons color="rgba(244,244,245,0.4)" name="chevron-right" size={20} />
              </View>
            </Pressable>
          );
        })}
      </View>

      <Modal
        transparent
        animationType="slide"
        visible={isCreateModalOpen}
        onRequestClose={() => setIsCreateModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainerGlass}>
            <View style={styles.modalHeader}>
              <Pressable style={styles.modalBackBtn} onPress={() => setIsCreateModalOpen(false)}>
                <MaterialCommunityIcons color={colors.textPrimary} name="arrow-left" size={24} />
              </Pressable>
              <View style={styles.modalHeaderText}>
                <Text style={styles.modalHeaderKicker}>Create Session</Text>
                <Text style={styles.modalHeaderTitle}>NEW WORKOUT</Text>
              </View>
              <Pressable style={styles.modalCloseBtn} onPress={() => setIsCreateModalOpen(false)}>
                <MaterialCommunityIcons color={colors.textDim} name="close" size={24} />
              </Pressable>
            </View>

            <View style={styles.stepTrack}>
              <View style={[styles.stepTrackBar, { width: `${(createStep / 2) * 100}%` }]} />
            </View>

            {createStep === 1 ? (
              <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
                <View style={styles.formCard}>
                  <Text style={styles.formLabel}>DATE</Text>
                  <View style={styles.dateNavRow}>
                    <Pressable style={styles.dateNavBtn} onPress={() => setCreateDate(format(subDays(new Date(createDate), 1), 'yyyy-MM-dd'))}>
                      <MaterialCommunityIcons color={colors.textDim} name="chevron-left" size={20} />
                    </Pressable>
                    <Text style={styles.dateValue}>{format(new Date(createDate), 'dd MMM yyyy')}</Text>
                    <Pressable style={styles.dateNavBtn} onPress={() => setCreateDate(format(addDays(new Date(createDate), 1), 'yyyy-MM-dd'))}>
                      <MaterialCommunityIcons color={colors.textDim} name="chevron-right" size={20} />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.formCard}>
                  <Text style={styles.formLabel}>SESSION TYPE</Text>
                  <View style={styles.typeChipsRow}>
                    {SESSION_TYPE_OPTIONS.map((option) => (
                      <Pressable
                        key={option}
                        style={[
                          styles.typeChip,
                          createType === option && styles.typeChipActive,
                        ]}
                        onPress={() => setCreateType(option)}
                      >
                        <Text style={[styles.typeChipText, createType === option && styles.typeChipTextActive]}>
                          {option}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.formCard}>
                  <Text style={styles.formLabel}>PLANNED DAY TEMPLATE</Text>
                  <Pressable
                    onPress={() => setIsPlanSelectorOpen((prev) => !prev)}
                    style={styles.selectField}
                  >
                    <View style={styles.selectFieldContent}>
                      <Text style={styles.selectFieldValue}>{selectedPlan?.name || 'None (Manual)'}</Text>
                      <MaterialCommunityIcons
                        color={colors.textDim}
                        name={isPlanSelectorOpen ? 'chevron-up' : 'chevron-down'}
                        size={20}
                      />
                    </View>
                  </Pressable>
                  {isPlanSelectorOpen && (
                    <View style={styles.selectDropdown}>
                      <Pressable
                        onPress={() => {
                          setSelectedPlanId(null);
                          setPlannedExercises([]);
                          setIsPlanSelectorOpen(false);
                        }}
                        style={styles.dropdownOption}
                      >
                        <Text style={styles.dropdownOptionText}>None (Manual)</Text>
                      </Pressable>
                      {(plansQuery.data || []).map((plan) => (
                        <Pressable
                          key={plan.plan_id}
                          onPress={() => applyPlan(plan)}
                          style={styles.dropdownOption}
                        >
                          <Text style={styles.dropdownOptionText}>{plan.name}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>

                <View style={styles.formCard}>
                  <Text style={styles.formLabel}>NOTE</Text>
                  <TextInput
                    value={createNote}
                    onChangeText={setCreateNote}
                    placeholder="Add notes about this session..."
                    placeholderTextColor={colors.textDim}
                    style={styles.noteInput}
                    multiline
                    numberOfLines={3}
                  />
                </View>
              </ScrollView>
            ) : (
              <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
                <View style={styles.formCard}>
                  <Text style={styles.formLabel}>ADD EXERCISES</Text>
                  <View style={styles.searchFieldGlass}>
                    <MaterialCommunityIcons color={colors.textDim} name="magnify" size={18} />
                    <TextInput
                      value={exerciseSearch}
                      onChangeText={setExerciseSearch}
                      placeholder="Search exercises..."
                      placeholderTextColor={colors.textDim}
                      style={styles.searchFieldInput}
                    />
                  </View>

                  <ScrollView style={styles.exercisePickerList} nestedScrollEnabled>
                    {groupedExerciseOptions.length === 0 && exercisesQuery.isLoading ? (
                      <Text style={styles.mutedText}>Loading exercises...</Text>
                    ) : null}
                    {groupedExerciseOptions.length === 0 && !exercisesQuery.isLoading ? (
                      <Text style={styles.mutedText}>No exercises found</Text>
                    ) : null}
                    {groupedExerciseOptions.map((group) => (
                      <View key={group.category}>
                        <Text style={styles.groupCategoryLabel}>{group.category}</Text>
                        {group.items.map((exercise) => {
                          const alreadyAdded = plannedExercises.some((p) => p.exercise_id === exercise.exercise_id);
                          return (
                            <Pressable
                              key={exercise.exercise_id}
                              style={styles.exercisePickerCard}
                              onPress={() => addPlannedExercise(exercise)}
                            >
                              <View style={styles.exercisePickerIconBox}>
                                <MaterialCommunityIcons color={colors.primary} name="dumbbell" size={16} />
                              </View>
                              <View style={styles.exercisePickerInfo}>
                                <Text style={styles.exercisePickerName}>{exercise.name}</Text>
                              </View>
                              <View style={[styles.addBadge, alreadyAdded && styles.addBadgeActive]}>
                                <Text style={[styles.addBadgeText, alreadyAdded && styles.addBadgeTextActive]}>
                                  {alreadyAdded ? '✓' : '+'}
                                </Text>
                              </View>
                            </Pressable>
                          );
                        })}
                      </View>
                    ))}
                  </ScrollView>
                </View>

                {plannedExercises.length > 0 ? (
                  <View style={styles.formCard}>
                    <View style={styles.selectedExercisesHead}>
                      <Text style={styles.sectionTitle}>Selected</Text>
                      <Text style={styles.sectionMeta}>{plannedExercises.length}</Text>
                    </View>
                    {plannedExercises.map((item, idx) => (
                      <View key={item.exercise_id} style={styles.selectedExerciseCard}>
                        <View style={styles.selectedExerciseHead}>
                          <Text style={styles.selectedExerciseIndex}>{idx + 1}</Text>
                          <View style={styles.selectedExerciseInfo}>
                            <Text style={styles.selectedExerciseName}>{item.name}</Text>
                          </View>
                          <Pressable style={styles.removeExerciseBtn} onPress={() => removePlannedExercise(item.exercise_id)}>
                            <MaterialCommunityIcons color={colors.textDim} name="close" size={16} />
                          </Pressable>
                        </View>
                        <View style={styles.selectedExerciseInputs}>
                          <View style={styles.inputGroupSmall}>
                            <Text style={styles.inputGroupLabel}>SETS</Text>
                            <TextInput
                              style={styles.setRepsInputSmall}
                              keyboardType="numeric"
                              value={String(item.planned_sets)}
                              onChangeText={(v) => patchPlannedExercise(item.exercise_id, { planned_sets: Math.max(1, Number(v.replace(/[^0-9]/g, '')) || 1) })}
                            />
                          </View>
                          <View style={styles.inputGroupSmall}>
                            <Text style={styles.inputGroupLabel}>REPS</Text>
                            <TextInput
                              style={styles.setRepsInputSmall}
                              keyboardType="numeric"
                              value={String(item.planned_reps)}
                              onChangeText={(v) => patchPlannedExercise(item.exercise_id, { planned_reps: Math.max(1, Number(v.replace(/[^0-9]/g, '')) || 1) })}
                            />
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}
              </ScrollView>
            )}

            <View style={styles.modalFooter}>
              <Pressable style={styles.cancelBtn} onPress={() => (createStep === 1 ? setIsCreateModalOpen(false) : setCreateStep(1))}>
                <Text style={styles.cancelBtnText}>{createStep === 1 ? 'Cancel' : 'Back'}</Text>
              </Pressable>
              <Pressable
                style={[styles.createBtn, !((createStep === 1 && createType) || (createStep === 2 && plannedExercises.length > 0)) && styles.createBtnDisabled]}
                onPress={() => {
                  if (createStep === 1) {
                    if (!createType) {
                      Alert.alert('Validation', 'Please select a session type');
                      return;
                    }
                    setCreateStep(2);
                    return;
                  }
                  if (plannedExercises.length === 0) {
                    Alert.alert('Validation', 'Please add at least one exercise');
                    return;
                  }
                  createMutation.mutate();
                }}
                disabled={!((createStep === 1 && createType) || (createStep === 2 && plannedExercises.length > 0)) || createMutation.isPending}
              >
                <Text style={styles.createBtnText}>
                  {createMutation.isPending ? 'CREATING...' : createStep === 1 ? 'NEXT' : 'CREATE SESSION'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#060709',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 18,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.25)',
    backgroundColor: 'rgba(59,130,246,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startSessionBtn: {
    borderRadius: 16,
    backgroundColor: colors.primary,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: colors.primary,
    shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 24,
    elevation: 8,
  },
  startSessionText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  kicker: {
    color: colors.primary,
    fontSize: 10,
    letterSpacing: 3,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(244,244,245,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: 'rgba(10,11,14,0.92)',
    gap: 4,
    borderRadius: 18,
  },
  metricLabel: {
    color: 'rgba(244,244,245,0.45)',
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  metricValue: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: '900',
  },
  metricUnit: {
    color: 'rgba(244,244,245,0.4)',
    fontSize: 12,
    fontWeight: '500',
  },
  metricTrendRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricTrendText: {
    color: '#60a5fa',
    fontSize: 11,
    fontWeight: '600',
  },
  metricTrendTextDown: {
    color: '#f87171',
  },
  panel: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 16,
    gap: 14,
    borderRadius: 22,
  },
  panelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionHeading: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  panelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  panelBadgeText: {
    color: 'rgba(244,244,245,0.62)',
    fontSize: 11,
    fontWeight: '600',
  },
  muted: {
    color: 'rgba(244,244,245,0.5)',
    textAlign: 'center',
    marginTop: 8,
  },
  focusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  focusChartWrap: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  focusCenterLabel: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 96,
  },
  focusPercent: {
    color: colors.textPrimary,
    fontSize: 30,
    fontWeight: '900',
  },
  focusCaption: {
    color: 'rgba(244,244,245,0.45)',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  focusLegend: {
    flex: 1,
    gap: 14,
  },
  focusLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  legendDotLarge: {
    width: 12,
    height: 12,
    borderRadius: 999,
  },
  focusLegendTextWrap: {
    flex: 1,
  },
  focusLegendTitle: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  focusLegendSub: {
    color: 'rgba(244,244,245,0.45)',
    fontSize: 11,
    marginTop: 2,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  monthLabel: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    minWidth: 68,
    textAlign: 'center',
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekCell: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    color: 'rgba(244,244,245,0.35)',
    fontSize: 10,
    fontWeight: '900',
    marginBottom: 4,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dayCell: {
    width: '13.1%',
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'rgba(30,41,59,0.3)',
    borderRadius: 12,
    gap: 4,
  },
  dayCellOutside: {
    backgroundColor: 'transparent',
  },
  daySelected: {
    backgroundColor: colors.primary,
  },
  dayHasSession: {
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderColor: 'rgba(59,130,246,0.3)',
  },
  dayText: {
    color: colors.textPrimary,
    fontSize: 12,
  },
  dayTextSelected: {
    fontWeight: '700',
    color: '#ffffff',
  },
  dayOut: {
    color: 'rgba(244,244,245,0.35)',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  selectedDayHint: {
    color: 'rgba(244,244,245,0.42)',
    fontSize: 11,
    fontWeight: '600',
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(12,14,18,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(244,244,245,0.12)',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  sessionIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sessionContent: {
    flex: 1,
  },
  sessionRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  sessionTitle: {
    color: colors.textPrimary,
    fontWeight: '800',
    fontSize: 14,
  },
  sessionSub: {
    color: 'rgba(244,244,245,0.5)',
    marginTop: 3,
    fontSize: 12,
  },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: 'hidden',
  },
  done: {
    color: colors.primary,
    backgroundColor: 'rgba(59,130,246,0.16)',
  },
  progress: {
    color: colors.accent,
    backgroundColor: 'rgba(37,99,235,0.18)',
  },
  fabButton: {
    position: 'absolute',
    right: 22,
    bottom: 26,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContainerGlass: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: 'rgba(8, 10, 14, 0.98)',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderTopColor: 'rgba(59, 130, 246, 0.15)',
    borderLeftColor: 'rgba(59, 130, 246, 0.15)',
    borderRightColor: 'rgba(59, 130, 246, 0.15)',
    maxHeight: '92%',
    overflow: 'hidden',
    flex: 1,
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(59, 130, 246, 0.15)',
  },
  modalBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderText: {
    flex: 1,
  },
  modalHeaderKicker: {
    color: colors.primary,
    fontSize: 10,
    letterSpacing: 2.0,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  modalHeaderTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  stepTrack: {
    height: 3,
    backgroundColor: 'rgba(244, 244, 245, 0.08)',
    overflow: 'hidden',
  },
  stepTrackBar: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    paddingVertical: 16,
    paddingHorizontal: 14,
    gap: 14,
    flexGrow: 1,
  },
  formCard: {
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    backgroundColor: 'rgba(15, 17, 21, 0.65)',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 10,
    borderRadius: 8,
  },
  formLabel: {
    color: colors.textDim,
    fontSize: 10,
    letterSpacing: 2.0,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  // Date input styling
  dateNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  dateNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  dateValue: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    flex: 1,
  },
  // Type chips
  typeChipsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  typeChip: {
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    backgroundColor: 'rgba(5, 7, 10, 0.8)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  typeChipActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  typeChipText: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '600',
  },
  typeChipTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  // Select field styling
  selectField: {
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    backgroundColor: 'rgba(5, 7, 10, 0.8)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  selectFieldContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectFieldValue: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  selectDropdown: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.15)',
    backgroundColor: 'rgba(5, 7, 10, 0.9)',
    borderRadius: 6,
    overflow: 'hidden',
    maxHeight: 200,
  },
  dropdownOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(59, 130, 246, 0.1)',
  },
  dropdownOptionText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '500',
  },
  noteInput: {
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    backgroundColor: 'rgba(5, 7, 10, 0.8)',
    color: colors.textPrimary,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    fontSize: 13,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  // Search field with icon
  searchFieldGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    backgroundColor: 'rgba(5, 7, 10, 0.8)',
    paddingVertical: 0,
    paddingHorizontal: 10,
    borderRadius: 6,
    gap: 8,
  },
  searchFieldInput: {
    flex: 1,
    color: colors.textPrimary,
    paddingVertical: 10,
    fontSize: 13,
  },
  // Exercise picker list
  exercisePickerList: {
    maxHeight: 240,
    borderWidth: 1,
    borderColor: 'rgba(244, 244, 245, 0.12)',
    borderRadius: 6,
    marginTop: 4,
  },
  groupCategoryLabel: {
    color: colors.primary,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 4,
  },
  exercisePickerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(244, 244, 245, 0.08)',
    gap: 10,
  },
  exercisePickerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exercisePickerInfo: {
    flex: 1,
  },
  exercisePickerName: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  addBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  addBadgeActive: {
    backgroundColor: colors.primary,
  },
  addBadgeText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  addBadgeTextActive: {
    color: '#ffffff',
  },
  // Selected plan display
  selectedPlanHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(59, 130, 246, 0.15)',
  },
  selectedPlanNotes: {
    color: colors.textDim,
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(244, 244, 245, 0.08)',
  },
  planExerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  exerciseItemIndex: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    color: '#ffffff',
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 9,
    fontWeight: '700',
  },
  exerciseItemContent: {
    flex: 1,
  },
  exerciseItemName: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  exerciseItemMeta: {
    color: colors.textDim,
    fontSize: 10,
    marginTop: 2,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  sectionMeta: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '600',
  },
  // Selected exercises list
  selectedExercisesHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(59, 130, 246, 0.15)',
  },
  selectedExerciseCard: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.15)',
    backgroundColor: 'rgba(5, 7, 10, 0.8)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  selectedExerciseHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(59, 130, 246, 0.1)',
  },
  selectedExerciseIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    color: '#ffffff',
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 11,
    fontWeight: '700',
  },
  selectedExerciseInfo: {
    flex: 1,
  },
  selectedExerciseName: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  removeExerciseBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244, 244, 245, 0.08)',
  },
  selectedExerciseInputs: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 8,
  },
  inputGroupSmall: {
    flex: 1,
    gap: 4,
  },
  inputGroupLabel: {
    color: colors.textDim,
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  setRepsInputSmall: {
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    backgroundColor: 'rgba(5, 7, 10, 0.6)',
    color: colors.textPrimary,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 4,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  mutedText: {
    color: colors.textDim,
    textAlign: 'center',
    paddingVertical: 12,
    fontSize: 12,
  },
  // Modal footer
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(59, 130, 246, 0.15)',
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.textDim,
    paddingVertical: 11,
    alignItems: 'center',
    borderRadius: 8,
  },
  cancelBtnText: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
  createBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 11,
    alignItems: 'center',
    borderRadius: 8,
  },
  createBtnDisabled: {
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
    opacity: 0.5,
  },
});
