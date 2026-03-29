import 'react-native-gesture-handler';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { AppProviders } from '@/providers/AppProviders';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/theme/tokens';
import { SignInScreen } from '@/screens/auth/SignInScreen';
import { SignUpScreen } from '@/screens/auth/SignUpScreen';
import { ForgotPasswordScreen } from '@/screens/auth/ForgotPasswordScreen';
import { VerifyEmailScreen } from '@/screens/auth/VerifyEmailScreen';
import { WorkoutScreen } from '@/screens/app/WorkoutScreen';
import { NutritionScreen } from '@/screens/app/NutritionScreen';
import { SummaryScreen } from '@/screens/app/SummaryScreen';
import { ProgramsScreen } from '@/screens/app/ProgramsScreen';
import { ProfileScreen } from '@/screens/app/ProfileScreen';
import { WorkoutDetailScreen } from '@/screens/app/WorkoutDetailScreen';

type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  VerifyEmail: undefined;
};

type AppTabParamList = {
  Workout: undefined;
  Nutrition: undefined;
  Summary: undefined;
  Programs: undefined;
  Profile: undefined;
};

type RootStackParamList = {
  HomeTabs: undefined;
  WorkoutDetail: { sessionId: number };
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<AppTabParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.backgroundDark,
    card: colors.surfaceDark,
    text: colors.textPrimary,
    border: colors.surfaceHighlight,
    primary: colors.primary,
  },
};

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen component={SignInScreen} name="SignIn" />
      <AuthStack.Screen component={SignUpScreen} name="SignUp" />
      <AuthStack.Screen component={ForgotPasswordScreen} name="ForgotPassword" />
      <AuthStack.Screen component={VerifyEmailScreen} name="VerifyEmail" />
    </AuthStack.Navigator>
  );
}

function HomeTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surfaceDark },
        headerTitleStyle: { color: colors.textPrimary, fontWeight: '700' },
        headerTintColor: colors.textPrimary,
        tabBarStyle: {
          backgroundColor: colors.surfaceDark,
          borderTopColor: colors.surfaceHighlight,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textDim,
      }}
    >
      <Tab.Screen
        component={WorkoutScreen}
        name="Workout"
        options={{
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons color={color} name="dumbbell" size={size} />,
        }}
      />
      <Tab.Screen
        component={NutritionScreen}
        name="Nutrition"
        options={{
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons color={color} name="food-apple" size={size} />,
        }}
      />
      <Tab.Screen
        component={SummaryScreen}
        name="Summary"
        options={{
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons color={color} name="chart-line" size={size} />,
        }}
      />
      <Tab.Screen
        component={ProgramsScreen}
        name="Programs"
        options={{
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons color={color} name="folder-star" size={size} />,
        }}
      />
      <Tab.Screen
        component={ProfileScreen}
        name="Profile"
        options={{
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons color={color} name="account-circle" size={size} />,
        }}
      />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  return (
    <RootStack.Navigator>
      <RootStack.Screen component={HomeTabs} name="HomeTabs" options={{ headerShown: false }} />
      <RootStack.Screen
        component={WorkoutDetailScreen}
        name="WorkoutDetail"
        options={{
          title: 'Workout Detail',
          headerStyle: { backgroundColor: colors.surfaceDark },
          headerTitleStyle: { color: colors.textPrimary, fontWeight: '700' },
          headerTintColor: colors.textPrimary,
        }}
      />
    </RootStack.Navigator>
  );
}

function RootNavigation() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.backgroundDark, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return <NavigationContainer theme={navTheme}>{isAuthenticated ? <AppNavigator /> : <AuthNavigator />}</NavigationContainer>;
}

export default function App() {
  return (
    <AppProviders>
      <RootNavigation />
    </AppProviders>
  );
}
