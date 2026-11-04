import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  Package,
  MapPin,
  Truck,
  Scale,
  CreditCard,
  KeyRound,
  CheckCircle2,
  Clock,
  Phone,
  FileCheck2,
  XCircle,
  ArrowRight,
  Check,
} from 'lucide-react-native';
import {
  colors,
  spacing,
  borderRadius,
  formatDateTime,
  formatShortDate,
  formatCurrency,
  formatStatusLabel,
} from '../../theme';
import { Card } from '../../components/common/Card';
import { PrimaryButton } from '../../components/common/PrimaryButton';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  LoadingState,
  ErrorState,
} from '../../components/common/StateViews';
import { api, PickupDetailsData } from '../../services/api';
import { HandoverScreen } from './HandoverScreen';
import { PaymentScreen } from './PaymentScreen';
import { OTPGenerationScreen } from './OTPGenerationScreen';
import { PickupCompletionScreen } from './PickupCompletionScreen';

export type PickupFlowScreen =
  | 'details'
  | 'handover'
  | 'payment'
  | 'otp'
  | 'completion';

interface PickupDetailsScreenProps {
  pickupPublicId: string;
  initialSubScreen?: PickupFlowScreen;
  onSubScreenChange?: (screen: PickupFlowScreen) => void;
  onBackToDashboard: () => void;
}

export const PickupDetailsScreen: React.FC<PickupDetailsScreenProps> = ({
  pickupPublicId,
  initialSubScreen = 'details',
  onSubScreenChange,
  onBackToDashboard,
}) => {
  const [subScreen, setSubScreen] = useState<PickupFlowScreen>(initialSubScreen);
  const [details, setDetails] = useState<PickupDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cachedOtp, setCachedOtp] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const navigateSub = (next: PickupFlowScreen) => {
    setSubScreen(next);
    onSubScreenChange?.(next);
  };

  const fetchDetails = useCallback(async () => {
    setError(null);
    try {
      const data = await api.getPickupDetails(pickupPublicId);
      setDetails(data);
    } catch (err: any) {
      setError(err?.message || 'Unable to load pickup details.');
    } finally {
      setLoading(false);
    }
  }, [pickupPublicId]);

  useEffect(() => {
    setLoading(true);
    fetchDetails();
  }, [fetchDetails]);

  const handleCancelPickup = async () => {
    if (!details) return;
    setCancelling(true);
    try {
      await api.cancelPickup(
        details.public_id,
        'Cancelled by customer via mobile portal'
      );
      await fetchDetails();
    } catch (err: any) {
      Alert.alert(
        'Cancellation Failed',
        err?.message || 'Could not cancel this pickup request.'
      );
    } finally {
      setCancelling(false);
    }
  };

  if (loading && !details) {
    return <LoadingState message="Loading pickup details..." />;
  }

  if (error || !details) {
    return (
      <ErrorState
        message={error || 'Pickup record not found.'}
        onRetry={fetchDetails}
      />
    );
  }

  // Dedicated Stack Flow Views
  if (subScreen === 'handover') {
    return (
      <HandoverScreen
        details={details}
        onConfirmed={fetchDetails}
        onProceedToPayment={() => navigateSub('payment')}
        onBack={() => navigateSub('details')}
      />
    );
  }

  if (subScreen === 'payment') {
    return (
      <PaymentScreen
        details={details}
        onPaymentVerified={fetchDetails}
        onProceedToOTP={() => navigateSub('otp')}
        onBack={() => navigateSub('details')}
      />
    );
  }

  if (subScreen === 'otp') {
    return (
      <OTPGenerationScreen
        details={details}
        cachedOtp={cachedOtp}
        onOtpGenerated={(otp) => setCachedOtp(otp)}
        onRefreshDetails={fetchDetails}
        onBack={() => navigateSub('details')}
      />
    );
  }

  if (subScreen === 'completion') {
    return (
      <PickupCompletionScreen
        details={details}
        onBackToDetails={() => navigateSub('details')}
        onBackToDashboard={onBackToDashboard}
      />
    );
  }

  const canCancel =
    details.status === 'REQUESTED' || details.status === 'SCHEDULED';

  const isCompleted =
    details.status === 'COLLECTED' ||
    details.otp_status.otp_verified;

  // Determine the single clearest next step for the customer
  const getPrimaryLifecycleAction = (): {
    eyebrow: string;
    title: string;
    subtitle: string;
    buttonLabel: string;
    target: PickupFlowScreen;
  } | null => {
    if (details.status === 'CANCELLED') return null;

    if (isCompleted) {
      return {
        eyebrow: 'COLLECTION VERIFIED',
        title: 'Pickup Completed',
        subtitle: 'Waste custody transfer and payment are complete.',
        buttonLabel: 'View Collection Receipt',
        target: 'completion',
      };
    }

    if (details.actual_weight_kg != null && !details.handover_confirmed) {
      return {
        eyebrow: 'NEXT REQUIRED ACTION',
        title: 'Confirm Waste Handover',
        subtitle: `Driver recorded ${details.actual_weight_kg.toFixed(
          2
        )} kg. Review and confirm weight to generate your bill.`,
        buttonLabel: 'Confirm Handover',
        target: 'handover',
      };
    }

    if (details.handover_confirmed && details.payment_status !== 'PAID') {
      return {
        eyebrow: 'NEXT REQUIRED ACTION',
        title: 'Complete Bill Payment',
        subtitle: details.invoice
          ? `Invoice ${details.invoice.invoice_number} for ${formatCurrency(
              details.invoice.total_amount
            )} is ready.`
          : 'Complete payment to unlock your collection OTP.',
        buttonLabel: 'Review Bill & Pay',
        target: 'payment',
      };
    }

    if (details.payment_status === 'PAID' && !details.otp_status.otp_verified) {
      return {
        eyebrow: 'NEXT REQUIRED ACTION',
        title: 'Share Collection OTP',
        subtitle: cachedOtp
          ? `Active PIN: ${cachedOtp}. Share this code with the driver.`
          : 'Generate your single-use OTP and share it with the driver.',
        buttonLabel: cachedOtp ? 'View Collection OTP' : 'Generate OTP',
        target: 'otp',
      };
    }

    return null;
  };

  const nextAction = getPrimaryLifecycleAction();

  const stages: {
    key: PickupFlowScreen;
    label: string;
    sub: string;
    done: boolean;
    icon: React.ComponentType<{ size?: number; color?: string }>;
  }[] = [
    {
      key: 'handover',
      label: 'Handover',
      sub:
        details.actual_weight_kg != null
          ? `${details.actual_weight_kg.toFixed(1)} kg`
          : 'Pending',
      done: details.handover_confirmed,
      icon: Scale,
    },
    {
      key: 'payment',
      label: 'Payment',
      sub: details.invoice
        ? formatCurrency(details.invoice.total_amount)
        : formatStatusLabel(details.payment_status),
      done: details.payment_status === 'PAID',
      icon: CreditCard,
    },
    {
      key: 'otp',
      label: 'OTP',
      sub: details.otp_status.otp_verified
        ? 'Verified'
        : cachedOtp
        ? cachedOtp
        : 'PIN',
      done: details.otp_status.otp_verified,
      icon: KeyRound,
    },
    {
      key: 'completion',
      label: 'Receipt',
      sub: isCompleted ? 'Ready' : 'Summary',
      done: isCompleted,
      icon: FileCheck2,
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={fetchDetails}
          tintColor={colors.primary}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Pickup Header Card */}
      <Card variant="elevated" padding="lg" style={styles.sectionCard}>
        <View style={styles.topHeader}>
          <View style={styles.topHeaderLeft}>
            <Text style={styles.codeLabel}>PICKUP ID</Text>
            <Text style={styles.codeValue} numberOfLines={1}>
              {details.pickup_code}
            </Text>
          </View>
          <StatusBadge status={details.status} />
        </View>

        <View style={styles.quickBadgesRow}>
          <View style={styles.quickBadgeItem}>
            <Text style={styles.quickBadgeLabel}>HANDOVER</Text>
            <StatusBadge
              status={details.handover_confirmed ? 'VERIFIED' : 'PENDING'}
              size="sm"
            />
          </View>
          <View style={styles.quickBadgeItem}>
            <Text style={styles.quickBadgeLabel}>PAYMENT</Text>
            <StatusBadge status={details.payment_status} size="sm" />
          </View>
          <View style={styles.quickBadgeItem}>
            <Text style={styles.quickBadgeLabel}>OTP</Text>
            <StatusBadge
              status={
                details.otp_status.otp_verified
                  ? 'VERIFIED'
                  : details.otp_status.otp_active
                  ? 'ACTIVE'
                  : 'PENDING'
              }
              size="sm"
            />
          </View>
        </View>
      </Card>

      {/* Prominent Next Step Banner */}
      {nextAction ? (
        <Card variant="dark" padding="lg" style={styles.nextActionCard}>
          <Text style={styles.nextActionEyebrow}>{nextAction.eyebrow}</Text>
          <Text style={styles.nextActionTitle}>{nextAction.title}</Text>
          <Text style={styles.nextActionSub}>{nextAction.subtitle}</Text>
          <PrimaryButton
            title={nextAction.buttonLabel}
            onPress={() => navigateSub(nextAction.target)}
            variant="accent"
            size="md"
            icon={<ArrowRight size={16} color={colors.textInverse} />}
            style={{ marginTop: spacing.xs }}
          />
        </Card>
      ) : null}

      {/* Compact 4-Step Lifecycle Strip */}
      <View style={styles.stageRow}>
        {stages.map((st) => {
          const IconComp = st.icon;
          const isNext = nextAction?.target === st.key;
          return (
            <TouchableOpacity
              key={st.key}
              style={[
                styles.stageTile,
                st.done && styles.stageTileDone,
                isNext && styles.stageTileCurrent,
              ]}
              onPress={() => navigateSub(st.key)}
              activeOpacity={0.8}
            >
              <View style={styles.stageTileTop}>
                <IconComp
                  size={15}
                  color={
                    st.done
                      ? colors.success
                      : isNext
                      ? colors.accent
                      : colors.textSecondary
                  }
                />
                {st.done ? <Check size={12} color={colors.success} /> : null}
              </View>
              <Text style={styles.stageTileTitle} numberOfLines={1}>
                {st.label}
              </Text>
              <Text style={styles.stageTileSub} numberOfLines={1}>
                {st.sub}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Assigned Driver & Vehicle Card */}
      <Card variant="elevated" padding="lg" style={styles.sectionCard}>
        <View style={styles.cardHeaderRow}>
          <Truck size={17} color={colors.primary} />
          <Text style={styles.sectionTitle}>Driver & Vehicle</Text>
        </View>
        {details.driver ? (
          <View style={styles.infoGrid}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Driver</Text>
              <Text style={styles.infoValue}>{details.driver.name}</Text>
            </View>
            {details.driver.phone ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Phone</Text>
                <View style={styles.phoneInline}>
                  <Phone size={12} color={colors.accent} />
                  <Text style={styles.infoValue}>{details.driver.phone}</Text>
                </View>
              </View>
            ) : null}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Vehicle</Text>
              <Text style={styles.infoValue}>
                {details.driver.vehicle_number || 'Assigned Vehicle'}
                {details.driver.vehicle_type
                  ? ` (${details.driver.vehicle_type})`
                  : ''}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Route Status</Text>
              <Text style={styles.infoValue}>
                {details.driver.route_code} ·{' '}
                {formatStatusLabel(details.driver.stop_status)}
              </Text>
            </View>
          </View>
        ) : (
          <Text style={styles.emptyInfoText}>
            Driver and vehicle details will appear here once a route is assigned.
          </Text>
        )}
      </Card>

      {/* Location & Waste Specification Card */}
      <Card variant="elevated" padding="lg" style={styles.sectionCard}>
        <View style={styles.cardHeaderRow}>
          <MapPin size={17} color={colors.primary} />
          <Text style={styles.sectionTitle}>Pickup & Waste Details</Text>
        </View>

        {details.location ? (
          <View style={styles.locationBlock}>
            <Text style={styles.locTitle}>{details.location.name}</Text>
            <Text style={styles.locSub}>
              {details.location.address_line_1}, {details.location.city},{' '}
              {details.location.state} {details.location.postal_code}
            </Text>
            <Text style={styles.locSub}>
              {details.location.contact_name} · {details.location.contact_phone}
            </Text>
          </View>
        ) : null}

        <View style={styles.infoGrid}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Collection Date</Text>
            <Text style={styles.infoValue}>
              {formatShortDate(details.scheduled_date || details.requested_date)}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Time Window</Text>
            <Text style={styles.infoValue}>{details.time_slot}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Estimated Weight</Text>
            <Text style={styles.infoValue}>
              {details.estimated_weight_kg != null
                ? `${details.estimated_weight_kg.toFixed(2)} kg`
                : '—'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Recorded Weight</Text>
            <Text style={styles.infoValue}>
              {details.actual_weight_kg != null
                ? `${details.actual_weight_kg.toFixed(2)} kg`
                : 'Awaiting weigh-in'}
            </Text>
          </View>
        </View>

        <Text style={styles.subHeading}>WASTE CATEGORIES</Text>
        <View style={styles.categoriesWrap}>
          {details.waste_breakdown.map((w) => (
            <View key={w.code} style={styles.catBadge}>
              <Package size={12} color={colors.primary} />
              <Text style={styles.catBadgeText}>
                {w.name} ({w.bin_color})
              </Text>
            </View>
          ))}
        </View>

        {details.remarks ? (
          <View style={{ marginTop: spacing.md }}>
            <Text style={styles.subHeading}>HANDLING NOTES</Text>
            <Text style={styles.locSub}>{details.remarks}</Text>
          </View>
        ) : null}
      </Card>

      {/* Pickup Progress Timeline */}
      <Card variant="elevated" padding="lg" style={styles.sectionCard}>
        <Text style={[styles.sectionTitle, { marginBottom: spacing.md }]}>
          Tracking Timeline
        </Text>
        <View style={styles.timelineContainer}>
          {details.timeline.map((step, index) => {
            const isLast = index === details.timeline.length - 1;
            return (
              <View key={step.key} style={styles.timelineRow}>
                <View style={styles.timelineLeftCol}>
                  <View
                    style={[
                      styles.timelineDot,
                      step.completed
                        ? styles.timelineDotDone
                        : styles.timelineDotPending,
                    ]}
                  >
                    {step.completed ? (
                      <CheckCircle2 size={13} color={colors.textInverse} />
                    ) : (
                      <Clock size={11} color={colors.textMuted} />
                    )}
                  </View>
                  {!isLast ? (
                    <View
                      style={[
                        styles.timelineConnector,
                        step.completed && styles.timelineConnectorDone,
                      ]}
                    />
                  ) : null}
                </View>

                <View style={styles.timelineContent}>
                  <Text
                    style={[
                      styles.timelineTitle,
                      step.completed && styles.timelineTitleDone,
                    ]}
                  >
                    {step.title}
                  </Text>
                  <Text style={styles.timelineDesc}>{step.description}</Text>
                  {step.timestamp ? (
                    <Text style={styles.timelineTime}>
                      {formatDateTime(step.timestamp)}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      </Card>

      {canCancel ? (
        <PrimaryButton
          title="Cancel Pickup Request"
          onPress={handleCancelPickup}
          loading={cancelling}
          variant="outline"
          size="md"
          icon={<XCircle size={15} color={colors.textPrimary} />}
        />
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
    maxWidth: 700,
    width: '100%',
    alignSelf: 'center',
  },
  sectionCard: {
    marginBottom: spacing.md,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  topHeaderLeft: {
    flex: 1,
    flexShrink: 1,
  },
  codeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.6,
  },
  codeValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 2,
  },
  quickBadgesRow: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  quickBadgeItem: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 4,
  },
  quickBadgeLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  nextActionCard: {
    marginBottom: spacing.md,
    gap: 6,
  },
  nextActionEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: 0.7,
  },
  nextActionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textInverse,
  },
  nextActionSub: {
    fontSize: 13,
    color: '#D5CFC7',
    lineHeight: 19,
  },
  stageRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  stageTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    gap: 3,
  },
  stageTileDone: {
    borderColor: colors.successBorder,
    backgroundColor: colors.successBg,
  },
  stageTileCurrent: {
    borderColor: colors.accent,
    borderWidth: 1.5,
    backgroundColor: colors.lightAccent,
  },
  stageTileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  stageTileTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  stageTileSub: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  infoGrid: {
    gap: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  infoLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    flexShrink: 0,
  },
  infoValue: {
    flex: 1,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'right',
  },
  phoneInline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  emptyInfoText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  locationBlock: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.md,
    gap: 3,
  },
  locTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  locSub: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  subHeading: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.6,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  categoriesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  catBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.lightAccent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    maxWidth: '100%',
  },
  catBadgeText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  timelineContainer: {
    marginTop: 2,
  },
  timelineRow: {
    flexDirection: 'row',
  },
  timelineLeftCol: {
    alignItems: 'center',
    marginRight: spacing.md,
    width: 24,
  },
  timelineDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDotDone: {
    backgroundColor: colors.primary,
  },
  timelineDotPending: {
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  timelineConnector: {
    width: 2,
    flex: 1,
    minHeight: 24,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  timelineConnectorDone: {
    backgroundColor: colors.primary,
  },
  timelineContent: {
    flex: 1,
    flexShrink: 1,
    paddingBottom: spacing.md,
  },
  timelineTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  timelineTitleDone: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  timelineDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 17,
  },
  timelineTime: {
    fontSize: 11,
    color: colors.accentDark,
    fontWeight: '600',
    marginTop: 2,
  },
});
