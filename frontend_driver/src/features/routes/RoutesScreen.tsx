import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../../theme';
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
        showToast(`Advancing to next pending stop: ${nextPending.customer_name || 'Stop'}`);
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
      showToast(`Arrived at ${displayStop.customer_name || 'Stop'}. Auto-transitioning to Pickups Pipeline...`);
      setTimeout(() => {
        onNavigateToTab('pickups');
      }, 700);
    } catch (err: any) {
      showToast(err.message || 'Arrival confirmation failed.');
    }
  };

  if (isLoading && !route) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primaryAction} />
        <Text style={styles.loadingText}>Loading route navigation...</Text>
      </View>
    );
  }

  if (!route) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="map-outline" size={48} color={colors.textSecondary} />
        <Text style={[typography.headlineSm, { color: colors.textPrimary, marginTop: 8 }]}>
          No Active Navigation Route
        </Text>
        <Text style={styles.loadingText}>
          Route itinerary will appear here once assigned for today.
        </Text>
        <TouchableOpacity
          style={{
            marginTop: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: colors.primaryDark,
            paddingVertical: 12,
            paddingHorizontal: 20,
            borderRadius: radii.md,
          }}
          onPress={() => onNavigateToTab('operations')}
        >
          <Ionicons name="arrow-back" size={16} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
            Return to Operations
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const destinationName = displayStop?.customer_name || displayStop?.location_name || displayStop?.warehouse_name || 'Stop';

  return (
    <View style={styles.wrapper}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refreshRoute} tintColor={colors.primaryDark} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Route Selector & Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <View style={styles.enRouteRow}>
              <View style={styles.pulseOuter}>
                <View style={styles.pulseInner} />
              </View>
              <Text style={styles.enRouteText}>
                EN ROUTE TO STOP {stats.currentStopIndex} OF {stats.totalStops || 8}
              </Text>
            </View>
            <View style={styles.etaDurationPill}>
              <Text style={styles.etaDurationText}>12 min • 3.4 km</Text>
            </View>
          </View>

          <View style={styles.summaryBottom}>
            <View style={styles.turnGroup}>
              <View style={styles.turnIconCircle}>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </View>
              <View style={styles.turnTextGroup}>
                <Text style={styles.turnTitle}>Proceed to Stop {stats.currentStopIndex}</Text>
                <Text style={styles.turnSub} numberOfLines={1}>
                  onto {displayStop?.address || displayStop?.location_name || 'Assigned Destination'}
                </Text>
              </View>
            </View>

            <View style={styles.etaBlock}>
              <Text style={styles.etaLabel}>STATUS</Text>
              <Text style={styles.etaValue}>
                {displayStop?.execution_status || 'En Route'}
              </Text>
            </View>
          </View>
        </View>

        {/* High Fidelity Interactive Simulated Hazmat Map */}
        <RouteMap
          currentStop={displayStop}
          onToast={showToast}
        />

        {/* Next Stop Turn-by-Turn Instruction Card */}
        <NextStopCard
          stop={displayStop}
          stopIndex={stats.currentStopIndex}
          totalStops={stats.totalStops}
          onArrived={handleArrival}
          isLoading={actionLoading}
        />

        {/* Complete Stops Pipeline List Accordion */}
        <RouteItineraryAccordion
          stops={route?.stops || []}
          activeStopId={displayStop?.id}
          onSelectStop={(stop) => {
            setSelectedStop(stop);
            showToast(`Focused on Stop ${stop.sequence_number}: ${stop.customer_name || 'Destination'}`);
          }}
        />
      </ScrollView>

      {/* Floating Feedback Toast */}
      {toastMessage && (
        <View style={styles.toastContainer}>
          <View style={styles.toastPill}>
            <Ionicons name="information-circle" size={17} color={colors.primaryTint} />
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
    backgroundColor: colors.canvas,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.gutter,
    gap: 12,
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
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    gap: 10,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 8,
  },
  enRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulseOuter: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primaryDark,
  },
  enRouteText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.primaryDark,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  etaDurationPill: {
    backgroundColor: colors.primaryTint,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(123, 145, 238, 0.4)',
  },
  etaDurationText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.onPrimaryContainer,
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
    width: 36,
    height: 36,
    borderRadius: radii.lg,
    backgroundColor: colors.primaryDark,
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
    color: colors.ink,
  },
  turnSub: {
    ...typography.bodySm,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  etaBlock: {
    backgroundColor: colors.surfaceLow,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'flex-end',
  },
  etaLabel: {
    ...typography.labelSm,
    fontSize: 9,
    color: colors.textOutline,
    fontWeight: '700',
  },
  etaValue: {
    ...typography.headlineSm,
    fontSize: 14,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  toastContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 100,
  },
  toastPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.ink,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.full,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  toastText: {
    ...typography.bodySm,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default RoutesScreen;
