import { StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/components/ui/Screen';
import { getSummary } from '@/services/summary';
import { colors } from '@/theme/tokens';

export function SummaryScreen() {
  const month = format(new Date(), 'yyyy-MM');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const summaryQuery = useQuery({ queryKey: ['summary', month], queryFn: () => getSummary(month) });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await summaryQuery.refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Screen scroll refreshing={isRefreshing} onRefresh={handleRefresh}>
      <Text style={styles.title}>Monthly Summary</Text>
      <Text style={styles.subtitle}>Month: {month}</Text>

      <View style={styles.grid}>
        <MetricCard label="Workouts" value={summaryQuery.data?.total_workouts ?? 0} />
        <MetricCard label="GR Score" value={summaryQuery.data?.gr_score ?? 0} />
        <MetricCard label="Calories Avg" value={summaryQuery.data?.calories_avg ?? 0} />
        <MetricCard label="Protein Avg" value={summaryQuery.data?.protein_avg ?? 0} />
      </View>
    </Screen>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textDim,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    width: '48%',
    minHeight: 100,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
    backgroundColor: colors.surfaceCard,
    justifyContent: 'space-between',
  },
  label: {
    color: colors.textDim,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  value: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: '800',
  },
});
