import { Alert, StyleSheet, Text, View } from 'react-native';
import { format } from 'date-fns';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { addWater, getGoal, getMeals, getWater } from '@/services/nutrition';
import { colors } from '@/theme/tokens';

export function NutritionScreen() {
  const queryClient = useQueryClient();
  const date = format(new Date(), 'yyyy-MM-dd');
  const month = format(new Date(), 'yyyy-MM');

  const goalQuery = useQuery({ queryKey: ['goal'], queryFn: getGoal });
  const mealsQuery = useQuery({ queryKey: ['meals', month], queryFn: () => getMeals(month) });
  const waterQuery = useQuery({ queryKey: ['water', date], queryFn: () => getWater(date) });

  const waterMutation = useMutation({
    mutationFn: () => addWater(250, date),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['water', date] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Unable to add water';
      Alert.alert('Error', message);
    },
  });

  return (
    <Screen scroll>
      <Text style={styles.title}>Nutrition</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Goal</Text>
        <Text style={styles.value}>Calories: {goalQuery.data?.calories_target ?? '-'}</Text>
        <Text style={styles.value}>Protein: {goalQuery.data?.protein_target_g ?? '-'} g</Text>
        <Text style={styles.value}>Carbs: {goalQuery.data?.carbs_target_g ?? '-'} g</Text>
        <Text style={styles.value}>Fat: {goalQuery.data?.fat_target_g ?? '-'} g</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Hydration Today</Text>
        <Text style={styles.value}>
          {(waterQuery.data?.total_ml ?? 0)} / {(waterQuery.data?.goal_ml ?? goalQuery.data?.hydration_target_ml ?? 0)} ml
        </Text>
        <PrimaryButton label={waterMutation.isPending ? 'Adding...' : 'Add 250ml'} onPress={() => waterMutation.mutate()} />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Meals this month</Text>
        <Text style={styles.value}>{Array.isArray(mealsQuery.data) ? mealsQuery.data.length : 0} entries</Text>
      </View>
    </Screen>
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
    backgroundColor: colors.surfaceCard,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  label: {
    color: colors.textDim,
    textTransform: 'uppercase',
    fontSize: 12,
    letterSpacing: 1,
  },
  value: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
});
