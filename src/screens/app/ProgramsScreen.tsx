import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Screen } from '@/components/ui/Screen';
import { getPrograms, startProgram } from '@/services/programs';
import { colors } from '@/theme/tokens';
import { Program } from '@/types/api';

export function ProgramsScreen() {
  const programsQuery = useQuery({ queryKey: ['programs'], queryFn: getPrograms });
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

  return (
    <Screen>
      <Text style={styles.title}>Programs</Text>
      <FlatList
        data={programsQuery.data ?? []}
        keyExtractor={(item) => String(item.plan_id)}
        ListEmptyComponent={<Text style={styles.muted}>No programs available.</Text>}
        renderItem={({ item }) => (
          <ProgramRow item={item} onPress={() => startMutation.mutate(item.plan_id)} pending={startMutation.isPending} />
        )}
      />
    </Screen>
  );
}

function ProgramRow({ item, onPress, pending }: { item: Program; onPress: () => void; pending: boolean }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{item.name}</Text>
        <Text style={styles.rowSub}>{item.description ?? 'No description'}</Text>
      </View>
      <Pressable onPress={onPress} style={styles.action} disabled={pending}>
        <Text style={styles.actionText}>{pending ? '...' : 'Start'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
    backgroundColor: colors.surfaceCard,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  rowTitle: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  rowSub: {
    color: colors.textDim,
    marginTop: 4,
  },
  action: {
    alignSelf: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  actionText: {
    color: '#fff',
    fontWeight: '700',
  },
  muted: {
    color: colors.textDim,
    textAlign: 'center',
    marginTop: 8,
  },
});
