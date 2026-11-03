import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../../theme';
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

  // Compute actual dynamic QR matrix based on real pickup metadata
  const { matrix, size } = useMemo(() => {
    if (!stop) return { matrix: [], size: 0 };
    const payload = createPickupQrPayload(stop);
    return generateQrMatrix(payload);
  }, [stop?.id, stop?.pickup_code, stop?.pickup_id]);

  return (
    <View style={[styles.card, qrVerified && styles.cardVerified]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.qrIconBox, qrVerified && styles.qrIconBoxVerified]}>
            <Ionicons
              name={qrVerified ? 'checkmark-circle' : 'qr-code-outline'}
              size={18}
              color={qrVerified ? '#FFFFFF' : '#3B52B6'}
            />
          </View>
          <View>
            <Text style={styles.stepTitle}>STEP 3: QR TAG & TAMPER SEAL</Text>
            <Text style={styles.subTitle}>Chain-of-custody scannable manifest</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.printBtn} onPress={onPrintPress} activeOpacity={0.7}>
          <Ionicons name="print-outline" size={13} color="#3B52B6" />
          <Text style={styles.printText}>Print Slip</Text>
        </TouchableOpacity>
      </View>

      {/* QR Code and Tag Sync Info */}
      <View style={styles.syncBox}>
        {/* Dynamic Scannable QR Code Vector */}
        <View style={styles.qrCodeFrame}>
          {size > 0 && matrix.length > 0 ? (
            <Svg width={78} height={78} viewBox={`0 0 ${size + 4} ${size + 4}`}>
              <Rect width="100%" height="100%" fill="#FFFFFF" />
              {matrix.map((val, idx) => {
                if (!val) return null;
                const y = Math.floor(idx / size) + 2;
                const x = (idx % size) + 2;
                return <Rect key={idx} x={x} y={y} width={1} height={1} fill="#201E1C" />;
              })}
            </Svg>
          ) : (
            <Ionicons name="qr-code" size={54} color="#201E1C" />
          )}
        </View>

        {/* Sync Info Column */}
        <View style={styles.syncInfoCol}>
          <Text style={styles.verifiedLabel}>CHAIN-OF-CUSTODY MANIFEST</Text>
          <Text style={styles.barcodeText} numberOfLines={1}>
            {code}
          </Text>
          <Text style={styles.detailsText} numberOfLines={1}>
            {stop?.customer_name || 'Clinic'} • {totalWeight.toFixed(1)} kg Verified
          </Text>

          <View style={styles.tagStatusRow}>
            <View style={[styles.statusPill, qrVerified && styles.statusPillVerified]}>
              <Ionicons
                name={qrVerified ? 'checkmark-circle' : 'time-outline'}
                size={12}
                color={qrVerified ? colors.success : '#8A8279'}
              />
              <Text style={[styles.statusPillText, qrVerified && styles.statusPillTextVerified]}>
                {qrVerified ? 'QR Verified & Synced' : 'Awaiting Tag Scan'}
              </Text>
            </View>
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
          <Ionicons name="camera" size={16} color="#FFFFFF" />
          <Text style={styles.scanBtnText}>Scan with Camera</Text>
        </TouchableOpacity>

        {onQuickVerify && (
          <TouchableOpacity
            style={styles.quickMatchBtn}
            onPress={onQuickVerify}
            activeOpacity={0.85}
          >
            <Ionicons name="flash-outline" size={15} color="#3B52B6" />
            <Text style={styles.quickMatchBtnText}>Quick Match Tag</Text>
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
          <View style={styles.lockIconBox}>
            <Ionicons name="lock-closed" size={16} color="#3B52B6" />
          </View>
          <View style={styles.sealTextCol}>
            <Text style={styles.sealTitle}>Container sealed & tamper-tag affixed</Text>
            <Text style={styles.sealSub}>
              Regulatory tamper seal locked to {stop?.pickup_code || 'drum'}
            </Text>
          </View>
        </View>

        <View style={[styles.checkbox, tamperSealAffixed && styles.checkboxActive]}>
          {tamperSealAffixed && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
        </View>
      </TouchableOpacity>

      {/* Proceed to OTP button */}
      {onProceedToOTP && qrVerified && (
        <TouchableOpacity
          style={styles.proceedBtn}
          onPress={onProceedToOTP}
          activeOpacity={0.85}
        >
          <Text style={styles.proceedBtnText}>Next: Customer OTP Signoff</Text>
          <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
        </TouchableOpacity>
      )}
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
  qrIconBox: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    backgroundColor: '#E5EBFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrIconBoxVerified: {
    backgroundColor: colors.success,
  },
  stepTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#201E1C',
    letterSpacing: 0.5,
  },
  subTitle: {
    fontSize: 11,
    color: '#757683',
    fontWeight: '500',
  },
  printBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E5EBFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(59, 82, 182, 0.25)',
  },
  printText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3B52B6',
  },
  syncBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FDFBF8',
    padding: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#EADFD0',
  },
  qrCodeFrame: {
    width: 82,
    height: 82,
    backgroundColor: '#FFFFFF',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#EADFD0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  syncInfoCol: {
    flex: 1,
    gap: 2,
  },
  verifiedLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#757683',
    letterSpacing: 0.5,
  },
  barcodeText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#201E1C',
    letterSpacing: 0.5,
  },
  detailsText: {
    fontSize: 12,
    color: '#5C554E',
    fontWeight: '500',
  },
  tagStatusRow: {
    marginTop: 4,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F2E7D7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    alignSelf: 'flex-start',
  },
  statusPillVerified: {
    backgroundColor: '#E8F5E9',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#5C554E',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#3B52B6',
    height: 44,
    borderRadius: radii.lg,
    shadowColor: '#3B52B6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  scanBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  quickMatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#E5EBFF',
    height: 44,
    paddingHorizontal: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(59, 82, 182, 0.3)',
  },
  quickMatchBtnText: {
    color: '#3B52B6',
    fontSize: 12,
    fontWeight: '700',
  },
  sealBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FDFBF8',
    padding: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#EADFD0',
  },
  sealBoxActive: {
    borderColor: '#C6F6D5',
    backgroundColor: '#F0FDF4',
  },
  sealLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  lockIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5EBFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealTextCol: {
    flex: 1,
  },
  sealTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#201E1C',
  },
  sealSub: {
    fontSize: 10.5,
    color: '#757683',
    marginTop: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#A8A29E',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxActive: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  proceedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#201E1C',
    height: 44,
    borderRadius: radii.lg,
    marginTop: 2,
  },
  proceedBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});

export default QRTagCard;
