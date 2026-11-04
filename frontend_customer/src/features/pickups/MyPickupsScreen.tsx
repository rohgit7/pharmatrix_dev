import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import {
  Package,
  MapPin,
  ArrowRight,
  Plus,
} from 'lucide-react-native';
import {
  colors,
  spacing,
  borderRadius,
  formatShortDate,
  formatCurrency,
} from '../../theme';
import { Card } from '../../components/common/Card';
import { StatusBadge } from '../../components/common/StatusBadge';
import { PrimaryButton } from '../../components/common/PrimaryButton';
import {
  LoadingState,
  EmptyState,
} from '../../components/common/StateViews';
import { PickupSummaryItem } from '../../services/api';

interface MyPickupsScreenProps {
  pickups: PickupSummaryItem[];
  isLoading: boolean;
  onRefresh: () => void;
  onSelectPickup: (pickupPublicId: string) => void;
  onRequestPickup: () => void;
}

type FilterBucket = 'ACTIVE' | 'UPCOMING' | 'PAYMENT_DUE' | 'COMPLETED';

export const MyPickupsScreen: React.FC<MyPickupsScreenProps> = ({
  pickups,
  isLoading,
  onRefresh,
  onSelectPickup,
  onRequestPickup,
}) => {
  const [bucket, setBucket] = useState<FilterBucket>('ACTIVE');

  const filtered = useMemo(() => {
    return pickups.filter((p) => {
      const s = (p.status || '').toUpperCase();
      const pay = (p.payment_status || '').toUpperCase();
      if (bucket === 'ACTIVE') {
        return !['COLLECTED', 'COMPLETED', 'CANCELLED'].includes(s);
      }
      if (bucket === 'UPCOMING') {
        return ['REQUESTED', 'SCHEDULED', 'ASSIGNED'].includes(s);
      }
      if (bucket === 'PAYMENT_DUE') {
        return (
          (pay === 'PENDING' || pay === 'PARTIALLY_PAID') &&
          s !== 'CANCELLED'
        );
      }
      if (bucket === 'COMPLETED') {
        return s === 'COLLECTED' || s === 'COMPLETED';
      }
      return true;
    });
  }, [pickups, bucket]);

  if (isLoading && pickups.length === 0) {
    return <LoadingState message="Loading pickups..." />;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Filter Segment Bar */}
      <View style={styles.segmentRow}>
        {(
          [
            { key: 'ACTIVE', label: 'Active' },
            { key: 'UPCOMING', label: 'Scheduled' },
            { key: 'PAYMENT_DUE', label: 'To Pay' },
            { key: 'COMPLETED', label: 'Completed' },
          ] as { key: FilterBucket; label: string }[]
        ).map((item) => {
          const active = bucket === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.segmentBtn, active && styles.segmentBtnActive]}
              onPress={() => setBucket(item.key)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.segmentText,
                  active && styles.segmentTextActive,
                ]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {filtered.length === 0 ? (
        <Card variant="default" padding="lg">
          <EmptyState
            title="No pickups in this category"
            description="Request a new pharmaceutical waste pickup or switch filters above."
            actionLabel="Request Pickup"
            onAction={onRequestPickup}
          />
        </Card>
      ) : (
        <View style={styles.list}>
          {filtered.map((item) => {
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
                <Card variant="elevated" padding="md" style={styles.pickupCard}>
                  <View style={styles.topRow}>
                    <View style={styles.codeGroup}>
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
                    <Text style={styles.locText} numberOfLines={1}>
                      {item.location_name}
                      {item.location_address ? ` · ${item.location_address}` : ''}
                    </Text>
                  </View>

                  <View style={styles.metaGrid}>
                    <View style={styles.metaCol}>
                      <Text style={styles.metaLabel}>COLLECTION DATE</Text>
                      <Text style={styles.metaVal} numberOfLines={1}>
                        {formatShortDate(item.scheduled_date || item.requested_date)}
                      </Text>
                    </View>
                    <View style={styles.metaDivider} />
                    <View style={styles.metaCol}>
                      <Text style={styles.metaLabel}>WEIGHT & BILLING</Text>
                      <Text style={styles.metaVal} numberOfLines={1}>
                        {weightLabel}
                        {item.total_amount != null
                          ? ` · ${formatCurrency(item.total_amount, item.currency)}`
                          : ''}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.footerRow}>
                    <View style={styles.inlineRow}>
                      <StatusBadge status={item.payment_status} size="sm" />
                    </View>

                    <View style={styles.inlineRow}>
                      <Text style={styles.openText}>View Details</Text>
                      <ArrowRight size={13} color={colors.primary} />
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <View style={styles.bottomBtnWrap}>
        <PrimaryButton
          title="Request New Pickup"
          onPress={onRequestPickup}
          size="lg"
          icon={<Plus size={18} color={colors.textInverse} />}
        />
      </View>
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
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  segmentBtnActive: {
    backgroundColor: colors.primary,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: colors.textInverse,
    fontWeight: '700',
  },
  list: {
    gap: spacing.md,
  },
  pickupCard: {
    gap: spacing.sm + 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  codeGroup: {
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
  locText: {
    flex: 1,
    flexShrink: 1,
    fontSize: 12,
    color: colors.textSecondary,
  },
  metaGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  metaCol: {
    flex: 1,
    flexShrink: 1,
  },
  metaDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  metaLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metaVal: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
  },
  openText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  bottomBtnWrap: {
    marginTop: spacing.xl,
  },
});
