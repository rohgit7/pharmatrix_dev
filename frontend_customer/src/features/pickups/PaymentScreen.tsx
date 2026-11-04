import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Receipt,
  Scale,
  ArrowRight,
} from 'lucide-react-native';
import {
  colors,
  spacing,
  borderRadius,
  formatShortDate,
  formatCurrency,
} from '../../theme';
import { Card } from '../../components/common/Card';
import { PrimaryButton } from '../../components/common/PrimaryButton';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  api,
  PickupDetailsData,
  RazorpayOrderResponse,
} from '../../services/api';

interface PaymentScreenProps {
  details: PickupDetailsData;
  onPaymentVerified: () => Promise<void>;
  onProceedToOTP: () => void;
  onBack: () => void;
}

const loadWebRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      resolve(false);
      return;
    }
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export const PaymentScreen: React.FC<PaymentScreenProps> = ({
  details,
  onPaymentVerified,
  onProceedToOTP,
  onBack,
}) => {
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeOrder, setActiveOrder] = useState<RazorpayOrderResponse | null>(
    null
  );

  const invoice = details.invoice;
  const isPaid =
    details.payment_status === 'PAID' ||
    invoice?.status === 'PAID' ||
    (invoice != null && invoice.amount_due <= 0);

  const openRazorpaySdk = async (
    order: RazorpayOrderResponse
  ): Promise<{
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }> => {
    const options = {
      description: `Pharmatrix Pickup ${order.pickup_code} (${order.invoice_number})`,
      currency: order.currency,
      key: order.key_id,
      amount: order.amount,
      name: 'Pharmatrix Regulated Waste',
      order_id: order.order_id,
      prefill: {
        email: order.customer_email,
        contact: order.customer_phone,
        name: order.customer_name,
      },
      theme: { color: colors.primary },
    };

    if (Platform.OS === 'web') {
      const loaded = await loadWebRazorpayScript();
      if (loaded && (window as any).Razorpay) {
        return new Promise((resolve, reject) => {
          const rzp = new (window as any).Razorpay({
            ...options,
            handler: (response: any) => {
              resolve({
                razorpay_order_id:
                  response.razorpay_order_id || order.order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
            },
            modal: {
              ondismiss: () => {
                reject(new Error('Payment checkout was cancelled.'));
              },
            },
          });
          rzp.on('payment.failed', (resp: any) => {
            reject(
              new Error(
                resp?.error?.description || 'Razorpay payment failed.'
              )
            );
          });
          rzp.open();
        });
      }
    }

    try {
      const RazorpayCheckout = require('react-native-razorpay').default;
      if (RazorpayCheckout && typeof RazorpayCheckout.open === 'function') {
        const data = await RazorpayCheckout.open(options);
        return {
          razorpay_order_id: data.razorpay_order_id || order.order_id,
          razorpay_payment_id: data.razorpay_payment_id,
          razorpay_signature: data.razorpay_signature,
        };
      }
    } catch (nativeErr: any) {
      if (nativeErr?.description || nativeErr?.code) {
        throw new Error(
          nativeErr.description || 'Payment cancelled or failed in Razorpay Checkout.'
        );
      }
      throw new Error(
        'Razorpay Native SDK requires a native development build, or use Web Checkout.'
      );
    }

    throw new Error('Unable to initialize Razorpay Checkout.');
  };

  const handlePayNow = async () => {
    if (isPaid || processing) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setProcessing(true);

    try {
      const order = await api.createPaymentOrder(details.public_id);
      setActiveOrder(order);

      const checkoutResult = await openRazorpaySdk(order);

      const verified = await api.verifyPayment(details.public_id, {
        razorpay_order_id: checkoutResult.razorpay_order_id,
        razorpay_payment_id: checkoutResult.razorpay_payment_id,
        razorpay_signature: checkoutResult.razorpay_signature,
      });

      setSuccessMsg(verified.message || 'Payment verified.');
      await onPaymentVerified();
    } catch (err: any) {
      setErrorMsg(
        err?.message || 'Payment could not be completed. Please try again.'
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Card variant="elevated" padding="lg" style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.titleRow}>
            <Receipt size={18} color={colors.primary} />
            <Text style={styles.title}>Invoice & Payment</Text>
          </View>
          <StatusBadge status={details.payment_status} size="sm" />
        </View>

        <Text style={styles.subtitle}>
          Pickup {details.pickup_code}
        </Text>

        {errorMsg ? (
          <View style={styles.errorBanner}>
            <AlertCircle size={16} color={colors.error} />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        {successMsg ? (
          <View style={styles.successBanner}>
            <CheckCircle2 size={16} color={colors.success} />
            <Text style={styles.successText}>{successMsg}</Text>
          </View>
        ) : null}

        {!invoice ? (
          <View style={styles.awaitingBox}>
            <Scale size={20} color={colors.warning} />
            <View style={styles.awaitingTextCol}>
              <Text style={styles.awaitingTitle}>Bill Not Yet Generated</Text>
              <Text style={styles.awaitingDesc}>
                Your invoice will be generated automatically once the driver records the collected weight.
              </Text>
            </View>
          </View>
        ) : (
          <>
            {/* Overflow-safe 2-Row Invoice Header Box */}
            <View style={styles.invoiceMetaBox}>
              <View style={styles.invoiceTopRow}>
                <View style={styles.metaCol}>
                  <Text style={styles.metaLabel}>INVOICE NUMBER</Text>
                  <Text style={styles.metaValPrimary} numberOfLines={1}>
                    {invoice.invoice_number}
                  </Text>
                </View>
                <View style={styles.metaColRight}>
                  <Text style={styles.metaLabel}>ISSUED DATE</Text>
                  <Text style={styles.metaVal}>
                    {formatShortDate(invoice.issued_at)}
                  </Text>
                </View>
              </View>

              <View style={styles.invoiceDivider} />

              <View style={styles.invoiceBottomRow}>
                <View style={styles.metaCol}>
                  <Text style={styles.metaLabel}>BILLED WEIGHT</Text>
                  <Text style={styles.metaVal}>
                    {details.actual_weight_kg != null
                      ? `${details.actual_weight_kg.toFixed(2)} kg`
                      : `${invoice.pricing_snapshot?.actual_weight_kg || '0'} kg`}
                  </Text>
                </View>
                <View style={styles.metaColRight}>
                  <Text style={styles.metaLabel}>TOTAL PAYABLE</Text>
                  <Text style={styles.metaValHighlight}>
                    {formatCurrency(invoice.total_amount, invoice.currency)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Line Items */}
            <Text style={styles.sectionHeading}>BILL BREAKDOWN</Text>
            <View style={styles.lineItemsBox}>
              {invoice.line_items.map((item) => (
                <View key={item.id} style={styles.lineRow}>
                  <View style={styles.lineTextCol}>
                    <Text style={styles.lineDesc}>{item.description}</Text>
                    <Text style={styles.lineSub}>
                      {item.quantity} ×{' '}
                      {formatCurrency(item.unit_price, invoice.currency)}
                    </Text>
                  </View>
                  <Text style={styles.lineAmount}>
                    {formatCurrency(item.amount, invoice.currency)}
                  </Text>
                </View>
              ))}

              <View style={styles.divider} />

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>
                  {formatCurrency(invoice.subtotal, invoice.currency)}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Tax</Text>
                <Text style={styles.summaryValue}>
                  {formatCurrency(invoice.tax_amount, invoice.currency)}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.totalLabel}>Total Amount</Text>
                <Text style={styles.totalValue}>
                  {formatCurrency(invoice.total_amount, invoice.currency)}
                </Text>
              </View>
              {invoice.amount_paid > 0 ? (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.success }]}>
                    Paid
                  </Text>
                  <Text style={[styles.summaryValue, { color: colors.success }]}>
                    {formatCurrency(invoice.amount_paid, invoice.currency)}
                  </Text>
                </View>
              ) : null}
              {!isPaid ? (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Amount Due</Text>
                  <Text style={styles.summaryValue}>
                    {formatCurrency(invoice.amount_due, invoice.currency)}
                  </Text>
                </View>
              ) : null}
            </View>

            {activeOrder && !isPaid ? (
              <View style={styles.orderTagBox}>
                <Text style={styles.orderTagText} numberOfLines={1}>
                  Order ID: {activeOrder.order_id}
                </Text>
              </View>
            ) : null}

            {/* Payment Action or Paid Confirmation */}
            {!isPaid ? (
              <View style={styles.payActionSection}>
                <PrimaryButton
                  title={`Pay ${formatCurrency(
                    invoice.amount_due,
                    invoice.currency
                  )}`}
                  onPress={handlePayNow}
                  loading={processing}
                  size="lg"
                  icon={<CreditCard size={18} color={colors.textInverse} />}
                />
                <View style={styles.securityNote}>
                  <ShieldCheck size={14} color={colors.textSecondary} />
                  <Text style={styles.securityNoteText}>
                    Secured by Razorpay Checkout
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.paidBox}>
                <View style={styles.paidHeader}>
                  <CheckCircle2 size={20} color={colors.success} />
                  <View style={styles.paidTextCol}>
                    <Text style={styles.paidTitle}>Payment Complete</Text>
                    <Text style={styles.paidSub}>
                      Invoice {invoice.invoice_number} is paid.
                    </Text>
                  </View>
                </View>

                {invoice.payments?.[0]?.payment_reference ? (
                  <Text style={styles.paymentRef} numberOfLines={1}>
                    Ref: {invoice.payments[0].payment_reference}
                  </Text>
                ) : null}

                <PrimaryButton
                  title="Generate Collection OTP"
                  onPress={onProceedToOTP}
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
  card: {
    marginBottom: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
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
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successBg,
    borderWidth: 1,
    borderColor: colors.successBorder,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  successText: {
    flex: 1,
    fontSize: 13,
    color: colors.success,
    fontWeight: '600',
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
  invoiceMetaBox: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  invoiceTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  invoiceDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.sm + 2,
  },
  invoiceBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  metaCol: {
    flex: 1,
    flexShrink: 1,
  },
  metaColRight: {
    alignItems: 'flex-end',
  },
  metaLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metaValPrimary: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  metaVal: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  metaValHighlight: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  sectionHeading: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
  lineItemsBox: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.lg,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 8,
    gap: spacing.md,
  },
  lineTextCol: {
    flex: 1,
    flexShrink: 1,
  },
  lineDesc: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  lineSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  lineAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
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
  orderTagBox: {
    backgroundColor: colors.lightAccent,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
  },
  orderTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
    textAlign: 'center',
  },
  payActionSection: {
    gap: spacing.sm,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  securityNoteText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  paidBox: {
    backgroundColor: colors.successBg,
    borderWidth: 1,
    borderColor: colors.successBorder,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
  },
  paidHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  paidTextCol: {
    flex: 1,
    flexShrink: 1,
  },
  paidTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.success,
  },
  paidSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  paymentRef: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
});
