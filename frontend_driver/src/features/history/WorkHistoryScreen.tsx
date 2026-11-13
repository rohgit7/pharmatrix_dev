import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import {
  Search,
  Filter,
  ArrowUpDown,
  Calendar,
  Clock,
  Scale,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  X,
  TrendingUp,
  MapPin,
  Building2,
  Camera,
  QrCode,
  ShieldCheck,
  RefreshCw,
  Truck,
  RotateCcw,
} from 'lucide-react-native';
import { colors, radii, spacing, typography, shadows } from '../../theme';
import api from '../../services/api';
import {
  DriverHistoryFilterParams,
  DriverPickupHistoryItem,
  DriverWorkSummaryResponse,
} from '../../types/history';
import { PickupDetailModal } from './PickupDetailModal';

interface WorkHistoryScreenProps {
  onNavigateToTab?: (tab: any) => void;
}

type StatusFilter = 'all' | 'completed' | 'cancelled' | 'failed' | 'in_progress';
type DateFilter = 'all' | 'today' | '7days' | '30days';

export const WorkHistoryScreen: React.FC<WorkHistoryScreenProps> = () => {
  // Summary & list states
  const [summary, setSummary] = useState<DriverWorkSummaryResponse | null>(null);
  const [pickups, setPickups] = useState<DriverPickupHistoryItem[]>([]);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(10);

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [appliedSearch, setAppliedSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'oldest'>('recent');

  // Loading & refresh
  const [isSummaryLoading, setIsSummaryLoading] = useState<boolean>(true);
  const [isListLoading, setIsListLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [listError, setListError] = useState<string | null>(null);

  // Selected item for detail modal
  const [selectedPickupId, setSelectedPickupId] = useState<string | number | null>(null);

  // Compute date range strings based on quick filter
  const dateParams = useMemo(() => {
    if (dateFilter === 'all') return { start_date: undefined, end_date: undefined };
    const now = new Date();
    if (dateFilter === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { start_date: start.toISOString() };
    }
    if (dateFilter === '7days') {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { start_date: start.toISOString() };
    }
    if (dateFilter === '30days') {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { start_date: start.toISOString() };
    }
    return {};
  }, [dateFilter]);

  // Load Summary
  const fetchSummary = useCallback(async () => {
    try {
      setIsSummaryLoading(true);
      const data = await api.getWorkHistorySummary();
      setSummary(data);
    } catch {
      // Non-blocking for summary
    } finally {
      setIsSummaryLoading(false);
    }
  }, []);

  // Load Pickups List
  const fetchPickups = useCallback(
    async (targetPage: number = 1) => {
      try {
        setIsListLoading(true);
        setListError(null);
        const params: DriverHistoryFilterParams = {
          page: targetPage,
          page_size: pageSize,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          search: appliedSearch || undefined,
          sort_by: sortBy,
          start_date: dateParams.start_date,
          end_date: dateParams.end_date,
        };
        const res = await api.getWorkHistoryPickups(params);
        setPickups(res.items);
        setTotalPages(res.total_pages);
        setTotalCount(res.total);
        setPage(res.page);
      } catch (err: any) {
        setListError(err?.message || 'Failed to fetch work history');
      } finally {
        setIsListLoading(false);
      }
    },
    [pageSize, statusFilter, appliedSearch, sortBy, dateParams]
  );

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchPickups(1);
  }, [fetchPickups]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchSummary(), fetchPickups(page)]);
    setIsRefreshing(false);
  };

  const handleSearchSubmit = () => {
    setAppliedSearch(searchTerm.trim());
    setPage(1);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setAppliedSearch('');
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setAppliedSearch('');
    setStatusFilter('all');
    setDateFilter('all');
    setSortBy('recent');
    setPage(1);
  };

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s === 'COMPLETED' || s === 'COLLECTED') {
      return { bg: '#DCFCE7', text: '#15803D', border: '#86EFAC' };
    }
    if (s === 'CANCELLED') {
      return { bg: '#FEE2E2', text: '#B91C1C', border: '#FCA5A5' };
    }
    if (s === 'FAILED') {
      return { bg: '#FEF3C7', text: '#B45309', border: '#FCD34D' };
    }
    if (s === 'IN_PROGRESS' || s === 'ARRIVED') {
      return { bg: colors.lightAccent, text: colors.primaryAccent, border: '#C7D2FE' };
    }
    return { bg: '#F3F4F6', text: '#4B5563', border: '#E5E7EB' };
  };

  const formatDateDisplay = (dateStr?: string | null): string => {
    if (!dateStr) return 'Unscheduled';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatTimeDisplay = (dateStr?: string | null): string => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primaryAccent}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* =========================================================================
            1. WORK HISTORY DASHBOARD & SUMMARY METRICS
           ========================================================================= */}
        <View style={styles.dashboardSection}>
          <View style={styles.dashboardHeaderRow}>
            <View>
              <Text style={styles.dashboardSubtitle}>LIFECYCLE INTELLIGENCE</Text>
              <Text style={styles.dashboardTitle}>Driver Operations History</Text>
            </View>
            <TouchableOpacity
              style={styles.refreshIconBtn}
              onPress={handleRefresh}
              accessibilityLabel="Refresh Statistics"
            >
              <RefreshCw size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {isSummaryLoading && !summary ? (
            <View style={styles.summaryLoadingBox}>
              <ActivityIndicator size="small" color={colors.primaryAccent} />
              <Text style={styles.summaryLoadingText}>Calculating dynamic metrics...</Text>
            </View>
          ) : summary ? (
            <>
              {/* Primary KPI Grid */}
              <View style={styles.kpiGrid}>
                {/* Total Handled */}
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Total Handled</Text>
                  <Text style={styles.kpiNumber}>{summary.total_pickups}</Text>
                  <Text style={styles.kpiSub}>Lifetime assigned</Text>
                </View>

                {/* Completed */}
                <View style={[styles.kpiCard, styles.kpiCardCompleted]}>
                  <View style={styles.kpiLabelRow}>
                    <Text style={styles.kpiLabel}>Completed</Text>
                    <CheckCircle2 size={12} color="#15803D" />
                  </View>
                  <Text style={[styles.kpiNumber, { color: '#15803D' }]}>
                    {summary.completed_pickups}
                  </Text>
                  <Text style={styles.kpiSub}>Verified handovers</Text>
                </View>

                {/* Total Weight */}
                <View style={styles.kpiCard}>
                  <View style={styles.kpiLabelRow}>
                    <Text style={styles.kpiLabel}>Collected Weight</Text>
                    <Scale size={12} color={colors.primaryAccent} />
                  </View>
                  <Text style={styles.kpiNumber}>
                    {summary.total_collected_weight_kg.toFixed(1)}{' '}
                    <Text style={styles.kpiUnit}>kg</Text>
                  </Text>
                  <Text style={styles.kpiSub}>Aggregate gross</Text>
                </View>

                {/* Working Days & Avg/Day */}
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Working Days</Text>
                  <Text style={styles.kpiNumber}>{summary.total_working_days}</Text>
                  <Text style={styles.kpiSub}>
                    {summary.avg_pickups_per_day} pickups/day avg
                  </Text>
                </View>
              </View>

              {/* Status Breakdown Mini Strip */}
              <View style={styles.statusBreakdownStrip}>
                <View style={styles.breakdownItem}>
                  <View style={[styles.statusDot, { backgroundColor: '#16A34A' }]} />
                  <Text style={styles.breakdownText}>
                    Completed: <Text style={styles.breakdownBold}>{summary.completed_pickups}</Text>
                  </Text>
                </View>
                <View style={styles.breakdownItem}>
                  <View style={[styles.statusDot, { backgroundColor: '#DC2626' }]} />
                  <Text style={styles.breakdownText}>
                    Cancelled: <Text style={styles.breakdownBold}>{summary.cancelled_pickups}</Text>
                  </Text>
                </View>
                <View style={styles.breakdownItem}>
                  <View style={[styles.statusDot, { backgroundColor: '#D97706' }]} />
                  <Text style={styles.breakdownText}>
                    Failed: <Text style={styles.breakdownBold}>{summary.failed_pickups}</Text>
                  </Text>
                </View>
              </View>

              {/* Performance & Efficiency Banner */}
              <View style={styles.performanceCard}>
                <View style={styles.perfTopRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TrendingUp size={16} color={colors.primaryAccent} />
                    <Text style={styles.perfHeading}>Performance Efficiency</Text>
                  </View>
                  <Text style={styles.completionRateValue}>
                    {summary.performance.completion_rate_percentage}%
                  </Text>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${Math.min(100, summary.performance.completion_rate_percentage)}%` },
                    ]}
                  />
                </View>

                {/* Supporting Performance Stats */}
                <View style={styles.perfStatsRow}>
                  <View style={styles.perfStatCol}>
                    <Text style={styles.perfStatLabel}>This Week</Text>
                    <Text style={styles.perfStatVal}>
                      {summary.performance.completed_this_week} done
                    </Text>
                  </View>
                  <View style={styles.perfDivider} />
                  <View style={styles.perfStatCol}>
                    <Text style={styles.perfStatLabel}>This Month</Text>
                    <Text style={styles.perfStatVal}>
                      {summary.performance.completed_this_month} ({summary.performance.collected_weight_this_month_kg} kg)
                    </Text>
                  </View>
                  <View style={styles.perfDivider} />
                  <View style={styles.perfStatCol}>
                    <Text style={styles.perfStatLabel}>Total Distance</Text>
                    <Text style={styles.perfStatVal}>
                      {summary.performance.total_distance_km} km
                    </Text>
                  </View>
                </View>
              </View>
            </>
          ) : null}
        </View>

        {/* =========================================================================
            2. FILTERS AND SEARCH
           ========================================================================= */}
        <View style={styles.filterSection}>
          {/* Search Box */}
          <View style={styles.searchBarContainer}>
            <Search size={16} color={colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search pickup ID, customer, address..."
              placeholderTextColor={colors.textOutline}
              value={searchTerm}
              onChangeText={setSearchTerm}
              onSubmitEditing={handleSearchSubmit}
              returnKeyType="search"
            />
            {searchTerm ? (
              <TouchableOpacity onPress={handleClearSearch} style={styles.clearSearchBtn}>
                <X size={14} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Quick Date Filters */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dateChipsScroll}
          >
            {(
              [
                { id: 'all', label: 'All Time' },
                { id: 'today', label: 'Today' },
                { id: '7days', label: 'Last 7 Days' },
                { id: '30days', label: 'Last 30 Days' },
              ] as const
            ).map((df) => {
              const active = dateFilter === df.id;
              return (
                <TouchableOpacity
                  key={df.id}
                  style={[styles.dateChip, active && styles.activeDateChip]}
                  onPress={() => {
                    setDateFilter(df.id);
                    setPage(1);
                  }}
                >
                  <Text style={[styles.dateChipText, active && styles.activeDateChipText]}>
                    {df.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Status Filters & Sort Toggle */}
          <View style={styles.statusAndSortRow}>
            {/* Status Pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.statusPillsScroll}
            >
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'completed', label: 'Completed' },
                  { id: 'cancelled', label: 'Cancelled' },
                  { id: 'failed', label: 'Failed' },
                  { id: 'in_progress', label: 'In Progress' },
                ] as const
              ).map((st) => {
                const active = statusFilter === st.id;
                return (
                  <TouchableOpacity
                    key={st.id}
                    style={[styles.statusChip, active && styles.activeStatusChip]}
                    onPress={() => {
                      setStatusFilter(st.id);
                      setPage(1);
                    }}
                  >
                    <Text style={[styles.statusChipText, active && styles.activeStatusChipText]}>
                      {st.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Sort Order Toggle */}
            <TouchableOpacity
              style={styles.sortToggleBtn}
              onPress={() => {
                setSortBy(sortBy === 'recent' ? 'oldest' : 'recent');
                setPage(1);
              }}
              accessibilityLabel={`Sort: currently ${sortBy}`}
            >
              <ArrowUpDown size={12} color={colors.primary} />
              <Text style={styles.sortToggleText}>
                {sortBy === 'recent' ? 'Recent' : 'Oldest'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* =========================================================================
            3. WORK HISTORY LIST & PAGINATION
           ========================================================================= */}
        <View style={styles.listSection}>
          <View style={styles.listHeaderRow}>
            <Text style={styles.listHeading}>
              Historical Pickups ({totalCount})
            </Text>
            {appliedSearch || statusFilter !== 'all' || dateFilter !== 'all' ? (
              <TouchableOpacity
                style={styles.resetFiltersBtn}
                onPress={handleResetFilters}
              >
                <RotateCcw size={12} color={colors.primaryAccent} />
                <Text style={styles.resetFiltersText}>Reset</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {isListLoading ? (
            <View style={styles.listLoadingState}>
              <ActivityIndicator size="large" color={colors.primaryAccent} />
              <Text style={styles.listLoadingText}>Loading historical assignments...</Text>
            </View>
          ) : listError ? (
            <View style={styles.errorStateCard}>
              <AlertTriangle size={28} color="#DC2626" />
              <Text style={styles.errorStateTitle}>Could not load work history</Text>
              <Text style={styles.errorStateDesc}>{listError}</Text>
              <TouchableOpacity
                style={styles.retryActionBtn}
                onPress={() => fetchPickups(page)}
              >
                <Text style={styles.retryActionText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : pickups.length === 0 ? (
            <View style={styles.emptyStateCard}>
              <Clock size={36} color={colors.textOutline} />
              <Text style={styles.emptyStateTitle}>No Historical Pickups Found</Text>
              <Text style={styles.emptyStateDesc}>
                {appliedSearch || statusFilter !== 'all' || dateFilter !== 'all'
                  ? 'No assignments matched your active filters or search keyword.'
                  : 'You have no historical pickup assignments recorded in your driver profile.'}
              </Text>
              {appliedSearch || statusFilter !== 'all' || dateFilter !== 'all' ? (
                <TouchableOpacity
                  style={styles.resetEmptyBtn}
                  onPress={handleResetFilters}
                >
                  <Text style={styles.resetEmptyBtnText}>Clear All Filters</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            <View style={styles.pickupsList}>
              {pickups.map((item) => {
                const badge = getStatusBadge(item.status);
                const isCompleted = item.status === 'COMPLETED' || item.status === 'COLLECTED';
                const isCancelled = item.status === 'CANCELLED';
                const isFailed = item.status === 'FAILED';

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.pickupCard,
                      isCompleted && styles.pickupCardCompletedBorder,
                      isCancelled && styles.pickupCardCancelledBorder,
                      isFailed && styles.pickupCardFailedBorder,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => setSelectedPickupId(item.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`View pickup details for ${item.pickup_code}`}
                  >
                    {/* Top row: Code & Status */}
                    <View style={styles.cardTopRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardPickupCode}>{item.pickup_code}</Text>
                        <Text style={styles.cardCustomerName} numberOfLines={1}>
                          {item.customer_name}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.cardBadge,
                          {
                            backgroundColor: badge.bg,
                            borderColor: badge.border,
                          },
                        ]}
                      >
                        <Text style={[styles.cardBadgeText, { color: badge.text }]}>
                          {item.status}
                        </Text>
                      </View>
                    </View>

                    {/* Customer Type & Address */}
                    <View style={styles.cardLocationRow}>
                      <MapPin size={13} color={colors.textMuted} style={{ marginTop: 2 }} />
                      <Text style={styles.cardAddressText} numberOfLines={2}>
                        {item.location_name ? `${item.location_name} • ` : ''}
                        {item.address}
                        {item.city ? `, ${item.city}` : ''}
                      </Text>
                    </View>

                    {/* Meta and Verification strip */}
                    <View style={styles.cardMetaRow}>
                      {/* Date & Completion */}
                      <View style={styles.metaSubGroup}>
                        <Calendar size={12} color={colors.textMuted} />
                        <Text style={styles.metaSubText}>
                          {formatDateDisplay(item.scheduled_date || item.route_date || item.requested_date)}
                        </Text>
                      </View>

                      {/* Weight if recorded */}
                      <View style={styles.metaSubGroup}>
                        <Scale size={12} color={colors.textMuted} />
                        <Text style={styles.metaSubText}>
                          {item.collected_weight_kg !== null && item.collected_weight_kg !== undefined
                            ? `${item.collected_weight_kg.toFixed(1)} kg`
                            : item.estimated_weight_kg !== null && item.estimated_weight_kg !== undefined
                            ? `Est: ${item.estimated_weight_kg.toFixed(1)} kg`
                            : 'Pending'}
                        </Text>
                      </View>

                      {/* Micro Indicators */}
                      <View style={styles.microBadgesGroup}>
                        {item.qr_verified ? (
                          <View style={styles.microPill} accessibilityLabel="QR verified">
                            <QrCode size={11} color="#15803D" />
                          </View>
                        ) : null}
                        {item.otp_verified ? (
                          <View style={styles.microPill} accessibilityLabel="OTP authenticated">
                            <ShieldCheck size={11} color="#15803D" />
                          </View>
                        ) : null}
                        {item.has_proof ? (
                          <View style={styles.microPill} accessibilityLabel="Custody proof uploaded">
                            <Camera size={11} color={colors.primaryAccent} />
                          </View>
                        ) : null}
                      </View>

                      <ChevronRight size={16} color={colors.textMuted} />
                    </View>

                    {/* Failure reason callout if failed */}
                    {item.failure_reason ? (
                      <View style={styles.cardFailureCallout}>
                        <AlertTriangle size={12} color="#DC2626" />
                        <Text style={styles.cardFailureText} numberOfLines={1}>
                          {item.failure_reason}
                        </Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 ? (
            <View style={styles.paginationBar}>
              <TouchableOpacity
                style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
                disabled={page <= 1}
                onPress={() => fetchPickups(page - 1)}
              >
                <ChevronLeft size={16} color={page <= 1 ? colors.textOutline : colors.primary} />
                <Text style={[styles.pageBtnText, page <= 1 && styles.pageBtnTextDisabled]}>
                  Previous
                </Text>
              </TouchableOpacity>

              <Text style={styles.pageInfoText}>
                Page <Text style={styles.pageInfoBold}>{page}</Text> of{' '}
                <Text style={styles.pageInfoBold}>{totalPages}</Text>
              </Text>

              <TouchableOpacity
                style={[styles.pageBtn, page >= totalPages && styles.pageBtnDisabled]}
                disabled={page >= totalPages}
                onPress={() => fetchPickups(page + 1)}
              >
                <Text style={[styles.pageBtnText, page >= totalPages && styles.pageBtnTextDisabled]}>
                  Next
                </Text>
                <ChevronRight
                  size={16}
                  color={page >= totalPages ? colors.textOutline : colors.primary}
                />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Detailed Pickup History Screen / Modal */}
      <PickupDetailModal
        visible={Boolean(selectedPickupId)}
        pickupId={selectedPickupId}
        onClose={() => setSelectedPickupId(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  dashboardSection: {
    gap: spacing.sm,
  },
  dashboardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  dashboardSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primaryAccent,
    letterSpacing: 1,
  },
  dashboardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  refreshIconBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  summaryLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  summaryLoadingText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  kpiCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.secondary,
    ...shadows.subtle,
  },
  kpiCardCompleted: {
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
  },
  kpiLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kpiLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
  },
  kpiNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
    marginTop: 4,
  },
  kpiUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  kpiSub: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  statusBreakdownStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  breakdownText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  breakdownBold: {
    fontWeight: '700',
    color: colors.primary,
  },
  performanceCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.secondary,
    ...shadows.subtle,
    gap: spacing.xs,
  },
  perfTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  perfHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  completionRateValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primaryAccent,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: colors.lightAccent,
    borderRadius: radii.full,
    overflow: 'hidden',
    marginVertical: 4,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primaryAccent,
    borderRadius: radii.full,
  },
  perfStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  perfStatCol: {
    flex: 1,
    alignItems: 'center',
  },
  perfDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.secondary,
  },
  perfStatLabel: {
    fontSize: 10,
    color: colors.textMuted,
  },
  perfStatVal: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 1,
  },
  filterSection: {
    gap: spacing.xs,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.secondary,
    paddingHorizontal: spacing.sm,
    height: 44,
  },
  searchIcon: {
    marginRight: spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.primary,
    height: '100%',
  },
  clearSearchBtn: {
    padding: 4,
  },
  dateChipsScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  dateChip: {
    backgroundColor: colors.surface,
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  activeDateChip: {
    backgroundColor: colors.lightAccent,
    borderColor: colors.primaryAccent,
  },
  dateChipText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  activeDateChipText: {
    color: colors.primaryAccent,
    fontWeight: '700',
  },
  statusAndSortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: 2,
  },
  statusPillsScroll: {
    flexDirection: 'row',
    gap: 6,
  },
  statusChip: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  activeStatusChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  statusChipText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  activeStatusChipText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  sortToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  sortToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  listSection: {
    gap: spacing.sm,
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  resetFiltersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  resetFiltersText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primaryAccent,
  },
  listLoadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: 8,
  },
  listLoadingText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  errorStateCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    gap: 6,
  },
  errorStateTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
  },
  errorStateDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  retryActionBtn: {
    marginTop: spacing.xs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.md,
  },
  retryActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyStateCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.secondary,
    gap: 6,
  },
  emptyStateTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  emptyStateDesc: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: spacing.sm,
  },
  resetEmptyBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.primaryAccent,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radii.md,
  },
  resetEmptyBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  pickupsList: {
    gap: spacing.sm,
  },
  pickupCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.secondary,
    padding: spacing.md,
    ...shadows.subtle,
    gap: 6,
  },
  pickupCardCompletedBorder: {
    borderLeftWidth: 4,
    borderLeftColor: '#16A34A',
  },
  pickupCardCancelledBorder: {
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
  },
  pickupCardFailedBorder: {
    borderLeftWidth: 4,
    borderLeftColor: '#D97706',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardPickupCode: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryAccent,
    letterSpacing: 0.5,
  },
  cardCustomerName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 1,
  },
  cardBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  cardBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  cardLocationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  cardAddressText: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.secondary,
    marginTop: 2,
  },
  metaSubGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaSubText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  microBadgesGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  microPill: {
    backgroundColor: colors.surfaceLow,
    padding: 3,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  cardFailureCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    marginTop: 2,
  },
  cardFailureText: {
    flex: 1,
    fontSize: 10,
    color: '#B91C1C',
    fontWeight: '600',
  },
  paginationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  pageBtnTextDisabled: {
    color: colors.textOutline,
  },
  pageInfoText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  pageInfoBold: {
    fontWeight: '700',
    color: colors.primary,
  },
});

export default WorkHistoryScreen;

