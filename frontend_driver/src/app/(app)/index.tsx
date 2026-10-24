import React from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useStartRoute, useTodayRoute } from '@/hooks/useDriverRoute';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import { PrimaryButton } from '@/components/PrimaryButton';

export default function DriverDashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { driver, user } = useAuth();
  const { data: route, isLoading, isError, error, refetch, isRefetching } = useTodayRoute();
  const startRouteMutation = useStartRoute();

  const stops = route?.stops || [];
  const completedStops = stops.filter((s) => s.execution_status === 'COMPLETED');
  const failedStops = stops.filter((s) => s.execution_status === 'FAILED');
  const pendingStops = stops.filter(
    (s) => s.execution_status === 'PENDING' || s.execution_status === 'ARRIVED' || s.execution_status === 'IN_PROGRESS'
  );
  const totalStops = stops.length;
  const progressPercent = totalStops > 0 ? Math.round((completedStops.length / totalStops) * 100) : 0;

  // Next actionable stop
  const nextStop = stops.find(
    (s) => s.execution_status === 'ARRIVED' || s.execution_status === 'IN_PROGRESS' || s.execution_status === 'PENDING'
  );

  const totalCollectedWeight = completedStops
    .reduce((acc, s) => acc + (s.collected_weight_kg || 0), 0)
    .toFixed(1);

  const handleStartRoute = async () => {
    if (!route) return;
    try {
      await startRouteMutation.mutateAsync({ routeId: route.id });
      router.push('/(app)/route');
    } catch (err: any) {
      alert(err.message || 'Unable to start route.');
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.driverGreeting}>HELLO, {driver?.name?.toUpperCase() || 'DRIVER'}</Text>
          <Text style={styles.employeeTag}>
            ID: {driver?.employee_id || 'EMP-N/A'} • {driver?.license_number ? `LIC: ${driver.license_number}` : ''}
          </Text>
        </View>
        <View style={styles.availabilityPill}>
          <View
            style={[
              styles.availDot,
              { backgroundColor: driver?.is_available ? '#10B981' : Colors.amber },
            ]}
          />
          <Text style={styles.availText}>
            {driver?.is_available ? 'Available' : 'On Route'}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              refetch();
            }}
            tintColor={Colors.amber}
            colors={[Colors.amber]}
          />
        }
      >
        {/* Loading State */}
        {isLoading ? (
          <View style={styles.centeredBox}>
            <ActivityIndicator size="large" color={Colors.amber} />
            <Text style={styles.centeredText}>Loading today's schedule...</Text>
          </View>
        ) : isError ? (
          /* Error State */
          <Card style={styles.stateCard}>
            <Ionicons name="cloud-offline-outline" size={48} color="#EF4444" />
            <Text style={styles.stateTitle}>Connection Error</Text>
            <Text style={styles.stateSubtitle}>
              {error?.message || 'Unable to reach Pharmatrix backend.'}
            </Text>
            <PrimaryButton
              title="RETRY"
              onPress={() => refetch()}
              variant="outline"
              size="md"
              style={{ marginTop: Spacing.md }}
            />
          </Card>
        ) : !route ? (
          /* Empty State: No Route Assigned Today */
          <Card style={styles.stateCard}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="calendar-outline" size={36} color={Colors.amber} />
            </View>
            <Text style={styles.stateTitle}>No Route Assigned</Text>
            <Text style={styles.stateSubtitle}>
              You currently have no active or scheduled route for today. Please standby or contact your dispatch manager.
            </Text>
            <PrimaryButton
              title="REFRESH SCHEDULE"
              onPress={() => refetch()}
              variant="outline"
              size="md"
              style={{ marginTop: Spacing.md }}
            />
          </Card>
        ) : (
          /* Active Route Content */
          <>
            {/* Today's Route Banner Card */}
            <Card style={styles.routeBannerCard} accentColor={Colors.amber}>
              <View style={styles.routeHeaderRow}>
                <View>
                  <Text style={styles.routeCodeLabel}>TODAY'S ASSIGNED RUN</Text>
                  <Text style={styles.routeCodeValue}>{route.route_code}</Text>
                </View>
                <StatusBadge status={route.status} size="md" />
              </View>

              {/* Vehicle & Warehouse Info */}
              <View style={styles.routeInfoGrid}>
                <View style={styles.routeInfoCol}>
                  <Ionicons name="car-outline" size={18} color={Colors.amber} />
                  <View style={{ marginLeft: Spacing.xs }}>
                    <Text style={styles.infoColLabel}>VEHICLE</Text>
                    <Text style={styles.infoColValue}>
                      {route.vehicle_registration_number || 'Unassigned'}
                    </Text>
                  </View>
                </View>

                <View style={styles.routeInfoCol}>
                  <Ionicons name="business-outline" size={18} color={Colors.amber} />
                  <View style={{ marginLeft: Spacing.xs }}>
                    <Text style={styles.infoColLabel}>WAREHOUSE</Text>
                    <Text style={styles.infoColValue} numberOfLines={1}>
                      {route.warehouse_name}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Progress bar */}
              <View style={styles.progressContainer}>
                <View style={styles.progressLabelRow}>
                  <Text style={styles.progressLabel}>ROUTE PROGRESS</Text>
                  <Text style={styles.progressValue}>
                    {completedStops.length} of {totalStops} stops ({progressPercent}%)
                  </Text>
                </View>
                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${progressPercent}%` },
                    ]}
                  />
                </View>
              </View>

              {/* Route Action Button */}
              {route.status === 'ASSIGNED' ? (
                <PrimaryButton
                  title="START TODAY'S ROUTE"
                  onPress={handleStartRoute}
                  loading={startRouteMutation.isPending}
                  icon={<Ionicons name="play" size={20} color="#000" />}
                  style={{ marginTop: Spacing.md }}
                />
              ) : route.status === 'IN_PROGRESS' ? (
                <PrimaryButton
                  title={nextStop ? `CONTINUE STOP #${nextStop.sequence_number}` : 'VIEW ROUTE STOPS'}
                  onPress={() => {
                    if (nextStop?.id) {
                      router.push(`/(app)/stops/${nextStop.id}`);
                    } else {
                      router.push('/(app)/route');
                    }
                  }}
                  icon={<Ionicons name="arrow-forward" size={20} color="#000" />}
                  style={{ marginTop: Spacing.md }}
                />
              ) : (
                <View style={styles.completedRouteNotice}>
                  <Ionicons name="checkmark-done-circle" size={20} color="#10B981" />
                  <Text style={styles.completedNoticeText}>Route Successfully Completed</Text>
                </View>
              )}
            </Card>

            {/* Quick Metrics Grid */}
            <View style={styles.metricsGrid}>
              <Card style={styles.metricCard}>
                <Ionicons name="location" size={24} color={Colors.amber} />
                <Text style={styles.metricValue}>{pendingStops.length}</Text>
                <Text style={styles.metricLabel}>Pending Stops</Text>
              </Card>

              <Card style={styles.metricCard}>
                <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                <Text style={styles.metricValue}>{completedStops.length}</Text>
                <Text style={styles.metricLabel}>Completed</Text>
              </Card>

              <Card style={styles.metricCard}>
                <Ionicons name="scale-outline" size={24} color="#60A5FA" />
                <Text style={styles.metricValue}>{totalCollectedWeight} kg</Text>
                <Text style={styles.metricLabel}>Waste Collected</Text>
              </Card>
            </View>

            {/* Next Action Priority Card */}
            {nextStop ? (
              <Card style={styles.nextStopCard}>
                <View style={styles.nextStopHeader}>
                  <View style={styles.sequenceBadge}>
                    <Text style={styles.sequenceBadgeText}>
                      #{nextStop.sequence_number}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: Spacing.md }}>
                    <Text style={styles.nextStopType}>
                      NEXT ACTION: {nextStop.stop_type}
                    </Text>
                    <Text style={styles.nextStopName} numberOfLines={1}>
                      {nextStop.stop_type === 'PICKUP'
                        ? nextStop.location_name || nextStop.customer_name || 'Customer Pickup'
                        : nextStop.warehouse_name || 'Warehouse Intake'}
                    </Text>
                  </View>
                  <StatusBadge status={nextStop.execution_status} size="sm" />
                </View>

                <View style={styles.addressRow}>
                  <Ionicons name="navigate-outline" size={16} color={Colors.textMuted} />
                  <Text style={styles.addressText} numberOfLines={2}>
                    {nextStop.address}, {nextStop.city}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.openStopButton}
                  onPress={() => {
                    if (nextStop.id) {
                      router.push(`/(app)/stops/${nextStop.id}`);
                    } else {
                      router.push('/(app)/route');
                    }
                  }}
                >
                  <Text style={styles.openStopButtonText}>OPEN STOP DETAILS</Text>
                  <Ionicons name="chevron-forward" size={18} color="#000" />
                </TouchableOpacity>
              </Card>
            ) : null}

            {/* Exceptions Warning Card if any */}
            {failedStops.length > 0 ? (
              <Card style={styles.exceptionAlertCard} accentColor="#EF4444">
                <View style={styles.exceptionAlertHeader}>
                  <Ionicons name="warning" size={20} color="#EF4444" />
                  <Text style={styles.exceptionAlertTitle}>
                    {failedStops.length} STOP EXCEPTION{failedStops.length > 1 ? 'S' : ''} REPORTED
                  </Text>
                </View>
                <Text style={styles.exceptionAlertText}>
                  Dispatch has been notified. You can review exception notes in the Exceptions tab.
                </Text>
              </Card>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.navyDark,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.navy,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  driverGreeting: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.black,
    color: Colors.white,
    letterSpacing: 0.5,
  },
  employeeTag: {
    fontSize: Typography.sizes.xs,
    color: Colors.amber,
    fontWeight: Typography.weights.semibold,
    marginTop: 2,
  },
  availabilityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F1A2F',
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  availDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  availText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    color: Colors.white,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl * 2,
  },
  centeredBox: {
    padding: Spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centeredText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
    marginTop: Spacing.md,
  },
  stateCard: {
    alignItems: 'center',
    padding: Spacing.xxl,
    marginTop: Spacing.xl,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(252, 163, 17, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  stateTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.white,
    marginTop: Spacing.sm,
  },
  stateSubtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: Spacing.xs,
  },
  routeBannerCard: {
    marginBottom: Spacing.lg,
  },
  routeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  routeCodeLabel: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    color: Colors.amber,
    letterSpacing: 1.5,
  },
  routeCodeValue: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.black,
    color: Colors.white,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  routeInfoGrid: {
    flexDirection: 'row',
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  routeInfoCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoColLabel: {
    fontSize: 9,
    color: Colors.textMuted,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.5,
  },
  infoColValue: {
    fontSize: Typography.sizes.sm,
    color: Colors.white,
    fontWeight: Typography.weights.semibold,
  },
  progressContainer: {
    marginTop: Spacing.md,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  progressLabel: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  progressValue: {
    fontSize: Typography.sizes.xs,
    color: Colors.amber,
    fontWeight: Typography.weights.bold,
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0E172B',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.amber,
    borderRadius: 4,
  },
  completedRouteNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  completedNoticeText: {
    color: '#34D399',
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  metricCard: {
    flex: 1,
    padding: Spacing.md,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.black,
    color: Colors.white,
    marginTop: Spacing.xs,
  },
  metricLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  nextStopCard: {
    backgroundColor: '#1E2F52',
    borderColor: Colors.amber,
    marginBottom: Spacing.lg,
  },
  nextStopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sequenceBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.amber,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sequenceBadgeText: {
    color: '#000',
    fontWeight: Typography.weights.black,
    fontSize: Typography.sizes.md,
  },
  nextStopType: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    color: Colors.amber,
    letterSpacing: 1,
  },
  nextStopName: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.white,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  addressText: {
    flex: 1,
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  openStopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.amber,
    borderRadius: Radius.md,
    height: 44,
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  openStopButtonText: {
    color: '#000',
    fontWeight: Typography.weights.bold,
    fontSize: Typography.sizes.sm,
    letterSpacing: 0.5,
  },
  exceptionAlertCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  exceptionAlertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  exceptionAlertTitle: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.black,
    color: '#EF4444',
    letterSpacing: 1,
  },
  exceptionAlertText: {
    fontSize: Typography.sizes.xs,
    color: '#FCA5A5',
    marginTop: Spacing.xs,
    lineHeight: 18,
  },
});
