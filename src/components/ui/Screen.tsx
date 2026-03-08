import { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/tokens';

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
  noPadding?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  safeStyle?: StyleProp<ViewStyle>;
  edges?: Edge[];
}>;

export function Screen({
  children,
  scroll = false,
  noPadding = false,
  contentStyle,
  safeStyle,
  edges = ['top', 'bottom'],
}: ScreenProps) {
  const containerStyles = [styles.container, noPadding && styles.noPadding, contentStyle];

  if (scroll) {
    return (
      <SafeAreaView edges={edges} style={[styles.safe, safeStyle]}>
        <ScrollView contentContainerStyle={containerStyles} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={edges} style={[styles.safe, safeStyle]}>
      <View style={containerStyles}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.backgroundDark,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: colors.backgroundDark,
  },
  noPadding: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
});
