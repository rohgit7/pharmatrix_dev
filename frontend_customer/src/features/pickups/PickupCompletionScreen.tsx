import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import * as Print from 'expo-print';
import {
  CheckCircle2,
  Printer,
  FileCheck2,
  Scale,
  CreditCard,
  ShieldCheck,
  MapPin,
} from 'lucide-react-native';
import {
  colors,
  spacing,
  borderRadius,
  formatDateTime,
  formatCurrency,
  formatStatusLabel,
} from '../../theme';
import { Card } from '../../components/common/Card';
import { PrimaryButton } from '../../components/common/PrimaryButton';
import { StatusBadge } from '../../components/common/StatusBadge';
import { PickupDetailsData } from '../../services/api';

interface PickupCompletionScreenProps {
  details: PickupDetailsData;
  onBackToDetails: () => void;
  onBackToDashboard: () => void;
}

export const PickupCompletionScreen: React.FC<PickupCompletionScreenProps> = ({
  details,
  onBackToDetails,
  onBackToDashboard,
}) => {
  const invoice = details.invoice;

  const handlePrintReceipt = async () => {
    try {
      const html = `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; padding: 32px; color: #201E1C; }
              h1 { font-size: 20px; margin-bottom: 4px; }
              .meta { color: #6B6661; font-size: 13px; margin-bottom: 24px; }
              .box { border: 1px solid #E6DFD5; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
              .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
              .bold { font-weight: bold; }
            </style>
          </head>
          <body>
            <h1>PHARMATRIX COLLECTION RECEIPT</h1>
            <div class="meta">Pickup ID: ${details.pickup_code} | Status: ${formatStatusLabel(details.status)}</div>
            <div class="box">
              <div class="row"><span class="bold">Location:</span><span>${details.location?.name || 'Registered Facility'}</span></div>
              <div class="row"><span class="bold">Final Weight:</span><span>${details.actual_weight_kg ?? details.estimated_weight_kg ?? 0} kg</span></div>
              <div class="row"><span class="bold">Completion Date:</span><span>${details.collected_at ? new Date(details.collected_at).toLocaleString('en-IN') : 'Completed'}</span></div>
              <div class="row"><span class="bold">OTP Verification:</span><span>${details.otp_status.otp_verified ? 'Verified' : 'Completed'}</span></div>
            </div>
            ${
              invoice
                ? `<div class="box">
                    <div class="row"><span class="bold">Invoice Number:</span><span>${invoice.invoice_number}</span></div>
                    <div class="row"><span class="bold">Subtotal:</span><span>${invoice.currency} ${invoice.subtotal.toFixed(2)}</span></div>
                    <div class="row"><span class="bold">Tax:</span><span>${invoice.currency} ${invoice.tax_amount.toFixed(2)}</span></div>
                    <div class="row"><span class="bold">Total Paid:</span><span>${invoice.currency} ${invoice.total_amount.toFixed(2)}</span></div>
                  </div>`
                : ''
            }
          </body>
        </html>
      `;
      await Print.printAsync({ html });
    } catch {
      Alert.alert(
        'Receipt Ready',
        `Receipt for ${details.pickup_code} is saved in your pickup records.`
      );
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Card variant="elevated" padding="xl" style={styles.heroCard}>
        <View style={styles.heroIconWrap}>
          <CheckCircle2 size={34} color={colors.success} />
        </View>
        <Text style={styles.heroTitle}>{details.pickup_code}</Text>
        <Text style={styles.heroSub}>
          Waste collection, billing, and custody verification are complete.
        </Text>
        <View style={{ marginTop: spacing.xs }}>
          <StatusBadge status={details.status} />
        </View>
      </Card>

      {/* Completion Summary Metrics */}
      <Card variant="elevated" padding="lg" style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Collection Summary</Text>

        <View style={styles.summaryRow}>
          <View style={styles.summaryLabelRow}>
            <FileCheck2 size={15} color={colors.textSecondary} />
            <Text style={styles.summaryLabel}>Pickup ID</Text>
          </View>
          <Text style={styles.summaryValue}>{details.pickup_code}</Text>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryLabelRow}>
            <MapPin size={15} color={colors.textSecondary} />
            <Text style={styles.summaryLabel}>Location</Text>
          </View>
          <Text style={styles.summaryValue} numberOfLines={1}>
            {details.location?.name || 'Registered Location'}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryLabelRow}>
            <Scale size={15} color={colors.textSecondary} />
            <Text style={styles.summaryLabel}>Final Weight</Text>
          </View>
          <Text style={styles.summaryValue}>
            {details.actual_weight_kg != null
              ? `${details.actual_weight_kg.toFixed(2)} kg`
              : details.estimated_weight_kg != null
              ? `${details.estimated_weight_kg.toFixed(2)} kg`
              : '—'}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryLabelRow}>
            <CreditCard size={15} color={colors.textSecondary} />
            <Text style={styles.summaryLabel}>Payment Status</Text>
          </View>
          <StatusBadge status={details.payment_status} size="sm" />
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryLabelRow}>
            <ShieldCheck size={15} color={colors.textSecondary} />
            <Text style={styles.summaryLabel}>Custody OTP</Text>
          </View>
          <StatusBadge
            status={details.otp_status.otp_verified ? 'VERIFIED' : 'COMPLETED'}
            size="sm"
          />
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Completion Date</Text>
          <Text style={styles.summaryValue}>
            {details.collected_at
              ? formatDateTime(details.collected_at)
              : details.otp_status.otp_verified_at
              ? formatDateTime(details.otp_status.otp_verified_at)
              : 'Recorded'}
          </Text>
        </View>
      </Card>

      {/* Invoice & Receipt Details */}
      {invoice ? (
        <Card variant="elevated" padding="lg" style={styles.sectionCard}>
          <Text style={styles.sectionTitle} numberOfLines={1}>
            Invoice · {invoice.invoice_number}
          </Text>
          {invoice.line_items.map((item) => (
            <View key={item.id} style={styles.summaryRow}>
              <Text style={styles.summaryLabelFlex} numberOfLines={2}>
                {item.description} ({item.quantity})
              </Text>
              <Text style={styles.summaryValue}>
                {formatCurrency(item.amount, invoice.currency)}
              </Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total Paid</Text>
            <Text style={styles.totalValue}>
              {formatCurrency(invoice.total_amount, invoice.currency)}
            </Text>
          </View>
          {invoice.payments?.[0]?.payment_reference ? (
            <Text style={styles.paymentRef} numberOfLines={1}>
              Ref: {invoice.payments[0].payment_reference}
            </Text>
          ) : null}
        </Card>
      ) : null}

      <View style={styles.actionsCol}>
        <PrimaryButton
          title="Download / Print Receipt"
          onPress={handlePrintReceipt}
          variant="accent"
          size="lg"
          icon={<Printer size={17} color={colors.textInverse} />}
        />
        <View style={styles.secondaryActionsRow}>
          <PrimaryButton
            title="Pickup Details"
            onPress={onBackToDetails}
            variant="outline"
            size="md"
            style={{ flex: 1 }}
          />
          <PrimaryButton
            title="Home"
            onPress={onBackToDashboard}
            variant="primary"
            size="md"
            style={{ flex: 1 }}
          />
        </View>
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
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  heroCard: {
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: 6,
  },
  heroIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  heroSub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },
  sectionCard: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    gap: spacing.md,
  },
  summaryLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  summaryLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  summaryLabelFlex: {
    flex: 1,
    flexShrink: 1,
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  summaryValue: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  paymentRef: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  actionsCol: {
    gap: spacing.sm,
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
