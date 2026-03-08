import { RouteProp, useRoute } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/theme/tokens';

type RootStackParams = {
  WorkoutDetail: { sessionId: number };
};

export function WorkoutDetailScreen() {
  const route = useRoute<RouteProp<RootStackParams, 'WorkoutDetail'>>();

  return (
    <Screen>
      <Text style={styles.title}>Workout Detail</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Session ID</Text>
        <Text style={styles.value}>{route.params.sessionId}</Text>
        <Text style={styles.hint}>Next step: implement exercise detail and set logging endpoints for this session.</Text>
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
    fontSize: 18,
    fontWeight: '700',
  },
  hint: {
    color: colors.textDim,
    marginTop: 8,
  },
});
