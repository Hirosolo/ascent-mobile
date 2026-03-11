import { PropsWithChildren, ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/tokens';

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
  noPadding?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  safeStyle?: StyleProp<ViewStyle>;
  edges?: Edge[];
  refreshing?: boolean;
  onRefresh?: () => void;
  overlay?: ReactNode;
}>;

export function Screen({
  children,
  scroll = false,
  noPadding = false,
  contentStyle,
  safeStyle,
  edges = ['top', 'bottom'],
  refreshing = false,
  onRefresh,
  overlay,
}: ScreenProps) {
  const containerStyles = [styles.container, noPadding && styles.noPadding, contentStyle];

  if (scroll) {
    return (
      <SafeAreaView edges={edges} style={[styles.safe, safeStyle]}>
        <View style={styles.fill}>
          <ScrollView
            contentContainerStyle={containerStyles}
            keyboardShouldPersistTaps="handled"
            refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
          >
            {children}
          </ScrollView>
          {overlay}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={edges} style={[styles.safe, safeStyle]}>
      <View style={styles.fill}>
        <View style={containerStyles}>{children}</View>
        {overlay}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.backgroundDark,
  },
  fill: {
    flex: 1,
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
