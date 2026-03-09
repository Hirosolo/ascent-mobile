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
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  async function onSubmit() {
    try {
      setLoading(true);
      setStatus(null);
      await verifyEmail(token);
      setStatus({ type: 'success', message: 'Email verified successfully. You can now sign in.' });
      Alert.alert('Success', 'Email verification completed.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Verification failed';
      setStatus({ type: 'error', message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen contentStyle={styles.screen}>
      <Text style={styles.brand}>TrainDiary</Text>

      <View style={styles.header}>
        <Text style={styles.kicker}>ASCENT PERFORMANCE</Text>
        <Text style={styles.title}>VERIFY EMAIL</Text>
      </View>

      {status ? (
        <View style={[styles.statusBox, status.type === 'success' ? styles.successBox : styles.errorBox]}>
          <Text style={status.type === 'success' ? styles.successText : styles.errorText}>{status.message}</Text>
        </View>
      ) : null}

      <AppTextInput
        label="Verification Code"
        maxLength={6}
        onChangeText={text => {
          setToken(text);
          if (status) setStatus(null);
        }}
        placeholder="6-digit code"
        value={token}
        variant="underline"
      />

      <PrimaryButton
        disabled={loading || token.trim().length < 6}
        label={loading ? 'VERIFYING...' : 'VERIFY EMAIL'}
        onPress={onSubmit}
        style={styles.cta}
        variant="hero"
      />

      <View style={styles.footer}>
        <Pressable onPress={() => navigation.navigate('SignIn')}>
          <Text style={styles.link}>Back to Sign In</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 28,
    paddingVertical: 20,
    backgroundColor: '#030303',
    gap: 14,
  },
  brand: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  header: {
    marginTop: 44,
    marginBottom: 10,
    gap: 5,
  },
  kicker: {
    fontSize: 10,
    color: colors.primary,
    letterSpacing: 3.4,
    fontWeight: '700',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 38,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statusBox: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  successBox: {
    borderColor: 'rgba(59,130,246,0.45)',
    backgroundColor: 'rgba(59,130,246,0.12)',
  },
  errorBox: {
    borderColor: 'rgba(239,68,68,0.45)',
    backgroundColor: 'rgba(239,68,68,0.12)',
  },
  successText: {
    color: '#60a5fa',
    fontSize: 12,
  },
  errorText: {
    color: '#93c5fd',
    fontSize: 12,
  },
  cta: {
    marginTop: 10,
  },
  footer: {
    marginTop: 'auto',
    marginBottom: 12,
    alignItems: 'center',
  },
  link: {
    color: 'rgba(244,244,245,0.7)',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    textDecorationLine: 'underline',
    textDecorationColor: 'rgba(59,130,246,0.6)',
    fontWeight: '700',
  },
});
