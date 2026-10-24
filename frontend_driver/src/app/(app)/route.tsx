import React from 'react';
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
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useStartRoute, useTodayRoute } from '@/hooks/useDriverRoute';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import { PrimaryButton } from '@/components/PrimaryButton';
import { DriverRouteStopResponse } from '@/types/api';

export default function AssignedRouteScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: route, isLoading, isError, error, refetch, isRefetching } = useTodayRoute();
  const startRouteMutation = useStartRoute();

  const stops = route?.stops || [];
  const completedCount = stops.filter((s) => s.execution_status === 'COMPLETED').length;

  const handleOpenMaps = async (stop: DriverRouteStopResponse) => {
    if (!stop.latitude || !stop.longitude) {
      Alert.alert('No Coordinates', 'Coordinates for this stop are not available.');
      return;
    }

    try {
      // Request permission contextually
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission',
          'Location access helps navigate to stops. You can still open maps directly.'
        );
      }

      const label = encodeURIComponent(
        stop.stop_type === 'PICKUP'
          ? stop.location_name || 'Pickup Stop'
          : stop.warehouse_name || 'Warehouse Intake'
      );

      const url = Platform.select({
        ios: `maps:0,0?q=${label}@${stop.latitude},${stop.longitude}`,
        android: `geo:0,0?q=${stop.latitude},${stop.longitude}(${label})`,
        default: `https://www.google.com/maps/search/?api=1&query=${stop.latitude},${stop.longitude}`,
      });

      if (url) {
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
        } else {
          await Linking.openURL(
            `https://www.google.com/maps/search/?api=1&query=${stop.latitude},${stop.longitude}`
          );
        }
      }
    } catch {
      Alert.alert('Error', 'Unable to launch map application.');
    }
  };

  const handleCall = (phone?: string | null) => {
    if (!phone) {
      Alert.alert('No Phone', 'No contact phone number is recorded for this stop.');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  const handleStartRoute = async () => {
    if (!route) return;
    try {
      await startRouteMutation.mutateAsync({ routeId: route.id });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to start route.');
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.headerTitle}>TODAY'S ROUTE</Text>
          <Text style={styles.headerSubtitle}>
            {route ? `${route.route_code} • ${stops.length} STOPS` : 'ROUTE ITINERARY'}
          </Text>
        </View>
        {route ? <StatusBadge status={route.status} size="sm" /> : null}
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
        {isLoading ? (
          <View style={styles.centeredBox}>
            <ActivityIndicator size="large" color={Colors.amber} />
            <Text style={styles.centeredText}>Loading route itinerary...</Text>
          </View>
        ) : isError ? (
          <Card style={styles.stateCard}>
            <Ionicons name="alert-circle" size={44} color="#EF4444" />
            <Text style={styles.stateTitle}>Failed to Load Route</Text>
            <Text style={styles.stateSubtitle}>{error?.message || 'Error loading stops.'}</Text>
            <PrimaryButton
              title="RELOAD"
              onPress={() => refetch()}
              variant="outline"
              size="md"
              style={{ marginTop: Spacing.md }}
            />
          </Card>
        ) : !route ? (
          <Card style={styles.stateCard}>
            <Ionicons name="map-outline" size={44} color={Colors.amber} />
            <Text style={styles.stateTitle}>No Active Route</Text>
            <Text style={styles.stateSubtitle}>No route is currently assigned to your profile for today.</Text>
            <PrimaryButton
              title="REFRESH"
              onPress={() => refetch()}
              variant="outline"
              size="md"
              style={{ marginTop: Spacing.md }}
            />
          </Card>
        ) : (
          <>
            {/* Route Summary Overview */}
            <Card style={styles.summaryCard} accentColor={Colors.amber}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryCol}>
                  <Text style={styles.summaryLabel}>DISTANCE</Text>
                  <Text style={styles.summaryVal}>
                    {route.planned_distance_km ? `${route.planned_distance_km} km` : 'N/A'}
                  </Text>
                </View>

                <View style={styles.summaryCol}>
                  <Text style={styles.summaryLabel}>EST. DURATION</Text>
                  <Text style={styles.summaryVal}>
                    {route.planned_duration_seconds
                      ? `${Math.round(route.planned_duration_seconds / 60)} min`
                      : 'N/A'}
                  </Text>
                </View>

                <View style={styles.summaryCol}>
                  <Text style={styles.summaryLabel}>PROGRESS</Text>
                  <Text style={styles.summaryVal}>
                    {completedCount}/{stops.length}
                  </Text>
                </View>
              </View>

              {route.status === 'ASSIGNED' ? (
                <PrimaryButton
                  title="START ROUTE NOW"
                  onPress={handleStartRoute}
                  loading={startRouteMutation.isPending}
                  icon={<Ionicons name="play" size={20} color="#000" />}
                  style={{ marginTop: Spacing.md }}
                />
              ) : null}
            </Card>

            {/* Stop List Sequence */}
            <Text style={styles.sectionHeader}>ORDERED ITINERARY</Text>

            {stops.map((stop, index) => {
              const isPickup = stop.stop_type === 'PICKUP';
              const isCompleted = stop.execution_status === 'COMPLETED';
              const isFailed = stop.execution_status === 'FAILED';
              const isArrived = stop.execution_status === 'ARRIVED';
              const isInProgress = stop.execution_status === 'IN_PROGRESS';

              const cardBorderColor = isCompleted
                ? '#10B981'
                : isFailed
                ? '#EF4444'
                : isArrived || isInProgress
                ? Colors.amber
                : Colors.cardBorder;

              const title = isPickup
                ? stop.location_name || stop.customer_name || 'Customer Pickup'
                : stop.warehouse_name || 'Central Warehouse Intake';

              return (
                <Card
                  key={stop.id || `${stop.sequence_number}-${index}`}
                  style={[
                    styles.stopCard,
                    { borderColor: cardBorderColor },
                    isCompleted && styles.completedStopDim,
                  ]}
                >
                  {/* Sequence header */}
                  <View style={styles.stopCardHeader}>
                    <View
                      style={[
                        styles.sequenceCircle,
                        {
                          backgroundColor: isCompleted
                            ? '#10B981'
                            : isFailed
                            ? '#EF4444'
                            : Colors.amber,
                        },
                      ]}
                    >
                      <Text style={styles.sequenceText}>#{stop.sequence_number}</Text>
                    </View>

                    <View style={{ flex: 1, marginLeft: Spacing.md }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.stopTypeTag}>
                          {isPickup ? 'COLLECTION STOP' : 'FINAL WAREHOUSE'}
                        </Text>
                        {isPickup && stop.pickup_code ? (
                          <Text style={styles.pickupCodeTag}>{stop.pickup_code}</Text>
                        ) : null}
                      </View>
                      <Text style={styles.stopName} numberOfLines={1}>
                        {title}
                      </Text>
                    </View>

                    <StatusBadge status={stop.execution_status} size="sm" />
                  </View>

                  {/* Address */}
                  <View style={styles.stopAddressBox}>
                    <Ionicons name="location-outline" size={16} color={Colors.amber} />
                    <Text style={styles.stopAddressText}>
                      {stop.address}, {stop.city} {stop.postal_code || ''}
                    </Text>
                  </View>

                  {/* Pickup Weight & Details */}
                  {isPickup ? (
                    <View style={styles.stopDetailsRow}>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailItemLabel}>EST. WEIGHT</Text>
                        <Text style={styles.detailItemValue}>
                          {stop.estimated_weight_kg ? `${stop.estimated_weight_kg} kg` : 'N/A'}
                        </Text>
                      </View>

                      {stop.collected_weight_kg ? (
                        <View style={styles.detailItem}>
                          <Text style={styles.detailItemLabel}>COLLECTED</Text>
                          <Text style={[styles.detailItemValue, { color: '#34D399' }]}>
                            {stop.collected_weight_kg} kg
                          </Text>
                        </View>
                      ) : null}

                      <View style={styles.detailItem}>
                        <Text style={styles.detailItemLabel}>PROOF</Text>
                        <Text
                          style={[
                            styles.detailItemValue,
                            { color: stop.proof_uploaded ? '#34D399' : '#FBBF24' },
                          ]}
                        >
                          {stop.proof_uploaded ? 'Uploaded' : 'Pending'}
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  {/* Failure reason if failed */}
                  {isFailed && stop.failure_reason ? (
                    <View style={styles.failureBox}>
                      <Ionicons name="warning" size={16} color="#EF4444" />
                      <Text style={styles.failureText}>Reason: {stop.failure_reason}</Text>
                    </View>
                  ) : null}

                  {/* Action Buttons */}
                  <View style={styles.stopActionRow}>
                    {/* Navigation Button */}
                    <TouchableOpacity
                      style={styles.actionPill}
                      onPress={() => handleOpenMaps(stop)}
                    >
                      <Ionicons name="navigate" size={16} color={Colors.white} />
                      <Text style={styles.actionPillText}>Navigate</Text>
                    </TouchableOpacity>

                    {/* Call Button if customer phone available */}
                    {isPickup && stop.customer_phone ? (
                      <TouchableOpacity
                        style={styles.actionPill}
                        onPress={() => handleCall(stop.customer_phone)}
                      >
                        <Ionicons name="call" size={16} color={Colors.white} />
                        <Text style={styles.actionPillText}>Call</Text>
                      </TouchableOpacity>
                    ) : null}

                    {/* Execute Stop Button */}
                    <TouchableOpacity
                      style={[
                        styles.executeButton,
                        isCompleted && styles.executeButtonDim,
                      ]}
                      onPress={() => {
                        if (stop.id) {
                          router.push(`/(app)/stops/${stop.id}`);
                        } else {
                          Alert.alert('Notice', 'Stop ID is missing.');
                        }
                      }}
                    >
                      <Text style={styles.executeButtonText}>
                        {isCompleted ? 'VIEW' : 'EXECUTE'}
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={isCompleted ? Colors.textMuted : '#000'}
                      />
                    </TouchableOpacity>
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
  headerTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.black,
    color: Colors.white,
    letterSpacing: 1,
  },
  headerSubtitle: {
    fontSize: Typography.sizes.xs,
    color: Colors.amber,
    fontWeight: Typography.weights.semibold,
    marginTop: 2,
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
  summaryCard: {
    marginBottom: Spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryCol: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  summaryVal: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.white,
    marginTop: 2,
  },
  sectionHeader: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    color: Colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: Spacing.sm,
  },
  stopCard: {
    marginBottom: Spacing.md,
  },
  completedStopDim: {
    opacity: 0.75,
  },
  stopCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sequenceCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sequenceText: {
    color: '#000',
    fontWeight: Typography.weights.black,
    fontSize: Typography.sizes.sm,
  },
  stopTypeTag: {
    fontSize: 9,
    fontWeight: Typography.weights.black,
    color: Colors.amber,
    letterSpacing: 0.8,
  },
  pickupCodeTag: {
    fontSize: 9,
    color: Colors.textMuted,
    backgroundColor: '#0F1A2F',
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  stopName: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.white,
    marginTop: 1,
  },
  stopAddressBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#0E172B',
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  stopAddressText: {
    flex: 1,
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  stopDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#121F38',
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.sm,
  },
  detailItem: {
    alignItems: 'center',
  },
  detailItemLabel: {
    fontSize: 9,
    fontWeight: Typography.weights.bold,
    color: Colors.textMuted,
  },
  detailItemValue: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    color: Colors.white,
    marginTop: 2,
  },
  failureBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  failureText: {
    fontSize: Typography.sizes.xs,
    color: '#FCA5A5',
    fontWeight: Typography.weights.semibold,
  },
  stopActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.navyLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.md,
    gap: 4,
  },
  actionPillText: {
    color: Colors.white,
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semibold,
  },
  executeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.amber,
    borderRadius: Radius.md,
    height: 38,
    gap: 4,
  },
  executeButtonDim: {
    backgroundColor: Colors.navyLight,
  },
  executeButtonText: {
    color: '#000',
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.5,
  },
});
