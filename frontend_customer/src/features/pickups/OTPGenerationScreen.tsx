import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Platform,
} from 'react-native';
import {
  KeyRound,
  ShieldCheck,
  Clock,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react-native';
import {
  colors,
  spacing,
  borderRadius,
  formatDateTime,
} from '../../theme';
import { Card } from '../../components/common/Card';
import { PrimaryButton } from '../../components/common/PrimaryButton';
import { StatusBadge } from '../../components/common/StatusBadge';
import { api, PickupDetailsData } from '../../services/api';

interface OTPGenerationScreenProps {
  details: PickupDetailsData;
  cachedOtp: string | null;
  onOtpGenerated: (otp: string, expiresAt: string) => void;
  onRefreshDetails: () => Promise<void>;
  onBack: () => void;
}

export const OTPGenerationScreen: React.FC<OTPGenerationScreenProps> = ({
  details,
  cachedOtp,
  onOtpGenerated,
  onRefreshDetails,
  onBack,
}) => {
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expirySeconds, setExpirySeconds] = useState<number>(0);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(
    details.otp_status.cooldown_remaining_seconds || 0
  );

  useEffect(() => {
    setCooldownSeconds(details.otp_status.cooldown_remaining_seconds || 0);
  }, [details.otp_status.cooldown_remaining_seconds]);

  useEffect(() => {
    const updateTimers = () => {
      if (details.otp_status.otp_expires_at) {
        const expMs = new Date(details.otp_status.otp_expires_at).getTime();
        const diff = Math.max(0, Math.floor((expMs - Date.now()) / 1000));
        setExpirySeconds(diff);
      } else {
        setExpirySeconds(0);
      }
      setCooldownSeconds((prev) => Math.max(0, prev - 1));
    };

    updateTimers();
    const interval = setInterval(updateTimers, 1000);
    return () => clearInterval(interval);
  }, [details.otp_status.otp_expires_at]);

  const handleGenerateOTP = async () => {
    setErrorMsg(null);
    setGenerating(true);
    setCopied(false);
    try {
      const res = await api.requestPickupOTP(details.public_id);
      onOtpGenerated(res.otp, res.expires_at);
      setCooldownSeconds(60);
      await onRefreshDetails();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to generate OTP. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyOtp = async () => {
    if (!cachedOtp) return;
    try {
      if (
        Platform.OS === 'web' &&
        typeof navigator !== 'undefined' &&
        navigator.clipboard
      ) {
        await navigator.clipboard.writeText(cachedOtp);
      } else {
        await Share.share({
          message: `Pharmatrix Collection OTP for ${details.pickup_code}: ${cachedOtp}`,
        });
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  const isOtpVerified =
    details.otp_status.otp_verified || details.status === 'COLLECTED';
  const otpDigits = cachedOtp ? cachedOtp.split('') : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Card variant="elevated" padding="lg" style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.titleRow}>
            <KeyRound size={18} color={colors.primary} />
            <Text style={styles.title}>Collection OTP</Text>
          </View>
          <StatusBadge
            status={
              isOtpVerified
                ? 'VERIFIED'
                : expirySeconds > 0
                ? 'ACTIVE'
                : 'PENDING'
            }
            size="sm"
          />
        </View>

        <Text style={styles.subtitle}>
          Share this OTP with the driver to complete waste collection.
        </Text>

        {errorMsg ? (
          <View style={styles.errorBanner}>
            <AlertCircle size={16} color={colors.error} />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        {isOtpVerified ? (
          <View style={styles.verifiedContainer}>
            <View style={styles.verifiedIconCircle}>
              <CheckCircle2 size={30} color={colors.success} />
            </View>
            <Text style={styles.verifiedTitle}>Collection Verified</Text>
            <Text style={styles.verifiedSub}>
              The driver has verified your OTP and waste collection is complete.
            </Text>
            {details.otp_status.otp_verified_at ? (
              <Text style={styles.verifiedTime}>
                {formatDateTime(details.otp_status.otp_verified_at)}
              </Text>
            ) : null}
          </View>
        ) : (
          <>
            {/* OTP Digit Display (responsive on all phone widths) */}
            {otpDigits && expirySeconds > 0 ? (
              <View style={styles.otpDisplayBox}>
                <Text style={styles.otpBoxLabel}>COLLECTION PIN</Text>
                <View style={styles.digitsRow}>
                  {otpDigits.map((digit, idx) => (
                    <View key={idx} style={styles.digitCell}>
                      <Text style={styles.digitText}>{digit}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.otpActionsRow}>
                  <View style={styles.timerRow}>
                    <Clock size={13} color={colors.primary} />
                    <Text style={styles.timerText}>
                      Valid for {formatTimer(expirySeconds)}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.copyBtn}
                    onPress={handleCopyOtp}
                    activeOpacity={0.75}
                  >
                    {copied ? (
                      <>
                        <Check size={13} color={colors.success} />
                        <Text style={[styles.copyBtnText, { color: colors.success }]}>
                          Copied
                        </Text>
                      </>
                    ) : (
                      <>
                        <Copy size={13} color={colors.primary} />
                        <Text style={styles.copyBtnText}>Copy PIN</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.placeholderBox}>
                <ShieldCheck size={26} color={colors.textSecondary} />
                <Text style={styles.placeholderTitle}>
                  {details.otp_status.otp_active && !cachedOtp
                    ? 'OTP Active'
                    : 'Ready to Generate'}
                </Text>
                <Text style={styles.placeholderDesc}>
                  Generate a single-use 6-digit PIN when the driver is ready to collect the waste.
                </Text>
              </View>
            )}

            {/* Metadata Row */}
            <View style={styles.metaGrid}>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>QR SCAN</Text>
                <Text style={styles.metaValue}>
                  {details.otp_status.qr_verified ? 'Scanned' : 'Pending'}
                </Text>
              </View>
              <View style={styles.metaDivider} />
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>ATTEMPTS</Text>
                <Text style={styles.metaValue}>
                  {details.otp_status.otp_attempts} /{' '}
                  {details.otp_status.max_attempts}
                </Text>
              </View>
            </View>

            {/* Generate / Regenerate Button */}
            <PrimaryButton
              title={
                cooldownSeconds > 0
                  ? `Regenerate in ${cooldownSeconds}s`
                  : otpDigits
                  ? 'Regenerate OTP'
                  : 'Generate OTP'
              }
              onPress={handleGenerateOTP}
              loading={generating}
              disabled={cooldownSeconds > 0}
              size="lg"
              icon={<RefreshCw size={16} color={colors.textInverse} />}
            />
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
  otpDisplayBox: {
    backgroundColor: colors.lightAccent,
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  otpBoxLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accentDark,
    letterSpacing: 0.8,
    marginBottom: spacing.md,
  },
  digitsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
    maxWidth: 310,
    marginBottom: spacing.md,
  },
  digitCell: {
    flex: 1,
    maxWidth: 46,
    height: 54,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
  },
  otpActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 310,
    marginTop: 4,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  timerText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  placeholderBox: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  placeholderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  placeholderDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 260,
    lineHeight: 18,
  },
  metaGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.lg,
  },
  metaItem: {
    flex: 1,
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
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  verifiedContainer: {
    backgroundColor: colors.successBg,
    borderWidth: 1,
    borderColor: colors.successBorder,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
  },
  verifiedIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  verifiedTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.success,
  },
  verifiedSub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 19,
  },
  verifiedTime: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
});
