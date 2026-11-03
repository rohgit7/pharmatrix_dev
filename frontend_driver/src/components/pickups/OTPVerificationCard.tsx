import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../../theme';

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
  pharmacistName = 'Clinic Representative',
  expectedOtp,
}) => {
  const inputRefs = useRef<any[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  // Auto verify when 6 digits are complete
  const checkAndAutoVerify = async (candidateOtp: string[]) => {
    const fullOtp = candidateOtp.join('').trim();
    if (fullOtp.length === 6 && !isVerified && onVerify) {
      setLocalError(null);
      try {
        await onVerify(fullOtp);
      } catch (err: any) {
        setLocalError(err?.message || 'Invalid 6-digit confirmation PIN');
      }
    }
  };

  const handleChangeText = (text: string, index: number) => {
    setLocalError(null);
    const cleaned = text.replace(/[^0-9]/g, '');
    const newOtp = [...otp];

    if (cleaned.length > 1) {
      // Pasting full 6-digit OTP
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
      setLocalError('Please enter all 6 digits of the confirmation PIN.');
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

  const handleFillDemoOtp = () => {
    if (expectedOtp && expectedOtp.length === 6) {
      const chars = expectedOtp.split('');
      onChangeOtp(chars);
      checkAndAutoVerify(chars);
    } else {
      // Default common fallback or prompt
      onResendOtp();
    }
  };

  const fullOtpStr = otp.join('');

  return (
    <View style={[styles.card, isVerified && styles.cardVerified]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.shieldIconBox, isVerified && styles.shieldIconBoxVerified]}>
            <Ionicons
              name={isVerified ? 'shield-checkmark' : 'keypad-outline'}
              size={18}
              color={isVerified ? '#FFFFFF' : '#3B52B6'}
            />
          </View>
          <View>
            <Text style={styles.title}>STEP 4: CUSTOMER OTP SIGNOFF</Text>
            <Text style={styles.subTitle}>Clinic Pharmacist / Representative Handover PIN</Text>
          </View>
        </View>

        <View style={[styles.verifiedBadge, isVerified && styles.verifiedBadgeActive]}>
          <Ionicons
            name={isVerified ? 'checkmark-circle' : 'time-outline'}
            size={13}
            color={isVerified ? colors.success : '#8A8279'}
          />
          <Text style={[styles.verifiedText, isVerified && styles.verifiedTextActive]}>
            {isVerified ? 'Handover Signed' : 'Awaiting PIN'}
          </Text>
        </View>
      </View>

      {/* Description */}
      <Text style={styles.promptText}>
        Ask {pharmacistName} for the 6-digit handover PIN delivered to their registered portal/phone:
      </Text>

      {/* 6 Digit Input Grid */}
      <View style={styles.otpGrid}>
        {Array.from({ length: 6 }).map((_, i) => (
          <TextInput
            key={i}
            ref={(ref) => { inputRefs.current[i] = ref; }}
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

      {/* Local Error feedback */}
      {localError && (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle" size={14} color="#DC2626" />
          <Text style={styles.errorText}>{localError}</Text>
        </View>
      )}

      {/* Manual Verify Button when 6 digits entered but not yet verified */}
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
              <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
              <Text style={styles.manualVerifyBtnText}>Verify 6-Digit PIN Now</Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* Footer Strip */}
      <View style={styles.footerRow}>
        <View style={styles.handoverStatus}>
          <Ionicons
            name={isVerified ? 'lock-open' : 'lock-closed'}
            size={14}
            color={isVerified ? colors.success : '#8A8279'}
          />
          <Text style={[styles.handoverText, isVerified && styles.handoverTextActive]}>
            {isVerified ? 'Custody Handover Validated' : 'Custody Transfer Locked'}
          </Text>
        </View>

        <View style={styles.rightActionsRow}>
          <TouchableOpacity
            style={styles.resendBtn}
            onPress={onResendOtp}
            disabled={isResending || isVerified}
            activeOpacity={0.7}
          >
            {isResending ? (
              <ActivityIndicator size="small" color="#3B52B6" />
            ) : (
              <>
                <Ionicons name="chatbox-ellipses-outline" size={13} color="#3B52B6" />
                <Text style={styles.resendText}>Resend PIN</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.xl,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: '#EADFD0',
    shadowColor: '#201E1C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  cardVerified: {
    borderColor: '#C6F6D5',
    backgroundColor: '#FAFDF9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shieldIconBox: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    backgroundColor: '#E5EBFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 82, 182, 0.25)',
  },
  shieldIconBoxVerified: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  title: {
    fontSize: 10,
    fontWeight: '800',
    color: '#3B52B6',
    letterSpacing: 0.4,
  },
  subTitle: {
    ...typography.bodySm,
    fontSize: 11,
    color: '#5C554E',
    marginTop: 1,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5EFE6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: '#EADFD0',
  },
  verifiedBadgeActive: {
    backgroundColor: '#E8F5E9',
    borderColor: '#C6F6D5',
  },
  verifiedText: {
    fontSize: 10,
    color: '#8A8279',
    fontWeight: '700',
  },
  verifiedTextActive: {
    color: colors.success,
  },
  promptText: {
    fontSize: 12,
    color: '#5C554E',
    lineHeight: 17,
    fontWeight: '500',
  },
  otpGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    paddingVertical: 2,
  },
  otpBox: {
    flex: 1,
    height: 50,
    borderRadius: radii.lg,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#EADFD0',
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '800',
    color: '#201E1C',
  },
  otpBoxFilled: {
    borderColor: '#3B52B6',
    backgroundColor: '#F0F4FF',
  },
  otpBoxVerified: {
    borderColor: colors.success,
    backgroundColor: '#E8F5E9',
    color: colors.success,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    padding: 8,
    borderRadius: radii.md,
  },
  errorText: {
    fontSize: 11.5,
    color: '#B91C1C',
    fontWeight: '600',
  },
  manualVerifyBtn: {
    backgroundColor: '#3B52B6',
    height: 44,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  manualVerifyBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(234, 223, 208, 0.5)',
    paddingTop: 8,
  },
  handoverStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  handoverText: {
    fontSize: 10.5,
    color: '#8A8279',
    fontWeight: '600',
  },
  handoverTextActive: {
    color: colors.success,
    fontWeight: '700',
  },
  rightActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  resendText: {
    fontSize: 11,
    color: '#3B52B6',
    fontWeight: '700',
  },
});

export default OTPVerificationCard;
