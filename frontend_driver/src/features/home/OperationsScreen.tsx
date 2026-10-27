import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useDriverRoute } from '../../hooks/useDriverRoute';
import { ActiveTaskCard } from '../../components/overview/ActiveTaskCard';
import { QuickStatsStrip } from '../../components/overview/QuickStatsStrip';
import { ScheduleCard } from '../../components/overview/ScheduleCard';
import { RouteStop } from '../../types/api';

interface OperationsScreenProps {
  onNavigateToTab: (tab: 'operations' | 'routes' | 'pickups' | 'profile') => void;
  onSelectStop?: (stop: RouteStop) => void;
}

export const OperationsScreen: React.FC<OperationsScreenProps> = ({
  onNavigateToTab,
  onSelectStop,
}) => {
  const { driverProfile, user } = useAuth();
  const {
    route,
    activeStop,
    setSelectedStop,
    stats,
    isLoading,
    actionLoading,
    refreshRoute,
    startRoute,
    error,
  } = useDriverRoute();

  const driverName = driverProfile?.name || user?.name || 'Courier';
  const routeCode = route?.route_code || '';

  const handleExecuteStop = async () => {
    if (!route) return;
    if (route.status === 'ASSIGNED' || route.status === 'READY') {
      await startRoute();
    }
    // Launch navigation tab
    onNavigateToTab('routes');
  };

  const handleSelectScheduleStop = (stop: RouteStop) => {
    setSelectedStop(stop);
    onSelectStop?.(stop);
    if (stop.execution_status === 'ARRIVED' || stop.execution_status === 'IN_PROGRESS') {
      onNavigateToTab('pickups');
    } else {
      onNavigateToTab('routes');
    }
  };

  if (isLoading && !route) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primaryAction} />
        <Text style={styles.loadingText}>Loading assigned operations...</Text>
      </View>
    );
  }

  if (!route) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="clipboard-outline" size={48} color={colors.textSecondary} />
        <Text style={[styles.driverNameText, { fontSize: 20 }]}>
          {error ? 'Route Synchronization' : 'No Route Assigned'}
        </Text>
        <Text style={styles.loadingText}>
          {error || 'You have no operational routes scheduled for today.'}
        </Text>
        <TouchableOpacity style={styles.startBannerBtn} onPress={refreshRoute}>
          <Ionicons name="refresh" size={16} color="#FFFFFF" />
          <Text style={styles.startBannerBtnText}>Check for Assignments</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refreshRoute} tintColor={colors.primaryDark} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Driver Greeting & Minimal Shift Status Strip */}
      <View style={styles.greetingHeader}>
        <View style={styles.greetingLeft}>
          <View style={styles.shiftActiveTag}>
            <View style={styles.livePulseOuter}>
              <View style={styles.livePulseDot} />
            </View>
            <Text style={styles.shiftTagText}>
              ROUTE {routeCode || `ID-${route.id}`} • {route.status}
            </Text>
          </View>
          <Text style={styles.driverNameText}>{driverName}</Text>
        </View>

        <View style={styles.shiftBadge}>
          <Ionicons name="checkmark-circle" size={14} color={colors.primaryDark} />
          <Text style={styles.shiftBadgeText}>
            {route.status === 'IN_PROGRESS' ? 'In Transit' : route.status === 'COMPLETED' ? 'Completed' : 'Assigned'}
          </Text>
        </View>
      </View>

      {/* Start Route Action Banner if Route is Assigned/Ready */}
      {(route.status === 'ASSIGNED' || route.status === 'READY') && (
        <View style={styles.startRouteBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.startBannerTitle}>Route Assigned & Ready</Text>
            <Text style={styles.startBannerSub}>Initiate shift transit to unlock live stop guidance</Text>
          </View>
          <TouchableOpacity
            style={styles.startBannerBtn}
            onPress={startRoute}
            disabled={actionLoading}
            activeOpacity={0.88}
          >
            <Ionicons name="play" size={15} color="#FFFFFF" />
            <Text style={styles.startBannerBtnText}>Start Route</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Prominent Active Task Card with Auto-Progression */}
      <ActiveTaskCard
        stop={activeStop}
        stopIndex={stats.currentStopIndex}
        totalStops={stats.totalStops}
        onExecute={handleExecuteStop}
        isLoading={actionLoading}
      />

      {/* Compact Quick Stats Strip (Cold Chain + Vehicle Counter) */}
      <QuickStatsStrip
        vehicleReg={route.vehicle_registration_number ? `Van ${route.vehicle_registration_number}` : 'Service Vehicle'}
        completedStops={stats.completedStops}
        totalStops={stats.totalStops}
      />

      {/* Compact Schedule Overview Card */}
      <ScheduleCard
        stops={route.stops || []}
        activeStopId={activeStop?.id}
        onSelectStop={handleSelectScheduleStop}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  content: {
    padding: spacing.gutter,
    gap: 14,
    paddingBottom: 24,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.canvas,
    gap: 10,
  },
  loadingText: {
    ...typography.bodySm,
    color: colors.textSecondary,
    fontSize: 12,
  },
  greetingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  greetingLeft: {
    gap: 2,
    flex: 1,
  },
  shiftActiveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  livePulseOuter: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  shiftTagText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  driverNameText: {
    ...typography.headlineLg,
    fontSize: 26,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.5,
  },
  shiftBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primaryTint,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(123, 145, 238, 0.4)',
  },
  shiftBadgeText: {
    ...typography.labelSm,
    fontSize: 11,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  startRouteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primaryTint,
    borderRadius: radii.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.primaryAction,
    gap: 10,
  },
  startBannerTitle: {
    ...typography.labelMd,
    fontSize: 13,
    fontWeight: '700',
    color: colors.onPrimaryContainer,
  },
  startBannerSub: {
    ...typography.bodySm,
    fontSize: 10,
    color: colors.primaryDark,
    marginTop: 2,
  },
  startBannerBtn: {
    backgroundColor: colors.primaryDark,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  startBannerBtnText: {
    ...typography.labelSm,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 11,
  },
});

export default OperationsScreen;
