import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';
import { HeaderBar } from '../components/common/HeaderBar';
import {
  BottomTabBar,
  CustomerTabKey,
} from '../components/common/BottomTabBar';
import { LoadingState } from '../components/common/StateViews';
import { LoginScreen } from '../features/auth/LoginScreen';
import { OnboardingScreen } from '../features/auth/OnboardingScreen';
import { HomeScreen } from '../features/dashboard/HomeScreen';
import { RequestPickupScreen } from '../features/pickups/RequestPickupScreen';
import {
  PickupDetailsScreen,
  PickupFlowScreen,
} from '../features/pickups/PickupDetailsScreen';
import { MyPickupsScreen } from '../features/pickups/MyPickupsScreen';
import { HistoryScreen } from '../features/history/HistoryScreen';
import { ProfileScreen } from '../features/profile/ProfileScreen';
import { api, DashboardData } from '../services/api';

type StackViewMode =
  | { type: 'tabs' }
  | { type: 'request_pickup' }
  | {
      type: 'pickup_details';
      pickupPublicId: string;
      subScreen: PickupFlowScreen;
    };

export default function MainCustomerPortal() {
  const {
    user,
    customer,
    locations,
    isLoading: authLoading,
    isAuthenticated,
    isOnboarded,
    refreshProfile,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<CustomerTabKey>('home');
  const [stackView, setStackView] = useState<StackViewMode>({ type: 'tabs' });

  const [dashboard, setDashboard] = useState<DashboardData | undefined>(
    undefined
  );
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!isAuthenticated || !isOnboarded) return;
    setDashboardLoading(true);
    setDashboardError(null);
    try {
      const data = await api.getDashboard();
      setDashboard(data);
    } catch (err: any) {
      setDashboardError(err?.message || 'Failed to load dashboard data.');
    } finally {
      setDashboardLoading(false);
    }
  }, [isAuthenticated, isOnboarded]);

  useEffect(() => {
    if (isAuthenticated && isOnboarded) {
      loadDashboard();
    }
  }, [isAuthenticated, isOnboarded, loadDashboard]);

  if (authLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingState message="Authenticating..." />
      </SafeAreaView>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <SafeAreaView style={styles.container}>
        <LoginScreen />
      </SafeAreaView>
    );
  }

  if (!isOnboarded) {
    return (
      <SafeAreaView style={styles.container}>
        <OnboardingScreen />
      </SafeAreaView>
    );
  }

  const openRequestPickup = () => {
    setStackView({ type: 'request_pickup' });
  };

  const openPickupDetails = (
    pickupPublicId: string,
    subScreen: PickupFlowScreen = 'details'
  ) => {
    setStackView({
      type: 'pickup_details',
      pickupPublicId,
      subScreen,
    });
  };

  const returnToTabs = (targetTab?: CustomerTabKey) => {
    if (targetTab) {
      setActiveTab(targetTab);
    }
    setStackView({ type: 'tabs' });
    loadDashboard();
  };

  const getHeaderTitle = (): { title: string; subtitle?: string } => {
    if (stackView.type === 'request_pickup') {
      return {
        title: 'Request Pickup',
        subtitle: 'Schedule collection',
      };
    }
    if (stackView.type === 'pickup_details') {
      switch (stackView.subScreen) {
        case 'handover':
          return {
            title: 'Waste Handover',
            subtitle: 'Verify recorded weight',
          };
        case 'payment':
          return {
            title: 'Bill & Payment',
            subtitle: 'Invoice summary',
          };
        case 'otp':
          return {
            title: 'Collection OTP',
            subtitle: 'Custody verification PIN',
          };
        case 'completion':
          return {
            title: 'Collection Receipt',
            subtitle: 'Verified pickup summary',
          };
        default:
          return {
            title: 'Pickup Details',
            subtitle: 'Status & custody tracking',
          };
      }
    }

    switch (activeTab) {
      case 'home':
        return {
          title: customer?.display_name || user?.name || 'Pharmatrix',
        };
      case 'pickups':
        return {
          title: 'My Pickups',
          subtitle: 'Active & scheduled collections',
        };
      case 'history':
        return {
          title: 'Pickup History',
          subtitle: 'Past collections & receipts',
        };
      case 'profile':
        return {
          title: 'Facility Profile',
          subtitle: 'Addresses & account settings',
        };
    }
  };

  const headerMeta = getHeaderTitle();

  return (
    <SafeAreaView style={styles.container}>
      <HeaderBar
        title={headerMeta.title}
        subtitle={headerMeta.subtitle}
        customerType={customer?.customer_type}
        customerCode={customer?.customer_code}
        onBack={
          stackView.type !== 'tabs'
            ? () => {
                if (
                  stackView.type === 'pickup_details' &&
                  stackView.subScreen !== 'details'
                ) {
                  setStackView({
                    ...stackView,
                    subScreen: 'details',
                  });
                } else {
                  returnToTabs();
                }
              }
            : undefined
        }
        onRequestPickup={
          stackView.type === 'tabs' && activeTab !== 'home'
            ? openRequestPickup
            : undefined
        }
      />

      <View style={styles.body}>
        {stackView.type === 'request_pickup' ? (
          <RequestPickupScreen
            locations={locations}
            onRefreshLocations={refreshProfile}
            onSubmitted={(pickupPublicId) => {
              loadDashboard();
              openPickupDetails(pickupPublicId, 'details');
            }}
            onCancel={() => returnToTabs()}
          />
        ) : stackView.type === 'pickup_details' ? (
          <PickupDetailsScreen
            pickupPublicId={stackView.pickupPublicId}
            initialSubScreen={stackView.subScreen}
            onSubScreenChange={(sub) =>
              setStackView({
                type: 'pickup_details',
                pickupPublicId: stackView.pickupPublicId,
                subScreen: sub,
              })
            }
            onBackToDashboard={() => returnToTabs('home')}
          />
        ) : activeTab === 'home' ? (
          <HomeScreen
            customerName={customer?.display_name || user?.name}
            customerType={customer?.customer_type}
            customerCode={customer?.customer_code}
            dashboard={dashboard}
            isLoading={dashboardLoading}
            error={dashboardError}
            onRefresh={loadDashboard}
            onRequestPickup={openRequestPickup}
            onSelectPickup={(id, subScreen) =>
              openPickupDetails(id, subScreen || 'details')
            }
            onViewAllPickups={() => setActiveTab('pickups')}
          />
        ) : activeTab === 'pickups' ? (
          <MyPickupsScreen
            pickups={dashboard?.recent_pickups || []}
            isLoading={dashboardLoading}
            onRefresh={loadDashboard}
            onSelectPickup={(id) => openPickupDetails(id, 'details')}
            onRequestPickup={openRequestPickup}
          />
        ) : activeTab === 'history' ? (
          <HistoryScreen
            onSelectPickup={(id) => openPickupDetails(id, 'details')}
          />
        ) : (
          <ProfileScreen />
        )}
      </View>

      <BottomTabBar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setStackView({ type: 'tabs' });
          if (tab === 'home' || tab === 'pickups') {
            loadDashboard();
          }
        }}
        activePickupBadge={dashboard?.active_pickups || 0}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  body: {
    flex: 1,
  },
});
