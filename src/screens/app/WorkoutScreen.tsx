import { useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { addMonths, endOfMonth, format, startOfMonth, subDays, addDays } from 'date-fns';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Svg, { Path } from 'react-native-svg';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
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

function polarToCartesian(cx: number, cy: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

function describeSlice(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
}

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
    const firstWeekday = (start.getDay() + 6) % 7; // Mon=0

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

  const muscleSplit = summaryQuery.data?.muscle_split ?? [];

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
    <Screen scroll contentStyle={styles.screen} refreshing={isRefreshing} onRefresh={handleRefresh}>
      <View style={styles.heroCard}>
        <Text style={styles.kicker}>Ascent Performance</Text>
        <Text style={styles.title}>WORKOUT COMMAND</Text>
        <Text style={styles.subtitle}>{format(currentMonth, 'MMMM yyyy')}</Text>

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>GR Score</Text>
            <Text style={styles.metricValue}>{summaryQuery.data?.gr_score ?? 0}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Streak</Text>
            <Text style={styles.metricValue}>{summaryQuery.data?.longest_streak ?? 0}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Workouts</Text>
            <Text style={styles.metricValue}>{summaryQuery.data?.total_workouts ?? 0}</Text>
          </View>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Muscle Split</Text>
        {muscleSplit.length === 0 ? (
          <Text style={styles.muted}>No completed sessions for this month yet.</Text>
        ) : (
          <>
            <View style={styles.pieWrap}>
              <Svg width={160} height={160} viewBox="0 0 160 160">
                {(() => {
                  const radius = 64;
                  const total = muscleSplit.reduce((sum, item) => sum + Math.max(0, item.value), 0) || 1;
                  let startAngle = 0;

                  return muscleSplit.map((item, idx) => {
                    const ratio = Math.max(0, item.value) / total;
                    const sweep = Math.max(1, ratio * 360);
                    const endAngle = startAngle + sweep;
                    const slice = (
                      <Path
                        key={item.name}
                        d={describeSlice(80, 80, radius, startAngle, endAngle)}
                        fill={PIE_COLORS[idx % PIE_COLORS.length]}
                      />
                    );
                    startAngle = endAngle;
                    return slice;
                  });
                })()}
              </Svg>
            </View>
            {muscleSplit.map((item, idx) => (
              <View key={item.name} style={styles.splitRow}>
                <View style={[styles.legendDot, { backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }]} />
                <Text style={styles.splitLabel}>{item.name}</Text>
                <Text style={styles.splitValue}>{Math.round(item.value)}%</Text>
              </View>
            ))}
          </>
        )}
      </View>

      <View style={styles.panel}>
        <View style={styles.calendarHeader}>
          <Text style={styles.panelTitle}>Calendar</Text>
          <View style={styles.monthNav}>
            <Pressable onPress={() => setCurrentMonth((prev) => addMonths(prev, -1))}>
              <Text style={styles.monthNavText}>Prev</Text>
            </Pressable>
            <Text style={styles.monthLabel}>{format(currentMonth, 'MMMM yyyy')}</Text>
            <Pressable onPress={() => setCurrentMonth((prev) => addMonths(prev, 1))}>
              <Text style={styles.monthNavText}>Next</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.weekRow}>
          {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
            <Text key={d} style={styles.weekCell}>{d}</Text>
          ))}
        </View>

        <View style={styles.calendarGrid}>
          {calendarCells.map((cell) => {
            const isSelected = selectedDate === cell.date;
            const isToday = cell.date === todayKey;
            return (
              <Pressable
                key={cell.key}
                onPress={() => setSelectedDate(cell.date)}
                style={[styles.dayCell, isSelected && styles.daySelected]}
              >
                <Text style={[styles.dayText, !cell.currentMonth && styles.dayOut, isSelected && styles.dayTextSelected]}>{cell.day}</Text>
                {isToday ? <View style={styles.dot} /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Session Actions</Text>
        <Text style={styles.mutedInline}>Create a workout or manage your planned day templates.</Text>
        <View style={styles.actionTiles}>
          <Pressable style={styles.actionTile} onPress={openCreateModal}>
            <Text style={styles.actionTileTitle}>Create Workout Session</Text>
            <Text style={styles.actionTileSub}>Open guided setup</Text>
          </Pressable>
          <Pressable style={styles.actionTile} onPress={() => navigation.navigate('PlanDayManager')}>
            <Text style={styles.actionTileTitle}>Planned Day Menu</Text>
            <Text style={styles.actionTileSub}>View and edit templates</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Sessions On {format(new Date(selectedDate), 'dd MMM yyyy')}</Text>
        <FlatList
          data={selectedSessions}
          keyExtractor={(item) => String(item.session_id)}
          scrollEnabled={false}
          ListEmptyComponent={<Text style={styles.muted}>No sessions on selected day.</Text>}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => navigation.navigate('WorkoutDetail', { sessionId: item.session_id })}
              style={styles.sessionRow}
            >
              <View>
                <Text style={styles.sessionTitle}>{item.type ?? 'Workout Session'}</Text>
                <Text style={styles.sessionSub}>{item.notes || 'Open details to log sets and reps'}</Text>
              </View>
              <View style={styles.sessionActions}>
                <Text style={[styles.badge, item.status === 'COMPLETED' ? styles.done : styles.progress]}>{item.status}</Text>
                <Pressable onPress={() => confirmDeleteSession(item.session_id)}>
                  <Text style={styles.deleteSession}>Delete</Text>
                </Pressable>
              </View>
            </Pressable>
          )}
        />
      </View>

      <Modal
        transparent
        animationType="fade"
        visible={isCreateModalOpen}
        onRequestClose={() => setIsCreateModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create Workout Session</Text>
            <Text style={styles.stepIndicator}>Step {createStep} / 2</Text>

            {createStep === 1 ? (
              <View style={styles.stepBlock}>
                <Text style={styles.selectLabel}>Date</Text>
                <View style={styles.dateRow}>
                  <Pressable onPress={() => setCreateDate(format(subDays(new Date(createDate), 1), 'yyyy-MM-dd'))}>
                    <Text style={styles.monthNavText}>Prev Day</Text>
                  </Pressable>
                  <Text style={styles.dateValue}>{format(new Date(createDate), 'dd MMM yyyy')}</Text>
                  <Pressable onPress={() => setCreateDate(format(addDays(new Date(createDate), 1), 'yyyy-MM-dd'))}>
                    <Text style={styles.monthNavText}>Next Day</Text>
                  </Pressable>
                </View>

                <Text style={styles.selectLabel}>Session Type</Text>
                <Pressable
                  onPress={() => setIsCreateTypeOpen((prev) => !prev)}
                  style={styles.selectBox}
                >
                  <Text style={styles.selectValue}>{createType}</Text>
                  <Text style={styles.selectChevron}>{isCreateTypeOpen ? '▲' : '▼'}</Text>
                </Pressable>
                {isCreateTypeOpen ? (
                  <View style={styles.selectMenu}>
                    {SESSION_TYPE_OPTIONS.map((option) => {
                      const isActive = option === createType;
                      return (
                        <Pressable
                          key={option}
                          onPress={() => {
                            setCreateType(option);
                            setSessionType(option);
                            setIsCreateTypeOpen(false);
                          }}
                          style={[styles.selectOption, isActive && styles.selectOptionActive]}
                        >
                          <Text style={[styles.selectOptionText, isActive && styles.selectOptionTextActive]}>{option}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}

                <Text style={styles.selectLabel}>Planned Day Template</Text>
                <Pressable
                  onPress={() => setIsPlanSelectorOpen((prev) => !prev)}
                  style={styles.selectBox}
                >
                  <Text style={styles.selectValue}>{selectedPlan?.name || 'None (Manual)'}</Text>
                  <Text style={styles.selectChevron}>{isPlanSelectorOpen ? '▲' : '▼'}</Text>
                </Pressable>
                {isPlanSelectorOpen ? (
                  <View style={styles.selectMenu}>
                    <Pressable
                      onPress={() => {
                        setSelectedPlanId(null);
                        setPlannedExercises([]);
                        setIsPlanSelectorOpen(false);
                      }}
                      style={[styles.selectOption, selectedPlanId === null && styles.selectOptionActive]}
                    >
                      <Text style={[styles.selectOptionText, selectedPlanId === null && styles.selectOptionTextActive]}>None (Manual)</Text>
                    </Pressable>
                    {(plansQuery.data || []).map((plan) => {
                      const isActive = selectedPlanId === plan.plan_id;
                      return (
                        <Pressable
                          key={plan.plan_id}
                          onPress={() => applyPlan(plan)}
                          style={[styles.selectOption, isActive && styles.selectOptionActive]}
                        >
                          <Text style={[styles.selectOptionText, isActive && styles.selectOptionTextActive]}>{plan.name}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
                {plansQuery.isLoading ? <Text style={styles.mutedInline}>Loading planned days...</Text> : null}

                <Text style={styles.selectLabel}>Note</Text>
                <TextInput
                  value={createNote}
                  onChangeText={setCreateNote}
                  placeholder="Optional note for this workout"
                  placeholderTextColor="rgba(244,244,245,0.35)"
                  style={styles.noteInput}
                />
              </View>
            ) : (
              <View style={styles.stepBlock}>
                <Text style={styles.selectLabel}>Apply Saved Plan (Optional)</Text>
                {plansQuery.isLoading ? <Text style={styles.mutedInline}>Loading day plans...</Text> : null}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.planChipRow}>
                  {(plansQuery.data || []).map((plan) => {
                    const active = selectedPlanId === plan.plan_id;
                    return (
                      <Pressable
                        key={plan.plan_id}
                        onPress={() => applyPlan(plan)}
                        style={[styles.planChip, active && styles.planChipActive]}
                      >
                        <Text style={[styles.planChipText, active && styles.planChipTextActive]}>{plan.name}</Text>
                        <Text style={[styles.planChipMeta, active && styles.planChipMetaActive]}>
                          {plan.exercises?.length || 0} ex
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {selectedPlan ? (
                  <View style={styles.selectedPlanCard}>
                    <View style={styles.selectedPlanHead}>
                      <Text style={styles.selectedPlanName}>{selectedPlan.name}</Text>
                      <Pressable onPress={() => navigation.navigate('PlanDayManager', { planId: selectedPlan.plan_id })}>
                        <Text style={styles.selectedPlanEdit}>Edit Plan</Text>
                      </Pressable>
                    </View>
                    {selectedPlan.notes ? <Text style={styles.selectedPlanNotes}>{selectedPlan.notes}</Text> : null}
                    {(selectedPlan.exercises || [])
                      .slice()
                      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                      .map((item) => (
                        <View key={item.plan_exercise_id} style={styles.selectedPlanExerciseRow}>
                          <Text style={styles.selectedPlanExerciseName}>{item.exercise?.name || `Exercise ${item.exercise_id}`}</Text>
                          <Text style={styles.selectedPlanExerciseMeta}>
                            {item.planned_sets} x {item.planned_reps}
                          </Text>
                        </View>
                      ))}
                  </View>
                ) : null}

                <Text style={styles.selectLabel}>Add Planned Exercises</Text>
                <TextInput
                  value={exerciseSearch}
                  onChangeText={setExerciseSearch}
                  placeholder="Search exercise by name"
                  placeholderTextColor="rgba(244,244,245,0.35)"
                  style={styles.searchInput}
                />
                {exercisesQuery.isLoading ? <Text style={styles.mutedInline}>Loading exercises...</Text> : null}

                <ScrollView style={styles.exerciseList} nestedScrollEnabled>
                  {groupedExerciseOptions.length === 0 && !exercisesQuery.isLoading ? (
                    <Text style={styles.mutedInline}>No exercises match your search.</Text>
                  ) : null}
                  {groupedExerciseOptions.map((group) => (
                    <View key={group.category} style={styles.groupBlock}>
                      <Text style={styles.groupTitle}>{group.category}</Text>
                      {group.items.map((exercise) => {
                        const alreadyAdded = plannedExercises.some((p) => p.exercise_id === exercise.exercise_id);
                        return (
                          <Pressable
                            key={exercise.exercise_id}
                            style={styles.exercisePick}
                            onPress={() => addPlannedExercise(exercise)}
                          >
                            <Text style={styles.exercisePickText}>{exercise.name}</Text>
                            <Text style={alreadyAdded ? styles.addedTag : styles.addSet}>{alreadyAdded ? 'Added' : '+ Add'}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ))}
                </ScrollView>

                {plannedExercises.length > 0 ? (
                  <View style={styles.plannedList}>
                    {plannedExercises.map((item) => (
                      <View key={item.exercise_id} style={styles.plannedRow}>
                        <Text style={styles.plannedName}>{item.name}</Text>
                        <TextInput
                          style={styles.planInput}
                          keyboardType="numeric"
                          value={String(item.planned_sets)}
                          onChangeText={(v) => patchPlannedExercise(item.exercise_id, { planned_sets: Math.max(1, Number(v.replace(/[^0-9]/g, '')) || 1) })}
                        />
                        <Text style={styles.inputLabel}>sets</Text>
                        <TextInput
                          style={styles.planInput}
                          keyboardType="numeric"
                          value={String(item.planned_reps)}
                          onChangeText={(v) => patchPlannedExercise(item.exercise_id, { planned_reps: Math.max(1, Number(v.replace(/[^0-9]/g, '')) || 1) })}
                        />
                        <Text style={styles.inputLabel}>reps</Text>
                        <Pressable onPress={() => removePlannedExercise(item.exercise_id)}>
                          <Text style={styles.deleteSet}>Del</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.mutedInline}>No planned exercises selected.</Text>
                )}
              </View>
            )}

            <View style={styles.modalActions}>
              <Pressable onPress={() => (createStep === 1 ? setIsCreateModalOpen(false) : setCreateStep(1))}>
                <Text style={styles.monthNavText}>{createStep === 1 ? 'Cancel' : 'Back'}</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  if (createStep === 1) {
                    setCreateStep(2);
                    return;
                  }
                  createMutation.mutate();
                }}
              >
                <Text style={styles.modalConfirm}>{createStep === 1 ? 'Next' : (createMutation.isPending ? 'Creating...' : 'Create Session')}</Text>
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
    paddingTop: 14,
    gap: 14,
  },
  heroCard: {
    borderWidth: 1,
    borderColor: 'rgba(244,244,245,0.16)',
    backgroundColor: 'rgba(10,11,14,0.92)',
    padding: 16,
    gap: 8,
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
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: 'rgba(244,244,245,0.55)',
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  metricsRow: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(244,244,245,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: 'rgba(10,11,14,0.92)',
    gap: 4,
  },
  metricLabel: {
    color: 'rgba(244,244,245,0.45)',
    fontSize: 10,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  metricValue: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '900',
  },
  panel: {
    borderWidth: 1,
    borderColor: 'rgba(244,244,245,0.16)',
    backgroundColor: 'rgba(10,11,14,0.92)',
    padding: 14,
    gap: 10,
  },
  panelTitle: {
    color: colors.primary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontSize: 11,
    fontWeight: '700',
  },
  selectLabel: {
    color: 'rgba(244,244,245,0.65)',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  selectBox: {
    borderWidth: 1,
    borderColor: 'rgba(244,244,245,0.18)',
    backgroundColor: 'rgba(0,0,0,0.28)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectValue: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  selectChevron: {
    color: 'rgba(244,244,245,0.72)',
    fontSize: 12,
  },
  selectMenu: {
    borderWidth: 1,
    borderColor: 'rgba(244,244,245,0.16)',
    backgroundColor: 'rgba(12,14,18,0.98)',
  },
  selectOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(244,244,245,0.08)',
  },
  selectOptionActive: {
    backgroundColor: 'rgba(59,130,246,0.2)',
  },
  selectOptionText: {
    color: 'rgba(244,244,245,0.82)',
    fontSize: 13,
    fontWeight: '600',
  },
  selectOptionTextActive: {
    color: colors.primary,
  },
  muted: {
    color: 'rgba(244,244,245,0.5)',
    textAlign: 'center',
    marginTop: 8,
  },
  mutedInline: {
    color: 'rgba(244,244,245,0.5)',
    fontSize: 12,
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pieWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 99,
  },
  splitLabel: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 12,
  },
  splitValue: {
    width: 52,
    color: colors.textPrimary,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '700',
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  monthLabel: {
    color: 'rgba(244,244,245,0.7)',
    fontSize: 12,
    fontWeight: '600',
    minWidth: 94,
    textAlign: 'center',
  },
  monthNavText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekCell: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    color: 'rgba(244,244,245,0.45)',
    fontSize: 11,
    marginBottom: 4,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.2857%',
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(244,244,245,0.08)',
    gap: 4,
  },
  daySelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(59,130,246,0.18)',
  },
  dayText: {
    color: colors.textPrimary,
    fontSize: 12,
  },
  dayTextSelected: {
    fontWeight: '700',
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
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(12,14,18,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(244,244,245,0.12)',
    padding: 12,
    marginBottom: 8,
    gap: 8,
  },
  sessionActions: {
    alignItems: 'flex-end',
    gap: 6,
  },
  deleteSession: {
    color: '#fda4af',
    fontSize: 11,
    fontWeight: '700',
  },
  sessionTitle: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  sessionSub: {
    color: 'rgba(244,244,245,0.5)',
    marginTop: 3,
    maxWidth: 230,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    borderWidth: 1,
    borderColor: 'rgba(244,244,245,0.2)',
    backgroundColor: 'rgba(8,10,14,0.98)',
    padding: 14,
    gap: 10,
    maxHeight: '88%',
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  stepIndicator: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  stepBlock: {
    gap: 8,
    flexShrink: 1,
  },
  exerciseList: {
    maxHeight: 240,
    borderWidth: 1,
    borderColor: 'rgba(244,244,245,0.12)',
    paddingHorizontal: 8,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: 'rgba(244,244,245,0.18)',
    color: colors.textPrimary,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 40,
  },
  groupBlock: {
    paddingVertical: 4,
  },
  groupTitle: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateValue: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  noteInput: {
    borderWidth: 1,
    borderColor: 'rgba(244,244,245,0.18)',
    color: colors.textPrimary,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 42,
  },
  exercisePick: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(244,244,245,0.08)',
  },
  exercisePickText: {
    color: colors.textPrimary,
    fontSize: 13,
    flex: 1,
    paddingRight: 8,
  },
  plannedList: {
    marginTop: 8,
    gap: 8,
  },
  plannedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(244,244,245,0.12)',
    padding: 8,
  },
  plannedName: {
    color: colors.textPrimary,
    flex: 1,
    fontSize: 12,
  },
  inputLabel: {
    color: 'rgba(244,244,245,0.5)',
    fontSize: 11,
    width: 30,
  },
  deleteSet: {
    color: '#fda4af',
    fontSize: 11,
    fontWeight: '700',
  },
  addSet: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  planChipRow: {
    gap: 8,
    paddingVertical: 2,
  },
  planChip: {
    minWidth: 120,
    borderWidth: 1,
    borderColor: 'rgba(244,244,245,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  planChipActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(59,130,246,0.18)',
  },
  planChipText: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 12,
  },
  planChipTextActive: {
    color: colors.primary,
  },
  planChipMeta: {
    marginTop: 2,
    color: 'rgba(244,244,245,0.45)',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  planChipMetaActive: {
    color: colors.primary,
  },
  actionTiles: {
    flexDirection: 'row',
    gap: 10,
  },
  actionTile: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(244,244,245,0.16)',
    backgroundColor: 'rgba(10,11,14,0.92)',
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 4,
  },
  actionTileTitle: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  actionTileSub: {
    color: 'rgba(244,244,245,0.55)',
    fontSize: 11,
  },
  selectedPlanCard: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.38)',
    backgroundColor: 'rgba(9,13,20,0.92)',
    padding: 10,
    gap: 6,
  },
  selectedPlanHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  selectedPlanName: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    flex: 1,
  },
  selectedPlanEdit: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  selectedPlanNotes: {
    color: 'rgba(244,244,245,0.62)',
    fontSize: 11,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(244,244,245,0.1)',
    paddingBottom: 6,
  },
  selectedPlanExerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  selectedPlanExerciseName: {
    color: colors.textPrimary,
    fontSize: 12,
    flex: 1,
  },
  selectedPlanExerciseMeta: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  addedTag: {
    color: colors.green,
    fontWeight: '700',
    fontSize: 12,
  },
  planInput: {
    width: 40,
    borderWidth: 1,
    borderColor: 'rgba(244,244,245,0.18)',
    color: colors.textPrimary,
    paddingVertical: 4,
    textAlign: 'center',
  },
  modalActions: {
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalConfirm: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
