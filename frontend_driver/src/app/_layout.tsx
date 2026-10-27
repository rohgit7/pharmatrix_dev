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
import { RouteStop } from '../types/api';
import { colors, radii, spacing, typography } from '../theme';

const queryClient = new QueryClient();

function MainNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<TabName>('operations');

  if (isLoading && !isAuthenticated) {
    return (
      <View style={styles.splashContainer}>
        <View style={styles.brandBox}>
          <View style={styles.logoBadge}>
            <Ionicons name="compass" size={40} color="#FFFFFF" />
          </View>
          <Text style={styles.splashTitle}>PHARMATRIX</Text>
          <Text style={styles.splashSub}>Driver Logistics Terminal</Text>
          <ActivityIndicator size="small" color={colors.primaryAction} style={{ marginTop: 24 }} />
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

        {/* Current Screen Content */}
        <View style={styles.screenContainer}>{renderScreen()}</View>

        {/* Global Bottom Tab Bar */}
        <BottomTabBar currentTab={currentTab} onTabChange={setCurrentTab} />

        {/* Slide-Out Profile & Telemetry Drawer */}
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
    backgroundColor: Platform.select({ web: '#F3ECE2', default: colors.canvas }),
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  appContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 500,
    backgroundColor: colors.canvas,
    overflow: 'hidden',
    position: 'relative',
    borderLeftWidth: Platform.select({ web: 1, default: 0 }),
    borderRightWidth: Platform.select({ web: 1, default: 0 }),
    borderColor: colors.border,
  },
  screenContainer: {
    flex: 1,
    width: '100%',
  },
  splashContainer: {
    flex: 1,
    backgroundColor: colors.canvas,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  brandBox: {
    alignItems: 'center',
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  splashTitle: {
    ...typography.headlineMd,
    fontSize: 22,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: 2,
  },
  splashSub: {
    ...typography.bodySm,
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: 4,
  },
});
