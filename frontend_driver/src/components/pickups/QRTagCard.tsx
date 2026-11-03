import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography, shadows } from '../../theme';
import { RouteStop } from '../../types/api';
import { createPickupQrPayload, generateQrMatrix } from '../../utils/qr';

interface QRTagCardProps {
  stop: RouteStop | null;
  totalWeight: number;
  qrVerified: boolean;
  tamperSealAffixed: boolean;
  onToggleTamperSeal: () => void;
  onScanPress: () => void;
  onQuickVerify?: () => void;
  onPrintPress: () => void;
  onProceedToOTP?: () => void;
}

export const QRTagCard: React.FC<QRTagCardProps> = ({
  stop,
  totalWeight,
  qrVerified,
  tamperSealAffixed,
  onToggleTamperSeal,
  onScanPress,
  onQuickVerify,
  onPrintPress,
  onProceedToOTP,
}) => {
  const code = stop?.pickup_code ? `#${stop.pickup_code}` : 'Consignment';

  // Compute dynamic QR matrix from real pickup metadata
  const { matrix, size } = useMemo(() => {
    if (!stop) return { matrix: [], size: 0 };
    const payload = createPickupQrPayload(stop);
    return generateQrMatrix(payload);
  }, [stop?.id, stop?.pickup_code, stop?.pickup_id]);

  return (
    <View style={[styles.card, qrVerified && styles.cardVerified]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>STEP 3: QR TAG & TAMPER SEAL</Text>
        </View>

        <TouchableOpacity
          style={styles.printBtn}
          onPress={onPrintPress}
          activeOpacity={0.7}
        >
          <Ionicons name="print-outline" size={13} color={colors.primary} />
          <Text style={styles.printText}>Print Slip</Text>
        </TouchableOpacity>
      </View>

      {/* QR Code and Tag Sync Info */}
      <View style={styles.syncBox}>
        {/* Dynamic Scannable QR Matrix */}
        <View style={styles.qrCodeFrame}>
          {size > 0 && matrix.length > 0 ? (
            <Svg width={72} height={72} viewBox={`0 0 ${size + 4} ${size + 4}`}>
              <Rect width="100%" height="100%" fill="#FFFFFF" />
              {matrix.map((val, idx) => {
                if (!val) return null;
                const y = Math.floor(idx / size) + 2;
                const x = (idx % size) + 2;
                return <Rect key={idx} x={x} y={y} width={1} height={1} fill={colors.primary} />;
              })}
            </Svg>
          ) : (
            <Ionicons name="qr-code" size={48} color={colors.primary} />
          )}
        </View>

        {/* Sync Info Column */}
        <View style={styles.syncInfoCol}>
          <Text style={styles.barcodeText} numberOfLines={1}>
            {code}
          </Text>
          <Text style={styles.detailsText} numberOfLines={1}>
            {stop?.customer_name || 'Clinic'} | {totalWeight.toFixed(1)} kg
          </Text>

          <View style={[styles.statusPill, qrVerified && styles.statusPillVerified]}>
            <Ionicons
              name={qrVerified ? 'checkmark-circle' : 'time-outline'}
              size={12}
              color={qrVerified ? colors.success : colors.textMuted}
            />
            <Text style={[styles.statusPillText, qrVerified && styles.statusPillTextVerified]}>
              {qrVerified ? 'QR Verified' : 'Awaiting Scan'}
            </Text>
          </View>
        </View>
      </View>

      {/* Verification Actions */}
      <View style={styles.actionButtonsRow}>
        <TouchableOpacity
          style={styles.scanBtn}
          onPress={onScanPress}
          activeOpacity={0.85}
        >
          <Ionicons name="camera-outline" size={16} color="#FFFFFF" />
          <Text style={styles.scanBtnText}>Scan with Camera</Text>
        </TouchableOpacity>

        {onQuickVerify && (
          <TouchableOpacity
            style={styles.quickMatchBtn}
            onPress={onQuickVerify}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-done" size={15} color={colors.primary} />
            <Text style={styles.quickMatchBtnText}>Quick Verify</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tamper Seal Checkbox */}
      <TouchableOpacity
        style={[styles.sealBox, tamperSealAffixed && styles.sealBoxActive]}
        onPress={onToggleTamperSeal}
        activeOpacity={0.8}
      >
        <View style={styles.sealLeft}>
          <Ionicons name="shield-checkmark-outline" size={16} color={colors.primaryAccent} />
          <Text style={styles.sealTitle}>Container sealed & tamper seal affixed</Text>
        </View>

        <View style={[styles.checkbox, tamperSealAffixed && styles.checkboxActive]}>
          {tamperSealAffixed && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
        </View>
      </TouchableOpacity>

      {/* Proceed to OTP button */}
      {onProceedToOTP && qrVerified && (
        <TouchableOpacity
          style={styles.proceedBtn}
          onPress={onProceedToOTP}
          activeOpacity={0.85}
        >
          <Text style={styles.proceedBtnText}>Proceed to Customer PIN</Text>
          <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
        </TouchableOpacity>
      )}
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
  },
  stepBadge: {
    backgroundColor: colors.lightAccent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.xs,
  },
  stepBadgeText: {
    ...typography.labelSm,
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  printBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.secondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  printText: {
    ...typography.labelSm,
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
  },
  syncBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radii.md,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.secondary,
    gap: 12,
  },
  qrCodeFrame: {
    width: 76,
    height: 76,
    borderRadius: radii.sm,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncInfoCol: {
    flex: 1,
    gap: 2,
  },
  barcodeText: {
    ...typography.headlineSm,
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  detailsText: {
    ...typography.bodySm,
    fontSize: 11,
    color: colors.textSecondary,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.secondary,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  statusPillVerified: {
    backgroundColor: colors.successContainer,
    borderColor: 'rgba(22, 163, 74, 0.2)',
  },
  statusPillText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  statusPillTextVerified: {
    color: colors.success,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  scanBtn: {
    flex: 1,
    backgroundColor: colors.primaryAccent,
    height: 42,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  scanBtnText: {
    ...typography.labelMd,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  quickMatchBtn: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.secondary,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  quickMatchBtnText: {
    ...typography.labelMd,
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  sealBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.secondary,
    borderRadius: radii.md,
    padding: 10,
  },
  sealBoxActive: {
    borderColor: colors.primaryAccent,
  },
  sealLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  sealTitle: {
    ...typography.bodySm,
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.secondary,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.primaryAccent,
    borderColor: colors.primaryAccent,
  },
  proceedBtn: {
    backgroundColor: colors.primaryAccent,
    height: 42,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  proceedBtnText: {
    ...typography.labelMd,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default QRTagCard;
