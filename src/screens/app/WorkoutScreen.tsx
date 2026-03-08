import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppTextInput } from '@/components/ui/AppTextInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { createWorkout, getWorkouts } from '@/services/workouts';
import { colors } from '@/theme/tokens';
import { WorkoutSession } from '@/types/api';

export function WorkoutScreen() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const month = format(new Date(), 'yyyy-MM');
  const [sessionType, setSessionType] = useState('Strength');

  const workoutsQuery = useQuery({
    queryKey: ['workouts', month],
    queryFn: () => getWorkouts(month),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createWorkout({
        scheduled_date: format(new Date(), 'yyyy-MM-dd'),
        type: sessionType,
      }),
    onSuccess: () => {
      setSessionType('Strength');
      void queryClient.invalidateQueries({ queryKey: ['workouts', month] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to create workout';
      Alert.alert('Error', message);
    },
  });

  return (
    <Screen>
      <Text style={styles.title}>Workout</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Quick create session</Text>
        <AppTextInput onChangeText={setSessionType} placeholder="Session type" value={sessionType} />
        <PrimaryButton label={createMutation.isPending ? 'Creating...' : 'Create Today Session'} onPress={() => createMutation.mutate()} />
      </View>

      <Text style={styles.sectionTitle}>This Month Sessions</Text>

      <FlatList
        data={workoutsQuery.data ?? []}
        keyExtractor={(item) => String(item.session_id)}
        ListEmptyComponent={<Text style={styles.muted}>No sessions found yet.</Text>}
        refreshing={workoutsQuery.isRefetching}
        onRefresh={() => workoutsQuery.refetch()}
        renderItem={({ item }) => (
          <WorkoutRow item={item} onPress={() => navigation.navigate('WorkoutDetail', { sessionId: item.session_id })} />
        )}
      />
    </Screen>
  );
}

function WorkoutRow({ item, onPress }: { item: WorkoutSession; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View>
        <Text style={styles.rowTitle}>{item.type ?? 'Workout Session'}</Text>
        <Text style={styles.rowSub}>{item.scheduled_date}</Text>
      </View>
      <Text style={[styles.badge, item.status === 'COMPLETED' ? styles.done : styles.progress]}>{item.status}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
  },
  card: {
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
    borderRadius: 14,
    padding: 14,
    backgroundColor: colors.surfaceCard,
    gap: 10,
  },
  label: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
    padding: 12,
    marginBottom: 8,
  },
  rowTitle: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  rowSub: {
    color: colors.textDim,
    marginTop: 2,
  },
  badge: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: 'hidden',
  },
  done: {
    color: colors.green,
    backgroundColor: '#0f2015',
  },
  progress: {
    color: colors.orange,
    backgroundColor: '#2a1b0f',
  },
  muted: {
    color: colors.textDim,
    textAlign: 'center',
    marginTop: 12,
  },
});
