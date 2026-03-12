import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import {
  addExercisesToWorkout,
  createExerciseLog,
  deleteExerciseLog,
  deleteWorkout,
  getExercises,
  getWorkoutById,
  removeExerciseFromWorkout,
  updateExerciseLog,
  updateWorkout,
} from '@/services/workouts';
import { colors } from '@/theme/tokens';
import { Exercise, SessionDetail } from '@/types/api';

type RootStackParams = {
  WorkoutDetail: { sessionId: number };
};

type EditableSet = {
  key: string;
  setId?: number;
  sessionDetailId: number;
  reps: string;
  weight: string;
  duration: string;
  completed: boolean;
};

export function WorkoutDetailScreen() {
  const route = useRoute<RouteProp<RootStackParams, 'WorkoutDetail'>>();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const sessionId = route.params.sessionId;

  const sessionQuery = useQuery({
    queryKey: ['workout-session', sessionId],
    queryFn: () => getWorkoutById(sessionId),
  });

  const exercisesQuery = useQuery({
    queryKey: ['exercises-master'],
    queryFn: () => getExercises(),
  });

  const [setState, setSetState] = useState<Record<number, EditableSet[]>>({});
  const [isAddExerciseOpen, setIsAddExerciseOpen] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState('');

  const saveMutation = useMutation({
    mutationFn: async () => {
      const exercises = sessionQuery.data?.session_details ?? [];
      const mergedState = { ...initializedSets, ...setState };

      for (const exercise of exercises) {
        const detailId = exercise.session_detail_id;
        const sets = mergedState[detailId] ?? [];
        const isCardio = (exercise.exercises?.type || '').toLowerCase() === 'cardio';

        if (!isCardio && sets.some((set) => (Number(set.reps) || 0) <= 0)) {
          throw new Error(
            `${exercise.exercises?.name ?? 'Exercise'} has a set with reps <= 0. Fix reps before saving.`,
          );
        }

        for (const set of sets) {
          const reps = Number(set.reps) || 0;
          const weight = Number(set.weight) || 0;
          const duration = Number(set.duration) || 0;

          if (set.setId) {
            await updateExerciseLog({
              log_id: set.setId,
              reps,
              actual_reps: reps,
              weight_kg: weight,
              duration,
              status: set.completed,
            });
          } else {
            await createExerciseLog({
              session_detail_id: detailId,
              reps,
              actual_reps: reps,
              weight_kg: weight,
              duration,
              status: set.completed,
            });
          }
        }
      }

      const allDone = exercises.length > 0 && exercises.every((exercise) => {
        const sets = mergedState[exercise.session_detail_id] ?? [];
        return sets.length > 0 && sets.every((s) => s.completed);
      });

      if (allDone) {
        await updateWorkout(sessionId, { status: 'COMPLETED' });
      } else {
        await updateWorkout(sessionId, { status: 'PENDING' });
      }
    },
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workout-session', sessionId] }),
        queryClient.invalidateQueries({ queryKey: ['workouts'] }),
        queryClient.invalidateQueries({ queryKey: ['summary'] }),
      ]);
      Alert.alert('Saved', 'Workout updates have been synced.');
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to save workout changes';
      Alert.alert('Save Failed', message);
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: () => deleteWorkout(sessionId),
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workout-session', sessionId] }),
        queryClient.invalidateQueries({ queryKey: ['workouts'] }),
        queryClient.invalidateQueries({ queryKey: ['summary'] }),
      ]);
      navigation.goBack();
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to delete workout session';
      Alert.alert('Delete Failed', message);
    },
  });

  const addExerciseMutation = useMutation({
    mutationFn: async (exerciseId: number) => {
      await addExercisesToWorkout(sessionId, [
        { exercise_id: exerciseId, planned_sets: 1, planned_reps: 10 },
      ]);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workout-session', sessionId] });
      setIsAddExerciseOpen(false);
      setExerciseSearch('');
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to add exercise';
      Alert.alert('Add Exercise Failed', message);
    },
  });

  const initializedSets = useMemo(() => {
    const details = sessionQuery.data?.session_details ?? [];
    const nextState: Record<number, EditableSet[]> = {};

    for (const detail of details) {
      const logs = detail.exercise_logs ?? [];
      nextState[detail.session_detail_id] = logs.length
        ? logs.map((log, idx) => ({
            key: `${detail.session_detail_id}-${log.set_id ?? idx}`,
            setId: log.set_id ?? log.log_id,
            sessionDetailId: detail.session_detail_id,
            reps: String(log.reps ?? log.actual_reps ?? 0),
            weight: String(log.weight_kg ?? 0),
            duration: String(log.duration ?? 0),
            completed: typeof log.status === 'string' ? log.status === 'COMPLETED' : Boolean(log.status),
          }))
        : [
            {
              key: `${detail.session_detail_id}-new-0`,
              sessionDetailId: detail.session_detail_id,
              reps: String(detail.planned_reps ?? 0),
              weight: '0',
              duration: '0',
              completed: false,
            },
          ];
    }

    return nextState;
  }, [sessionQuery.data?.session_details]);

  const session = sessionQuery.data;
  const sessionDetails = session?.session_details ?? [];
  const isSessionCompleted = session ? session.status === 'COMPLETED' || Boolean(session.completed) : false;
  const existingExerciseIds = new Set(sessionDetails.map((d) => d.exercise_id));

  const exerciseOptions = useMemo(() => {
    const list = Array.isArray(exercisesQuery.data) ? exercisesQuery.data : [];
    const dedup = new Map<number, { exercise_id: number; name: string; category?: string }>();

    list.forEach((item, index) => {
      const source = item as Exercise & { id?: number; title?: string };
      const exerciseId = Number(source.exercise_id ?? source.id ?? 0) || index + 1;
      if (existingExerciseIds.has(exerciseId) || dedup.has(exerciseId)) return;

      dedup.set(exerciseId, {
        exercise_id: exerciseId,
        name: source.name ?? source.title ?? `Exercise ${exerciseId}`,
        category: source.category || 'General',
      });
    });

    return Array.from(dedup.values());
  }, [exercisesQuery.data, existingExerciseIds]);

  const filteredExerciseOptions = useMemo(() => {
    const query = exerciseSearch.trim().toLowerCase();
    const filtered = query
      ? exerciseOptions.filter((item) => item.name.toLowerCase().includes(query))
      : exerciseOptions;

    const groups = new Map<string, { exercise_id: number; name: string; category?: string }[]>();
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

  if (sessionQuery.isLoading) {
    return (
      <Screen>
        <Text style={styles.muted}>Loading workout detail...</Text>
      </Screen>
    );
  }

  if (sessionQuery.isError || !sessionQuery.data) {
    return (
      <Screen>
        <Text style={styles.muted}>Unable to load workout detail.</Text>
        <PrimaryButton label="Back" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  // Merge initialized sets with user edits so updating one exercise does not hide others.
  const effectiveState = { ...initializedSets, ...setState };

  const patchSet = (detailId: number, key: string, patch: Partial<EditableSet>) => {
    if (isSessionCompleted) return;
    setSetState((prev) => {
      const source = prev[detailId] ?? initializedSets[detailId] ?? [];
      return {
        ...prev,
        [detailId]: source.map((item) => (item.key === key ? { ...item, ...patch } : item)),
      };
    });
  };

  const addSet = (detailId: number, isCardio: boolean) => {
    if (isSessionCompleted) return;

    setSetState((prev) => {
      const source = prev[detailId] ?? initializedSets[detailId] ?? [];
      const reps = Number(source[source.length - 1]?.reps ?? '0');

      if (!isCardio && reps <= 0) {
        Alert.alert('Invalid Reps', 'Cannot add a new set when reps is 0 or less.');
        return prev;
      }

      const newSet: EditableSet = {
        key: `${detailId}-new-${Date.now()}`,
        sessionDetailId: detailId,
        reps: source[source.length - 1]?.reps ?? '1',
        weight: source[source.length - 1]?.weight ?? '0',
        duration: source[source.length - 1]?.duration ?? '0',
        completed: false,
      };

      return {
        ...prev,
        [detailId]: [...source, newSet],
      };
    });
  };

  const removeSet = async (detailId: number, set: EditableSet) => {
    if (isSessionCompleted) return;
    try {
      if (set.setId) {
        await deleteExerciseLog(set.setId);
      }

      setSetState((prev) => {
        const source = prev[detailId] ?? initializedSets[detailId] ?? [];
        return {
          ...prev,
          [detailId]: source.filter((item) => item.key !== set.key),
        };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete set';
      Alert.alert('Delete Failed', message);
    }
  };

  const removeExercise = async (detail: SessionDetail) => {
    if (isSessionCompleted) return;
    try {
      await removeExerciseFromWorkout(sessionId, detail.session_detail_id);
      await queryClient.invalidateQueries({ queryKey: ['workout-session', sessionId] });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove exercise';
      Alert.alert('Delete Failed', message);
    }
  };

  const confirmDeleteSession = () => {
    Alert.alert('Delete Session', 'This will permanently delete this workout session.', [
      { text: 'Cancel', style: 'cancel' },
      { text: deleteSessionMutation.isPending ? 'Deleting...' : 'Delete', style: 'destructive', onPress: () => deleteSessionMutation.mutate() },
    ]);
  };

  return (
    <Screen scroll contentStyle={styles.screen}>
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroCopy}>
            <Text style={styles.kicker}>Active Session</Text>
            <Text style={styles.title}>{session.type || 'Workout Session'}</Text>
            <Text style={styles.subtitle}>{format(new Date(session.scheduled_date), 'EEEE, dd MMM yyyy')}</Text>
            <Text style={styles.status}>Status: {session.status}</Text>
          </View>
          <Pressable style={styles.deleteSessionBtn} onPress={confirmDeleteSession}>
            <Text style={styles.deleteSessionBtnText}>{deleteSessionMutation.isPending ? 'Deleting...' : 'Delete Session'}</Text>
          </Pressable>
        </View>
      </View>

      {sessionDetails.length === 0 ? <Text style={styles.muted}>No exercises yet in this session.</Text> : null}

      {sessionDetails.map((detail) => {
        const sets = effectiveState[detail.session_detail_id] ?? [];
        const isCardio = (detail.exercises?.type || '').toLowerCase() === 'cardio';

        return (
          <View key={detail.session_detail_id} style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <View>
                <Text style={styles.exerciseName}>{detail.exercises?.name ?? `Exercise #${detail.exercise_id}`}</Text>
                <Text style={styles.exerciseMeta}>{detail.exercises?.category || 'General'} {isCardio ? '• Cardio' : '• Strength'}</Text>
              </View>
              {!isSessionCompleted ? (
                <Pressable onPress={() => void removeExercise(detail)}>
                  <Text style={styles.deleteText}>Remove</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.setColumnHeader}>
              <Text style={styles.setColLabelSet}>Set</Text>
              <Text style={styles.setColLabelValue}>Weight</Text>
              <Text style={styles.setColLabelValue}>{isCardio ? 'Duration' : 'Rep'}</Text>
              <Text style={styles.setColLabelAction}>Status</Text>
              <Text style={styles.setColLabelAction}>Action</Text>
            </View>

            {sets.map((set, index) => (
              <View key={set.key} style={[styles.setRow, set.completed && styles.setRowCompleted]}>
                <Text style={styles.setIndex}>S{index + 1}</Text>

                {!isCardio ? (
                  <>
                    <View style={styles.valueColumn}>
                      <TextInput
                        editable={!isSessionCompleted}
                        keyboardType="numeric"
                        onChangeText={(v) => patchSet(detail.session_detail_id, set.key, { weight: v.replace(/[^0-9.]/g, '') })}
                        style={styles.input}
                        value={set.weight}
                      />
                      <Text style={styles.inputLabel}>kg</Text>
                    </View>

                    <View style={styles.valueColumn}>
                      <TextInput
                        editable={!isSessionCompleted}
                        keyboardType="numeric"
                        onChangeText={(v) => patchSet(detail.session_detail_id, set.key, { reps: v.replace(/[^0-9]/g, '') })}
                        style={styles.input}
                        value={set.reps}
                      />
                      <Text style={styles.inputLabel}>reps</Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.valueColumn}>
                    <TextInput
                      editable={!isSessionCompleted}
                      keyboardType="numeric"
                      onChangeText={(v) => patchSet(detail.session_detail_id, set.key, { duration: v.replace(/[^0-9]/g, '') })}
                      style={styles.input}
                      value={set.duration}
                    />
                    <Text style={styles.inputLabel}>sec</Text>
                  </View>
                )}

                <Pressable
                  onPress={() => {
                    const reps = Number(set.reps) || 0;
                    if (!isCardio && !set.completed && reps <= 0) {
                      Alert.alert('Invalid Reps', 'Set reps must be greater than 0 before marking done.');
                      return;
                    }
                    patchSet(detail.session_detail_id, set.key, { completed: !set.completed });
                  }}
                  style={[styles.checkCircle, set.completed && styles.checkCircleDone]}
                  disabled={isSessionCompleted}
                >
                  <MaterialCommunityIcons
                    color={set.completed ? '#ffffff' : 'rgba(244,244,245,0.55)'}
                    name={set.completed ? 'checkbox-marked-circle-outline' : 'checkbox-blank-circle-outline'}
                    size={18}
                  />
                </Pressable>

                {!isSessionCompleted ? (
                  <Pressable style={styles.deleteSetBtn} onPress={() => void removeSet(detail.session_detail_id, set)}>
                    <MaterialCommunityIcons color={colors.red} name="trash-can-outline" size={16} />
                  </Pressable>
                ) : null}
              </View>
            ))}

            {!isSessionCompleted ? (
              <Pressable onPress={() => addSet(detail.session_detail_id, isCardio)}>
                <Text style={styles.addSet}>+ Add Set</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}

      {!isSessionCompleted ? (
        <Pressable style={styles.addExerciseBtn} onPress={() => setIsAddExerciseOpen(true)}>
          <MaterialCommunityIcons color={colors.primary} name="plus" size={16} />
          <Text style={styles.addExerciseBtnText}>Add Exercise</Text>
        </Pressable>
      ) : null}

      {isSessionCompleted ? (
        <View style={styles.missionCard}>
          <Text style={styles.missionTitle}>Mission Accomplished</Text>
          <Text style={styles.missionText}>Workout session completed. Editing is now locked.</Text>
        </View>
      ) : (
        <PrimaryButton
          label={saveMutation.isPending ? 'SYNCING...' : 'FINISH SESSION'}
          onPress={() => saveMutation.mutate()}
          variant="hero"
        />
      )}

      <Modal
        visible={isAddExerciseOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsAddExerciseOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Exercise</Text>
              <Pressable onPress={() => setIsAddExerciseOpen(false)}>
                <MaterialCommunityIcons color={colors.textDim} name="close" size={20} />
              </Pressable>
            </View>

            <View style={styles.searchWrap}>
              <MaterialCommunityIcons color={colors.textDim} name="magnify" size={18} />
              <TextInput
                value={exerciseSearch}
                onChangeText={setExerciseSearch}
                placeholder="Search exercises..."
                placeholderTextColor={colors.textDim}
                style={styles.searchInput}
              />
            </View>

            <ScrollView style={styles.exerciseList} nestedScrollEnabled>
              {filteredExerciseOptions.length === 0 && exercisesQuery.isLoading ? (
                <Text style={styles.modalMuted}>Loading exercises...</Text>
              ) : null}
              {filteredExerciseOptions.length === 0 && !exercisesQuery.isLoading ? (
                <Text style={styles.modalMuted}>No exercises found</Text>
              ) : null}
              {filteredExerciseOptions.map((group) => (
                <View key={group.category}>
                  <Text style={styles.groupLabel}>{group.category}</Text>
                  {group.items.map((exercise) => (
                    <Pressable
                      key={exercise.exercise_id}
                      style={styles.exerciseRow}
                      onPress={() => addExerciseMutation.mutate(exercise.exercise_id)}
                      disabled={addExerciseMutation.isPending}
                    >
                      <Text style={styles.exerciseRowText}>{exercise.name}</Text>
                      <MaterialCommunityIcons color={colors.primary} name="plus-circle-outline" size={18} />
                    </Pressable>
                  ))}
                </View>
              ))}
            </ScrollView>
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
    paddingVertical: 14,
    gap: 14,
  },
  heroCard: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 16,
    gap: 4,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroCopy: {
    flex: 1,
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
  status: {
    color: colors.textPrimary,
    marginTop: 2,
    fontWeight: '700',
  },
  deleteSessionBtn: {
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.35)',
    backgroundColor: 'rgba(127,29,29,0.28)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  deleteSessionBtnText: {
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: '800',
  },
  muted: {
    color: 'rgba(244,244,245,0.55)',
    textAlign: 'center',
  },
  exerciseCard: {
    borderWidth: 1,
    borderColor: 'rgba(244,244,245,0.16)',
    backgroundColor: 'rgba(10,11,14,0.92)',
    padding: 12,
    gap: 10,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  exerciseName: {
    color: colors.textPrimary,
    fontWeight: '800',
    fontSize: 15,
  },
  exerciseMeta: {
    color: 'rgba(244,244,245,0.5)',
    marginTop: 2,
    fontSize: 12,
  },
  deleteText: {
    color: colors.red,
    fontWeight: '700',
    fontSize: 12,
  },
  setColumnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 4,
    gap: 6,
  },
  setColLabelSet: {
    color: 'rgba(244,244,245,0.35)',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    width: 24,
  },
  setColLabelValue: {
    color: 'rgba(244,244,245,0.35)',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    flex: 1,
    textAlign: 'left',
  },
  setColLabelAction: {
    color: 'rgba(244,244,245,0.35)',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    width: 50,
    textAlign: 'center',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(244,244,245,0.06)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  setRowCompleted: {
    opacity: 0.45,
  },
  setIndex: {
    width: 24,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  valueColumn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  input: {
    minWidth: 42,
    borderWidth: 1,
    borderColor: 'rgba(244,244,245,0.18)',
    color: colors.textPrimary,
    paddingHorizontal: 8,
    paddingVertical: 6,
    textAlign: 'center',
    flex: 1,
  },
  inputLabel: {
    color: 'rgba(244,244,245,0.5)',
    fontSize: 11,
    width: 30,
    textAlign: 'left',
  },
  checkCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: 'rgba(59,130,246,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleDone: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  deleteSet: {
    color: colors.red,
    fontSize: 11,
    fontWeight: '700',
  },
  deleteSetBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(127,29,29,0.2)',
  },
  addSet: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
    marginTop: 2,
  },
  addExerciseBtn: {
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.28)',
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  addExerciseBtnText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#0b0d12',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)',
    padding: 14,
    maxHeight: '80%',
    gap: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    color: colors.textPrimary,
    fontWeight: '800',
    fontSize: 16,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.22)',
    borderRadius: 8,
    paddingHorizontal: 10,
    gap: 8,
    backgroundColor: 'rgba(5,7,10,0.9)',
  },
  searchInput: {
    color: colors.textPrimary,
    flex: 1,
    paddingVertical: 10,
  },
  exerciseList: {
    maxHeight: 380,
    borderWidth: 1,
    borderColor: 'rgba(244,244,245,0.1)',
    borderRadius: 8,
  },
  modalMuted: {
    color: colors.textDim,
    paddingVertical: 14,
    textAlign: 'center',
  },
  groupLabel: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 4,
  },
  exerciseRow: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(244,244,245,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  exerciseRowText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  missionCard: {
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.35)',
    backgroundColor: 'rgba(59,130,246,0.12)',
    padding: 16,
    gap: 4,
  },
  missionTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  missionText: {
    color: 'rgba(191,219,254,0.95)',
    fontSize: 12,
    fontWeight: '600',
  },
});
