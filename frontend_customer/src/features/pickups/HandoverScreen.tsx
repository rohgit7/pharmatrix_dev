import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Scale,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Package,
  AlertCircle,
  ArrowRight,
  Receipt,
} from 'lucide-react-native';
import {
  colors,
  spacing,
  borderRadius,
  formatDateTime,
  formatCurrency,
} from '../../theme';
import { Card } from '../../components/common/Card';
import { PrimaryButton } from '../../components/common/PrimaryButton';
import { StatusBadge } from '../../components/common/StatusBadge';
import { api, PickupDetailsData } from '../../services/api';

interface HandoverScreenProps {
  details: PickupDetailsData;
  onConfirmed: () => Promise<void>;
  onProceedToPayment: () => void;
  onBack: () => void;
}

export const HandoverScreen: React.FC<HandoverScreenProps> = ({
  details,
  onConfirmed,
  onProceedToPayment,
  onBack,
}) => {
  const [notes, setNotes] = useState(details.handover_notes || '');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const actualWeight = details.actual_weight_kg;
  const estimatedWeight = details.estimated_weight_kg;
  const discrepancyKg = details.weight_discrepancy_kg;
  const discrepancyPct = details.weight_discrepancy_pct;
  const invoice = details.invoice;

  const handleConfirmHandover = async () => {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await api.confirmHandover(details.public_id, notes.trim() || undefined);
      await onConfirmed();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to confirm waste handover.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Card variant="elevated" padding="lg" style={styles.sectionCard}>
          <View style={styles.topRow}>
            <View style={styles.titleRow}>
              <Scale size={18} color={colors.primary} />
              <Text style={styles.title}>Weight Verification</Text>
            </View>
            <StatusBadge
              status={details.handover_confirmed ? 'VERIFIED' : 'PENDING'}
              size="sm"
            />
          </View>
          <Text style={styles.subtitle}>
            Pickup {details.pickup_code} · Review the collected weight recorded by the driver.
          </Text>

          {errorMsg ? (
            <View style={styles.errorBanner}>
              <AlertCircle size={16} color={colors.error} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          {actualWeight == null ? (
            <View style={styles.awaitingBox}>
              <AlertTriangle size={20} color={colors.warning} />
              <View style={styles.awaitingTextCol}>
                <Text style={styles.awaitingTitle}>Awaiting Driver Weigh-In</Text>
                <Text style={styles.awaitingDesc}>
                  Weight verification will unlock as soon as the driver records the collected weight at your facility.
                </Text>
              </View>
            </View>
          ) : (
            <>
              {/* Side-by-Side Weight Comparison */}
              <View style={styles.weightGrid}>
                <View style={styles.weightBox}>
                  <Text style={styles.weightLabel}>ESTIMATED</Text>
                  <Text style={styles.weightValue}>
                    {estimatedWeight != null
                      ? `${estimatedWeight.toFixed(2)} kg`
                      : '—'}
                  </Text>
                  <Text style={styles.weightCaption}>Booked Estimate</Text>
                </View>

                <View style={[styles.weightBox, styles.weightBoxActual]}>
                  <View style={styles.lockedHeader}>
                    <Text style={[styles.weightLabel, { color: colors.accentDark }]}>
                      RECORDED
                    </Text>
                    <Lock size={12} color={colors.accentDark} />
                  </View>
                  <Text style={[styles.weightValue, { color: colors.primary }]}>
                    {actualWeight.toFixed(2)} kg
                  </Text>
                  <Text style={styles.weightCaption}>Driver Weigh-In</Text>
                </View>
              </View>

              {/* Variance Strip */}
              {discrepancyKg != null ? (
                <View
                  style={[
                    styles.discrepancyBanner,
                    Math.abs(discrepancyKg) > 0.01
                      ? styles.discrepancyVariance
                      : styles.discrepancyExact,
                  ]}
                >
                  <Scale
                    size={15}
                    color={
                      Math.abs(discrepancyKg) > 0.01
                        ? colors.warning
                        : colors.success
                    }
                  />
                  <Text style={styles.discrepancyTitle}>
                    Variance:{' '}
                    {discrepancyKg > 0
                      ? `+${discrepancyKg.toFixed(2)} kg`
                      : `${discrepancyKg.toFixed(2)} kg`}
                    {discrepancyPct != null
                      ? ` (${discrepancyPct > 0 ? '+' : ''}${discrepancyPct}%)`
                      : ''}
                  </Text>
                </View>
              ) : null}

              {/* Category Breakdown */}
              <Text style={styles.sectionHeading}>WASTE CATEGORIES</Text>
              <View style={styles.breakdownList}>
                {details.waste_breakdown.map((item) => (
                  <View key={item.code} style={styles.breakdownRow}>
                    <View style={styles.breakdownLeft}>
                      <Package size={15} color={colors.textSecondary} />
                      <View style={styles.breakdownTextCol}>
                        <Text style={styles.breakdownName}>{item.name}</Text>
                        <Text style={styles.breakdownBin}>
                          {item.bin_color} Bin
                        </Text>
                      </View>
                    </View>
                    <View style={styles.breakdownRight}>
                      <Text style={styles.breakdownActual}>
                        {item.actual_weight_kg != null
                          ? `${item.actual_weight_kg.toFixed(2)} kg`
                          : '—'}
                      </Text>
                      {item.estimated_weight_kg != null ? (
                        <Text style={styles.breakdownEst}>
                          Est: {item.estimated_weight_kg.toFixed(2)} kg
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>

              {/* Bill Breakdown Summary if generated */}
              {invoice ? (
                <View style={styles.billSummaryBox}>
                  <View style={styles.billSummaryHeader}>
                    <Receipt size={14} color={colors.primary} />
                    <Text style={styles.billSummaryTitle}>
                      CALCULATED BILL ({invoice.invoice_number})
                    </Text>
                  </View>
                  <View style={styles.billSummaryRow}>
                    <Text style={styles.billLabel}>Subtotal</Text>
                    <Text style={styles.billValue}>
                      {formatCurrency(invoice.subtotal, invoice.currency)}
                    </Text>
                  </View>
                  <View style={styles.billSummaryRow}>
                    <Text style={styles.billLabel}>Tax</Text>
                    <Text style={styles.billValue}>
                      {formatCurrency(invoice.tax_amount, invoice.currency)}
                    </Text>
                  </View>
                  <View style={[styles.billSummaryRow, styles.billTotalRow]}>
                    <Text style={styles.billTotalLabel}>Total Amount</Text>
                    <Text style={styles.billTotalValue}>
                      {formatCurrency(invoice.total_amount, invoice.currency)}
                    </Text>
                  </View>
                </View>
              ) : null}

              {/* Handover Notes & Confirmation */}
              {!details.handover_confirmed ? (
                <View style={styles.confirmBlock}>
                  <Text style={styles.inputLabel}>
                    Handover Remarks (Optional)
                  </Text>
                  <TextInput
                    style={styles.textArea}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Optional notes on waste handover"
                    placeholderTextColor={colors.textMuted}
                    multiline
                  />
                  <PrimaryButton
                    title="Confirm Waste Handover"
                    onPress={handleConfirmHandover}
                    loading={submitting}
                    size="lg"
                    icon={<CheckCircle2 size={18} color={colors.textInverse} />}
                  />
                </View>
              ) : (
                <View style={styles.confirmedBox}>
                  <View style={styles.confirmedHeader}>
                    <CheckCircle2 size={18} color={colors.success} />
                    <Text style={styles.confirmedTitle}>Handover Confirmed</Text>
                  </View>
                  {details.handover_confirmed_at ? (
                    <Text style={styles.confirmedTimestamp}>
                      {formatDateTime(details.handover_confirmed_at)}
                    </Text>
                  ) : null}
                  {details.handover_notes ? (
                    <Text style={styles.confirmedNotes}>
                      {details.handover_notes}
                    </Text>
                  ) : null}
                  <PrimaryButton
                    title="Proceed to Payment"
                    onPress={onProceedToPayment}
                    variant="accent"
                    size="md"
                    icon={<ArrowRight size={15} color={colors.textInverse} />}
                    style={{ marginTop: spacing.md }}
                  />
                </View>
              )}
            </>
          )}

          <PrimaryButton
            title="Back to Pickup Details"
            onPress={onBack}
            variant="outline"
            size="sm"
            style={{ marginTop: spacing.md }}
          />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
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
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  sectionCard: {
    marginBottom: spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: spacing.sm,
  },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    marginBottom: spacing.lg,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: colors.error,
    fontWeight: '500',
  },
  awaitingBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    gap: spacing.md,
  },
  awaitingTextCol: {
    flex: 1,
    flexShrink: 1,
  },
  awaitingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.warning,
  },
  awaitingDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  weightGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  weightBox: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  weightBoxActual: {
    backgroundColor: colors.lightAccent,
    borderColor: colors.accent,
  },
  lockedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weightLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.6,
  },
  weightValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 4,
  },
  weightCaption: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  discrepancyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  discrepancyVariance: {
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  discrepancyExact: {
    backgroundColor: colors.successBg,
    borderWidth: 1,
    borderColor: colors.successBorder,
  },
  discrepancyTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  sectionHeading: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
  breakdownList: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: spacing.sm,
  },
  breakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    flexShrink: 1,
  },
  breakdownTextCol: {
    flex: 1,
    flexShrink: 1,
  },
  breakdownName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  breakdownBin: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  breakdownRight: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  breakdownActual: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  breakdownEst: {
    fontSize: 11,
    color: colors.textMuted,
  },
  billSummaryBox: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    gap: 6,
  },
  billSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  billSummaryTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.6,
  },
  billSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  billLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  billValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  billTotalRow: {
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  billTotalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  billTotalValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  confirmBlock: {
    marginTop: spacing.xs,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  textArea: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    minHeight: 68,
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    textAlignVertical: 'top',
  },
  confirmedBox: {
    backgroundColor: colors.successBg,
    borderWidth: 1,
    borderColor: colors.successBorder,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
  },
  confirmedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confirmedTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.success,
  },
  confirmedTimestamp: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  confirmedNotes: {
    fontSize: 12,
    color: colors.textPrimary,
    marginTop: 4,
  },
});
