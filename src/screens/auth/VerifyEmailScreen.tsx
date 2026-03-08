import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppTextInput } from '@/components/ui/AppTextInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { verifyEmail } from '@/services/auth';
import { colors } from '@/theme/tokens';

type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  VerifyEmail: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'VerifyEmail'>;
};

export function VerifyEmailScreen({ navigation }: Props) {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    try {
      setLoading(true);
      await verifyEmail(token);
      Alert.alert('Success', 'Email verification completed.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Verification failed';
      Alert.alert('Failed', message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Verify Email</Text>
        <Text style={styles.subtitle}>Paste your verification token from email.</Text>
      </View>

      <AppTextInput onChangeText={setToken} placeholder="Verification token" value={token} />

      <PrimaryButton disabled={loading || !token} label={loading ? 'Verifying...' : 'Verify'} onPress={onSubmit} />

      <Pressable onPress={() => navigation.navigate('SignIn')}>
        <Text style={styles.link}>Back to sign in</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: 32,
    marginBottom: 12,
    gap: 6,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textDim,
  },
  link: {
    marginTop: 8,
    textAlign: 'center',
    color: colors.accent,
    fontWeight: '700',
  },
});
