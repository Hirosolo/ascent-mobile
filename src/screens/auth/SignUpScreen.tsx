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
  navigation: NativeStackNavigationProp<AuthStackParamList, 'SignUp'>;
};

export function SignUpScreen({ navigation }: Props) {
  const { signup } = useAuth();
  const [fullname, setFullname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    try {
      setLoading(true);
      await signup({ fullname, email, password, phone });
      Alert.alert('Success', 'Account created. Please verify your email.');
      navigation.navigate('VerifyEmail');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign up failed';
      Alert.alert('Sign Up Failed', message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>TrainDiary mobile onboarding</Text>
      </View>

      <AppTextInput onChangeText={setFullname} placeholder="Full name" value={fullname} />
      <AppTextInput
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        onChangeText={setEmail}
        placeholder="Email"
        value={email}
      />
      <AppTextInput onChangeText={setPassword} placeholder="Password" secureTextEntry value={password} />
      <AppTextInput keyboardType="phone-pad" onChangeText={setPhone} placeholder="Phone" value={phone} />

      <PrimaryButton
        disabled={loading || !fullname || !email || !password || !phone}
        label={loading ? 'Creating...' : 'Create Account'}
        onPress={onSubmit}
      />

      <Pressable onPress={() => navigation.navigate('SignIn')}>
        <Text style={styles.link}>Back to sign in</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: 24,
    marginBottom: 16,
    gap: 6,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 28,
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
