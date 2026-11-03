import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography, shadows } from '../../theme';
import { useDriverRoute } from '../../hooks/useDriverRoute';
import { RouteMap } from '../../components/routes/RouteMap';
import { NextStopCard } from '../../components/routes/NextStopCard';
import { RouteItineraryAccordion } from '../../components/routes/RouteItineraryAccordion';
import { RouteStop } from '../../types/api';

interface RoutesScreenProps {
  onNavigateToTab: (tab: 'operations' | 'routes' | 'pickups' | 'profile') => void;
  selectedStop?: RouteStop | null;
}

export const RoutesScreen: React.FC<RoutesScreenProps> = ({
  onNavigateToTab,
  selectedStop: propSelectedStop,
}) => {
  const {
    route,
    activeStop: routeActiveStop,
    selectedStop: contextSelectedStop,
    setSelectedStop,
    stats,
    isLoading,
    actionLoading,
    refreshRoute,
    arriveAtStop,
  } = useDriverRoute();

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const displayStop = propSelectedStop || contextSelectedStop || routeActiveStop;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  const handleArrival = async () => {
    if (!displayStop || !route) return;

    if (displayStop.stop_type === 'WAREHOUSE') {
      onNavigateToTab('profile');
      return;
    }

    if (displayStop.execution_status === 'COMPLETED') {
      const nextPending = route.stops.find(
        (s) => s.execution_status !== 'COMPLETED' && s.execution_status !== 'FAILED'
      );
      if (nextPending) {
        setSelectedStop(nextPending);
        showToast(`Next stop: ${nextPending.customer_name || 'Stop'}`);
      } else {
        onNavigateToTab('profile');
      }
      return;
    }

    if (displayStop.execution_status === 'ARRIVED' || displayStop.execution_status === 'IN_PROGRESS') {
      setSelectedStop(displayStop);
      onNavigateToTab('pickups');
      return;
    }

    try {
      await arriveAtStop(displayStop.id);
      setSelectedStop(displayStop);
      showToast(`Arrived at ${displayStop.customer_name || 'Stop'}`);
      setTimeout(() => {
        onNavigateToTab('pickups');
      }, 600);
    } catch (err: any) {
      showToast(err.message || 'Arrival confirmation failed.');
    }
  };

  if (isLoading && !route) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primaryAccent} />
        <Text style={styles.loadingText}>Syncing route itinerary...</Text>
      </View>
    );
  }

  if (!route) {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.emptyIconBox}>
          <Ionicons name="map-outline" size={36} color={colors.textMuted} />
        </View>
        <Text style={styles.emptyTitle}>No Active Route</Text>
        <Text style={styles.loadingText}>
          Route navigation will appear once an itinerary is assigned.
        </Text>
        <TouchableOpacity
          style={styles.returnBtn}
          onPress={() => onNavigateToTab('operations')}
          activeOpacity={0.85}
        >
          <Ionicons name="arrow-back" size={15} color="#FFFFFF" />
          <Text style={styles.returnBtnText}>Operations Overview</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Dynamic route metrics without hardcoded strings
  const remainingCount = Math.max(0, stats.totalStops - stats.completedStops);
  const routeStatusLabel =
    route.planned_duration_seconds && route.planned_distance_km
      ? `${Math.round(route.planned_duration_seconds / 60)} min / ${route.planned_distance_km} km`
      : `${remainingCount} stops remaining`;

  return (
    <View style={styles.wrapper}>
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
        {/* Route Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <View style={styles.enRouteRow}>
              <View style={styles.pulseDot} />
              <Text style={styles.enRouteText}>
                STOP {stats.currentStopIndex} OF {stats.totalStops}
              </Text>
            </View>
            <View style={styles.metricsPill}>
              <Text style={styles.metricsText}>{routeStatusLabel}</Text>
            </View>
          </View>

          <View style={styles.summaryBottom}>
            <View style={styles.turnGroup}>
              <View style={styles.turnIconCircle}>
                <Ionicons name="navigate" size={16} color="#FFFFFF" />
              </View>
              <View style={styles.turnTextGroup}>
                <Text style={styles.turnTitle}>
                  Stop {stats.currentStopIndex}: {displayStop?.customer_name || 'Destination'}
                </Text>
                <Text style={styles.turnSub} numberOfLines={1}>
                  {displayStop?.address || 'Dock receiving area'}
                </Text>
              </View>
            </View>

            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>
                {displayStop?.execution_status === 'ARRIVED'
                  ? 'Arrived'
                  : displayStop?.execution_status === 'COMPLETED'
                  ? 'Completed'
                  : 'En Route'}
              </Text>
            </View>
          </View>
        </View>

        {/* Vector Road Map */}
        <RouteMap currentStop={displayStop} onToast={showToast} />

        {/* Next Stop Card */}
        <NextStopCard
          stop={displayStop}
          stopIndex={stats.currentStopIndex}
          totalStops={stats.totalStops}
          onArrived={handleArrival}
          isLoading={actionLoading}
        />

        {/* Route Itinerary Accordion */}
        <RouteItineraryAccordion
          stops={route?.stops || []}
          activeStopId={displayStop?.id}
          onSelectStop={(stop) => {
            setSelectedStop(stop);
            showToast(`Stop ${stop.sequence_number}: ${stop.customer_name || 'Destination'}`);
          }}
        />
      </ScrollView>

      {/* Toast Notification */}
      {toastMessage && (
        <View style={styles.toastContainer}>
          <View style={styles.toastPill}>
            <Ionicons name="information-circle" size={16} color={colors.primaryAccent} />
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.gutter,
    paddingBottom: 90,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
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
  },
  loadingText: {
    ...typography.bodySm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  returnBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radii.md,
  },
  returnBtnText: {
    ...typography.labelMd,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.secondary,
    marginBottom: spacing.md,
    gap: 10,
    ...shadows.subtle,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.secondary,
    paddingBottom: 8,
  },
  enRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primaryAccent,
  },
  enRouteText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.primary,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  metricsPill: {
    backgroundColor: colors.lightAccent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  metricsText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.primary,
    fontWeight: '700',
  },
  summaryBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  turnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  turnIconCircle: {
    width: 34,
    height: 34,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  turnTextGroup: {
    flex: 1,
  },
  turnTitle: {
    ...typography.headlineSm,
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  turnSub: {
    ...typography.bodySm,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  statusPill: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.secondary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.xs,
  },
  statusPillText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  toastContainer: {
    position: 'absolute',
    bottom: 24,
    left: spacing.gutter,
    right: spacing.gutter,
    alignItems: 'center',
  },
  toastPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.secondary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.full,
    ...shadows.card,
  },
  toastText: {
    ...typography.bodySm,
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
});

export default RoutesScreen;
