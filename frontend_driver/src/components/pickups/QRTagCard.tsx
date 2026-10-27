import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../../theme';
import { RouteStop } from '../../types/api';

interface QRTagCardProps {
  stop: RouteStop | null;
  totalWeight: number;
  qrVerified: boolean;
  tamperSealAffixed: boolean;
  onToggleTamperSeal: () => void;
  onScanPress: () => void;
  onPrintPress: () => void;
}

export const QRTagCard: React.FC<QRTagCardProps> = ({
  stop,
  totalWeight,
  qrVerified,
  tamperSealAffixed,
  onToggleTamperSeal,
  onScanPress,
  onPrintPress,
}) => {
  const code = stop?.pickup_code ? `#${stop.pickup_code}` : 'Consignment';

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={styles.pulseDot} />
          <Text style={styles.title}>STAGE B • QR TAG & CONTAINER SEAL</Text>
        </View>

        <TouchableOpacity style={styles.printBtn} onPress={onPrintPress} activeOpacity={0.7}>
          <Ionicons name="print-outline" size={13} color={colors.onPrimaryContainer} />
          <Text style={styles.printText}>Print (Zebra BT Ready)</Text>
        </TouchableOpacity>
      </View>

      {/* QR Code and Tag Sync Info */}
      <View style={styles.syncBox}>
        {/* Vector Stylized QR Code matching Stitch SVG */}
        <View style={styles.qrCodeFrame}>
          <Svg width={76} height={76} viewBox="0 0 100 100">
            {/* Top Left Marker */}
            <Rect x="5" y="5" width="28" height="28" rx="2" fill="#201E1C" />
            <Rect x="9" y="9" width="20" height="20" rx="1" fill="#FFFFFF" />
            <Rect x="13" y="13" width="12" height="12" rx="1" fill="#201E1C" />

            {/* Top Right Marker */}
            <Rect x="67" y="5" width="28" height="28" rx="2" fill="#201E1C" />
            <Rect x="71" y="9" width="20" height="20" rx="1" fill="#FFFFFF" />
            <Rect x="75" y="13" width="12" height="12" rx="1" fill="#201E1C" />

            {/* Bottom Left Marker */}
            <Rect x="5" y="67" width="28" height="28" rx="2" fill="#201E1C" />
            <Rect x="9" y="71" width="20" height="20" rx="1" fill="#FFFFFF" />
            <Rect x="13" y="75" width="12" height="12" rx="1" fill="#201E1C" />

            {/* Data Modules */}
            <Rect x="38" y="8" width="8" height="8" fill="#201E1C" />
            <Rect x="50" y="8" width="8" height="8" fill="#201E1C" />
            <Rect x="38" y="20" width="8" height="8" fill="#201E1C" />
            <Rect x="50" y="24" width="8" height="8" fill="#201E1C" />
            <Rect x="8" y="38" width="8" height="8" fill="#201E1C" />
            <Rect x="20" y="38" width="8" height="8" fill="#201E1C" />

            {/* Stitch Signature Center Blue Accent */}
            <Rect x="38" y="38" width="10" height="10" fill="#4158B1" />

            <Rect x="52" y="38" width="8" height="8" fill="#201E1C" />
            <Rect x="66" y="38" width="8" height="8" fill="#201E1C" />
            <Rect x="80" y="38" width="12" height="8" fill="#201E1C" />
            <Rect x="38" y="52" width="8" height="8" fill="#201E1C" />
            <Rect x="50" y="52" width="14" height="8" fill="#201E1C" />
            <Rect x="68" y="52" width="8" height="8" fill="#201E1C" />
            <Rect x="38" y="66" width="8" height="8" fill="#201E1C" />
            <Rect x="50" y="66" width="8" height="8" fill="#201E1C" />
            <Rect x="66" y="66" width="12" height="8" fill="#201E1C" />
            <Rect x="82" y="66" width="10" height="10" fill="#201E1C" />
            <Rect x="38" y="80" width="12" height="12" fill="#201E1C" />
            <Rect x="54" y="80" width="8" height="8" fill="#201E1C" />
            <Rect x="68" y="80" width="10" height="10" fill="#201E1C" />
            <Rect x="82" y="80" width="10" height="10" fill="#201E1C" />
          </Svg>
        </View>

        {/* Sync Info Column */}
        <View style={styles.syncInfoCol}>
          <Text style={styles.verifiedLabel}>VERIFIED CHAIN-OF-CUSTODY</Text>
          <Text style={styles.barcodeText} numberOfLines={1}>
            {code}
          </Text>
          <Text style={styles.detailsText} numberOfLines={1}>
            {stop?.pickup_code || 'Consignment'} • {totalWeight.toFixed(1)} kg Total
          </Text>

          <TouchableOpacity
            style={[styles.statusPill, qrVerified && styles.statusPillVerified]}
            onPress={onScanPress}
            activeOpacity={0.7}
          >
            <Ionicons
              name={qrVerified ? 'checkmark-circle' : 'qr-code-outline'}
              size={12}
              color={qrVerified ? colors.success : colors.primaryDark}
            />
            <Text style={[styles.statusPillText, qrVerified && styles.statusPillTextVerified]}>
              {qrVerified ? 'Tag Generated & Synced' : 'Scan & Verify QR'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tamper Seal Checkbox */}
      <TouchableOpacity
        style={[styles.sealBox, tamperSealAffixed && styles.sealBoxActive]}
        onPress={onToggleTamperSeal}
        activeOpacity={0.8}
      >
        <View style={styles.sealLeft}>
          <View style={styles.lockIconBox}>
            <Ionicons name="lock-closed" size={16} color={colors.primaryDark} />
          </View>
          <View style={styles.sealTextCol}>
            <Text style={styles.sealTitle}>Container sealed and tamper-tag affixed</Text>
            <Text style={styles.sealSub}>Tamper seal affixed to {stop?.pickup_code || 'container'} & verified</Text>
          </View>
        </View>

        <View style={[styles.checkbox, tamperSealAffixed && styles.checkboxActive]}>
          {tamperSealAffixed && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: 'rgba(123, 145, 238, 0.6)',
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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primaryDark,
  },
  title: {
    ...typography.labelSm,
    fontSize: 10,
    fontWeight: '700',
    color: colors.primaryDark,
    letterSpacing: 0.5,
  },
  printBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryTint,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(123, 145, 238, 0.4)',
  },
  printText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.onPrimaryContainer,
    fontWeight: '700',
  },
  syncBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceLow,
    padding: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  qrCodeFrame: {
    width: 84,
    height: 84,
    backgroundColor: '#FFFFFF',
    borderRadius: radii.md,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  syncInfoCol: {
    flex: 1,
    gap: 2,
  },
  verifiedLabel: {
    ...typography.labelSm,
    fontSize: 9,
    fontWeight: '700',
    color: colors.textOutline,
    letterSpacing: 0.5,
  },
  barcodeText: {
    ...typography.headlineSm,
    fontSize: 16,
    fontWeight: '700',
    color: colors.onPrimaryContainer,
  },
  detailsText: {
    ...typography.bodySm,
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryTint,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    alignSelf: 'flex-start',
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(123, 145, 238, 0.4)',
  },
  statusPillVerified: {
    backgroundColor: colors.successContainer,
    borderColor: 'rgba(30, 142, 90, 0.3)',
  },
  statusPillText: {
    ...typography.labelSm,
    fontSize: 9,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  statusPillTextVerified: {
    color: colors.success,
  },
  sealBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(229, 235, 255, 0.5)',
    padding: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(123, 145, 238, 0.3)',
  },
  sealBoxActive: {
    borderColor: colors.primaryAction,
  },
  sealLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  lockIconBox: {
    width: 28,
    height: 28,
    borderRadius: radii.md,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealTextCol: {
    flex: 1,
  },
  sealTitle: {
    ...typography.labelMd,
    fontSize: 12,
    fontWeight: '700',
    color: colors.onPrimaryContainer,
  },
  sealSub: {
    ...typography.bodySm,
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.primaryAction,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
  },
});

export default QRTagCard;
