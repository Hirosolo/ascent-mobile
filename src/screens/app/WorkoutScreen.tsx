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
  const monthLabel = format(new Date(), 'MMMM yyyy');
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
    <Screen contentStyle={styles.screen}>
      <View style={styles.heroCard}>
        <Text style={styles.kicker}>Ascent Performance</Text>
        <Text style={styles.title}>WORKOUT COMMAND</Text>
        <Text style={styles.subtitle}>{monthLabel}</Text>

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Sessions</Text>
            <Text style={styles.metricValue}>{workoutsQuery.data?.length ?? 0}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Status</Text>
            <Text style={styles.metricValueSmall}>{workoutsQuery.isLoading ? 'Syncing' : 'Ready'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Quick Create Session</Text>
        <AppTextInput
          label="Session Type"
          onChangeText={setSessionType}
          placeholder="Strength / Push / Pull / Cardio"
          value={sessionType}
          variant="underline"
        />
        <PrimaryButton
          label={createMutation.isPending ? 'CREATING...' : 'CREATE TODAY SESSION'}
          onPress={() => createMutation.mutate()}
          variant="hero"
        />
      </View>

      <Text style={styles.sectionTitle}>This Month Sessions</Text>

      <FlatList
        data={workoutsQuery.data ?? []}
        keyExtractor={(item) => String(item.session_id)}
        ListEmptyComponent={<Text style={styles.muted}>No sessions found yet.</Text>}
        refreshing={workoutsQuery.isRefetching}
        onRefresh={() => workoutsQuery.refetch()}
        contentContainerStyle={styles.listContent}
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
        <Text style={styles.rowSub}>{format(new Date(item.scheduled_date), 'EEE, dd MMM')}</Text>
      </View>
      <Text style={[styles.badge, item.status === 'COMPLETED' ? styles.done : styles.progress]}>{item.status}</Text>
    </Pressable>
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
    borderColor: 'rgba(59,130,246,0.38)',
    backgroundColor: 'rgba(8,10,14,0.95)',
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
    backgroundColor: 'rgba(0,0,0,0.32)',
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
  metricValueSmall: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  card: {
    borderWidth: 1,
    borderColor: 'rgba(244,244,245,0.16)',
    borderRadius: 0,
    padding: 14,
    backgroundColor: 'rgba(10,11,14,0.92)',
    gap: 10,
  },
  label: {
    color: colors.primary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontSize: 11,
    fontWeight: '700',
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  listContent: {
    paddingBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(12,14,18,0.96)',
    borderRadius: 0,
    borderWidth: 1,
    borderColor: 'rgba(244,244,245,0.12)',
    padding: 12,
    marginBottom: 8,
  },
  rowTitle: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  rowSub: {
    color: 'rgba(244,244,245,0.5)',
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
