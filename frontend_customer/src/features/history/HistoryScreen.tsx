import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import {
  Search,
  Package,
  MapPin,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react-native';
import {
  colors,
  spacing,
  borderRadius,
  formatShortDate,
  formatCurrency,
  formatStatusLabel,
} from '../../theme';
import { Card } from '../../components/common/Card';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  LoadingState,
  EmptyState,
  ErrorState,
} from '../../components/common/StateViews';
import { api, PickupSummaryItem } from '../../services/api';

interface HistoryScreenProps {
  onSelectPickup: (pickupPublicId: string) => void;
}

const STATUS_FILTERS = [
  'ALL',
  'COLLECTED',
  'IN_PROGRESS',
  'ASSIGNED',
  'SCHEDULED',
  'REQUESTED',
  'CANCELLED',
];

export const HistoryScreen: React.FC<HistoryScreenProps> = ({
  onSelectPickup,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<PickupSummaryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.getPickupHistory({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        search: searchQuery.trim() || undefined,
        page,
        page_size: 12,
      });
      setItems(res.items);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (err: any) {
      setError(err?.message || 'Unable to load pickup history.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery, page]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={fetchHistory}
          tintColor={colors.primary}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Search Bar */}
      <View style={styles.searchBox}>
        <Search size={17} color={colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search pickup ID or location..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={(txt) => {
            setSearchQuery(txt);
            setPage(1);
          }}
        />
        {searchQuery ? (
          <TouchableOpacity
            onPress={() => {
              setSearchQuery('');
              setPage(1);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={16} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Status Filter Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterPillsRow}
      >
        {STATUS_FILTERS.map((st) => {
          const active = statusFilter === st;
          const label = st === 'ALL' ? 'All' : formatStatusLabel(st);
          return (
            <TouchableOpacity
              key={st}
              style={[styles.filterPill, active && styles.filterPillActive]}
              onPress={() => {
                setStatusFilter(st);
                setPage(1);
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.filterPillText,
                  active && styles.filterPillTextActive,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.resultMetaRow}>
        <Text style={styles.resultCountText}>
          {total} {total === 1 ? 'record' : 'records'}
        </Text>
      </View>

      {loading && items.length === 0 ? (
        <LoadingState message="Loading history..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchHistory} />
      ) : items.length === 0 ? (
        <Card variant="default" padding="lg">
          <EmptyState
            title="No matching records"
            description="Try adjusting your search query or status filter."
          />
        </Card>
      ) : (
        <View style={styles.list}>
          {items.map((item) => {
            const weightLabel =
              item.actual_weight_kg != null
                ? `${item.actual_weight_kg.toFixed(1)} kg`
                : item.estimated_weight_kg != null
                ? `~${item.estimated_weight_kg.toFixed(1)} kg`
                : '—';

            return (
              <TouchableOpacity
                key={item.public_id}
                activeOpacity={0.85}
                onPress={() => onSelectPickup(item.public_id)}
              >
                <Card variant="elevated" padding="md" style={styles.historyCard}>
                  <View style={styles.topRow}>
                    <View style={styles.idRow}>
                      <View style={styles.pkgIconBox}>
                        <Package size={15} color={colors.primary} />
                      </View>
                      <Text style={styles.codeText} numberOfLines={1}>
                        {item.pickup_code}
                      </Text>
                    </View>
                    <StatusBadge status={item.status} size="sm" />
                  </View>

                  <View style={styles.locRow}>
                    <MapPin size={13} color={colors.textSecondary} />
                    <Text style={styles.locName} numberOfLines={1}>
                      {item.location_name}
                    </Text>
                  </View>

                  {/* 2-Column Metadata Box (overflow-safe) */}
                  <View style={styles.gridRow}>
                    <View style={styles.gridCol}>
                      <Text style={styles.gridLabel}>DATE</Text>
                      <Text style={styles.gridVal} numberOfLines={1}>
                        {formatShortDate(
                          item.collected_at ||
                            item.scheduled_date ||
                            item.created_at
                        )}
                      </Text>
                    </View>

                    <View style={styles.gridDivider} />

                    <View style={styles.gridCol}>
                      <Text style={styles.gridLabel}>WEIGHT & AMOUNT</Text>
                      <Text style={styles.gridVal} numberOfLines={1}>
                        {weightLabel}
                        {item.total_amount != null
                          ? ` · ${formatCurrency(item.total_amount, item.currency)}`
                          : ''}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.footerRow}>
                    <View style={styles.inline}>
                      <StatusBadge status={item.payment_status} size="sm" />
                    </View>

                    <View style={styles.inline}>
                      <Text style={styles.viewText}>View Details</Text>
                      <ArrowRight size={13} color={colors.primary} />
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 ? (
        <View style={styles.paginationRow}>
          <TouchableOpacity
            style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
            disabled={page <= 1}
            onPress={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft size={16} color={colors.textPrimary} />
            <Text style={styles.pageBtnText}>Prev</Text>
          </TouchableOpacity>

          <Text style={styles.pageIndicator}>
            Page {page} of {totalPages}
          </Text>

          <TouchableOpacity
            style={[
              styles.pageBtn,
              page >= totalPages && styles.pageBtnDisabled,
            ]}
            disabled={page >= totalPages}
            onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            <Text style={styles.pageBtnText}>Next</Text>
            <ChevronRight size={16} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 46,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    height: '100%',
  },
  filterPillsRow: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  filterPill: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  filterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterPillTextActive: {
    color: colors.textInverse,
  },
  resultMetaRow: {
    marginBottom: spacing.sm,
    marginTop: 4,
  },
  resultCountText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  list: {
    gap: spacing.md,
  },
  historyCard: {
    gap: spacing.sm + 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  idRow: {
    flex: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pkgIconBox: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.xs,
    backgroundColor: colors.secondaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeText: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locName: {
    flex: 1,
    flexShrink: 1,
    fontSize: 12,
    color: colors.textSecondary,
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  gridCol: {
    flex: 1,
    flexShrink: 1,
  },
  gridDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  gridLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  gridVal: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
  },
  viewText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pageBtnDisabled: {
    opacity: 0.45,
  },
  pageBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  pageIndicator: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
