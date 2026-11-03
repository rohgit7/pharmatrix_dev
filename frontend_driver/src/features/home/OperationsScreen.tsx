import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography, shadows } from '../../theme';
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

  const driverName = driverProfile?.name || user?.name || 'Driver';
  const routeCode = route?.route_code || '';

  const handleExecuteStop = async () => {
    if (!route) return;
    if (route.status === 'ASSIGNED' || route.status === 'READY') {
      await startRoute();
    }
    if (activeStop?.execution_status === 'ARRIVED' || activeStop?.execution_status === 'IN_PROGRESS') {
      onNavigateToTab('pickups');
    } else {
      onNavigateToTab('routes');
    }
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
        <ActivityIndicator size="large" color={colors.primaryAccent} />
        <Text style={styles.loadingText}>Syncing assigned operations...</Text>
      </View>
    );
  }

  if (!route) {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.emptyIconBox}>
          <Ionicons name="clipboard-outline" size={36} color={colors.textMuted} />
        </View>
        <Text style={styles.emptyTitle}>
          {error ? 'Route Sync Required' : 'No Route Assigned'}
        </Text>
        <Text style={styles.loadingText}>
          {error || 'No active routes scheduled for your vehicle today.'}
        </Text>
        <TouchableOpacity style={styles.retryBtn} onPress={refreshRoute} activeOpacity={0.85}>
          <Ionicons name="refresh" size={15} color="#FFFFFF" />
          <Text style={styles.retryBtnText}>Check for Updates</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={refreshRoute}
          tintColor={colors.primary}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header Greeting & Route Status */}
      <View style={styles.greetingHeader}>
        <View style={styles.greetingLeft}>
          <Text style={styles.routeCodeTag}>
            ROUTE {routeCode || `ID-${route.id}`}
          </Text>
          <Text style={styles.driverNameText}>{driverName}</Text>
        </View>

        <View style={styles.statusBadge}>
          <Ionicons name="shield-checkmark" size={13} color={colors.primary} />
          <Text style={styles.statusBadgeText}>
            {route.status === 'IN_PROGRESS'
              ? 'In Transit'
              : route.status === 'COMPLETED'
              ? 'Completed'
              : 'Assigned'}
          </Text>
        </View>
      </View>

      {/* Start Route Action Banner if Route is Assigned/Ready */}
      {(route.status === 'ASSIGNED' || route.status === 'READY') && (
        <View style={styles.startRouteBanner}>
          <View style={styles.startBannerInfo}>
            <Text style={styles.startBannerTitle}>Route Ready</Text>
            <Text style={styles.startBannerSub}>Start route to begin guided stops</Text>
          </View>
          <TouchableOpacity
            style={styles.startBannerBtn}
            onPress={startRoute}
            disabled={actionLoading}
            activeOpacity={0.85}
          >
            <Ionicons name="play" size={14} color="#FFFFFF" />
            <Text style={styles.startBannerBtnText}>Start Route</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Prominent Active Task Card */}
      <ActiveTaskCard
        stop={activeStop}
        stopIndex={stats.currentStopIndex}
        totalStops={stats.totalStops}
        onExecute={handleExecuteStop}
        isLoading={actionLoading}
      />

      {/* Quick Stats Strip */}
      <QuickStatsStrip
        vehicleReg={
          route.vehicle_registration_number
            ? `Van ${route.vehicle_registration_number}`
            : 'Service Fleet'
        }
        completedStops={stats.completedStops}
        totalStops={stats.totalStops}
      />

      {/* Schedule Overview */}
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
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.gutter,
    paddingBottom: 90,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.headlineSm,
    color: colors.primary,
    marginBottom: 4,
    textAlign: 'center',
  },
  loadingText: {
    ...typography.bodySm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    maxWidth: 280,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryAccent,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radii.md,
  },
  retryBtnText: {
    ...typography.labelMd,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  greetingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  greetingLeft: {
    flex: 1,
  },
  routeCodeTag: {
    ...typography.labelSm,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  driverNameText: {
    ...typography.headlineMd,
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.lightAccent,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(123, 145, 238, 0.3)',
  },
  statusBadgeText: {
    ...typography.labelSm,
    fontSize: 11,
    color: colors.primary,
    fontWeight: '700',
  },
  startRouteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.secondary,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.subtle,
  },
  startBannerInfo: {
    flex: 1,
    marginRight: 8,
  },
  startBannerTitle: {
    ...typography.labelLg,
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  startBannerSub: {
    ...typography.bodySm,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  startBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryAccent,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radii.md,
  },
  startBannerBtnText: {
    ...typography.labelMd,
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});

export default OperationsScreen;
