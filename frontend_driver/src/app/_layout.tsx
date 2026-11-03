import React, { useState } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { RouteProvider } from '../context/RouteContext';
import { HeaderBar } from '../components/common/HeaderBar';
import { BottomTabBar, TabName } from '../components/common/BottomTabBar';
import { DriverProfileDrawer } from '../components/profile/DriverProfileDrawer';
import { LoginScreen } from '../features/auth/LoginScreen';
import { OperationsScreen } from '../features/home/OperationsScreen';
import { RoutesScreen } from '../features/routes/RoutesScreen';
import { PickupsScreen } from '../features/pickups/PickupsScreen';
import { ProfileScreen } from '../features/handover/ProfileScreen';
import { colors, radii, spacing, typography, shadows } from '../theme';

const queryClient = new QueryClient();

function MainNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<TabName>('operations');

  if (isLoading && !isAuthenticated) {
    return (
      <View style={styles.splashContainer}>
        <View style={styles.brandBox}>
          <View style={styles.logoBadge}>
            <Ionicons name="cube" size={36} color="#FFFFFF" />
          </View>
          <Text style={styles.splashTitle}>PHARMATRIX</Text>
          <Text style={styles.splashSub}>Driver Logistics Terminal</Text>
          <ActivityIndicator size="small" color={colors.primaryAccent} style={{ marginTop: 24 }} />
        </View>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  const getHeaderTitle = (): string => {
    switch (currentTab) {
      case 'operations':
        return 'Operations';
      case 'routes':
        return 'Routes';
      case 'pickups':
        return 'Pickups Pipeline';
      case 'profile':
        return 'Profile';
      default:
        return 'Operations';
    }
  };

  const renderScreen = () => {
    switch (currentTab) {
      case 'operations':
        return <OperationsScreen onNavigateToTab={setCurrentTab} />;
      case 'routes':
        return <RoutesScreen onNavigateToTab={setCurrentTab} />;
      case 'pickups':
        return <PickupsScreen onNavigateToTab={setCurrentTab} />;
      case 'profile':
        return <ProfileScreen />;
    }
  };

  return (
    <View style={styles.outerStage}>
      <View style={styles.appContainer}>
        <StatusBar style="dark" />

        {/* Global Header Bar */}
        <HeaderBar
          title={getHeaderTitle()}
          showPhoneCall={currentTab === 'pickups' || currentTab === 'routes'}
        />

        {/* Screen Content */}
        <View style={styles.screenContainer}>{renderScreen()}</View>

        {/* Global Bottom Tab Bar */}
        <BottomTabBar currentTab={currentTab} onTabChange={setCurrentTab} />

        {/* Driver Profile Drawer */}
        <DriverProfileDrawer />
      </View>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouteProvider>
            <MainNavigator />
          </RouteProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  outerStage: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  appContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 500,
    backgroundColor: colors.background,
    overflow: 'hidden',
    position: 'relative',
    borderLeftWidth: Platform.select({ web: 1, default: 0 }),
    borderRightWidth: Platform.select({ web: 1, default: 0 }),
    borderColor: colors.secondary,
  },
  screenContainer: {
    flex: 1,
    width: '100%',
  },
  splashContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  brandBox: {
    alignItems: 'center',
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: radii.lg,
    backgroundColor: colors.primaryAccent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    ...shadows.card,
  },
  splashTitle: {
    ...typography.headlineMd,
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 2,
  },
  splashSub: {
    ...typography.bodySm,
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: 4,
  },
});
