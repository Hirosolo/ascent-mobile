import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
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
  const navigation = useNavigation<any>();
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
        <View style={styles.headerRow}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons color={colors.textDim} name="arrow-left" size={24} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.headerKicker}>Protocol Library</Text>
            <Text style={styles.headerTitle}>PLAN DAY</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <Pressable style={styles.createBtn} onPress={startCreate}>
          <MaterialCommunityIcons color="#ffffff" name="plus-circle" size={20} />
          <Text style={styles.createBtnText}>NEW TEMPLATE</Text>
        </Pressable>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Template Library</Text>
          <Text style={styles.sectionMeta}>{plansQuery.data?.length ?? 0} saved</Text>
        </View>

        {plansQuery.isLoading ? <Text style={styles.muted}>Loading plans...</Text> : null}
        {plansQuery.isError ? <Text style={styles.muted}>Unable to load plans.</Text> : null}
        {!plansQuery.isLoading && (plansQuery.data?.length ?? 0) === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons color="rgba(255,255,255,0.12)" name="folder-open-outline" size={48} />
            <Text style={styles.emptyTitle}>No Templates Yet</Text>
            <Text style={styles.emptySubtitle}>Create your first workout template</Text>
          </View>
        ) : null}

        {(plansQuery.data || []).map((plan) => {
          const isExpanded = expandedPlanId === plan.plan_id;

          return (
            <View key={plan.plan_id} style={styles.planCard}>
              <Pressable style={styles.planCardHead} onPress={() => setExpandedPlanId(isExpanded ? null : plan.plan_id)}>
                <View style={styles.planIconBox}>
                  <MaterialCommunityIcons color={colors.primary} name="dumbbell" size={20} />
                </View>
                <View style={styles.planCardInfo}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  <Text style={styles.planMeta}>
                    {plan.type || 'General'} • {plan.exercises?.length || 0} ex
                  </Text>
                </View>
                <View style={styles.planCardActions}>
                  <Pressable style={styles.planActionBtn} onPress={() => startEdit(plan)}>
                    <MaterialCommunityIcons color={colors.primary} name="pencil" size={16} />
                  </Pressable>
                  <Pressable style={[styles.planActionBtn, styles.planDeleteBtn]} onPress={() => askDelete(plan.plan_id)}>
                    <MaterialCommunityIcons color="#ef4444" name="trash-can-outline" size={16} />
                  </Pressable>
                </View>
              </Pressable>

              {isExpanded ? (
                <View style={styles.planExpandedContent}>
                  {plan.notes ? <Text style={styles.planDetailNotes}>{plan.notes}</Text> : null}
                  <View style={styles.exerciseList}>
                    {(plan.exercises || [])
                      .slice()
                      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                      .map((item, idx) => (
                        <View key={item.plan_exercise_id} style={[styles.templateExerciseRow, idx > 0 && { marginTop: 6 }]}>
                          <Text style={styles.exerciseIndex}>{idx + 1}</Text>
                          <View style={styles.exerciseRowContent}>
                            <Text style={styles.templateExerciseName}>{item.exercise?.name || `Exercise ${item.exercise_id}`}</Text>
                            <Text style={styles.templateExerciseMeta}>
                              {item.planned_sets}×{item.planned_reps} reps
                            </Text>
                          </View>
                        </View>
                      ))}
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}
      </Screen>
    );
  }

  return (
    <Screen scroll contentStyle={styles.screen}>
      <View style={styles.headerRow}>
        <Pressable style={styles.backBtn} onPress={() => setMode('list')}>
          <MaterialCommunityIcons color={colors.textDim} name="arrow-left" size={24} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.headerKicker}>{editingPlanId ? 'Edit' : 'Create'} Template</Text>
          <Text style={styles.headerTitle}>{editingPlanId ? 'UPDATE PROTOCOL' : 'NEW PROTOCOL'}</Text>
        </View>
        <Pressable style={styles.closeHeaderBtn} onPress={() => setMode('list')}>
          <MaterialCommunityIcons color={colors.textDim} name="close" size={24} />
        </Pressable>
      </View>

      <View style={styles.stepIndicator}>
        <View style={styles.stepDot} />
        <Text style={styles.stepLabel}>Building your template...</Text>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.formLabel}>TEMPLATE NAME</Text>
        <TextInput
          style={styles.formInput}
          value={name}
          onChangeText={setName}
          placeholder="e.g., Upper Body Strength"
          placeholderTextColor={colors.textDim}
        />
      </View>

      <View style={styles.formCard}>
        <Text style={styles.formLabel}>PROGRAM TYPE</Text>
        <View style={styles.typeChips}>
          {DEFAULT_TYPES.map((option) => {
            const active = option === type;
            return (
              <Pressable key={option} onPress={() => setType(option)} style={[styles.typeChip, active && styles.typeChipActive]}>
                <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>{option}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.formLabel}>NOTES</Text>
        <TextInput
          style={[styles.formInput, styles.notesInput]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Add workout notes or tips..."
          placeholderTextColor={colors.textDim}
          multiline
          numberOfLines={3}
        />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Add Exercises</Text>
      </View>
      <View style={styles.exerciseSearchCard}>
        <MaterialCommunityIcons color={colors.textDim} name="magnify" size={20} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search exercises..."
          placeholderTextColor={colors.textDim}
        />
      </View>

      <ScrollView style={styles.exercisePickList} nestedScrollEnabled>
        {exerciseOptions.map((item) => (
          <Pressable key={item.exercise_id} style={styles.exercisePickCard} onPress={() => addExercise(item)}>
            <View style={styles.exercisePickIconBox}>
              <MaterialCommunityIcons color={colors.primary} name="dumbbell" size={18} />
            </View>
            <View style={styles.exercisePickContent}>
              <Text style={styles.exercisePickName}>{item.name}</Text>
              <Text style={styles.exercisePickCategory}>{item.category}</Text>
            </View>
            <Pressable style={styles.exerciseAddBtn}>
              <MaterialCommunityIcons color={colors.primary} name="plus-circle" size={24} />
            </Pressable>
          </Pressable>
        ))}
        {exerciseOptions.length === 0 && search.trim() !== '' ? (
          <Text style={styles.emptyText}>No matching exercises</Text>
        ) : null}
      </ScrollView>

      {draftExercises.length > 0 ? (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Selected Exercises</Text>
            <Text style={styles.sectionMeta}>{draftExercises.length}</Text>
          </View>
          {draftExercises.map((item, idx) => (
            <View key={item.exercise_id} style={styles.exerciseCard}>
              <View style={styles.exerciseCardHead}>
                <Text style={styles.exerciseCardIndex}>{idx + 1}</Text>
                <View style={styles.exerciseCardContent}>
                  <Text style={styles.exerciseCardName}>{item.name}</Text>
                  <Text style={styles.exerciseCardMeta}>{item.planned_sets}×{item.planned_reps}</Text>
                </View>
                <Pressable style={styles.removeBtnSmall} onPress={() => removeExercise(item.exercise_id)}>
                  <MaterialCommunityIcons color={colors.textDim} name="close" size={18} />
                </Pressable>
              </View>
              <View style={styles.exerciseCardInputs}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputGroupLabel}>SETS</Text>
                  <TextInput
                    style={styles.setRepsInput}
                    keyboardType="numeric"
                    value={String(item.planned_sets)}
                    onChangeText={(v) => patchExercise(item.exercise_id, { planned_sets: Math.max(1, Number(v.replace(/[^0-9]/g, '')) || 1) })}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputGroupLabel}>REPS</Text>
                  <TextInput
                    style={styles.setRepsInput}
                    keyboardType="numeric"
                    value={String(item.planned_reps)}
                    onChangeText={(v) => patchExercise(item.exercise_id, { planned_reps: Math.max(1, Number(v.replace(/[^0-9]/g, '')) || 1) })}
                  />
                </View>
              </View>
            </View>
          ))}
        </>
      ) : null}

      <View style={styles.actionButtons}>
        <Pressable style={styles.cancelButton} onPress={() => setMode('list')}>
          <Text style={styles.cancelButtonText}>CANCEL</Text>
        </Pressable>
        <Pressable
          style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
          onPress={() => {
            if (!name.trim()) {
              Alert.alert('Validation', 'Please provide a template name.');
              return;
            }
            if (draftExercises.length === 0) {
              Alert.alert('Validation', 'Please add at least one exercise.');
              return;
            }
            saveMutation.mutate();
          }}
          disabled={!canSave || saveMutation.isPending}
        >
          <Text style={styles.saveButtonText}>
            {saveMutation.isPending ? 'SAVING...' : editingPlanId ? 'UPDATE' : 'CREATE'}
          </Text>
        </Pressable>
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
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.textDim,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 6,
  },
  cancelButtonText: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 6,
  },
  saveButtonDisabled: {
    backgroundColor: 'rgba(59,130,246,0.3)',
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  // Form styling
  formCard: {
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    backgroundColor: 'rgba(15, 17, 21, 0.65)',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 10,
    borderRadius: 6,
  },
  formLabel: {
    color: colors.textDim,
    fontSize: 10,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  formInput: {
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    backgroundColor: 'rgba(5, 7, 10, 0.8)',
    color: colors.textPrimary,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 4,
    fontSize: 14,
  },
  notesInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  typeChips: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  // Exercise search
  exerciseSearchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    backgroundColor: 'rgba(15, 17, 21, 0.65)',
    paddingVertical: 0,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    paddingVertical: 11,
    fontSize: 14,
  },
  exercisePickList: {
    maxHeight: 240,
    borderWidth: 1,
    borderColor: 'rgba(244, 244, 245, 0.12)',
    borderRadius: 6,
  },
  exercisePickCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(244, 244, 245, 0.08)',
    gap: 10,
  },
  exercisePickIconBox: {
    width: 40,
    height: 40,
    borderRadius: 4,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exercisePickContent: {
    flex: 1,
  },
  exercisePickName: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  exercisePickCategory: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 2,
  },
  exerciseAddBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Selected exercises
  exerciseCard: {
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    backgroundColor: 'rgba(15, 17, 21, 0.65)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  exerciseCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(59, 130, 246, 0.15)',
    gap: 10,
  },
  exerciseCardIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    color: '#ffffff',
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 12,
    fontWeight: '700',
  },
  exerciseCardContent: {
    flex: 1,
  },
  exerciseCardName: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  exerciseCardMeta: {
    color: colors.primary,
    fontSize: 11,
    marginTop: 3,
    fontWeight: '700',
  },
  removeBtnSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244, 244, 245, 0.08)',
  },
  exerciseCardInputs: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 10,
  },
  inputGroup: {
    flex: 1,
    gap: 6,
  },
  inputGroupLabel: {
    color: colors.textDim,
    fontSize: 9,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  setRepsInput: {
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    backgroundColor: 'rgba(5, 7, 10, 0.8)',
    color: colors.textPrimary,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 4,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyText: {
    color: colors.textDim,
    textAlign: 'center',
    paddingVertical: 12,
    fontSize: 12,
  },
  // List mode - header and layout
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  closeHeaderBtn: {
    width: 40,
    height: 40,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    marginLeft: 4,
  },
  headerKicker: {
    color: colors.primary,
    fontSize: 10,
    letterSpacing: 2.0,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  headerSpacer: {
    width: 40,
  },
  // Step indicator
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  stepLabel: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  // Create button
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 6,
    gap: 8,
  },
  createBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    marginTop: 8,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  sectionMeta: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '600',
  },
  // Plan cards
  planCard: {
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    backgroundColor: 'rgba(15, 17, 21, 0.65)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  planCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 10,
  },
  planIconBox: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planCardInfo: {
    flex: 1,
  },
  planCardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  planActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  planDeleteBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  // Plan expanded detail
  planExpandedContent: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(59, 130, 246, 0.15)',
    gap: 8,
  },
  planDetailNotes: {
    color: colors.textDim,
    fontSize: 12,
    lineHeight: 18,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(244, 244, 245, 0.08)',
  },
  templateExerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  exerciseIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    color: '#ffffff',
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 10,
    fontWeight: '700',
  },
  exerciseRowContent: {
    flex: 1,
  },
  templateExerciseName: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  templateExerciseMeta: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 2,
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  emptySubtitle: {
    color: colors.textDim,
    fontSize: 12,
  },
});

