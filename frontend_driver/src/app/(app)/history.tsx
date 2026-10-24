import React, { useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useTodayRoute } from '@/hooks/useDriverRoute';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';

export default function HistoryAndExceptionsScreen() {
  const insets = useSafeAreaInsets();
  const { data: route, isLoading, refetch, isRefetching } = useTodayRoute();
  const [filter, setFilter] = useState<'all' | 'failed' | 'completed'>('all');

  const stops = route?.stops || [];
  const completedStops = stops.filter((s) => s.execution_status === 'COMPLETED');
  const failedStops = stops.filter((s) => s.execution_status === 'FAILED');

  const filteredStops =
    filter === 'failed'
      ? failedStops
      : filter === 'completed'
      ? completedStops
      : stops.filter((s) => s.execution_status === 'COMPLETED' || s.execution_status === 'FAILED');

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.headerTitle}>EXCEPTIONS & HISTORY</Text>
          <Text style={styles.headerSubtitle}>TODAY'S AUDIT LOG & COMPLETED RUNS</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, filter === 'all' && styles.tabItemActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.tabText, filter === 'all' && styles.tabTextActive]}>
            All Resolved ({completedStops.length + failedStops.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, filter === 'failed' && styles.tabItemActive]}
          onPress={() => setFilter('failed')}
        >
          <Text style={[styles.tabText, filter === 'failed' && styles.tabTextActive]}>
            Exceptions ({failedStops.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, filter === 'completed' && styles.tabItemActive]}
          onPress={() => setFilter('completed')}
        >
          <Text style={[styles.tabText, filter === 'completed' && styles.tabTextActive]}>
            Completed ({completedStops.length})
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
            tintColor={Colors.amber}
            colors={[Colors.amber]}
          />
        }
      >
        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.amber} />
            <Text style={styles.centeredText}>Loading history log...</Text>
          </View>
        ) : filteredStops.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="document-text-outline" size={44} color={Colors.amber} />
            <Text style={styles.emptyTitle}>No Records Found</Text>
            <Text style={styles.emptySubtitle}>
              {filter === 'failed'
                ? 'Great news! No operational exceptions or failed pickups have occurred today.'
                : 'No settled stops have been recorded for today’s route yet.'}
            </Text>
          </Card>
        ) : (
          filteredStops.map((stop, index) => {
            const isPickup = stop.stop_type === 'PICKUP';
            const isFailed = stop.execution_status === 'FAILED';
            const title = isPickup
              ? stop.location_name || stop.customer_name || 'Customer Pickup'
              : stop.warehouse_name || 'Warehouse Intake';

            return (
              <Card
                key={stop.id || `${stop.sequence_number}-${index}`}
                style={styles.recordCard}
                accentColor={isFailed ? '#EF4444' : '#10B981'}
              >
                <View style={styles.recordHeader}>
                  <View style={styles.sequenceBadge}>
                    <Text style={styles.sequenceText}>#{stop.sequence_number}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                    <Text style={styles.recordType}>
                      {isPickup ? 'COLLECTION STOP' : 'WAREHOUSE HANDOVER'}
                    </Text>
                    <Text style={styles.recordTitle} numberOfLines={1}>
                      {title}
                    </Text>
                  </View>
                  <StatusBadge status={stop.execution_status} size="sm" />
                </View>

                <View style={styles.addressBox}>
                  <Ionicons name="location-outline" size={14} color={Colors.textMuted} />
                  <Text style={styles.addressText} numberOfLines={1}>
                    {stop.address}, {stop.city}
                  </Text>
                </View>

                {isFailed && stop.failure_reason ? (
                  <View style={styles.reasonBox}>
                    <Ionicons name="alert-circle" size={16} color="#EF4444" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reasonLabel}>LOGGED EXCEPTION REASON:</Text>
                      <Text style={styles.reasonValue}>{stop.failure_reason}</Text>
                    </View>
                  </View>
                ) : null}

                {!isFailed && isPickup ? (
                  <View style={styles.weightSummaryRow}>
                    <View>
                      <Text style={styles.weightLabel}>COLLECTED WEIGHT</Text>
                      <Text style={styles.weightVal}>
                        {stop.collected_weight_kg ? `${stop.collected_weight_kg} kg` : '0 kg'}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.weightLabel}>INVOICE & PROOF</Text>
                      <Text style={[styles.weightVal, { color: '#34D399' }]}>
                        {stop.proof_uploaded ? 'Verified' : 'Recorded'}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </Card>
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
    backgroundColor: Colors.navyDark,
  },
  topHeader: {
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
    fontSize: 10,
    color: Colors.amber,
    fontWeight: Typography.weights.bold,
    letterSpacing: 1,
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#0F1A2F',
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  tabItem: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: Colors.amber,
  },
  tabText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    fontWeight: Typography.weights.semibold,
  },
  tabTextActive: {
    color: Colors.amber,
    fontWeight: Typography.weights.bold,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl * 2,
  },
  centered: {
    padding: Spacing.xxl,
    alignItems: 'center',
  },
  centeredText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
    marginTop: Spacing.md,
  },
  emptyCard: {
    alignItems: 'center',
    padding: Spacing.xxl,
    marginTop: Spacing.xl,
  },
  emptyTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.white,
    marginTop: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: Spacing.xs,
  },
  recordCard: {
    marginBottom: Spacing.md,
  },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sequenceBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.navyLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sequenceText: {
    color: Colors.white,
    fontWeight: Typography.weights.bold,
    fontSize: Typography.sizes.xs,
  },
  recordType: {
    fontSize: 9,
    fontWeight: Typography.weights.bold,
    color: Colors.amber,
    letterSpacing: 0.5,
  },
  recordTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.white,
  },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    gap: 4,
  },
  addressText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  reasonBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  reasonLabel: {
    fontSize: 9,
    fontWeight: Typography.weights.bold,
    color: '#EF4444',
  },
  reasonValue: {
    fontSize: Typography.sizes.xs,
    color: '#FCA5A5',
    fontWeight: Typography.weights.semibold,
    marginTop: 2,
  },
  weightSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#0E172B',
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
  },
  weightLabel: {
    fontSize: 9,
    color: Colors.textMuted,
    fontWeight: Typography.weights.bold,
  },
  weightVal: {
    fontSize: Typography.sizes.xs,
    color: Colors.white,
    fontWeight: Typography.weights.bold,
    marginTop: 2,
  },
});
