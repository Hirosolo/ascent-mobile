import { useState } from 'react';
import { Alert, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
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
  const [error, setError] = useState('');

  async function onSubmit() {
    try {
      setLoading(true);
      setError('');
      await signup({ fullname, email, password, phone });
      Alert.alert('Success', 'Account created. Please verify your email.');
      navigation.navigate('VerifyEmail');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen contentStyle={styles.screen} noPadding scroll>
      <ImageBackground
        source={{
          uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDcUXH4ifrq2QS9tctcHzm-hb-u6qaAnVK2YQEDhKIx92bj5jUdFensoT4AHlqKtMlWx2QbxzKHOHK_fSyt1uYFIPT8scQEsfkPt8FMCNyITtjNKB5JUaDn09BLLID2ECNcJqriz_NFyAX8ZlSDNOJETmdjukK5STDkBjDD4ybNKhhUD_2VdKebsU6PSTqQtgiTmhcX4v7rjN2jZ0BjNt7ozKrpVn8DLpiY1mvSkThSt4Kv3XXrqhjCVY6whslqTPrPL1e0Q-gJomQ',
        }}
        style={StyleSheet.absoluteFill}
        imageStyle={styles.backgroundImage}
      />
      <View pointerEvents="none" style={styles.blueGlow} />
      <View pointerEvents="none" style={styles.cinematicOverlay} />

      <View style={styles.content}>
        <Text style={styles.brand}>TrainDiary</Text>

        <View style={styles.header}>
          <Text style={styles.kicker}>ASCENT PERFORMANCE</Text>
          <Text style={styles.title}>CREATE ACCESS</Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <AppTextInput
          label="Full Name"
          onChangeText={text => {
            setFullname(text);
            if (error) setError('');
          }}
          placeholder="e.g. John Doe"
          value={fullname}
          variant="underline"
        />

        <AppTextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          label="Email Address"
          onChangeText={text => {
            setEmail(text);
            if (error) setError('');
          }}
          placeholder="name@performance.com"
          value={email}
          variant="underline"
        />

        <AppTextInput
          keyboardType="phone-pad"
          label="Phone Number"
          onChangeText={text => {
            setPhone(text);
            if (error) setError('');
          }}
          placeholder="+1 (555) 000-0000"
          value={phone}
          variant="underline"
        />

        <AppTextInput
          label="Password"
          onChangeText={text => {
            setPassword(text);
            if (error) setError('');
          }}
          placeholder="••••••••"
          secureTextEntry
          value={password}
          variant="underline"
        />

        <Pressable onPress={() => navigation.navigate('ForgotPassword')}>
          <Text style={styles.forgot}>FORGOT PASSWORD?</Text>
        </Pressable>

        <PrimaryButton
          disabled={loading || !fullname || !email || !password || !phone}
          label={loading ? 'CREATING...' : 'START ASCENT'}
          onPress={onSubmit}
          style={styles.cta}
          variant="hero"
        />

        <View style={styles.quickRow}>
          <View style={styles.divider} />
          <Text style={styles.quickText}>Quick Access</Text>
          <View style={styles.divider} />
        </View>

        <View style={styles.socialRow}>
          <Pressable style={styles.socialButton}>
            <MaterialCommunityIcons color="rgba(244,244,245,0.5)" name="google" size={20} />
          </Pressable>
          <Pressable style={styles.socialButton}>
            <MaterialCommunityIcons color="rgba(244,244,245,0.5)" name="apple" size={20} />
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>ALREADY A MEMBER?</Text>
          <Pressable onPress={() => navigation.navigate('SignIn')}>
            <Text style={styles.footerLink}>Sign In</Text>
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
    transform: [{ scale: 1.06 }],
  },
  blueGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(59,130,246,0.15)',
  },
  cinematicOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.74)',
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
    marginTop: 36,
    marginBottom: 14,
    gap: 5,
  },
  kicker: {
    fontSize: 10,
    color: colors.primary,
    letterSpacing: 3.6,
    fontWeight: '700',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 39,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  errorBox: {
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.45)',
    backgroundColor: 'rgba(239,68,68,0.14)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  errorText: {
    color: '#93c5fd',
    fontSize: 12,
  },
  forgot: {
    color: 'rgba(244,244,245,0.55)',
    textAlign: 'right',
    fontSize: 10,
    letterSpacing: 1.8,
    fontWeight: '700',
  },
  cta: {
    marginTop: 8,
  },
  quickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    gap: 12,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(244,244,245,0.1)',
  },
  quickText: {
    color: 'rgba(244,244,245,0.4)',
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 8,
  },
  socialButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(244,244,245,0.22)',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  footer: {
    marginTop: 'auto',
    marginBottom: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  footerText: {
    color: 'rgba(244,244,245,0.48)',
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: '700',
  },
  footerLink: {
    color: colors.textPrimary,
    fontSize: 11,
    textDecorationLine: 'underline',
    textDecorationColor: 'rgba(59,130,246,0.7)',
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
