import React, { useState, useMemo } from 'react';
import {
  ActivityIndicator,
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

type HistoryFilter = 'all' | 'completed' | 'exceptions';

export default function ActivityHistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: route, isLoading, isError, error, refetch, isRefetching } = useTodayRoute();

  const [activeFilter, setActiveFilter] = useState<HistoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const stops = useMemo(() => route?.stops || [], [route]);

  const settledStops = useMemo(
    () => stops.filter((s) => s.execution_status === 'COMPLETED' || s.execution_status === 'FAILED'),
    [stops]
  );

  const completedStops = useMemo(
    () => stops.filter((s) => s.execution_status === 'COMPLETED'),
    [stops]
  );

  const exceptionStops = useMemo(
    () => stops.filter((s) => s.execution_status === 'FAILED'),
    [stops]
  );

  const filteredRecords = useMemo(() => {
    let result =
      activeFilter === 'completed'
        ? completedStops
        : activeFilter === 'exceptions'
        ? exceptionStops
        : settledStops;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (s) =>
          (s.customer_name && s.customer_name.toLowerCase().includes(q)) ||
          (s.location_name && s.location_name.toLowerCase().includes(q)) ||
          (s.pickup_code && s.pickup_code.toLowerCase().includes(q)) ||
          (s.failure_reason && s.failure_reason.toLowerCase().includes(q))
      );
    }

    return result;
  }, [activeFilter, completedStops, exceptionStops, settledStops, searchQuery]);

  const totalCollectedKg = useMemo(
    () =>
      completedStops
        .reduce((sum, s) => sum + (s.collected_weight_kg || 0), 0)
        .toFixed(1),
    [completedStops]
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <View style={styles.headerTitleRow}>
          <View>
            <Text style={styles.headerTitle}>OPERATIONAL ACTIVITY</Text>
            <Text style={styles.headerSubtitle}>
              {route ? `${route.route_code} • AUDIT LEDGER` : 'ACTIVITY & AUDIT TRAIL'}
            </Text>
          </View>

          <View style={styles.metricsBadge}>
            <Text style={styles.metricsBadgeText}>
              {completedStops.length} Done • {totalCollectedKg} kg
            </Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search resolved records or exceptions..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Filter Tabs */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeFilter === 'all' && styles.tabItemActive]}
            onPress={() => setActiveFilter('all')}
          >
            <Text style={[styles.tabText, activeFilter === 'all' && styles.tabTextActive]}>
              All Resolved ({settledStops.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeFilter === 'completed' && styles.tabItemActive]}
            onPress={() => setActiveFilter('completed')}
          >
            <Text style={[styles.tabText, activeFilter === 'completed' && styles.tabTextActive]}>
              Completed ({completedStops.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeFilter === 'exceptions' && styles.tabItemActive]}
            onPress={() => setActiveFilter('exceptions')}
          >
            <Text style={[styles.tabText, activeFilter === 'exceptions' && styles.tabTextActive]}>
              Exceptions ({exceptionStops.length})
            </Text>
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
            <Text style={styles.centeredText}>Loading audit logs...</Text>
          </View>
        ) : isError && (error as any)?.status !== 404 ? (
          <Card style={styles.stateCard}>
            <Ionicons name="alert-circle-outline" size={44} color="#DC2626" />
            <Text style={styles.stateTitle}>Unable to Load Activity</Text>
            <Text style={styles.stateSubtitle}>{error?.message || 'Server error'}</Text>
          </Card>
        ) : filteredRecords.length === 0 ? (
          <Card style={styles.stateCard}>
            <Ionicons name="document-text-outline" size={48} color={Colors.primary} />
            <Text style={styles.stateTitle}>No Records Found</Text>
            <Text style={styles.stateSubtitle}>
              {activeFilter === 'exceptions'
                ? 'Great news! No operational exceptions or failed pickups have occurred today.'
                : 'No settled stops recorded for today yet. Active progress will appear here.'}
            </Text>
          </Card>
        ) : (
          filteredRecords.map((stop) => {
            const isPickup = stop.stop_type === 'PICKUP';
            const isFailed = stop.execution_status === 'FAILED';
            const title = isPickup
              ? stop.customer_name || stop.location_name || 'Customer Consignment'
              : stop.warehouse_name || 'Central Intake';

            return (
              <TouchableOpacity
                key={stop.id}
                activeOpacity={0.85}
                onPress={() => router.push(`/(app)/stops/${stop.id}` as any)}
              >
                <Card
                  style={styles.recordCard}
                  accentColor={isFailed ? '#DC2626' : '#16A34A'}
                >
                  <View style={styles.recordHeader}>
                    <View style={styles.seqBadge}>
                      <Text style={styles.seqText}>#{stop.sequence_number}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                      <Text style={styles.recordTypeTag}>
                        {isPickup ? 'BIOMEDICAL PICKUP' : 'CENTRAL WAREHOUSE INTAKE'}
                      </Text>
                      <Text style={styles.recordTitle} numberOfLines={1}>
                        {title}
                      </Text>
                    </View>
                    <StatusBadge status={stop.execution_status} size="sm" />
                  </View>

                  {/* Location Address */}
                  <View style={styles.addressRow}>
                    <Ionicons name="location-outline" size={14} color={Colors.primary} />
                    <Text style={styles.addressText} numberOfLines={1}>
                      {stop.address}, {stop.city}
                    </Text>
                  </View>

                  {/* Failure reason if failed */}
                  {isFailed && stop.failure_reason ? (
                    <View style={styles.exceptionBox}>
                      <Ionicons name="alert-circle" size={16} color="#DC2626" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.exceptionLabel}>LOGGED OPERATIONAL EXCEPTION:</Text>
                        <Text style={styles.exceptionReason}>{stop.failure_reason}</Text>
                      </View>
                    </View>
                  ) : null}

                  {/* Weight and Invoicing Info if Completed */}
                  {!isFailed && isPickup ? (
                    <View style={styles.metricsBox}>
                      <View style={styles.metricCol}>
                        <Text style={styles.metricLabel}>COLLECTED WEIGHT</Text>
                        <Text style={styles.metricVal}>
                          {stop.collected_weight_kg ? `${stop.collected_weight_kg} kg` : '0.0 kg'}
                        </Text>
                      </View>

                      <View style={styles.metricCol}>
                        <Text style={styles.metricLabel}>PROOF LEDGER</Text>
                        <View style={styles.proofVerifiedRow}>
                          <Ionicons name="shield-checkmark" size={13} color="#16A34A" />
                          <Text style={styles.proofVerifiedText}>
                            {stop.proof_uploaded ? 'Uploaded' : 'Recorded'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.metricCol}>
                        <Text style={styles.metricLabel}>INVOICE</Text>
                        <Text style={[styles.metricVal, { color: Colors.primaryDark }]}>
                          Generated
                        </Text>
                      </View>
                    </View>
                  ) : null}
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
  metricsBadge: {
    backgroundColor: Colors.infoSurface,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  metricsBadgeText: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    color: Colors.primaryDark,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: Spacing.sm,
    height: 38,
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorderSubtle,
  },
  tabItem: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 11,
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
  recordCard: {
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seqBadge: {
    width: 32,
    height: 32,
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
  recordTypeTag: {
    fontSize: 9,
    fontWeight: Typography.weights.bold,
    color: Colors.primaryDark,
    letterSpacing: 0.5,
  },
  recordTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    gap: 4,
  },
  addressText: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  exceptionBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEE2E2',
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  exceptionLabel: {
    fontSize: 9,
    fontWeight: Typography.weights.bold,
    color: '#DC2626',
    letterSpacing: 0.5,
  },
  exceptionReason: {
    fontSize: Typography.sizes.xs,
    color: '#B91C1C',
    fontWeight: Typography.weights.semibold,
    marginTop: 2,
  },
  metricsBox: {
    flexDirection: 'row',
    backgroundColor: Colors.infoSurface,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  metricCol: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: Typography.weights.bold,
    color: Colors.textMuted,
  },
  metricVal: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  proofVerifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  proofVerifiedText: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    color: '#16A34A',
  },
});
