import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import {
  createExerciseLog,
  deleteExerciseLog,
  getWorkoutById,
  removeExerciseFromWorkout,
  updateExerciseLog,
  updateWorkout,
} from '@/services/workouts';
import { colors } from '@/theme/tokens';
import { SessionDetail } from '@/types/api';

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

  const [setState, setSetState] = useState<Record<number, EditableSet[]>>({});

  const saveMutation = useMutation({
    mutationFn: async () => {
      const exercises = sessionQuery.data?.session_details ?? [];

      for (const exercise of exercises) {
        const detailId = exercise.session_detail_id;
        const sets = setState[detailId] ?? [];

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

      const allDone = Object.values(setState)
        .flat()
        .every((s) => s.completed);

      if (allDone) {
        await updateWorkout(sessionId, { status: 'COMPLETED' });
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

  const session = sessionQuery.data;
  const sessionDetails = session.session_details ?? [];
  const effectiveState = Object.keys(setState).length === 0 ? initializedSets : setState;

  const patchSet = (detailId: number, key: string, patch: Partial<EditableSet>) => {
    setSetState((prev) => {
      const source = prev[detailId] ?? effectiveState[detailId] ?? [];
      return {
        ...prev,
        [detailId]: source.map((item) => (item.key === key ? { ...item, ...patch } : item)),
      };
    });
  };

  const addSet = (detailId: number) => {
    setSetState((prev) => {
      const source = prev[detailId] ?? effectiveState[detailId] ?? [];
      const newSet: EditableSet = {
        key: `${detailId}-new-${Date.now()}`,
        sessionDetailId: detailId,
        reps: source[source.length - 1]?.reps ?? '0',
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
    try {
      if (set.setId) {
        await deleteExerciseLog(set.setId);
      }

      setSetState((prev) => {
        const source = prev[detailId] ?? effectiveState[detailId] ?? [];
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
    try {
      await removeExerciseFromWorkout(sessionId, detail.session_detail_id);
      await queryClient.invalidateQueries({ queryKey: ['workout-session', sessionId] });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove exercise';
      Alert.alert('Delete Failed', message);
    }
  };

  return (
    <Screen scroll contentStyle={styles.screen}>
      <View style={styles.heroCard}>
        <Text style={styles.kicker}>Session Detail</Text>
        <Text style={styles.title}>{session.type || 'Workout Session'}</Text>
        <Text style={styles.subtitle}>{format(new Date(session.scheduled_date), 'EEEE, dd MMM yyyy')}</Text>
        <Text style={styles.status}>Status: {session.status}</Text>
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
              <Pressable onPress={() => void removeExercise(detail)}>
                <Text style={styles.deleteText}>Remove</Text>
              </Pressable>
            </View>

            {sets.map((set, index) => (
              <View key={set.key} style={styles.setRow}>
                <Text style={styles.setIndex}>S{index + 1}</Text>

                {!isCardio ? (
                  <>
                    <TextInput
                      keyboardType="numeric"
                      onChangeText={(v) => patchSet(detail.session_detail_id, set.key, { reps: v.replace(/[^0-9]/g, '') })}
                      style={styles.input}
                      value={set.reps}
                    />
                    <Text style={styles.inputLabel}>reps</Text>

                    <TextInput
                      keyboardType="numeric"
                      onChangeText={(v) => patchSet(detail.session_detail_id, set.key, { weight: v.replace(/[^0-9.]/g, '') })}
                      style={styles.input}
                      value={set.weight}
                    />
                    <Text style={styles.inputLabel}>kg</Text>
                  </>
                ) : (
                  <>
                    <TextInput
                      keyboardType="numeric"
                      onChangeText={(v) => patchSet(detail.session_detail_id, set.key, { duration: v.replace(/[^0-9]/g, '') })}
                      style={styles.inputWide}
                      value={set.duration}
                    />
                    <Text style={styles.inputLabel}>sec</Text>
                  </>
                )}

                <Pressable
                  onPress={() => patchSet(detail.session_detail_id, set.key, { completed: !set.completed })}
                  style={[styles.toggle, set.completed && styles.toggleDone]}
                >
                  <Text style={styles.toggleText}>{set.completed ? 'Done' : 'Todo'}</Text>
                </Pressable>

                <Pressable onPress={() => void removeSet(detail.session_detail_id, set)}>
                  <Text style={styles.deleteSet}>Del</Text>
                </Pressable>
              </View>
            ))}

            <Pressable onPress={() => addSet(detail.session_detail_id)}>
              <Text style={styles.addSet}>+ Add Set</Text>
            </Pressable>
          </View>
        );
      })}

      <PrimaryButton
        label={saveMutation.isPending ? 'SAVING...' : 'SAVE WORKOUT CHANGES'}
        onPress={() => saveMutation.mutate()}
        variant="hero"
      />
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
    borderColor: 'rgba(59,130,246,0.38)',
    backgroundColor: 'rgba(8,10,14,0.95)',
    padding: 16,
    gap: 4,
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
    alignItems: 'center',
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
    color: '#fda4af',
    fontWeight: '700',
    fontSize: 12,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  setIndex: {
    width: 24,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  input: {
    minWidth: 48,
    borderWidth: 1,
    borderColor: 'rgba(244,244,245,0.18)',
    color: colors.textPrimary,
    paddingHorizontal: 8,
    paddingVertical: 6,
    textAlign: 'center',
  },
  inputWide: {
    minWidth: 72,
    borderWidth: 1,
    borderColor: 'rgba(244,244,245,0.18)',
    color: colors.textPrimary,
    paddingHorizontal: 8,
    paddingVertical: 6,
    textAlign: 'center',
  },
  inputLabel: {
    color: 'rgba(244,244,245,0.5)',
    fontSize: 11,
    width: 30,
  },
  toggle: {
    borderWidth: 1,
    borderColor: 'rgba(244,244,245,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    minWidth: 52,
    alignItems: 'center',
  },
  toggleDone: {
    borderColor: colors.green,
    backgroundColor: '#123021',
  },
  toggleText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
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
    marginTop: 2,
  },
});
