import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import {
  createWorkoutDayPlan,
  deleteWorkoutDayPlan,
  getExercises,
  getWorkoutDayPlans,
  updateWorkoutDayPlan,
} from '@/services/workouts';
import { colors } from '@/theme/tokens';
import { Exercise, WorkoutDayPlan } from '@/types/api';

type DraftExercise = {
  exercise_id: number;
  name: string;
  planned_sets: number;
  planned_reps: number;
};

const DEFAULT_TYPES = ['Push', 'Pull', 'Legs', 'Cardio', 'Full Body', 'Strength'];

export function PlanDayManagerScreen() {
  const route = useRoute<any>();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'list' | 'edit'>('list');
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null);
  const [expandedPlanId, setExpandedPlanId] = useState<number | null>(null);
  const [consumedRoutePlanId, setConsumedRoutePlanId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState('Strength');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [draftExercises, setDraftExercises] = useState<DraftExercise[]>([]);

  const plansQuery = useQuery({
    queryKey: ['workout-day-plans'],
    queryFn: () => getWorkoutDayPlans(),
  });

  const exercisesQuery = useQuery({
    queryKey: ['exercises-master'],
    queryFn: () => getExercises(),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        type: type.trim() || null,
        notes: notes.trim() || null,
        exercises: draftExercises.map((item, index) => ({
          exercise_id: item.exercise_id,
          planned_sets: item.planned_sets,
          planned_reps: item.planned_reps,
          sort_order: index,
        })),
      };

      if (editingPlanId) {
        await updateWorkoutDayPlan(editingPlanId, payload);
      } else {
        await createWorkoutDayPlan(payload);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workout-day-plans'] });
      setMode('list');
      setEditingPlanId(null);
      setName('');
      setType('Strength');
      setNotes('');
      setSearch('');
      setDraftExercises([]);
      Alert.alert('Success', editingPlanId ? 'Plan updated.' : 'Plan created.');
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to save plan day';
      Alert.alert('Save Failed', message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (planId: number) => deleteWorkoutDayPlan(planId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workout-day-plans'] });
      setMode('list');
      setEditingPlanId(null);
      Alert.alert('Deleted', 'Plan day deleted successfully.');
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to delete plan day';
      Alert.alert('Delete Failed', message);
    },
  });

  const exerciseOptions = useMemo(() => {
    const raw = Array.isArray(exercisesQuery.data) ? exercisesQuery.data : [];
    const query = search.trim().toLowerCase();
    return raw
      .map((item) => {
        const source = item as Exercise & { id?: number; title?: string };
        return {
          exercise_id: Number(source.exercise_id ?? source.id ?? 0),
          name: source.name ?? source.title ?? 'Exercise',
          category: source.category ?? 'General',
        };
      })
      .filter((item) => item.exercise_id > 0)
      .filter((item) => !query || item.name.toLowerCase().includes(query))
      .filter((item) => !draftExercises.some((picked) => picked.exercise_id === item.exercise_id));
  }, [exercisesQuery.data, search, draftExercises]);

  const routePlanId = Number(route.params?.planId ?? 0) || null;

  const startCreate = () => {
    setEditingPlanId(null);
    setName('');
    setType('Strength');
    setNotes('');
    setSearch('');
    setDraftExercises([]);
    setMode('edit');
  };

  const startEdit = (plan: WorkoutDayPlan) => {
    setEditingPlanId(plan.plan_id);
    setExpandedPlanId(plan.plan_id);
    setName(plan.name || '');
    setType(plan.type || 'Strength');
    setNotes(plan.notes || '');
    setSearch('');
    setDraftExercises(
      (plan.exercises || []).map((item) => ({
        exercise_id: item.exercise_id,
        name: item.exercise?.name || `Exercise ${item.exercise_id}`,
        planned_sets: item.planned_sets,
        planned_reps: item.planned_reps,
      })),
    );
    setMode('edit');
  };

  useEffect(() => {
    if (!routePlanId || consumedRoutePlanId === routePlanId) return;
    if (!plansQuery.data || plansQuery.isLoading) return;

    const matched = plansQuery.data.find((plan) => plan.plan_id === routePlanId);
    if (!matched) {
      setConsumedRoutePlanId(routePlanId);
      return;
    }

    setConsumedRoutePlanId(routePlanId);
    startEdit(matched);
  }, [routePlanId, consumedRoutePlanId, plansQuery.data, plansQuery.isLoading]);

  const askDelete = (planId: number) => {
    Alert.alert('Delete Plan Day', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(planId) },
    ]);
  };

  const addExercise = (exercise: { exercise_id: number; name: string }) => {
    setDraftExercises((prev) => [
      ...prev,
      { exercise_id: exercise.exercise_id, name: exercise.name, planned_sets: 3, planned_reps: 10 },
    ]);
  };

  const patchExercise = (exerciseId: number, patch: Partial<DraftExercise>) => {
    setDraftExercises((prev) => prev.map((item) => (item.exercise_id === exerciseId ? { ...item, ...patch } : item)));
  };

  const removeExercise = (exerciseId: number) => {
    setDraftExercises((prev) => prev.filter((item) => item.exercise_id !== exerciseId));
  };

  const canSave = name.trim().length > 0 && draftExercises.length > 0 && !saveMutation.isPending;

  if (mode === 'list') {
    return (
      <Screen scroll contentStyle={styles.screen}>
        <View style={styles.heroCard}>
          <Text style={styles.kicker}>Plan Day</Text>
          <Text style={styles.title}>WORKOUT TEMPLATES</Text>
          <Text style={styles.subtitle}>Reuse your preferred exercise templates quickly.</Text>
        </View>

        <View style={styles.panel}>
          <PrimaryButton label="CREATE PLAN DAY" onPress={startCreate} variant="hero" />
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Saved Plans</Text>
          {plansQuery.isLoading ? <Text style={styles.muted}>Loading plans...</Text> : null}
          {plansQuery.isError ? <Text style={styles.muted}>Unable to load plans.</Text> : null}
          {!plansQuery.isLoading && (plansQuery.data?.length ?? 0) === 0 ? (
            <Text style={styles.muted}>No plan day templates yet.</Text>
          ) : null}

          {(plansQuery.data || []).map((plan) => {
            const isExpanded = expandedPlanId === plan.plan_id;

            return (
              <View key={plan.plan_id} style={styles.planBlock}>
                <Pressable style={styles.planRow} onPress={() => setExpandedPlanId(isExpanded ? null : plan.plan_id)}>
                  <View style={styles.planInfo}>
                    <Text style={styles.planName}>{plan.name}</Text>
                    <Text style={styles.planMeta}>
                      {plan.type || 'General'} • {plan.exercises?.length || 0} exercises
                    </Text>
                  </View>
                  <View style={styles.planActions}>
                    <Text style={styles.openDetailText}>{isExpanded ? 'Hide' : 'View'}</Text>
                    <Pressable onPress={() => startEdit(plan)}>
                      <Text style={styles.editText}>Edit</Text>
                    </Pressable>
                    <Pressable onPress={() => askDelete(plan.plan_id)}>
                      <Text style={styles.deleteText}>Delete</Text>
                    </Pressable>
                  </View>
                </Pressable>

                {isExpanded ? (
                  <View style={styles.planDetailCard}>
                    {plan.notes ? <Text style={styles.planDetailNotes}>{plan.notes}</Text> : null}
                    {(plan.exercises || [])
                      .slice()
                      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                      .map((item) => (
                        <View key={item.plan_exercise_id} style={styles.detailRow}>
                          <Text style={styles.detailExerciseName}>{item.exercise?.name || `Exercise ${item.exercise_id}`}</Text>
                          <Text style={styles.detailExerciseMeta}>
                            {item.planned_sets} x {item.planned_reps}
                          </Text>
                        </View>
                      ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll contentStyle={styles.screen}>
      <View style={styles.heroCard}>
        <Text style={styles.kicker}>{editingPlanId ? 'Edit Plan' : 'Create Plan'}</Text>
        <Text style={styles.title}>{editingPlanId ? 'UPDATE TEMPLATE' : 'NEW TEMPLATE'}</Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.selectLabel}>Plan Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Push Day Alpha"
          placeholderTextColor="rgba(244,244,245,0.35)"
          style={styles.input}
        />

        <Text style={styles.selectLabel}>Type</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
          {DEFAULT_TYPES.map((option) => {
            const active = option === type;
            return (
              <Pressable key={option} onPress={() => setType(option)} style={[styles.typeChip, active && styles.typeChipActive]}>
                <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>{option}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.selectLabel}>Notes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional notes"
          placeholderTextColor="rgba(244,244,245,0.35)"
          style={styles.input}
        />
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Add Exercises</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search exercise"
          placeholderTextColor="rgba(244,244,245,0.35)"
          style={styles.input}
        />

        <ScrollView style={styles.exerciseList} nestedScrollEnabled>
          {exerciseOptions.map((item) => (
            <Pressable key={item.exercise_id} onPress={() => addExercise(item)} style={styles.exercisePick}>
              <Text style={styles.exercisePickText}>{item.name}</Text>
              <Text style={styles.addSet}>+ Add</Text>
            </Pressable>
          ))}
          {exerciseOptions.length === 0 ? <Text style={styles.mutedInline}>No matching exercises.</Text> : null}
        </ScrollView>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Selected Exercises</Text>
        {draftExercises.length === 0 ? <Text style={styles.mutedInline}>Add at least one exercise.</Text> : null}
        {draftExercises.map((item) => (
          <View key={item.exercise_id} style={styles.plannedRow}>
            <Text style={styles.plannedName}>{item.name}</Text>
            <TextInput
              style={styles.planInput}
              keyboardType="numeric"
              value={String(item.planned_sets)}
              onChangeText={(v) => patchExercise(item.exercise_id, { planned_sets: Math.max(1, Number(v.replace(/[^0-9]/g, '')) || 1) })}
            />
            <Text style={styles.inputLabel}>sets</Text>
            <TextInput
              style={styles.planInput}
              keyboardType="numeric"
              value={String(item.planned_reps)}
              onChangeText={(v) => patchExercise(item.exercise_id, { planned_reps: Math.max(1, Number(v.replace(/[^0-9]/g, '')) || 1) })}
            />
            <Text style={styles.inputLabel}>reps</Text>
            <Pressable onPress={() => removeExercise(item.exercise_id)}>
              <Text style={styles.deleteSet}>Del</Text>
            </Pressable>
          </View>
        ))}
      </View>

      <View style={styles.actionRow}>
        <PrimaryButton label="BACK" onPress={() => setMode('list')} style={styles.actionButton} />
        <PrimaryButton
          label={saveMutation.isPending ? 'SAVING...' : editingPlanId ? 'UPDATE PLAN' : 'SAVE PLAN'}
          onPress={() => {
            if (!name.trim()) {
              Alert.alert('Validation', 'Please provide a plan name.');
              return;
            }
            if (draftExercises.length === 0) {
              Alert.alert('Validation', 'Please add at least one exercise.');
              return;
            }
            saveMutation.mutate();
          }}
          disabled={!canSave}
          variant="hero"
          style={styles.actionButton}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#060709',
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 12,
  },
  heroCard: {
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.38)',
    backgroundColor: 'rgba(8,10,14,0.95)',
    padding: 16,
    gap: 6,
  },
  kicker: {
    color: colors.primary,
    fontSize: 10,
    letterSpacing: 2.8,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '900',
  },
  subtitle: {
    color: 'rgba(244,244,245,0.55)',
    fontSize: 12,
  },
  panel: {
    borderWidth: 1,
    borderColor: 'rgba(244,244,245,0.16)',
    backgroundColor: 'rgba(10,11,14,0.92)',
    padding: 12,
    gap: 8,
  },
  panelTitle: {
    color: colors.primary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontSize: 11,
    fontWeight: '700',
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
  planRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(12,14,18,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(244,244,245,0.12)',
    padding: 12,
    gap: 8,
  },
  planBlock: {
    gap: 6,
  },
  planInfo: {
    flex: 1,
  },
  planName: {
    color: colors.textPrimary,
    fontWeight: '800',
  },
  planMeta: {
    color: 'rgba(244,244,245,0.5)',
    marginTop: 3,
    fontSize: 12,
  },
  planActions: {
    alignItems: 'flex-end',
    gap: 6,
  },
  openDetailText: {
    color: 'rgba(244,244,245,0.6)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  editText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  deleteText: {
    color: '#fda4af',
    fontSize: 12,
    fontWeight: '700',
  },
  planDetailCard: {
    borderWidth: 1,
    borderColor: 'rgba(244,244,245,0.1)',
    backgroundColor: 'rgba(6,8,11,0.9)',
    padding: 10,
    gap: 6,
  },
  planDetailNotes: {
    color: 'rgba(244,244,245,0.7)',
    fontSize: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(244,244,245,0.1)',
    paddingBottom: 6,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  detailExerciseName: {
    color: colors.textPrimary,
    flex: 1,
    fontSize: 12,
  },
  detailExerciseMeta: {
    color: colors.primary,
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
  input: {
    borderWidth: 1,
    borderColor: 'rgba(244,244,245,0.18)',
    color: colors.textPrimary,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 42,
  },
  typeRow: {
    gap: 8,
    paddingVertical: 2,
  },
  typeChip: {
    borderWidth: 1,
    borderColor: 'rgba(244,244,245,0.2)',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  typeChipActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(59,130,246,0.18)',
  },
  typeChipText: {
    color: 'rgba(244,244,245,0.8)',
    fontSize: 12,
    fontWeight: '700',
  },
  typeChipTextActive: {
    color: colors.primary,
  },
  exerciseList: {
    maxHeight: 220,
    borderWidth: 1,
    borderColor: 'rgba(244,244,245,0.12)',
    paddingHorizontal: 8,
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
  addSet: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
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
  planInput: {
    width: 40,
    borderWidth: 1,
    borderColor: 'rgba(244,244,245,0.18)',
    color: colors.textPrimary,
    paddingVertical: 4,
    textAlign: 'center',
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
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
  },
});
