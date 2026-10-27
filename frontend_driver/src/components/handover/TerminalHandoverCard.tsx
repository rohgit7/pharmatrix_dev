import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../../theme';
import { DriverRoute, RouteStop } from '../../types/api';

interface TerminalHandoverCardProps {
  route: DriverRoute | null;
  warehouseStop: RouteStop | null;
  onCompleteHandover: () => Promise<void>;
  isCompleted?: boolean;
}

export const TerminalHandoverCard: React.FC<TerminalHandoverCardProps> = ({
  route,
  warehouseStop,
  onCompleteHandover,
  isCompleted = false,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(isCompleted);

  const terminalName = route?.warehouse_name || 'Terminal Facility';
  const terminalAddress = route?.warehouse_address
    ? `${route.warehouse_address}, ${route.warehouse_city || ''}`
    : 'Facility Terminal Receiving';

  const totalPickups = route?.stops?.filter((s) => s.stop_type === 'PICKUP').length || 0;
  const totalMass =
    route?.stops?.reduce((acc, s) => acc + (s.collected_weight_kg || s.estimated_weight_kg || 0), 0) || 0;

  const tareWeight = (route?.vehicle_capacity_kg || 100) * 10;
  const grossWeight = tareWeight + totalMass;

  const handleHandover = async () => {
    setLoading(true);
    try {
      await onCompleteHandover();
      setSuccess(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.card}>
      {/* Terminal Title Row */}
      <View style={styles.terminalHeader}>
        <View style={styles.factoryIconBox}>
          <Ionicons name="business" size={20} color={colors.primaryDark} />
        </View>
        <View style={styles.terminalInfo}>
          <View style={styles.terminalTags}>
            <View style={styles.destTag}>
              <Text style={styles.destTagText}>DEST. TERMINAL</Text>
            </View>
            <Text style={styles.gateText}>Commercial Receiving</Text>
          </View>
          <Text style={styles.terminalName} numberOfLines={1}>
            {terminalName}
          </Text>
          <Text style={styles.terminalAddress} numberOfLines={1}>
            {terminalAddress}
          </Text>
        </View>
      </View>

      {/* Driver Role Notice */}
      <View style={styles.noticeBox}>
        <Ionicons name="shield-outline" size={18} color={colors.primaryDark} style={{ marginTop: 2 }} />
        <View style={{ flex: 1 }}>
          <Text style={styles.noticeTitle}>DRIVER ROLE: CUSTODY TRANSFER ONLY</Text>
          <Text style={styles.noticeText}>
            You perform cargo handover & weighbridge check.{' '}
            <Text style={{ fontWeight: '700', color: colors.ink }}>Certificate of Destruction</Text> is officially
            issued and authorized by the {terminalName} Facility Officer upon neutralization.
          </Text>
        </View>
      </View>

      {/* 3 KPIs */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Stops</Text>
          <Text style={styles.kpiValue}>{totalPickups}</Text>
          <Text style={styles.kpiSub}>PICKUPS</Text>
        </View>
        <View style={[styles.kpiCard, styles.kpiCardActive]}>
          <Text style={styles.kpiLabel}>Net Mass</Text>
          <Text style={[styles.kpiValue, { color: colors.primaryDark }]}>{totalMass.toFixed(1)} kg</Text>
          <Text style={[styles.kpiSub, { color: colors.primaryDark }]}>VERIFIED</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Payload</Text>
          <Text style={styles.kpiValue}>{totalPickups}</Text>
          <Text style={styles.kpiSub}>CONSIGNMENTS</Text>
        </View>
      </View>

      {/* Weighbridge & Inspector Strip */}
      <View style={styles.inspectStrip}>
        <View style={styles.weighRow}>
          <View style={styles.iconCircle}>
            <Ionicons name="speedometer-outline" size={16} color={colors.textSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.weighTitle}>Scale Weighbridge Readout</Text>
            <Text style={styles.weighSub}>
              Gross {grossWeight.toFixed(1)} kg • Tare {tareWeight.toFixed(1)} kg
            </Text>
          </View>
          <View style={styles.weighDelta}>
            <Text style={styles.weighDeltaText}>Δ +{totalMass.toFixed(1)} kg</Text>
            <View style={styles.zeroTolBadge}>
              <Text style={styles.zeroTolText}>Zero Tolerance OK</Text>
            </View>
          </View>
        </View>

        <View style={styles.weighRow}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primaryTint }]}>
            <Ionicons name="shield-checkmark" size={16} color={colors.primaryDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.weighTitle}>Inspector of Record</Text>
            <Text style={styles.weighSub}>Receiving Facility Officer</Text>
          </View>
          <View style={styles.stationBadge}>
            <Text style={styles.stationText}>DOCK #1</Text>
          </View>
        </View>
      </View>

      {/* Pre-Staged Disposal Receipt Strip */}
      <View style={styles.receiptStrip}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="receipt-outline" size={16} color={colors.onPrimaryContainer} />
          <Text style={styles.receiptText}>Disposal Receipt Pre-Staged</Text>
        </View>
        <Text style={styles.receiptDate}>
          {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </Text>
      </View>

      {/* Action / Success Banner */}
      {success ? (
        <View style={styles.successBanner}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <Text style={styles.successText}>Custody Transferred to {terminalName} • Officer Clearance Granted</Text>
        </View>
      ) : (
        <View style={{ gap: 6 }}>
          <TouchableOpacity
            style={[styles.handoverBtn, loading && styles.handoverBtnDisabled]}
            onPress={handleHandover}
            disabled={loading}
            activeOpacity={0.88}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.handoverBtnText}>Complete Terminal Handover & Transfer Custody</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
          <View style={styles.certNotice}>
            <Ionicons name="checkmark-done" size={13} color={colors.textOutline} />
            <Text style={styles.certNoticeText}>
              Certificate of Destruction is issued by {terminalName} Facility Officer
            </Text>
          </View>
        </View>
      )}
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
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    gap: 12,
  },
  terminalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  factoryIconBox: {
    width: 38,
    height: 38,
    borderRadius: radii.lg,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(123, 145, 238, 0.4)',
  },
  terminalInfo: {
    flex: 1,
  },
  terminalTags: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  destTag: {
    backgroundColor: colors.surfaceHigh,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  destTagText: {
    ...typography.labelSm,
    fontSize: 9,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  gateText: {
    ...typography.bodySm,
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  terminalName: {
    ...typography.headlineSm,
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    marginTop: 2,
  },
  terminalAddress: {
    ...typography.bodySm,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  noticeBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.surfaceLow,
    padding: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noticeTitle: {
    ...typography.labelSm,
    fontSize: 10,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: 0.4,
  },
  noticeText: {
    ...typography.bodySm,
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 15,
    marginTop: 2,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: colors.surfaceLow,
    padding: 10,
    borderRadius: radii.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  kpiCardActive: {
    borderColor: colors.primaryAction,
    backgroundColor: colors.primaryTint,
  },
  kpiLabel: {
    ...typography.bodySm,
    fontSize: 11,
    color: colors.textSecondary,
  },
  kpiValue: {
    ...typography.headlineSm,
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
    marginVertical: 2,
  },
  kpiSub: {
    ...typography.labelSm,
    fontSize: 9,
    color: colors.textOutline,
    fontWeight: '700',
  },
  inspectStrip: {
    gap: 8,
  },
  weighRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceLow,
    padding: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weighTitle: {
    ...typography.labelMd,
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  weighSub: {
    ...typography.bodySm,
    fontSize: 10,
    color: colors.textSecondary,
  },
  weighDelta: {
    alignItems: 'flex-end',
  },
  weighDeltaText: {
    ...typography.labelMd,
    fontSize: 12,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  zeroTolBadge: {
    backgroundColor: colors.surfaceHigh,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: radii.sm,
    marginTop: 2,
  },
  zeroTolText: {
    ...typography.labelSm,
    fontSize: 9,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  stationBadge: {
    backgroundColor: colors.surfaceHigh,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  stationText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.ink,
    fontWeight: '700',
  },
  receiptStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primaryTint,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(123, 145, 238, 0.4)',
  },
  receiptText: {
    ...typography.labelMd,
    fontSize: 12,
    color: colors.onPrimaryContainer,
    fontWeight: '700',
  },
  receiptDate: {
    ...typography.monoNumbers,
    fontSize: 11,
    color: colors.onPrimaryContainer,
    fontWeight: '700',
  },
  handoverBtn: {
    height: 52,
    backgroundColor: colors.primaryDark,
    borderRadius: radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  handoverBtnDisabled: {
    opacity: 0.6,
  },
  handoverBtnText: {
    ...typography.labelLg,
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  certNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  certNoticeText: {
    ...typography.bodySm,
    fontSize: 10,
    color: colors.textSecondary,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.successContainer,
    padding: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(30, 142, 90, 0.3)',
  },
  successText: {
    ...typography.labelMd,
    fontSize: 12,
    color: colors.success,
    fontWeight: '700',
    flex: 1,
  },
});

export default TerminalHandoverCard;
