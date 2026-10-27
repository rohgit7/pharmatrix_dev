import React, { useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius, Spacing, Typography, Shadows } from '@/constants/theme';
import { useTodayRoute } from '@/hooks/useDriverRoute';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import { DriverRouteStopResponse } from '@/types/api';

type PickupFilterTab = 'all' | 'pending' | 'active' | 'completed' | 'failed';

export default function PickupsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: route, isLoading, isError, error, refetch, isRefetching } = useTodayRoute();

  const [activeTab, setActiveTab] = useState<PickupFilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Extract only pickup stops from the assigned route
  const allStops = route?.stops || [];
  const pickupStops = useMemo(
    () => allStops.filter((s) => s.stop_type === 'PICKUP'),
    [allStops]
  );

  // Filtered by tab and search
  const filteredPickups = useMemo(() => {
    let result = pickupStops;

    if (activeTab === 'pending') {
      result = result.filter((s) => s.execution_status === 'PENDING');
    } else if (activeTab === 'active') {
      result = result.filter(
        (s) => s.execution_status === 'ARRIVED' || s.execution_status === 'IN_PROGRESS'
      );
    } else if (activeTab === 'completed') {
      result = result.filter((s) => s.execution_status === 'COMPLETED');
    } else if (activeTab === 'failed') {
      result = result.filter((s) => s.execution_status === 'FAILED');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (s) =>
          (s.customer_name && s.customer_name.toLowerCase().includes(q)) ||
          (s.location_name && s.location_name.toLowerCase().includes(q)) ||
          (s.pickup_code && s.pickup_code.toLowerCase().includes(q)) ||
          (s.address && s.address.toLowerCase().includes(q)) ||
          (s.city && s.city.toLowerCase().includes(q))
      );
    }

    return result;
  }, [pickupStops, activeTab, searchQuery]);

  const counts = useMemo(
    () => ({
      all: pickupStops.length,
      pending: pickupStops.filter((s) => s.execution_status === 'PENDING').length,
      active: pickupStops.filter(
        (s) => s.execution_status === 'ARRIVED' || s.execution_status === 'IN_PROGRESS'
      ).length,
      completed: pickupStops.filter((s) => s.execution_status === 'COMPLETED').length,
      failed: pickupStops.filter((s) => s.execution_status === 'FAILED').length,
    }),
    [pickupStops]
  );

  const handleOpenMap = (stop: DriverRouteStopResponse) => {
    if (!stop.latitude || !stop.longitude) return;
    const label = encodeURIComponent(stop.location_name || stop.customer_name || 'Pickup');
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${stop.latitude},${stop.longitude}`,
      android: `geo:0,0?q=${stop.latitude},${stop.longitude}(${label})`,
      default: `https://www.google.com/maps/search/?api=1&query=${stop.latitude},${stop.longitude}`,
    });
    if (url) Linking.openURL(url);
  };

  const handleCall = (phone?: string | null) => {
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <View style={styles.headerTitleRow}>
          <View>
            <Text style={styles.headerTitle}>PICKUP MANIFEST</Text>
            <Text style={styles.headerSubtitle}>
              {route ? `${route.route_code} • ${pickupStops.length} TOTAL CONSIGNMENTS` : 'ASSIGNED PICKUPS'}
            </Text>
          </View>
          {route ? <StatusBadge status={route.status} size="sm" /> : null}
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by customer, code, or address..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterBar}
        >
          <TouchableOpacity
            style={[styles.filterChip, activeTab === 'all' && styles.filterChipActive]}
            onPress={() => setActiveTab('all')}
          >
            <Text style={[styles.filterChipText, activeTab === 'all' && styles.filterChipTextActive]}>
              All ({counts.all})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, activeTab === 'active' && styles.filterChipActive]}
            onPress={() => setActiveTab('active')}
          >
            <Text style={[styles.filterChipText, activeTab === 'active' && styles.filterChipTextActive]}>
              In Progress ({counts.active})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, activeTab === 'pending' && styles.filterChipActive]}
            onPress={() => setActiveTab('pending')}
          >
            <Text style={[styles.filterChipText, activeTab === 'pending' && styles.filterChipTextActive]}>
              Upcoming ({counts.pending})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, activeTab === 'completed' && styles.filterChipActive]}
            onPress={() => setActiveTab('completed')}
          >
            <Text style={[styles.filterChipText, activeTab === 'completed' && styles.filterChipTextActive]}>
              Completed ({counts.completed})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, activeTab === 'failed' && styles.filterChipActive]}
            onPress={() => setActiveTab('failed')}
          >
            <Text style={[styles.filterChipText, activeTab === 'failed' && styles.filterChipTextActive]}>
              Exceptions ({counts.failed})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Main List */}
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
            <Text style={styles.centeredText}>Loading pickups schedule...</Text>
          </View>
        ) : isError && (error as any)?.status !== 404 ? (
          <Card style={styles.stateCard}>
            <Ionicons name="alert-circle-outline" size={44} color="#DC2626" />
            <Text style={styles.stateTitle}>Unable to Load Pickups</Text>
            <Text style={styles.stateSubtitle}>{error?.message || 'Server error loading pickups'}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </Card>
        ) : !route || pickupStops.length === 0 ? (
          <Card style={styles.stateCard}>
            <Ionicons name="cube-outline" size={48} color={Colors.primary} />
            <Text style={styles.stateTitle}>No Pickups Assigned</Text>
            <Text style={styles.stateSubtitle}>
              There are no customer pickups assigned to your route today.
            </Text>
          </Card>
        ) : filteredPickups.length === 0 ? (
          <Card style={styles.stateCard}>
            <Ionicons name="search-outline" size={44} color={Colors.textMuted} />
            <Text style={styles.stateTitle}>No Matching Pickups</Text>
            <Text style={styles.stateSubtitle}>
              No pickup records match the selected filter or search keyword.
            </Text>
          </Card>
        ) : (
          filteredPickups.map((stop) => {
            const isCompleted = stop.execution_status === 'COMPLETED';
            const isFailed = stop.execution_status === 'FAILED';
            const isActive =
              stop.execution_status === 'ARRIVED' || stop.execution_status === 'IN_PROGRESS';

            return (
              <TouchableOpacity
                key={stop.id}
                activeOpacity={0.85}
                onPress={() => router.push(`/(app)/stops/${stop.id}` as any)}
              >
                <Card
                  style={styles.pickupCard}
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
                  {/* Card Header */}
                  <View style={styles.cardHeader}>
                    <View style={styles.sequenceBadge}>
                      <Text style={styles.sequenceText}>#{stop.sequence_number}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                      {stop.pickup_code ? (
                        <Text style={styles.pickupCode}>{stop.pickup_code}</Text>
                      ) : null}
                      <Text style={styles.customerName} numberOfLines={1}>
                        {stop.customer_name || stop.location_name || 'Customer Pickup'}
                      </Text>
                    </View>
                    <StatusBadge status={stop.execution_status} size="sm" />
                  </View>

                  {/* Location Address */}
                  <View style={styles.addressRow}>
                    <Ionicons name="location-outline" size={15} color={Colors.primary} />
                    <Text style={styles.addressText} numberOfLines={2}>
                      {stop.address}, {stop.city} {stop.postal_code || ''}
                    </Text>
                  </View>

                  {/* Weight Info Grid */}
                  <View style={styles.infoRow}>
                    <View style={styles.infoBlock}>
                      <Text style={styles.infoLabel}>EXPECTED WEIGHT</Text>
                      <Text style={styles.infoValue}>
                        {stop.estimated_weight_kg ? `${stop.estimated_weight_kg} kg` : 'N/A'}
                      </Text>
                    </View>

                    {stop.collected_weight_kg !== null && stop.collected_weight_kg !== undefined ? (
                      <View style={styles.infoBlock}>
                        <Text style={styles.infoLabel}>COLLECTED WEIGHT</Text>
                        <Text style={[styles.infoValue, { color: '#16A34A' }]}>
                          {stop.collected_weight_kg} kg
                        </Text>
                      </View>
                    ) : null}

                    {stop.proof_uploaded ? (
                      <View style={styles.infoBlock}>
                        <Text style={styles.infoLabel}>PROOF PHOTO</Text>
                        <View style={styles.verifiedRow}>
                          <Ionicons name="shield-checkmark" size={13} color="#16A34A" />
                          <Text style={styles.verifiedText}>Uploaded</Text>
                        </View>
                      </View>
                    ) : null}
                  </View>

                  {/* Failure reason if failed */}
                  {isFailed && stop.failure_reason ? (
                    <View style={styles.exceptionBox}>
                      <Ionicons name="alert-circle" size={15} color="#DC2626" />
                      <Text style={styles.exceptionText} numberOfLines={2}>
                        Exception: {stop.failure_reason}
                      </Text>
                    </View>
                  ) : null}

                  {/* Card Actions Footer */}
                  <View style={styles.cardFooter}>
                    <View style={styles.quickActions}>
                      {stop.customer_phone ? (
                        <TouchableOpacity
                          style={styles.iconActionBtn}
                          onPress={() => handleCall(stop.customer_phone)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="call" size={14} color={Colors.primaryDark} />
                          <Text style={styles.iconActionText}>Call</Text>
                        </TouchableOpacity>
                      ) : null}

                      {stop.latitude && stop.longitude ? (
                        <TouchableOpacity
                          style={styles.iconActionBtn}
                          onPress={() => handleOpenMap(stop)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="navigate" size={14} color={Colors.primaryDark} />
                          <Text style={styles.iconActionText}>Navigate</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    <View style={styles.openDetailsBtn}>
                      <Text style={styles.openDetailsText}>
                        {isCompleted ? 'View Record' : isActive ? 'Resume Flow' : 'Start Stop'}
                      </Text>
                      <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })
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
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
    ...Shadows.subtle,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: Spacing.sm,
    height: 40,
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
  },
  filterBar: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingVertical: 2,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.full,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  filterChipActive: {
    backgroundColor: Colors.infoSurface,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: Typography.weights.semibold,
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
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
  retryBtn: {
    marginTop: Spacing.md,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  retryBtnText: {
    color: Colors.white,
    fontWeight: Typography.weights.bold,
    fontSize: Typography.sizes.sm,
  },
  pickupCard: {
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sequenceBadge: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.infoSurface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  sequenceText: {
    color: Colors.primaryDark,
    fontWeight: Typography.weights.black,
    fontSize: Typography.sizes.xs,
  },
  pickupCode: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    color: Colors.primaryDark,
    letterSpacing: 0.5,
  },
  customerName: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  addressRow: {
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
  infoRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorderSubtle,
  },
  infoBlock: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 9,
    fontWeight: Typography.weights.bold,
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    color: '#16A34A',
  },
  exceptionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    padding: Spacing.xs,
    borderRadius: Radius.sm,
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  exceptionText: {
    flex: 1,
    fontSize: 11,
    color: '#B91C1C',
    fontWeight: Typography.weights.medium,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorderSubtle,
  },
  quickActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  iconActionBtn: {
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
  iconActionText: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    color: Colors.primaryDark,
  },
  openDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  openDetailsText: {
    fontSize: 12,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
  },
});
