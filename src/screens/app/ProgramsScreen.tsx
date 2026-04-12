import { Alert, ActivityIndicator, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Screen } from '@/components/ui/Screen';
import { getPrograms, startProgram } from '@/services/programs';
import { getSummary } from '@/services/summary';
import { colors } from '@/theme/tokens';
import { Program } from '@/types/api';

const PROGRAM_IMAGES = [
  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1554344058-13e7b89e3f52?auto=format&fit=crop&w=1200&q=80',
];

function getCurrentMonth() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

function formatVolume(value?: number) {
  if (!value || value <= 0) return '0 kg';
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k kg`;
  return `${Math.round(value)} kg`;
}

export function ProgramsScreen() {
  const today = new Date();
  const programsQuery = useQuery({ queryKey: ['programs'], queryFn: getPrograms });
  const summaryQuery = useQuery({
    queryKey: ['summary', getCurrentMonth()],
    queryFn: () => getSummary(getCurrentMonth()),
  });
  const startMutation = useMutation({
    mutationFn: (planId: number) => startProgram(planId),
    onSuccess: () => {
      Alert.alert('Success', 'Program started.');
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to start program';
      Alert.alert('Error', message);
    },
  });

  const programs = programsQuery.data ?? [];
  const summary = summaryQuery.data;
  const activeProgram = programs[0];

  return (
    <Screen scroll contentStyle={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerKicker}>Ascent</Text>
          <Text style={styles.headerTitle}>PROGRAMS</Text>
          <Text style={styles.dateText}>{format(today, 'MMM dd, yyyy')}</Text>
        </View>
      </View>

      <Text style={styles.sectionKicker}>Active Program</Text>
      <ImageBackground
        imageStyle={styles.activeImage}
        source={{ uri: PROGRAM_IMAGES[0] }}
        style={styles.activeCard}
      >
        <View style={styles.activeOverlay}>
          <View style={styles.dayPill}>
            <Text style={styles.dayPillText}>DAY 12 / WEEK 4</Text>
          </View>
          <Text style={styles.activeTitle}>{activeProgram?.name ?? 'No Program Active'}</Text>
          <Text style={styles.activeSub}>{activeProgram?.description ?? 'Pick a plan to begin your training cycle.'}</Text>
          <Pressable
            style={[styles.resumeBtn, !activeProgram && styles.btnDisabled]}
            onPress={() => activeProgram && startMutation.mutate(activeProgram.plan_id)}
            disabled={!activeProgram || startMutation.isPending}
          >
            {startMutation.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text style={styles.resumeText}>Resume</Text>
                <MaterialCommunityIcons color="#fff" name="play" size={14} />
              </>
            )}
          </Pressable>
        </View>
      </ImageBackground>

      <View style={styles.statsRow}>
        <MetricCard
          icon="calendar-month-outline"
          label="Streak"
          value={summary ? `${summary.longest_streak} Days` : '--'}
        />
        <MetricCard
          icon="dumbbell"
          label="Volume"
          value={summary ? formatVolume(summary.total_volume) : '--'}
        />
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Explore Programs</Text>
        <Text style={styles.viewAll}>View All</Text>
      </View>

      {programsQuery.isLoading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={colors.primary} size="small" />
          <Text style={styles.muted}>Loading programs...</Text>
        </View>
      ) : programs.length === 0 ? (
        <Text style={styles.muted}>No programs available.</Text>
      ) : (
        <View style={styles.list}>
          {programs.map((item, idx) => (
            <ProgramRow
              key={item.plan_id}
              item={item}
              imageUri={PROGRAM_IMAGES[(idx + 1) % PROGRAM_IMAGES.length]}
              onPress={() => startMutation.mutate(item.plan_id)}
              pending={startMutation.isPending}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

function MetricCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricIcon}>
        <MaterialCommunityIcons color={colors.primary} name={icon} size={18} />
      </View>
      <View>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue}>{value}</Text>
      </View>
    </View>
  );
}

function ProgramRow({
  item,
  imageUri,
  onPress,
  pending,
}: {
  item: Program;
  imageUri: string;
  onPress: () => void;
  pending: boolean;
}) {
  return (
    <ImageBackground source={{ uri: imageUri }} imageStyle={styles.rowImage} style={styles.row}>
      <View style={styles.rowOverlay}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{item.name}</Text>
          <Text style={styles.rowSub}>{item.description ?? 'Structured strength progression plan'}</Text>
        </View>
        <Pressable onPress={onPress} style={styles.action} disabled={pending}>
          {pending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <MaterialCommunityIcons color="#fff" name="plus" size={16} />
          )}
        </Pressable>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 30,
    gap: 14,
    backgroundColor: '#0a0f18',
  },
  header: {
    paddingVertical: 4,
  },
  headerKicker: {
    color: colors.primary,
    fontSize: 10,
    letterSpacing: 3,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  dateText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sectionKicker: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
  },
  activeCard: {
    height: 220,
    borderRadius: 18,
    overflow: 'hidden',
  },
  activeImage: {
    borderRadius: 18,
  },
  activeOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    gap: 8,
    padding: 16,
    backgroundColor: 'rgba(7,11,18,0.5)',
  },
  dayPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  dayPillText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  activeTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },
  activeSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginBottom: 4,
  },
  resumeBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  resumeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(60,131,246,0.18)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    padding: 12,
  },
  metricIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(60,131,246,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    color: colors.textDim,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  metricValue: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  viewAll: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  list: {
    gap: 12,
  },
  row: {
    borderRadius: 16,
    overflow: 'hidden',
    minHeight: 130,
  },
  rowImage: {
    borderRadius: 16,
  },
  rowOverlay: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(6,10,16,0.64)',
  },
  rowTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  rowSub: {
    color: 'rgba(255,255,255,0.75)',
    marginTop: 4,
    fontSize: 12,
  },
  action: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(60,131,246,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 22,
    gap: 8,
  },
  muted: {
    color: colors.textDim,
    textAlign: 'center',
    marginTop: 8,
  },
});
