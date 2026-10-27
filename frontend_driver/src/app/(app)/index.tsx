import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
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
import { Colors, Radius, Spacing, Typography, Shadows } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useArriveStop, useStartRoute, useTodayRoute } from '@/hooks/useDriverRoute';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import { PrimaryButton } from '@/components/PrimaryButton';
import { DriverRouteStopResponse } from '@/types/api';

export default function DriverHomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { driver, user } = useAuth();
  const { data: route, isLoading, isError, error, refetch, isRefetching } = useTodayRoute();
  const startRouteMutation = useStartRoute();
  const arriveMutation = useArriveStop();

  const stops = useMemo(() => route?.stops || [], [route]);
  const pickupStops = useMemo(() => stops.filter((s) => s.stop_type === 'PICKUP'), [stops]);

  const completedPickups = useMemo(
    () => pickupStops.filter((s) => s.execution_status === 'COMPLETED'),
    [pickupStops]
  );

  const pendingPickups = useMemo(
    () => pickupStops.filter((s) => s.execution_status === 'PENDING'),
    [pickupStops]
  );

  // Active or next actionable stop in exact sequence
  const activeStop = useMemo(
    () =>
      stops.find(
        (s) => s.execution_status === 'ARRIVED' || s.execution_status === 'IN_PROGRESS'
      ),
    [stops]
  );

  const nextStop: DriverRouteStopResponse | undefined = useMemo(() => {
    if (activeStop) return activeStop;
    return stops.find((s) => s.execution_status === 'PENDING');
  }, [activeStop, stops]);

  const remainingStopsCount = useMemo(
    () => stops.filter((s) => s.execution_status !== 'COMPLETED' && s.execution_status !== 'FAILED').length,
    [stops]
  );

  const totalStops = stops.length;
  const progressPercent = totalStops > 0 ? Math.round(((totalStops - remainingStopsCount) / totalStops) * 100) : 0;

  const currentDateFormatted = useMemo(() => {
    return new Date().toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }, []);

  const handleStartRoute = async () => {
    if (!route) return;
    try {
      await startRouteMutation.mutateAsync({ routeId: route.id });
      if (nextStop) {
        router.push(`/(app)/stops/${nextStop.id}` as any);
      } else {
        router.push('/(app)/route');
      }
    } catch (err: any) {
      Alert.alert('Route Start Failed', err.message || 'Unable to start route.');
    }
  };

  const handleQuickArrive = async (stop: DriverRouteStopResponse) => {
    if (!route) return;
    try {
      await arriveMutation.mutateAsync({
        routeId: route.id,
        stopId: stop.id!,
      });
      Alert.alert(
        'Arrival Confirmed',
        `Presence verified at ${stop.customer_name || 'stop'}. Proceeding to container QR and customer OTP handshake.`,
        [
          {
            text: 'Open Stop Pipeline',
            onPress: () => router.push(`/(app)/stops/${stop.id}` as any),
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Arrival Error', err.message || 'Unable to stamp arrival.');
    }
  };

  const handleOpenMap = (lat?: number | null, lng?: number | null, label = 'Stop') => {
    if (!lat || !lng) {
      Alert.alert('GPS Unavailable', 'No GPS coordinates recorded for this location.');
      return;
    }
    const encoded = encodeURIComponent(label);
    const url = Platform.select({
      ios: `maps:0,0?q=${encoded}@${lat},${lng}`,
      android: `geo:0,0?q=${lat},${lng}(${encoded})`,
      default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    });
    if (url) Linking.openURL(url);
  };

  const handleCall = (phone?: string | null) => {
    if (!phone) {
      Alert.alert('No Phone', 'No contact phone recorded for this customer.');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  // Determine the exact single primary button action for current operational state
  const getPrimaryActionSpec = () => {
    if (!route) return null;
    if (route.status === 'ASSIGNED') {
      return {
        label: "START TODAY'S ROUTE EXECUTION",
        icon: 'play',
        sublabel: 'Authorize vehicle departure from depot',
        onPress: handleStartRoute,
      };
    }
    if (!nextStop) {
      return {
        label: 'VIEW ACTIVITY AUDIT TRAIL',
        icon: 'checkmark-done',
        sublabel: 'All assigned stops finished for today',
        onPress: () => router.push('/(app)/history' as any),
      };
    }
    if (nextStop.execution_status === 'PENDING') {
      return {
        label: `PROCEED TO STOP #${nextStop.sequence_number}`,
        icon: 'navigate',
        sublabel: `Next: ${nextStop.customer_name || 'Biomedical Pickup'}`,
        onPress: () => router.push(`/(app)/stops/${nextStop.id}` as any),
      };
    }
    if (nextStop.execution_status === 'ARRIVED') {
      return {
        label: `VERIFY OTP HANDSHAKE — STOP #${nextStop.sequence_number}`,
        icon: 'key',
        sublabel: 'Driver presence confirmed. Custody OTP handshake pending',
        onPress: () => router.push(`/(app)/stops/${nextStop.id}` as any),
      };
    }
    if (nextStop.execution_status === 'IN_PROGRESS') {
      return {
        label: `WEIGH & FINALIZE — STOP #${nextStop.sequence_number}`,
        icon: 'cube',
        sublabel: 'Record net weight (kg) & upload photo evidence',
        onPress: () => router.push(`/(app)/stops/${nextStop.id}` as any),
      };
    }
    if (nextStop.stop_type === 'WAREHOUSE') {
      return {
        label: 'PROCEED TO WAREHOUSE INTAKE',
        icon: 'business',
        sublabel: 'Deliver all collected waste consignments',
        onPress: () => router.push(`/(app)/stops/${nextStop.id}` as any),
      };
    }
    return {
      label: 'OPEN STOP DETAILS',
      icon: 'arrow-forward',
      sublabel: 'Review customer requirements and guidelines',
      onPress: () => router.push(`/(app)/stops/${nextStop.id}` as any),
    };
  };

  const heroAction = getPrimaryActionSpec();

  // Shift Stepper active index: 0 = Route start, 1 = Arrive, 2 = QR & OTP, 3 = Weigh, 4 = Warehouse
  const currentStepIndex = useMemo(() => {
    if (!route || route.status === 'ASSIGNED') return 0;
    if (!nextStop || route.status === 'COMPLETED') return 4;
    if (nextStop.stop_type === 'WAREHOUSE') return 4;
    if (nextStop.execution_status === 'PENDING') return 1;
    if (nextStop.execution_status === 'ARRIVED') return 2;
    if (nextStop.execution_status === 'IN_PROGRESS') return 3;
    return 1;
  }, [route, nextStop]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Sleek Minimal Header */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.dateText}>{currentDateFormatted.toUpperCase()}</Text>
          <Text style={styles.driverName}>
            {driver?.name || user?.name || 'Operations Driver'}
          </Text>
          <View style={styles.tagRow}>
            <Text style={styles.empTag}>ID: {driver?.employee_id || 'DRV-PM-001'}</Text>
            {route?.vehicle_registration_number ? (
              <Text style={styles.vehicleTag}>• {route.vehicle_registration_number}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.headerRight}>
          <View style={styles.statusPill}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: driver?.is_available ? '#15803D' : '#D97706' },
              ]}
            />
            <Text style={styles.statusText}>
              {driver?.is_available ? 'Available' : 'On Duty'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => refetch()}
            disabled={isRefetching}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={isRefetching ? 'sync' : 'refresh-outline'}
              size={18}
              color={Colors.primary}
            />
          </TouchableOpacity>
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
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {isLoading ? (
          <View style={styles.centeredBox}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.centeredText}>Loading today's route...</Text>
          </View>
        ) : isError && (error as any)?.status !== 404 ? (
          <Card style={styles.stateCard}>
            <Ionicons name="cloud-offline-outline" size={44} color="#DC2626" />
            <Text style={styles.stateTitle}>Backend Connection Error</Text>
            <Text style={styles.stateSubtitle}>{error?.message || 'Failed to connect'}</Text>
            <PrimaryButton
              title="RETRY CONNECTION"
              onPress={() => refetch()}
              size="md"
              style={{ marginTop: Spacing.md }}
            />
          </Card>
        ) : !route ? (
          <Card style={styles.stateCard}>
            <View style={styles.emptyCircle}>
              <Ionicons name="calendar-outline" size={32} color={Colors.primary} />
            </View>
            <Text style={styles.stateTitle}>No Active Route Today</Text>
            <Text style={styles.stateSubtitle}>
              You currently have no scheduled pickup route assigned. Please contact dispatch or pull down to check for updates.
            </Text>
            <PrimaryButton
              title="CHECK FOR ASSIGNMENT"
              onPress={() => refetch()}
              variant="outline"
              size="md"
              style={{ marginTop: Spacing.md }}
            />
          </Card>
        ) : (
          <>
            {/* 1. OPERATIONAL SUMMARY CARDS (2x2 GRID) */}
            <View style={styles.metricsGrid}>
              {/* Card 1: Assigned Route */}
              <Card style={styles.metricCard}>
                <View style={styles.metricHeader}>
                  <Text style={styles.metricLabel}>ROUTE</Text>
                  <StatusBadge status={route.status} size="sm" />
                </View>
                <Text style={styles.metricMainValue} numberOfLines={1}>
                  {route.route_code}
                </Text>
                <Text style={styles.metricSubText}>
                  {route.planned_distance_km ? `${route.planned_distance_km} km planned` : 'Daily Manifest'}
                </Text>
              </Card>

              {/* Card 2: Remaining Stops */}
              <Card style={styles.metricCard}>
                <View style={styles.metricHeader}>
                  <Text style={styles.metricLabel}>REMAINING</Text>
                  <Ionicons name="time-outline" size={16} color={Colors.primary} />
                </View>
                <Text style={styles.metricMainValue}>
                  {remainingStopsCount} <Text style={styles.metricUnit}>stops</Text>
                </Text>
                <Text style={styles.metricSubText}>
                  {progressPercent}% completed
                </Text>
              </Card>

              {/* Card 3: Completed Pickups */}
              <Card style={styles.metricCard}>
                <View style={styles.metricHeader}>
                  <Text style={styles.metricLabel}>CONSIGNMENTS</Text>
                  <Ionicons name="cube-outline" size={16} color="#15803D" />
                </View>
                <Text style={styles.metricMainValue}>
                  {completedPickups.length} <Text style={styles.metricUnit}>/ {pickupStops.length}</Text>
                </Text>
                <Text style={styles.metricSubText}>
                  {pendingPickups.length} pending pickup
                </Text>
              </Card>

              {/* Card 4: Assigned Van */}
              <Card style={styles.metricCard}>
                <View style={styles.metricHeader}>
                  <Text style={styles.metricLabel}>FLEET VEHICLE</Text>
                  <Ionicons name="car-outline" size={16} color={Colors.primaryDark} />
                </View>
                <Text style={styles.metricMainValue} numberOfLines={1}>
                  {route.vehicle_registration_number || 'Van Assigned'}
                </Text>
                <Text style={styles.metricSubText}>
                  Intake: {route.warehouse_name}
                </Text>
              </Card>
            </View>

            {/* 2. PROMINENT HERO TASK CARD */}
            <Card style={styles.heroCard} accentColor={Colors.primary}>
              <View style={styles.heroHeaderRow}>
                <View style={styles.runBadge}>
                  <Ionicons name="flash" size={14} color={Colors.primaryDark} />
                  <Text style={styles.runBadgeText}>NEXT OPERATIONAL ACTION</Text>
                </View>
                <StatusBadge status={nextStop ? nextStop.execution_status : route.status} size="sm" />
              </View>

              {route.status === 'COMPLETED' ? (
                <View style={styles.concludedBox}>
                  <Ionicons name="checkmark-circle" size={48} color="#15803D" />
                  <Text style={styles.concludedTitle}>Shift Complete!</Text>
                  <Text style={styles.concludedSub}>
                    All biomedical waste consignments safely collected and handed over to central facility.
                  </Text>
                </View>
              ) : nextStop ? (
                <View style={styles.nextStopBlock}>
                  <View style={styles.stopTitleRow}>
                    <View style={styles.seqCircle}>
                      <Text style={styles.seqText}>#{nextStop.sequence_number}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                      <Text style={styles.nextCategoryTag}>
                        {nextStop.stop_type === 'PICKUP' ? 'SCHEDULED PICKUP' : 'CENTRAL INTAKE FACILITY'}
                      </Text>
                      <Text style={styles.stopName} numberOfLines={1}>
                        {nextStop.stop_type === 'PICKUP'
                          ? nextStop.customer_name || nextStop.location_name || 'Customer'
                          : nextStop.warehouse_name || 'Central Warehouse'}
                      </Text>
                    </View>
                    {nextStop.pickup_code ? (
                      <View style={styles.pickupCodePill}>
                        <Text style={styles.pickupCodePillText}>{nextStop.pickup_code}</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.addressLine}>
                    <Ionicons name="location" size={16} color={Colors.primary} />
                    <Text style={styles.addressText} numberOfLines={2}>
                      {nextStop.address}, {nextStop.city}
                    </Text>
                  </View>

                  {/* Secondary Quick Action Shortcuts */}
                  <View style={styles.heroShortcutRow}>
                    {nextStop.latitude && nextStop.longitude ? (
                      <TouchableOpacity
                        style={styles.heroShortcutBtn}
                        onPress={() =>
                          handleOpenMap(
                            nextStop.latitude,
                            nextStop.longitude,
                            nextStop.customer_name || 'Stop'
                          )
                        }
                      >
                        <Ionicons name="navigate-outline" size={14} color={Colors.primaryDark} />
                        <Text style={styles.heroShortcutText}>Maps Navigation</Text>
                      </TouchableOpacity>
                    ) : null}

                    {nextStop.customer_phone ? (
                      <TouchableOpacity
                        style={styles.heroShortcutBtn}
                        onPress={() => handleCall(nextStop.customer_phone)}
                      >
                        <Ionicons name="call-outline" size={14} color={Colors.primaryDark} />
                        <Text style={styles.heroShortcutText}>Call Contact</Text>
                      </TouchableOpacity>
                    ) : null}

                    {nextStop.execution_status === 'PENDING' ? (
                      <TouchableOpacity
                        style={[styles.heroShortcutBtn, styles.heroShortcutBtnArrive]}
                        onPress={() => handleQuickArrive(nextStop)}
                        disabled={arriveMutation.isPending}
                      >
                        <Ionicons name="checkmark-circle-outline" size={14} color="#15803D" />
                        <Text style={[styles.heroShortcutText, { color: '#15803D' }]}>
                          {arriveMutation.isPending ? 'Stamping...' : 'Confirm Arrival (GPS)'}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              ) : null}

              {/* SINGLE HERO BUTTON — The Driver Never Guesses */}
              {heroAction ? (
                <View style={styles.heroBtnContainer}>
                  <PrimaryButton
                    title={heroAction.label}
                    onPress={heroAction.onPress}
                    loading={startRouteMutation.isPending}
                    icon={<Ionicons name={heroAction.icon as any} size={18} color={Colors.white} />}
                    style={{ marginTop: Spacing.md }}
                  />
                  <Text style={styles.heroBtnSub}>{heroAction.sublabel}</Text>
                </View>
              ) : null}
            </Card>

            {/* 3. SHIFT OPERATIONAL PIPELINE STEPPER */}
            <Card style={styles.stepperCard}>
              <View style={styles.stepperHeader}>
                <Text style={styles.stepperTitle}>OPERATIONAL PIPELINE</Text>
                <Text style={styles.stepperStepCounter}>
                  Stage {Math.min(currentStepIndex + 1, 5)} of 5
                </Text>
              </View>

              <View style={styles.stepperTrack}>
                {[
                  { label: 'Start Route', icon: 'play' },
                  { label: 'Arrive at Stop', icon: 'location' },
                  { label: 'QR & OTP', icon: 'key' },
                  { label: 'Weigh & Proof', icon: 'cube' },
                  { label: 'Intake Handover', icon: 'business' },
                ].map((step, idx) => {
                  const isDone = idx < currentStepIndex || route.status === 'COMPLETED';
                  const isCurrent = idx === currentStepIndex && route.status !== 'COMPLETED';

                  return (
                    <View key={step.label} style={styles.stepperNode}>
                      <View
                        style={[
                          styles.stepperCircle,
                          isDone
                            ? styles.stepperCircleDone
                            : isCurrent
                            ? styles.stepperCircleCurrent
                            : styles.stepperCirclePending,
                        ]}
                      >
                        {isDone ? (
                          <Ionicons name="checkmark" size={12} color={Colors.white} />
                        ) : (
                          <Ionicons
                            name={step.icon as any}
                            size={11}
                            color={isCurrent ? Colors.white : Colors.textMuted}
                          />
                        )}
                      </View>
                      <Text
                        style={[
                          styles.stepperLabel,
                          isDone && styles.stepperLabelDone,
                          isCurrent && styles.stepperLabelCurrent,
                        ]}
                        numberOfLines={1}
                      >
                        {step.label}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {/* Route Progress Bar */}
              <View style={styles.progressRow}>
                <View style={styles.progressBarTrack}>
                  <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
                </View>
                <Text style={styles.progressPercentText}>{progressPercent}%</Text>
              </View>
            </Card>

            {/* 4. SEQUENCED STOPS ITINERARY LIST */}
            <View style={styles.itineraryHeader}>
              <View>
                <Text style={styles.itinerarySectionTitle}>SEQUENCED ROUTE ITINERARY</Text>
                <Text style={styles.itinerarySectionSub}>
                  {totalStops - remainingStopsCount} of {totalStops} stops completed
                </Text>
              </View>
              <TouchableOpacity
                style={styles.viewMapBtn}
                onPress={() => router.push('/(app)/route')}
              >
                <Ionicons name="map-outline" size={14} color={Colors.primaryDark} />
                <Text style={styles.viewMapLink}>Full Map</Text>
              </TouchableOpacity>
            </View>

            {stops.map((stop) => {
              const isPickup = stop.stop_type === 'PICKUP';
              const isDone = stop.execution_status === 'COMPLETED';
              const isFailed = stop.execution_status === 'FAILED';
              const isActive =
                stop.execution_status === 'ARRIVED' || stop.execution_status === 'IN_PROGRESS';

              const title = isPickup
                ? stop.customer_name || stop.location_name || 'Customer'
                : stop.warehouse_name || 'Central Warehouse Intake';

              return (
                <Card
                  key={stop.id}
                  style={styles.stopTile}
                  accentColor={
                    isDone
                      ? '#16A34A'
                      : isFailed
                      ? '#DC2626'
                      : isActive
                      ? Colors.primary
                      : '#D97706'
                  }
                >
                  <View style={styles.stopTileRow}>
                    <View
                      style={[
                        styles.tileSeqBadge,
                        isDone
                          ? styles.tileSeqDone
                          : isFailed
                          ? styles.tileSeqFailed
                          : isActive
                          ? styles.tileSeqActive
                          : styles.tileSeqPending,
                      ]}
                    >
                      <Text
                        style={[
                          styles.tileSeqText,
                          (isDone || isActive || isFailed) && { color: Colors.white },
                        ]}
                      >
                        #{stop.sequence_number}
                      </Text>
                    </View>

                    <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                      <View style={styles.tileHeaderRow}>
                        <Text style={styles.tileTypeTag}>
                          {isPickup ? 'BIOMEDICAL CONSIGNMENT' : 'CENTRAL INTAKE'}
                        </Text>
                        <StatusBadge status={stop.execution_status} size="sm" />
                      </View>
                      <Text style={styles.tileTitle} numberOfLines={1}>
                        {title}
                      </Text>
                      <Text style={styles.tileAddress} numberOfLines={1}>
                        {stop.address}, {stop.city}
                      </Text>
                    </View>
                  </View>

                  {/* Weight / Payload Details & Action Shortcuts */}
                  <View style={styles.stopTileFooter}>
                    <View style={styles.tileMetaGroup}>
                      {stop.estimated_weight_kg ? (
                        <Text style={styles.tileMetaText}>
                          Est: {stop.estimated_weight_kg} kg
                        </Text>
                      ) : null}
                      {stop.collected_weight_kg ? (
                        <Text style={[styles.tileMetaText, { color: '#16A34A', fontWeight: 'bold' }]}>
                          • Collected: {stop.collected_weight_kg} kg
                        </Text>
                      ) : null}
                    </View>

                    <View style={styles.tileActionGroup}>
                      {stop.customer_phone ? (
                        <TouchableOpacity
                          style={styles.tileIconBtn}
                          onPress={() => handleCall(stop.customer_phone)}
                        >
                          <Ionicons name="call" size={13} color={Colors.primaryDark} />
                        </TouchableOpacity>
                      ) : null}

                      {stop.latitude && stop.longitude ? (
                        <TouchableOpacity
                          style={styles.tileIconBtn}
                          onPress={() =>
                            handleOpenMap(
                              stop.latitude,
                              stop.longitude,
                              isPickup ? stop.customer_name || 'Stop' : 'Warehouse'
                            )
                          }
                        >
                          <Ionicons name="navigate" size={13} color={Colors.primaryDark} />
                        </TouchableOpacity>
                      ) : null}

                      <TouchableOpacity
                        style={[
                          styles.tileExecuteBtn,
                          isDone && styles.tileExecuteBtnDone,
                        ]}
                        onPress={() => router.push(`/(app)/stops/${stop.id}` as any)}
                      >
                        <Text
                          style={[
                            styles.tileExecuteBtnText,
                            isDone && { color: Colors.textSecondary },
                          ]}
                        >
                          {isDone ? 'VIEW' : isActive ? 'RESUME' : 'EXECUTE'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </Card>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
    ...Shadows.subtle,
  },
  headerLeft: {
    flex: 1,
  },
  dateText: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  driverName: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.black,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  empTag: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: Typography.weights.medium,
  },
  vehicleTag: {
    fontSize: 11,
    color: Colors.primaryDark,
    fontWeight: Typography.weights.bold,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: Spacing.xs,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  refreshBtn: {
    padding: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.infoSurface,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl * 2,
  },
  centeredBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl * 2,
  },
  centeredText: {
    marginTop: Spacing.md,
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
  },
  stateCard: {
    alignItems: 'center',
    padding: Spacing.xl,
    marginTop: Spacing.xl,
  },
  stateTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginTop: Spacing.md,
  },
  stateSubtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
    lineHeight: 20,
  },
  emptyCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.infoSurface,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* 1. Metrics 2x2 Grid */
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  metricCard: {
    flex: 1,
    minWidth: '47%',
    padding: Spacing.md,
    backgroundColor: Colors.surface,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: Typography.weights.bold,
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  metricMainValue: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.black,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  metricUnit: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    color: Colors.textMuted,
  },
  metricSubText: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  /* 2. Hero Card */
  heroCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  runBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.infoSurface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  runBadgeText: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    color: Colors.primaryDark,
    letterSpacing: 0.5,
  },
  concludedBox: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  concludedTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.black,
    color: '#15803D',
    marginTop: Spacing.sm,
  },
  concludedSub: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  nextStopBlock: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  stopTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seqCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  seqText: {
    fontSize: 11,
    fontWeight: Typography.weights.black,
    color: Colors.white,
  },
  nextCategoryTag: {
    fontSize: 9,
    fontWeight: Typography.weights.bold,
    color: Colors.primaryDark,
    letterSpacing: 0.5,
  },
  stopName: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.black,
    color: Colors.textPrimary,
  },
  pickupCodePill: {
    backgroundColor: Colors.infoSurface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  pickupCodePillText: {
    fontSize: 9,
    fontWeight: Typography.weights.bold,
    color: Colors.primaryDark,
  },
  addressLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: Spacing.sm,
  },
  addressText: {
    flex: 1,
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  heroShortcutRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  heroShortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.infoSurface,
  },
  heroShortcutBtnArrive: {
    backgroundColor: '#DCFCE7',
  },
  heroShortcutText: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    color: Colors.primaryDark,
  },
  heroBtnContainer: {
    alignItems: 'center',
  },
  heroBtnSub: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 6,
    textAlign: 'center',
  },

  /* 3. Stepper */
  stepperCard: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
  },
  stepperHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  stepperTitle: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
  stepperStepCounter: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    color: Colors.primaryDark,
  },
  stepperTrack: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  stepperNode: {
    alignItems: 'center',
    flex: 1,
  },
  stepperCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  stepperCircleDone: {
    backgroundColor: '#16A34A',
  },
  stepperCircleCurrent: {
    backgroundColor: Colors.primary,
  },
  stepperCirclePending: {
    backgroundColor: Colors.cardBorder,
  },
  stepperLabel: {
    fontSize: 8,
    fontWeight: Typography.weights.medium,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  stepperLabelDone: {
    color: '#16A34A',
    fontWeight: Typography.weights.bold,
  },
  stepperLabelCurrent: {
    color: Colors.primaryDark,
    fontWeight: Typography.weights.bold,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  progressBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.cardBorder,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  progressPercentText: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },

  /* 4. Itinerary List */
  itineraryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
  },
  itinerarySectionTitle: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  itinerarySectionSub: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  viewMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
    backgroundColor: Colors.infoSurface,
  },
  viewMapLink: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    color: Colors.primaryDark,
  },
  stopTile: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.surface,
  },
  stopTileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tileSeqBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tileSeqDone: {
    backgroundColor: '#16A34A',
  },
  tileSeqActive: {
    backgroundColor: Colors.primary,
  },
  tileSeqPending: {
    backgroundColor: Colors.cardBorder,
  },
  tileSeqFailed: {
    backgroundColor: '#DC2626',
  },
  tileSeqText: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  tileHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  tileTypeTag: {
    fontSize: 9,
    fontWeight: Typography.weights.bold,
    color: Colors.textMuted,
  },
  tileTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.black,
    color: Colors.textPrimary,
  },
  tileAddress: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  stopTileFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  tileMetaGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tileMetaText: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  tileActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tileIconBtn: {
    padding: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.infoSurface,
  },
  tileExecuteBtn: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primary,
  },
  tileExecuteBtnDone: {
    backgroundColor: Colors.cardBorder,
  },
  tileExecuteBtnText: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    color: Colors.white,
    letterSpacing: 0.5,
  },
});
