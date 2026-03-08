import { StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/contexts/AuthContext';
import { getCurrentUser } from '@/services/users';
import { colors } from '@/theme/tokens';

export function ProfileScreen() {
  const { user, logout } = useAuth();
  const userQuery = useQuery({ queryKey: ['me'], queryFn: getCurrentUser });

  const profile = userQuery.data ?? user;

  return (
    <Screen>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>{profile?.username ?? profile?.fullname ?? '-'}</Text>

        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{profile?.email ?? '-'}</Text>

        <Text style={styles.label}>User ID</Text>
        <Text style={styles.value}>{profile?.user_id ?? '-'}</Text>
      </View>

      <PrimaryButton label="Logout" onPress={() => void logout()} />
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
    marginTop: 6,
  },
  value: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
});
