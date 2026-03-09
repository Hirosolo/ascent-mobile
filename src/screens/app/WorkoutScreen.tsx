import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { addMonths, endOfMonth, format, startOfMonth } from 'date-fns';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Svg, { Circle } from 'react-native-svg';
import { AppTextInput } from '@/components/ui/AppTextInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { getSummary } from '@/services/summary';
import { createWorkout, getWorkouts } from '@/services/workouts';
import { colors } from '@/theme/tokens';
import { WorkoutSession } from '@/types/api';

type CalendarCell = {
  key: string;
  day: number;
  date: string;
  currentMonth: boolean;
};

const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#A855F7', '#14B8A6', '#64748B'];

export function WorkoutScreen() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => todayKey);
  const [sessionType, setSessionType] = useState('Strength');

  const monthKey = format(currentMonth, 'yyyy-MM');

  const workoutsQuery = useQuery({
    queryKey: ['workouts', monthKey],
    queryFn: () => getWorkouts(monthKey),
  });

  const summaryQuery = useQuery({
    queryKey: ['summary', monthKey],
    queryFn: () => getSummary(monthKey),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createWorkout({
        scheduled_date: selectedDate,
        type: sessionType.trim() || 'Strength',
      }),
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workouts', monthKey] }),
        queryClient.invalidateQueries({ queryKey: ['summary', monthKey] }),
      ]);
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

  return (
    <Screen scroll contentStyle={styles.screen}>
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
                  const strokeWidth = 128;
                  const circumference = 2 * Math.PI * radius;
                  const total = muscleSplit.reduce((sum, item) => sum + Math.max(0, item.value), 0) || 1;
                  let offset = 0;

                  return muscleSplit.map((item, idx) => {
                    const ratio = Math.max(0, item.value) / total;
                    const segment = circumference * ratio;
                    const circle = (
                      <Circle
                        key={item.name}
                        cx={80}
                        cy={80}
                        r={radius}
                        fill="transparent"
                        stroke={PIE_COLORS[idx % PIE_COLORS.length]}
                        strokeWidth={strokeWidth}
                        strokeDasharray={`${segment} ${circumference - segment}`}
                        strokeDashoffset={-offset}
                        strokeLinecap="butt"
                        transform="rotate(-90 80 80)"
                      />
                    );
                    offset += segment;
                    return circle;
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
        <Text style={styles.panelTitle}>Quick Create</Text>
        <AppTextInput
          label="Session Type"
          onChangeText={setSessionType}
          placeholder="Strength / Push / Pull / Cardio"
          value={sessionType}
          variant="underline"
        />
        <PrimaryButton
          label={createMutation.isPending ? 'CREATING...' : `CREATE FOR ${format(new Date(selectedDate), 'dd MMM').toUpperCase()}`}
          onPress={() => createMutation.mutate()}
          variant="hero"
        />
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
              <Text style={[styles.badge, item.status === 'COMPLETED' ? styles.done : styles.progress]}>{item.status}</Text>
            </Pressable>
          )}
        />
      </View>
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
  muted: {
    color: 'rgba(244,244,245,0.5)',
    textAlign: 'center',
    marginTop: 8,
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
    gap: 12,
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
    width: `${100 / 7}%`,
    aspectRatio: 1,
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
    color: colors.green,
    backgroundColor: '#0f2015',
  },
  progress: {
    color: colors.orange,
    backgroundColor: '#2a1b0f',
  },
});
