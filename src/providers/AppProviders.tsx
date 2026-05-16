import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/contexts/AuthContext';
import { ensureSystemNotificationChannel, requestSystemNotificationPermission } from '@/lib/notifications';

const queryClient = new QueryClient();

export function AppProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void (async () => {
      try {
        await requestSystemNotificationPermission();
        await ensureSystemNotificationChannel();
      } catch {
        // Notification setup is best-effort so the app still boots if permission is denied.
      }
    })();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>{children}</AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
