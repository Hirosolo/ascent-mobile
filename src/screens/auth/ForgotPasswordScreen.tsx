import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppTextInput } from '@/components/ui/AppTextInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { forgotPassword } from '@/services/auth';
import { colors } from '@/theme/tokens';

type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  VerifyEmail: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'ForgotPassword'>;
};

export function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    try {
      setLoading(true);
      await forgotPassword(email);
      Alert.alert('Request Sent', 'Check your email for reset instructions.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Request failed';
      Alert.alert('Failed', message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Forgot Password</Text>
        <Text style={styles.subtitle}>We will send reset instructions to your email.</Text>
      </View>

      <AppTextInput
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        onChangeText={setEmail}
        placeholder="Email"
        value={email}
      />

      <PrimaryButton disabled={loading || !email} label={loading ? 'Sending...' : 'Send Request'} onPress={onSubmit} />

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
