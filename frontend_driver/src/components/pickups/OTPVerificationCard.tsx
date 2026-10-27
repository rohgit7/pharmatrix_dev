import React, { useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../../theme';

interface OTPVerificationCardProps {
  otp: string[];
  onChangeOtp: (newOtp: string[]) => void;
  isVerified: boolean;
  onResendOtp: () => void;
  isResending?: boolean;
  pharmacistName?: string;
}

export const OTPVerificationCard: React.FC<OTPVerificationCardProps> = ({
  otp,
  onChangeOtp,
  isVerified,
  onResendOtp,
  isResending = false,
  pharmacistName = 'Clinic Representative',
}) => {
  const inputRefs = useRef<any[]>([]);

  const handleChangeText = (text: string, index: number) => {
    // Only accept digits
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
      return;
    }

    newOtp[index] = cleaned;
    onChangeOtp(newOtp);

    if (cleaned && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.shieldIconBox}>
            <Ionicons name="shield-checkmark-outline" size={17} color={colors.textSecondary} />
          </View>
          <View>
            <Text style={styles.title}>Customer OTP Signoff</Text>
            <Text style={styles.subTitle}>Clinic Representative / Pharmacist Signoff</Text>
          </View>
        </View>

        <View style={[styles.verifiedBadge, isVerified && styles.verifiedBadgeActive]}>
          <Ionicons
            name={isVerified ? 'checkmark-circle' : 'time-outline'}
            size={13}
            color={isVerified ? colors.success : colors.textSecondary}
          />
          <Text style={[styles.verifiedText, isVerified && styles.verifiedTextActive]}>
            {isVerified ? 'Pharmacist Verified' : 'Awaiting PIN'}
          </Text>
        </View>
      </View>

      {/* Description */}
      <Text style={styles.promptText}>
        Ask {pharmacistName} for the 6-digit confirmation PIN generated on their customer portal:
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
            editable={!isVerified}
          />
        ))}
      </View>

      {/* Footer Strip */}
      <View style={styles.footerRow}>
        <View style={styles.handoverStatus}>
          <Ionicons
            name={isVerified ? 'lock-open' : 'lock-closed'}
            size={14}
            color={isVerified ? colors.success : colors.textOutline}
          />
          <Text style={[styles.handoverText, isVerified && styles.handoverTextActive]}>
            {isVerified ? 'Custody Handover Validated' : 'Handover Locked'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.resendBtn}
          onPress={onResendOtp}
          disabled={isResending}
          activeOpacity={0.7}
        >
          {isResending ? (
            <ActivityIndicator size="small" color={colors.primaryDark} />
          ) : (
            <>
              <Ionicons name="chatbox-ellipses-outline" size={13} color={colors.primaryDark} />
              <Text style={styles.resendText}>Resend SMS PIN</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
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
    width: 28,
    height: 28,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    ...typography.headlineSm,
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  subTitle: {
    ...typography.bodySm,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceLow,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  verifiedBadgeActive: {
    backgroundColor: colors.successContainer,
    borderColor: 'rgba(30, 142, 90, 0.3)',
  },
  verifiedText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  verifiedTextActive: {
    color: colors.success,
  },
  promptText: {
    ...typography.bodySm,
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  otpGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    paddingVertical: 4,
  },
  otpBox: {
    flex: 1,
    height: 48,
    borderRadius: radii.lg,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: colors.border,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: colors.onPrimaryContainer,
  },
  otpBoxFilled: {
    borderColor: colors.primaryDark,
    backgroundColor: 'rgba(229, 235, 255, 0.3)',
  },
  otpBoxVerified: {
    borderColor: colors.success,
    backgroundColor: colors.successContainer,
    color: colors.success,
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
    ...typography.labelSm,
    fontSize: 10,
    color: colors.textOutline,
    fontWeight: '600',
  },
  handoverTextActive: {
    color: colors.success,
    fontWeight: '700',
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  resendText: {
    ...typography.labelSm,
    fontSize: 11,
    color: colors.primaryDark,
    fontWeight: '700',
  },
});

export default OTPVerificationCard;
