import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography, shadows } from '../../theme';

interface OTPVerificationCardProps {
  otp: string[];
  onChangeOtp: (newOtp: string[]) => void;
  isVerified: boolean;
  onVerify?: (otpStr: string) => Promise<void>;
  onResendOtp: () => void;
  isResending?: boolean;
  isVerifying?: boolean;
  pharmacistName?: string;
  expectedOtp?: string;
}

export const OTPVerificationCard: React.FC<OTPVerificationCardProps> = ({
  otp,
  onChangeOtp,
  isVerified,
  onVerify,
  onResendOtp,
  isResending = false,
  isVerifying = false,
  pharmacistName = 'Customer Representative',
}) => {
  const inputRefs = useRef<any[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  const checkAndAutoVerify = async (candidateOtp: string[]) => {
    const fullOtp = candidateOtp.join('').trim();
    if (fullOtp.length === 6 && !isVerified && onVerify) {
      setLocalError(null);
      try {
        await onVerify(fullOtp);
      } catch (err: any) {
        setLocalError(err?.message || 'Invalid 6-digit PIN code');
      }
    }
  };

  const handleChangeText = (text: string, index: number) => {
    setLocalError(null);
    const cleaned = text.replace(/[^0-9]/g, '');
    const newOtp = [...otp];

    if (cleaned.length > 1) {
      const chars = cleaned.slice(0, 6).split('');
      for (let i = 0; i < 6; i++) {
        newOtp[i] = chars[i] || '';
      }
      onChangeOtp(newOtp);
      const nextIdx = Math.min(chars.length, 5);
      inputRefs.current[nextIdx]?.focus();
      checkAndAutoVerify(newOtp);
      return;
    }

    newOtp[index] = cleaned;
    onChangeOtp(newOtp);

    if (cleaned && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newOtp.join('').length === 6) {
      checkAndAutoVerify(newOtp);
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleManualVerifyPress = async () => {
    const fullOtp = otp.join('').trim();
    if (fullOtp.length !== 6) {
      setLocalError('Please enter all 6 digits of the PIN.');
      return;
    }
    if (onVerify) {
      setLocalError(null);
      try {
        await onVerify(fullOtp);
      } catch (err: any) {
        setLocalError(err?.message || 'Invalid PIN code');
      }
    }
  };

  const fullOtpStr = otp.join('');

  return (
    <View style={[styles.card, isVerified && styles.cardVerified]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>STEP 4: CUSTOMER OTP PIN</Text>
        </View>

        <View style={[styles.verifiedBadge, isVerified && styles.verifiedBadgeActive]}>
          <Ionicons
            name={isVerified ? 'checkmark-circle' : 'keypad-outline'}
            size={12}
            color={isVerified ? colors.success : colors.textMuted}
          />
          <Text style={[styles.verifiedText, isVerified && styles.verifiedTextActive]}>
            {isVerified ? 'PIN Verified' : 'Awaiting PIN'}
          </Text>
        </View>
      </View>

      {/* Description */}
      <Text style={styles.promptText}>
        Enter 6-digit confirmation PIN from {pharmacistName}:
      </Text>

      {/* 6 Digit Input Grid */}
      <View style={styles.otpGrid}>
        {Array.from({ length: 6 }).map((_, i) => (
          <TextInput
            key={i}
            ref={(ref) => {
              inputRefs.current[i] = ref;
            }}
            style={[
              styles.otpBox,
              otp[i] ? styles.otpBoxFilled : null,
              isVerified ? styles.otpBoxVerified : null,
            ]}
            value={otp[i] || ''}
            onChangeText={(text) => handleChangeText(text, i)}
            onKeyPress={(e) => handleKeyPress(e, i)}
            keyboardType="number-pad"
            maxLength={6}
            selectTextOnFocus
            editable={!isVerified && !isVerifying}
          />
        ))}
      </View>

      {/* Error feedback */}
      {localError && (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
          <Text style={styles.errorText}>{localError}</Text>
        </View>
      )}

      {/* Manual Verify Button */}
      {!isVerified && fullOtpStr.length === 6 && (
        <TouchableOpacity
          style={styles.manualVerifyBtn}
          onPress={handleManualVerifyPress}
          disabled={isVerifying}
          activeOpacity={0.85}
        >
          {isVerifying ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <View style={styles.verifyBtnContent}>
              <Ionicons name="checkmark-circle" size={15} color="#FFFFFF" />
              <Text style={styles.manualVerifyBtnText}>Verify PIN</Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* Footer */}
      <View style={styles.footerRow}>
        <View style={styles.handoverStatus}>
          <Ionicons
            name={isVerified ? 'shield-checkmark' : 'lock-closed-outline'}
            size={13}
            color={isVerified ? colors.success : colors.textMuted}
          />
          <Text style={[styles.handoverText, isVerified && styles.handoverTextActive]}>
            {isVerified ? 'Custody Handover Validated' : 'Custody Handover Locked'}
          </Text>
        </View>

        {!isVerified && (
          <TouchableOpacity
            style={styles.resendBtn}
            onPress={onResendOtp}
            disabled={isResending || isVerified}
            activeOpacity={0.7}
          >
            {isResending ? (
              <ActivityIndicator size="small" color={colors.primaryAccent} />
            ) : (
              <View style={styles.resendContent}>
                <Ionicons name="refresh-outline" size={12} color={colors.primary} />
                <Text style={styles.resendText}>Resend PIN</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.secondary,
    gap: 10,
    marginBottom: spacing.md,
    ...shadows.subtle,
  },
  cardVerified: {
    borderColor: colors.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  stepBadge: {
    backgroundColor: colors.lightAccent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.xs,
    flexShrink: 1,
  },
  stepBadgeText: {
    ...typography.labelSm,
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.secondary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    flexShrink: 1,
  },
  verifiedBadgeActive: {
    backgroundColor: colors.successContainer,
    borderColor: 'rgba(22, 163, 74, 0.2)',
  },
  verifiedText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  verifiedTextActive: {
    color: colors.success,
  },
  promptText: {
    ...typography.bodySm,
    fontSize: 12,
    color: colors.textSecondary,
  },
  otpGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    paddingVertical: 4,
  },
  otpBox: {
    flex: 1,
    maxWidth: 48,
    minWidth: 36,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.secondary,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  otpBoxFilled: {
    borderColor: colors.primaryAccent,
    backgroundColor: colors.surface,
  },
  otpBoxVerified: {
    borderColor: colors.success,
    backgroundColor: colors.successContainer,
    color: colors.success,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.errorContainer,
    padding: 8,
    borderRadius: radii.xs,
  },
  errorText: {
    ...typography.bodySm,
    fontSize: 11,
    color: colors.error,
    flex: 1,
  },
  manualVerifyBtn: {
    backgroundColor: colors.primaryAccent,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  manualVerifyBtnText: {
    ...typography.labelMd,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.secondary,
    paddingTop: 8,
  },
  handoverStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  handoverText: {
    ...typography.bodySm,
    fontSize: 11,
    color: colors.textMuted,
  },
  handoverTextActive: {
    color: colors.success,
    fontWeight: '600',
  },
  resendBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  resendContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  resendText: {
    ...typography.labelSm,
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
  },
});

export default OTPVerificationCard;
