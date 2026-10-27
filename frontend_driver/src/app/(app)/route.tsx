import React, { useState, useEffect, useMemo } from 'react';
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
import * as Location from 'expo-location';
import { Colors, Radius, Spacing, Typography, Shadows } from '@/constants/theme';
import { useStartRoute, useTodayRoute } from '@/hooks/useDriverRoute';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import { PrimaryButton } from '@/components/PrimaryButton';
import { DriverRouteStopResponse } from '@/types/api';

type RouteViewMode = 'itinerary' | 'map';

export default function AssignedRouteScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: route, isLoading, isError, error, refetch, isRefetching } = useTodayRoute();
  const startRouteMutation = useStartRoute();

  const [viewMode, setViewMode] = useState<RouteViewMode>('itinerary');
  const [driverLocation, setDriverLocation] = useState<Location.LocationObjectCoords | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<number | null>(null);

  const stops = useMemo(() => route?.stops || [], [route]);
  const completedStops = useMemo(
    () => stops.filter((s) => s.execution_status === 'COMPLETED'),
    [stops]
  );
  const remainingStops = useMemo(
    () => stops.filter((s) => s.execution_status !== 'COMPLETED' && s.execution_status !== 'FAILED'),
    [stops]
  );
  const totalStopsCount = stops.length;
  const progressPercent = totalStopsCount > 0 ? Math.round((completedStops.length / totalStopsCount) * 100) : 0;

  // Next actionable stop
  const nextActiveStop = useMemo(
    () =>
      stops.find(
        (s) =>
          s.execution_status === 'ARRIVED' ||
          s.execution_status === 'IN_PROGRESS' ||
          s.execution_status === 'PENDING'
      ),
    [stops]
  );

  // Request location contextually
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          setLocationPermission(true);
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setDriverLocation(loc.coords);
        } else {
          setLocationPermission(false);
        }
      } catch {
        setLocationPermission(false);
      }
    })();
  }, []);

  const handleRequestLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationPermission(true);
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setDriverLocation(loc.coords);
        Alert.alert('Location Acquired', 'GPS coordinates synchronized with dispatch.');
      } else {
        setLocationPermission(false);
        Alert.alert(
          'Permission Needed',
          'Location access helps identify your distance to assigned stops and launches maps at your exact position.'
        );
      }
    } catch {
      Alert.alert('Error', 'Unable to retrieve device GPS location.');
    }
  };

  const handleStartRoute = async () => {
    if (!route) return;
    try {
      await startRouteMutation.mutateAsync({ routeId: route.id });
      if (nextActiveStop) {
        router.push(`/(app)/stops/${nextActiveStop.id}` as any);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to start route.');
    }
  };

  const handleOpenTurnByTurnNav = async (stop: DriverRouteStopResponse) => {
    if (!stop.latitude || !stop.longitude) {
      Alert.alert('Missing Coordinates', 'This stop has no GPS coordinates recorded.');
      return;
    }

    const label = encodeURIComponent(
      stop.stop_type === 'PICKUP'
        ? stop.location_name || stop.customer_name || 'Pickup Stop'
        : stop.warehouse_name || 'Warehouse Intake'
    );

    // Support external turn-by-turn navigation via Google Maps or Apple Maps deep link
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${stop.latitude},${stop.longitude}`,
      android: `google.navigation:q=${stop.latitude},${stop.longitude}&label=${label}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${stop.latitude},${stop.longitude}`,
    });

    try {
      if (url) {
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
        } else {
          await Linking.openURL(
            `https://www.google.com/maps/dir/?api=1&destination=${stop.latitude},${stop.longitude}`
          );
        }
      }
    } catch {
      Alert.alert('Navigation Error', 'Could not open map navigation application.');
    }
  };

  const handleCall = (phone?: string | null) => {
    if (!phone) {
      Alert.alert('No Phone', 'No contact phone recorded for this stop.');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  const selectedStop = useMemo(
    () => stops.find((s) => s.id === selectedStopId) || nextActiveStop,
    [stops, selectedStopId, nextActiveStop]
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerTitle}>ASSIGNED ROUTE</Text>
          <Text style={styles.headerSubtitle}>
            {route ? `${route.route_code} • ${stops.length} SEQUENCED STOPS` : 'ROUTE ITINERARY'}
          </Text>
        </View>

        {route ? (
          <View style={styles.headerRight}>
            <StatusBadge status={route.status} size="sm" />
          </View>
        ) : null}
      </View>

      {/* View Mode Segmented Control */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, viewMode === 'itinerary' && styles.tabItemActive]}
          onPress={() => setViewMode('itinerary')}
        >
          <Ionicons
            name="list-outline"
            size={16}
            color={viewMode === 'itinerary' ? Colors.primaryDark : Colors.textMuted}
          />
          <Text
            style={[styles.tabText, viewMode === 'itinerary' && styles.tabTextActive]}
          >
            Ordered Itinerary
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, viewMode === 'map' && styles.tabItemActive]}
          onPress={() => setViewMode('map')}
        >
          <Ionicons
            name="map-outline"
            size={16}
            color={viewMode === 'map' ? Colors.primaryDark : Colors.textMuted}
          />
          <Text
            style={[styles.tabText, viewMode === 'map' && styles.tabTextActive]}
          >
            Route Map Visualizer
          </Text>
        </TouchableOpacity>
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
            <Text style={styles.centeredText}>Loading sequenced itinerary...</Text>
          </View>
        ) : isError && (error as any)?.status !== 404 ? (
          <Card style={styles.stateCard}>
            <Ionicons name="alert-circle-outline" size={48} color="#DC2626" />
            <Text style={styles.stateTitle}>Failed to Load Route</Text>
            <Text style={styles.stateSubtitle}>{error?.message || 'Server error'}</Text>
            <PrimaryButton
              title="RELOAD MANIFEST"
              onPress={() => refetch()}
              size="md"
              style={{ marginTop: Spacing.md }}
            />
          </Card>
        ) : !route ? (
          <Card style={styles.stateCard}>
            <Ionicons name="map-outline" size={48} color={Colors.primary} />
            <Text style={styles.stateTitle}>No Active Route Today</Text>
            <Text style={styles.stateSubtitle}>
              You do not have an assigned route for today. Please standby or contact your operations manager.
            </Text>
            <PrimaryButton
              title="REFRESH ROUTE"
              onPress={() => refetch()}
              variant="outline"
              size="md"
              style={{ marginTop: Spacing.md }}
            />
          </Card>
        ) : (
          <>
            {/* Route Summary Overview Card */}
            <Card style={styles.summaryCard} accentColor={Colors.primary}>
              <View style={styles.metricsRow}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>DISTANCE</Text>
                  <Text style={styles.metricValue}>
                    {route.planned_distance_km ? `${route.planned_distance_km} km` : 'Calculated'}
                  </Text>
                </View>

                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>DURATION</Text>
                  <Text style={styles.metricValue}>
                    {route.planned_duration_seconds
                      ? `${Math.round(route.planned_duration_seconds / 60)} min`
                      : 'Optimized'}
                  </Text>
                </View>

                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>PROGRESS</Text>
                  <Text style={[styles.metricValue, { color: '#16A34A' }]}>
                    {progressPercent}%
                  </Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${progressPercent}%` },
                  ]}
                />
              </View>

              {/* Vehicle & Facility Info */}
              <View style={styles.metaBox}>
                <View style={styles.metaRow}>
                  <Ionicons name="car-outline" size={16} color={Colors.primary} />
                  <Text style={styles.metaLabel}>Assigned Vehicle:</Text>
                  <Text style={styles.metaVal}>
                    {route.vehicle_registration_number || 'Unassigned vehicle'}
                  </Text>
                </View>

                <View style={styles.metaRow}>
                  <Ionicons name="business-outline" size={16} color={Colors.primary} />
                  <Text style={styles.metaLabel}>Intake Warehouse:</Text>
                  <Text style={styles.metaVal}>{route.warehouse_name}</Text>
                </View>
              </View>

              {/* Start Route button if in ASSIGNED state */}
              {route.status === 'ASSIGNED' ? (
                <PrimaryButton
                  title="START ROUTE EXECUTION"
                  onPress={handleStartRoute}
                  loading={startRouteMutation.isPending}
                  icon={<Ionicons name="play" size={16} color={Colors.white} />}
                  style={{ marginTop: Spacing.md }}
                />
              ) : null}
            </Card>

            {/* View Mode A: Interactive Map Visualizer */}
            {viewMode === 'map' ? (
              <Card style={styles.mapCard}>
                <View style={styles.mapHeaderRow}>
                  <View>
                    <Text style={styles.mapCardTitle}>ROUTE GEOMETRY & STOPS</Text>
                    <Text style={styles.mapCardSubtitle}>
                      Sequenced along road network from depot to warehouse
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.gpsSyncBtn}
                    onPress={handleRequestLocation}
                  >
                    <Ionicons
                      name={driverLocation ? 'locate' : 'locate-outline'}
                      size={16}
                      color={driverLocation ? '#16A34A' : Colors.primaryDark}
                    />
                    <Text style={styles.gpsSyncText}>
                      {driverLocation ? 'GPS Synced' : 'Sync GPS'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Road Geometry & Stops Visualizer */}
                <View style={styles.mapVisualContainer}>
                  {/* Start Point */}
                  <View style={styles.mapStopNode}>
                    <View style={[styles.nodeIconCircle, { backgroundColor: Colors.infoSurface }]}>
                      <Ionicons name="flag" size={14} color={Colors.primaryDark} />
                    </View>
                    <View style={styles.nodeDetails}>
                      <Text style={styles.nodeType}>ROUTE START</Text>
                      <Text style={styles.nodeName}>Depot Departure</Text>
                    </View>
                  </View>
                  <View style={styles.nodeConnectorLine} />

                  {/* Sequence of Ordered Stops */}
                  {stops.map((stop, idx) => {
                    const isPickup = stop.stop_type === 'PICKUP';
                    const isCompleted = stop.execution_status === 'COMPLETED';
                    const isFailed = stop.execution_status === 'FAILED';
                    const isActive =
                      stop.execution_status === 'ARRIVED' || stop.execution_status === 'IN_PROGRESS';
                    const isSelected = selectedStopId === stop.id;

                    const title = isPickup
                      ? stop.customer_name || stop.location_name || 'Customer'
                      : stop.warehouse_name || 'Warehouse Intake';

                    return (
                      <React.Fragment key={stop.id || idx}>
                        <TouchableOpacity
                          style={[
                            styles.mapStopNode,
                            isSelected && styles.mapStopNodeSelected,
                          ]}
                          onPress={() => setSelectedStopId(stop.id)}
                          activeOpacity={0.8}
                        >
                          <View
                            style={[
                              styles.nodeNumberBadge,
                              isCompleted
                                ? { backgroundColor: '#16A34A' }
                                : isFailed
                                ? { backgroundColor: '#DC2626' }
                                : isActive
                                ? { backgroundColor: Colors.primary }
                                : { backgroundColor: '#D97706' },
                            ]}
                          >
                            <Text style={styles.nodeNumberText}>
                              {stop.sequence_number}
                            </Text>
                          </View>

                          <View style={styles.nodeDetails}>
                            <View style={styles.nodeHeaderRow}>
                              <Text style={styles.nodeType}>
                                {isPickup ? 'PICKUP' : 'CENTRAL WAREHOUSE'}
                              </Text>
                              <StatusBadge status={stop.execution_status} size="sm" />
                            </View>
                            <Text style={styles.nodeName} numberOfLines={1}>
                              {title}
                            </Text>
                            <Text style={styles.nodeAddress} numberOfLines={1}>
                              {stop.address}, {stop.city}
                            </Text>
                          </View>

                          {stop.latitude && stop.longitude ? (
                            <TouchableOpacity
                              style={styles.navPinBtn}
                              onPress={() => handleOpenTurnByTurnNav(stop)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Ionicons name="navigate" size={14} color={Colors.primaryDark} />
                            </TouchableOpacity>
                          ) : null}
                        </TouchableOpacity>

                        {idx < stops.length - 1 ? (
                          <View
                            style={[
                              styles.nodeConnectorLine,
                              isCompleted ? styles.nodeConnectorDone : null,
                            ]}
                          />
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                </View>

                {/* Selected Stop Details Card */}
                {selectedStop ? (
                  <View style={styles.selectedStopBanner}>
                    <View style={styles.selectedStopHeader}>
                      <View style={styles.selectedBadge}>
                        <Text style={styles.selectedBadgeText}>
                          #{selectedStop.sequence_number}
                        </Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                        <Text style={styles.selectedTitle} numberOfLines={1}>
                          {selectedStop.stop_type === 'PICKUP'
                            ? selectedStop.customer_name || selectedStop.location_name
                            : selectedStop.warehouse_name}
                        </Text>
                        <Text style={styles.selectedSub} numberOfLines={1}>
                          {selectedStop.address}, {selectedStop.city}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.selectedActionRow}>
                      <TouchableOpacity
                        style={styles.navTurnBtn}
                        onPress={() => handleOpenTurnByTurnNav(selectedStop)}
                      >
                        <Ionicons name="navigate" size={16} color={Colors.white} />
                        <Text style={styles.navTurnBtnText}>Start Navigation</Text>
                      </TouchableOpacity>

                      <PrimaryButton
                        title="EXECUTE"
                        variant="secondary"
                        size="md"
                        onPress={() => router.push(`/(app)/stops/${selectedStop.id}` as any)}
                        style={{ flex: 1 }}
                      />
                    </View>
                  </View>
                ) : null}
              </Card>
            ) : (
              /* View Mode B: Ordered Itinerary List */
              <View style={styles.itineraryList}>
                {stops.map((stop) => {
                  const isPickup = stop.stop_type === 'PICKUP';
                  const isCompleted = stop.execution_status === 'COMPLETED';
                  const isFailed = stop.execution_status === 'FAILED';
                  const isActive =
                    stop.execution_status === 'ARRIVED' || stop.execution_status === 'IN_PROGRESS';

                  const title = isPickup
                    ? stop.customer_name || stop.location_name || 'Customer'
                    : stop.warehouse_name || 'Warehouse Intake';

                  return (
                    <Card
                      key={stop.id}
                      style={styles.stopCard}
                      accentColor={
                        isCompleted
                          ? '#16A34A'
                          : isFailed
                          ? '#DC2626'
                          : isActive
                          ? Colors.primary
                          : '#D97706'
                      }
                    >
                      <View style={styles.stopCardHeader}>
                        <View style={styles.seqBadge}>
                          <Text style={styles.seqText}>#{stop.sequence_number}</Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                          <Text style={styles.stopTypeTag}>
                            {isPickup ? 'BIOMEDICAL PICKUP' : 'CENTRAL INTAKE'}
                          </Text>
                          <Text style={styles.stopTitle} numberOfLines={1}>
                            {title}
                          </Text>
                        </View>
                        <StatusBadge status={stop.execution_status} size="sm" />
                      </View>

                      {/* Address */}
                      <View style={styles.addressLine}>
                        <Ionicons name="location-outline" size={15} color={Colors.primary} />
                        <Text style={styles.addressText} numberOfLines={2}>
                          {stop.address}, {stop.city} {stop.postal_code || ''}
                        </Text>
                      </View>

                      {/* Weight / Payload Details */}
                      {isPickup ? (
                        <View style={styles.weightBox}>
                          <View style={styles.weightItem}>
                            <Text style={styles.weightItemLabel}>ESTIMATED</Text>
                            <Text style={styles.weightItemVal}>
                              {stop.estimated_weight_kg ? `${stop.estimated_weight_kg} kg` : 'N/A'}
                            </Text>
                          </View>
                          {stop.collected_weight_kg !== null && stop.collected_weight_kg !== undefined ? (
                            <View style={styles.weightItem}>
                              <Text style={styles.weightItemLabel}>COLLECTED</Text>
                              <Text style={[styles.weightItemVal, { color: '#16A34A' }]}>
                                {stop.collected_weight_kg} kg
                              </Text>
                            </View>
                          ) : null}
                          <View style={styles.weightItem}>
                            <Text style={styles.weightItemLabel}>PROOF</Text>
                            <Text
                              style={[
                                styles.weightItemVal,
                                { color: stop.proof_uploaded ? '#16A34A' : Colors.textMuted },
                              ]}
                            >
                              {stop.proof_uploaded ? 'Verified' : 'Required'}
                            </Text>
                          </View>
                        </View>
                      ) : null}

                      {/* Footer Actions */}
                      <View style={styles.stopCardFooter}>
                        <View style={styles.leftBtnGroup}>
                          {stop.customer_phone ? (
                            <TouchableOpacity
                              style={styles.pillActionBtn}
                              onPress={() => handleCall(stop.customer_phone)}
                            >
                              <Ionicons name="call" size={13} color={Colors.primaryDark} />
                              <Text style={styles.pillActionText}>Call</Text>
                            </TouchableOpacity>
                          ) : null}

                          {stop.latitude && stop.longitude ? (
                            <TouchableOpacity
                              style={styles.pillActionBtn}
                              onPress={() => handleOpenTurnByTurnNav(stop)}
                            >
                              <Ionicons name="navigate" size={13} color={Colors.primaryDark} />
                              <Text style={styles.pillActionText}>Navigate</Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>

                        <PrimaryButton
                          title={
                            isCompleted
                              ? 'VIEW RECORD'
                              : isActive
                              ? 'RESUME'
                              : 'EXECUTE'
                          }
                          variant={isCompleted ? 'outline' : 'primary'}
                          size="sm"
                          onPress={() => router.push(`/(app)/stops/${stop.id}` as any)}
                        />
                      </View>
                    </Card>
                  );
                })}
              </View>
            )}
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
  headerTitleBlock: {
    flex: 1,
  },
  headerTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.black,
    color: Colors.textPrimary,
    letterSpacing: 1,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
    letterSpacing: 1,
    marginTop: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: Colors.primary,
    backgroundColor: Colors.infoSurface,
  },
  tabText: {
    fontSize: 12,
    fontWeight: Typography.weights.semibold,
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.primaryDark,
    fontWeight: Typography.weights.bold,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl * 2,
  },
  centeredBox: {
    padding: Spacing.xxl,
    alignItems: 'center',
  },
  centeredText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
    marginTop: Spacing.md,
  },
  stateCard: {
    alignItems: 'center',
    padding: Spacing.xxl,
    marginTop: Spacing.xl,
  },
  stateTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
  },
  stateSubtitle: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: Spacing.xs,
    maxWidth: 280,
  },
  summaryCard: {
    marginBottom: Spacing.md,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  metricItem: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: Typography.weights.bold,
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.black,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.separator,
    overflow: 'hidden',
    marginVertical: Spacing.sm,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#16A34A',
    borderRadius: 3,
  },
  metaBox: {
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorderSubtle,
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: Typography.weights.semibold,
    color: Colors.textSecondary,
  },
  metaVal: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  mapCard: {
    marginBottom: Spacing.md,
  },
  mapHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  mapCardTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    letterSpacing: 0.5,
  },
  mapCardSubtitle: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  gpsSyncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: Radius.sm,
    backgroundColor: Colors.infoSurface,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  gpsSyncText: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    color: Colors.primaryDark,
  },
  mapVisualContainer: {
    paddingVertical: Spacing.sm,
  },
  mapStopNode: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  mapStopNodeSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.infoSurface,
  },
  nodeIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nodeNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nodeNumberText: {
    color: Colors.white,
    fontWeight: Typography.weights.black,
    fontSize: 12,
  },
  nodeDetails: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  nodeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nodeType: {
    fontSize: 9,
    fontWeight: Typography.weights.bold,
    color: Colors.primaryDark,
    letterSpacing: 0.5,
  },
  nodeName: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  nodeAddress: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  nodeConnectorLine: {
    width: 2,
    height: 18,
    backgroundColor: Colors.separator,
    marginLeft: 23,
    marginVertical: 2,
  },
  nodeConnectorDone: {
    backgroundColor: '#16A34A',
  },
  navPinBtn: {
    padding: 8,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  selectedStopBanner: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  selectedStopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  selectedBadge: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedBadgeText: {
    color: Colors.white,
    fontWeight: Typography.weights.black,
    fontSize: Typography.sizes.xs,
  },
  selectedTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  selectedSub: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  selectedActionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  navTurnBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    ...Shadows.button,
  },
  navTurnBtnText: {
    color: Colors.white,
    fontWeight: Typography.weights.bold,
    fontSize: Typography.sizes.sm,
  },
  itineraryList: {
    gap: Spacing.md,
  },
  stopCard: {
    padding: Spacing.md,
  },
  stopCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seqBadge: {
    width: 30,
    height: 30,
    borderRadius: Radius.sm,
    backgroundColor: Colors.infoSurface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  seqText: {
    color: Colors.primaryDark,
    fontWeight: Typography.weights.black,
    fontSize: Typography.sizes.xs,
  },
  stopTypeTag: {
    fontSize: 9,
    fontWeight: Typography.weights.bold,
    color: Colors.primaryDark,
    letterSpacing: 0.5,
  },
  stopTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  addressLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: Spacing.sm,
    gap: 6,
  },
  addressText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  weightBox: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorderSubtle,
    gap: Spacing.lg,
  },
  weightItem: {
    flex: 1,
  },
  weightItemLabel: {
    fontSize: 9,
    fontWeight: Typography.weights.bold,
    color: Colors.textMuted,
  },
  weightItemVal: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  stopCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorderSubtle,
  },
  leftBtnGroup: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  pillActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
    backgroundColor: Colors.infoSurface,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  pillActionText: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    color: Colors.primaryDark,
  },
});
