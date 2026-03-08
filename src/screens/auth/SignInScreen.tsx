import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppTextInput } from '@/components/ui/AppTextInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/theme/tokens';

type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  VerifyEmail: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'SignIn'>;
};

export function SignInScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    try {
      setLoading(true);
      await login({ email, password });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      Alert.alert('Sign In Failed', message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>ASCENT</Text>
        <Text style={styles.subtitle}>Performance Elite</Text>
      </View>

      <AppTextInput
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        onChangeText={setEmail}
        placeholder="Email"
        value={email}
      />
      <AppTextInput onChangeText={setPassword} placeholder="Password" secureTextEntry value={password} />

      <PrimaryButton disabled={loading || !email || !password} label={loading ? 'Signing In...' : 'Sign In'} onPress={onSubmit} />

      <Pressable onPress={() => navigation.navigate('ForgotPassword')}>
        <Text style={styles.link}>Forgot password?</Text>
      </Pressable>

      <View style={styles.row}>
        <Text style={styles.text}>No account yet?</Text>
        <Pressable onPress={() => navigation.navigate('SignUp')}>
          <Text style={styles.link}>Sign up</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: 48,
    marginBottom: 24,
    gap: 4,
  },
  title: {
    fontSize: 38,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 1.6,
  },
  subtitle: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 8,
  },
  text: {
    color: colors.textDim,
  },
  link: {
    color: colors.accent,
    fontWeight: '700',
    textAlign: 'center',
  },
});
