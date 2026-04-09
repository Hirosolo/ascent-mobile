import { useState } from 'react';
import { Alert, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
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
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function onSubmit() {
    try {
      setLoading(true);
      setError('');
      setSent(false);
      await forgotPassword(email);
      setSent(true);
      Alert.alert('Request Sent', 'Check your email for reset instructions.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Request failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen contentStyle={styles.screen} noPadding>
      <ImageBackground
        source={{
          uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAllRzzgFtL68FX113ZyhGnIl8PWSuuFvwd3dUhvV7cmiOxlz88FR2KbAAMzZ05a8MgNCrtzFWQWeOkXnRzEEvAcsv72t3gIyPKkYQn4KUEv8lTFjyY15ldTxwy-z1Hkg0ppoE_drHsePXuPsH83ikoLCYgd8BX0W_sT-lgxpzJLzUD8pFwb9jduvLFhF5i7Ixt8kjDAw_rvrANrNUjNWRyfB8PLUNrHOA8h9fio2BS-HbLAlHpa7IZd_DWInEb6AuvmYDdWtTktro',
        }}
        style={StyleSheet.absoluteFill}
        imageStyle={styles.backgroundImage}
      />
      <View pointerEvents="none" style={styles.blueGlow} />
      <View pointerEvents="none" style={styles.cinematicOverlay} />

      <View style={styles.content}>
        <Text style={styles.brand}>TrainDiary</Text>

        <View style={styles.header}>
          <Text style={styles.kicker}>ASCENT SECURITY</Text>
          <Text style={styles.title}>PASSWORD RECOVERY</Text>
        </View>

        <AppTextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          label="Email Address"
          onChangeText={text => {
            setEmail(text);
            if (error) setError('');
            if (sent) setSent(false);
          }}
          placeholder="Enter your registered email"
          value={email}
          variant="underline"
        />

        <Text style={styles.helper}>Enter your email to receive a recovery link.</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {sent ? <Text style={styles.success}>Recovery link sent successfully.</Text> : null}

        <PrimaryButton
          disabled={loading || !email}
          label={loading ? 'SENDING...' : 'SEND RESET LINK'}
          onPress={onSubmit}
          style={styles.cta}
          variant="hero"
        />

        <View style={styles.footer}>
          <Pressable onPress={() => navigation.navigate('SignIn')}>
            <Text style={styles.link}>Back to Sign In</Text>
          </Pressable>
        </View>

        <View style={styles.homeIndicator} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: 0,
  },
  backgroundImage: {
    resizeMode: 'cover',
    transform: [{ scale: 1.09 }],
  },
  blueGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(59,130,246,0.15)',
  },
  cinematicOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.76)',
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 14,
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
    marginBottom: 18,
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
  helper: {
    marginTop: 2,
    color: 'rgba(244,244,245,0.5)',
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
  },
  error: {
    color: '#93c5fd',
    textAlign: 'center',
    fontSize: 12,
  },
  success: {
    color: '#60a5fa',
    textAlign: 'center',
    fontSize: 12,
  },
  cta: {
    marginTop: 14,
  },
  footer: {
    marginTop: 'auto',
    marginBottom: 16,
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
  homeIndicator: {
    alignSelf: 'center',
    width: 114,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(244,244,245,0.2)',
    marginBottom: 2,
  },
});
