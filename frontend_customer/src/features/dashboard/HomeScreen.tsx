import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import {
  Plus,
  Package,
  Calendar,
  CreditCard,
  CheckCircle2,
  ArrowRight,
  Truck,
  MapPin,
  Scale,
  KeyRound,
  AlertCircle,
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
import { PrimaryButton } from '../../components/common/PrimaryButton';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  LoadingState,
  EmptyState,
  ErrorState,
} from '../../components/common/StateViews';
import { DashboardData, PickupSummaryItem } from '../../services/api';
import type { PickupFlowScreen } from '../pickups/PickupDetailsScreen';

interface HomeScreenProps {
  customerName?: string;
  customerType?: string;
  customerCode?: string;
  dashboard?: DashboardData;
  isLoading: boolean;
  error?: string | null;
  onRefresh: () => void;
  onRequestPickup: () => void;
  onSelectPickup: (pickupPublicId: string, subScreen?: PickupFlowScreen) => void;
  onViewAllPickups: () => void;
}

interface NextActionInfo {
  pickup: PickupSummaryItem;
  label: string;
  description: string;
  buttonText: string;
  subScreen: PickupFlowScreen;
  tone: 'accent' | 'warning' | 'primary';
}

function getNextActionForPickup(item: PickupSummaryItem): NextActionInfo | null {
  const status = (item.status || '').toUpperCase();
  const payStatus = (item.payment_status || '').toUpperCase();

  if (status === 'WEIGHT_RECORDED' || status === 'PENDING_HANDOVER') {
    return {
      pickup: item,
      label: 'WEIGHT RECORDED BY DRIVER',
      description: `${item.pickup_code} at ${item.location_name} (${
        item.actual_weight_kg != null ? `${item.actual_weight_kg.toFixed(1)} kg` : 'verify weight'
      })`,
      buttonText: 'Confirm Handover',
      subScreen: 'handover',
      tone: 'accent',
    };
  }

  if (
    status === 'HANDOVER_CONFIRMED' ||
    status === 'PAYMENT_PENDING' ||
    (payStatus === 'PENDING' && item.total_amount != null && item.total_amount > 0 && status !== 'COMPLETED' && status !== 'CANCELLED')
  ) {
    return {
      pickup: item,
      label: 'INVOICE READY FOR PAYMENT',
      description: `${item.pickup_code} · ${
        item.total_amount != null ? formatCurrency(item.total_amount) : 'Bill generated'
      }`,
      buttonText: 'Pay Bill Now',
      subScreen: 'payment',
      tone: 'warning',
    };
  }

  if (
    status === 'PAID' ||
    status === 'OTP_PENDING' ||
    (payStatus === 'PAID' && status !== 'COMPLETED' && status !== 'CANCELLED' && status !== 'COLLECTED')
  ) {
    return {
      pickup: item,
      label: 'READY FOR CUSTODY OTP',
      description: `${item.pickup_code} · Share verification code with the driver`,
      buttonText: 'Generate OTP',
      subScreen: 'otp',
      tone: 'primary',
    };
  }

  return null;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  customerName,
  customerType,
  customerCode,
  dashboard,
  isLoading,
  error,
  onRefresh,
  onRequestPickup,
  onSelectPickup,
  onViewAllPickups,
}) => {
  if (isLoading && !dashboard) {
    return <LoadingState message="Loading dashboard..." />;
  }

  if (error && !dashboard) {
    return <ErrorState message={error} onRetry={onRefresh} />;
  }

  const stats = dashboard || {
    total_pickups: 0,
    active_pickups: 0,
    upcoming_pickups: 0,
    completed_pickups: 0,
    pending_payments: 0,
    pending_payment_amount: 0,
    recent_pickups: [],
  };

  const actionableItem = stats.recent_pickups
    .map(getNextActionForPickup)
    .find((info): info is NextActionInfo => info !== null);

  const getPickupStepActionLabel = (item: PickupSummaryItem): string => {
    const action = getNextActionForPickup(item);
    if (action) return action.buttonText;
    const s = (item.status || '').toUpperCase();
    if (s === 'COMPLETED' || s === 'COLLECTED' || s === 'VERIFIED') {
      return 'View Receipt';
    }
    return 'Track Pickup';
  };

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
      {/* Facility Header & Primary Action */}
      <Card variant="dark" padding="lg" style={styles.heroCard}>
        <View style={styles.heroHeaderRow}>
          <View style={styles.heroTextCol}>
            <View style={styles.facilityMetaRow}>
              {customerType ? (
                <View style={styles.typePill}>
                  <Text style={styles.typePillText}>
                    {formatStatusLabel(customerType).toUpperCase()}
                  </Text>
                </View>
              ) : null}
              {customerCode ? (
                <Text style={styles.codeText}>{customerCode}</Text>
              ) : null}
            </View>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {customerName || 'Facility Dashboard'}
            </Text>
          </View>
        </View>

        <PrimaryButton
          title="Request Pickup"
          onPress={onRequestPickup}
          variant="accent"
          size="lg"
          icon={<Plus size={18} color={colors.textInverse} />}
          style={styles.requestBtn}
        />
      </Card>

      {/* Dynamic Next Action Banner when a pickup requires user attention */}
      {actionableItem ? (
        <Card variant="accent" padding="md" style={styles.actionBanner}>
          <View style={styles.actionBannerTop}>
            <View style={styles.actionIconWrap}>
              {actionableItem.subScreen === 'handover' ? (
                <Scale size={18} color={colors.accent} />
              ) : actionableItem.subScreen === 'payment' ? (
                <CreditCard size={18} color={colors.accent} />
              ) : (
                <KeyRound size={18} color={colors.accent} />
              )}
            </View>
            <View style={styles.actionTextCol}>
              <Text style={styles.actionEyebrow}>{actionableItem.label}</Text>
              <Text style={styles.actionDesc} numberOfLines={2}>
                {actionableItem.description}
              </Text>
            </View>
          </View>
          <PrimaryButton
            title={actionableItem.buttonText}
            onPress={() =>
              onSelectPickup(
                actionableItem.pickup.public_id,
                actionableItem.subScreen
              )
            }
            variant="primary"
            size="md"
            icon={<ArrowRight size={15} color={colors.textInverse} />}
          />
        </Card>
      ) : null}

      {/* Pending Payment Alert Strip if any */}
      {stats.pending_payments > 0 && !actionableItem ? (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onViewAllPickups}
          style={styles.pendingAlertStrip}
        >
          <View style={styles.pendingAlertLeft}>
            <AlertCircle size={16} color={colors.warning} />
            <Text style={styles.pendingAlertText}>
              {stats.pending_payments} pending{' '}
              {stats.pending_payments === 1 ? 'invoice' : 'invoices'}
              {stats.pending_payment_amount > 0
                ? ` · ${formatCurrency(stats.pending_payment_amount)}`
                : ''}
            </Text>
          </View>
          <ArrowRight size={15} color={colors.warning} />
        </TouchableOpacity>
      ) : null}

      {/* Compact 3-Column Summary Strip */}
      <View style={styles.summaryStrip}>
        <TouchableOpacity
          style={styles.summaryCard}
          activeOpacity={0.8}
          onPress={onViewAllPickups}
        >
          <View style={[styles.summaryIcon, { backgroundColor: colors.lightAccent }]}>
            <Truck size={15} color={colors.accent} />
          </View>
          <Text style={styles.summaryValue}>{stats.active_pickups}</Text>
          <Text style={styles.summaryLabel} numberOfLines={1}>
            Active
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.summaryCard}
          activeOpacity={0.8}
          onPress={onViewAllPickups}
        >
          <View style={[styles.summaryIcon, { backgroundColor: colors.secondary }]}>
            <Calendar size={15} color={colors.primary} />
          </View>
          <Text style={styles.summaryValue}>{stats.upcoming_pickups}</Text>
          <Text style={styles.summaryLabel} numberOfLines={1}>
            Scheduled
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.summaryCard}
          activeOpacity={0.8}
          onPress={onViewAllPickups}
        >
          <View style={[styles.summaryIcon, { backgroundColor: colors.successBg }]}>
            <CheckCircle2 size={15} color={colors.success} />
          </View>
          <Text style={styles.summaryValue}>{stats.completed_pickups}</Text>
          <Text style={styles.summaryLabel} numberOfLines={1}>
            Completed
          </Text>
        </TouchableOpacity>
      </View>

      {/* Recent Pickups List */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Recent Pickups</Text>
        {stats.recent_pickups.length > 0 ? (
          <TouchableOpacity
            onPress={onViewAllPickups}
            style={styles.viewAllBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.viewAllText}>See All</Text>
            <ArrowRight size={14} color={colors.accent} />
          </TouchableOpacity>
        ) : null}
      </View>

      {stats.recent_pickups.length === 0 ? (
        <Card variant="default" padding="lg">
          <EmptyState
            title="No pickups scheduled"
            description="Request your first pharmaceutical waste pickup to begin tracking."
            actionLabel="Request Pickup"
            onAction={onRequestPickup}
          />
        </Card>
      ) : (
        <View style={styles.listContainer}>
          {stats.recent_pickups.slice(0, 6).map((item: PickupSummaryItem) => {
            const nextAction = getNextActionForPickup(item);
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
                onPress={() =>
                  onSelectPickup(
                    item.public_id,
                    nextAction ? nextAction.subScreen : 'details'
                  )
                }
              >
                <Card variant="elevated" padding="md" style={styles.pickupCard}>
                  {/* Top Row: Pickup ID + Status Badge */}
                  <View style={styles.pickupTopRow}>
                    <View style={styles.pickupIdGroup}>
                      <View style={styles.pkgIconBox}>
                        <Package size={15} color={colors.primary} />
                      </View>
                      <Text style={styles.pickupCode} numberOfLines={1}>
                        {item.pickup_code}
                      </Text>
                    </View>
                    <StatusBadge status={item.status} size="sm" />
                  </View>

                  {/* Location */}
                  <View style={styles.locationRow}>
                    <MapPin size={13} color={colors.textSecondary} />
                    <Text style={styles.locationText} numberOfLines={1}>
                      {item.location_name}
                      {item.location_address ? ` · ${item.location_address}` : ''}
                    </Text>
                  </View>

                  {/* 2-Column Metadata Box (overflow-safe on narrow devices) */}
                  <View style={styles.metaBox}>
                    <View style={styles.metaCol}>
                      <Text style={styles.metaLabel}>COLLECTION DATE</Text>
                      <Text style={styles.metaValue} numberOfLines={1}>
                        {formatShortDate(item.scheduled_date || item.requested_date)}
                      </Text>
                    </View>
                    <View style={styles.metaDivider} />
                    <View style={styles.metaCol}>
                      <Text style={styles.metaLabel}>WEIGHT & BILLING</Text>
                      <Text style={styles.metaValue} numberOfLines={1}>
                        {weightLabel}
                        {item.total_amount != null
                          ? ` · ${formatCurrency(item.total_amount)}`
                          : ''}
                      </Text>
                    </View>
                  </View>

                  {/* Footer with Payment Status + Clear Next Step */}
                  <View style={styles.pickupFooter}>
                    <View style={styles.paymentChipRow}>
                      <StatusBadge status={item.payment_status} size="sm" />
                    </View>

                    <View
                      style={[
                        styles.stepCta,
                        nextAction && styles.stepCtaHighlighted,
                      ]}
                    >
                      <Text
                        style={[
                          styles.stepCtaText,
                          nextAction && styles.stepCtaTextHighlighted,
                        ]}
                      >
                        {getPickupStepActionLabel(item)}
                      </Text>
                      <ArrowRight
                        size={13}
                        color={nextAction ? colors.accent : colors.primary}
                      />
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
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
  heroCard: {
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heroTextCol: {
    flex: 1,
    flexShrink: 1,
    gap: 6,
  },
  facilityMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  typePill: {
    backgroundColor: 'rgba(123, 145, 238, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.xs,
  },
  typePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.lightAccent,
    letterSpacing: 0.6,
  },
  codeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ABA49C',
    letterSpacing: 0.4,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textInverse,
    letterSpacing: -0.3,
    lineHeight: 26,
  },
  requestBtn: {
    width: '100%',
  },
  actionBanner: {
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  actionBannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  actionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextCol: {
    flex: 1,
    flexShrink: 1,
    gap: 2,
  },
  actionEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accentDark,
    letterSpacing: 0.6,
  },
  actionDesc: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 18,
  },
  pendingAlertStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  pendingAlertLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pendingAlertText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: colors.warning,
  },
  summaryStrip: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm + 2,
    alignItems: 'flex-start',
  },
  summaryIcon: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 24,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
  },
  listContainer: {
    gap: spacing.md,
  },
  pickupCard: {
    gap: spacing.sm + 2,
  },
  pickupTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  pickupIdGroup: {
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
  pickupCode: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    flex: 1,
    flexShrink: 1,
    fontSize: 12,
    color: colors.textSecondary,
  },
  metaBox: {
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
  metaValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  pickupFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
    gap: spacing.sm,
  },
  paymentChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  stepCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: borderRadius.xs,
  },
  stepCtaHighlighted: {
    backgroundColor: colors.lightAccent,
  },
  stepCtaText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  stepCtaTextHighlighted: {
    color: colors.accentDark,
  },
});
