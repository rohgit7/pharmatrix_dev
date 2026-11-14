import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  Linking,
} from 'react-native';
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Receipt,
  Scale,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  Zap,
  Info,
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
  getApiBaseUrl,
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
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [webCheckoutActive, setWebCheckoutActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
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
  } | null> => {
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

    let hasNativeModule = false;
    let RazorpayCheckout: any = null;
    try {
      RazorpayCheckout = require('react-native-razorpay')?.default;
      if (RazorpayCheckout && typeof RazorpayCheckout.open === 'function') {
        hasNativeModule = true;
      }
    } catch {
      hasNativeModule = false;
    }

    if (hasNativeModule) {
      try {
        const data = await RazorpayCheckout.open(options);
        return {
          razorpay_order_id: data.razorpay_order_id || order.order_id,
          razorpay_payment_id: data.razorpay_payment_id,
          razorpay_signature: data.razorpay_signature,
        };
      } catch (nativeErr: any) {
        if (nativeErr?.description || nativeErr?.code) {
          throw new Error(
            nativeErr.description || 'Payment cancelled or failed in Razorpay Checkout.'
          );
        }
      }
    }

    // Fallback gracefully to Web Checkout in mobile browser
    const baseUrl = getApiBaseUrl();
    const checkoutUrl = `${baseUrl}/api/pickups/${details.public_id}/checkout?order_id=${encodeURIComponent(order.order_id)}`;
    await Linking.openURL(checkoutUrl);
    setWebCheckoutActive(true);
    setInfoMsg(
      'Web Checkout opened in your browser. Complete the payment, then tap "Check Payment Status" below.'
    );
    return null;
  };

  const handlePayNow = async () => {
    if (isPaid || processing) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setInfoMsg(null);
    setProcessing(true);

    try {
      let order = activeOrder;
      if (!order) {
        order = await api.createPaymentOrder(details.public_id);
        setActiveOrder(order);
      }

      const checkoutResult = await openRazorpaySdk(order);
      if (!checkoutResult) {
        // Opened in web browser
        return;
      }

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

  const handleOpenWebCheckout = async () => {
    if (isPaid || processing) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setProcessing(true);

    try {
      let order = activeOrder;
      if (!order) {
        order = await api.createPaymentOrder(details.public_id);
        setActiveOrder(order);
      }
      const baseUrl = getApiBaseUrl();
      const checkoutUrl = `${baseUrl}/api/pickups/${details.public_id}/checkout?order_id=${encodeURIComponent(order.order_id)}`;
      await Linking.openURL(checkoutUrl);
      setWebCheckoutActive(true);
      setInfoMsg(
        'Web Checkout opened in your browser. Complete the payment, then tap "Check Payment Status" below.'
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not open web checkout.');
    } finally {
      setProcessing(false);
    }
  };

  const handleCheckStatus = async () => {
    if (checkingStatus) return;
    setCheckingStatus(true);
    setErrorMsg(null);
    try {
      await onPaymentVerified();
    } catch (err: any) {
      setErrorMsg('Payment not recorded yet. Please complete checkout or try again.');
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleSimulatePayment = async () => {
    if (isPaid || processing) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setProcessing(true);

    try {
      const res = await api.simulateTestPayment(details.public_id);
      setSuccessMsg(res.message || 'Test payment simulated successfully!');
      await onPaymentVerified();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to simulate test payment.');
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
            <View style={styles.bannerTextCol}>
              <Text style={styles.errorText}>{errorMsg}</Text>
              {(errorMsg.includes('Web Checkout') || errorMsg.includes('Native SDK')) ? (
                <Text style={styles.errorHelpText}>
                  {__DEV__
                    ? 'In Expo Go, use Web Checkout in your browser or simulate a test payment below.'
                    : 'Please use Web Checkout in your browser to complete payment.'}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}

        {infoMsg ? (
          <View style={styles.infoBanner}>
            <Info size={16} color="#1d4ed8" />
            <Text style={styles.infoText}>{infoMsg}</Text>
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
                {webCheckoutActive || (errorMsg && (errorMsg.includes('Native SDK') || errorMsg.includes('Web Checkout'))) ? (
                  <>
                    <PrimaryButton
                      title="Open Web Checkout in Browser"
                      onPress={handleOpenWebCheckout}
                      loading={processing}
                      size="lg"
                      icon={<ExternalLink size={18} color={colors.textInverse} />}
                    />
                    <PrimaryButton
                      title="Check Payment Status"
                      onPress={handleCheckStatus}
                      loading={checkingStatus}
                      variant="outline"
                      size="md"
                      icon={<RefreshCw size={16} color={colors.primary} />}
                      style={{ marginTop: spacing.sm }}
                    />
                  </>
                ) : (
                  <>
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
                    <PrimaryButton
                      title="Pay with Web Checkout (Browser)"
                      onPress={handleOpenWebCheckout}
                      loading={processing}
                      variant="outline"
                      size="md"
                      icon={<ExternalLink size={16} color={colors.primary} />}
                      style={{ marginTop: spacing.sm }}
                    />
                  </>
                )}

                {__DEV__ ? (
                  <PrimaryButton
                    title="⚡ Simulate Test Payment (Dev/Demo Only)"
                    onPress={handleSimulatePayment}
                    loading={processing}
                    variant="accent"
                    size="md"
                    icon={<Zap size={16} color={colors.textInverse} />}
                    style={{ marginTop: spacing.sm }}
                  />
                ) : null}

                <View style={styles.securityNote}>
                  <ShieldCheck size={14} color={colors.textSecondary} />
                  <Text style={styles.securityNoteText}>
                    Secured by Razorpay • UPI, Cards & Netbanking
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
    alignItems: 'flex-start',
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  bannerTextCol: {
    flex: 1,
    flexShrink: 1,
  },
  errorText: {
    fontSize: 13,
    color: colors.error,
    fontWeight: '500',
  },
  errorHelpText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 16,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1d4ed8',
    fontWeight: '500',
    lineHeight: 18,
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
