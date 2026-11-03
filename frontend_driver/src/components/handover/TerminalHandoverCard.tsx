import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography, shadows } from '../../theme';
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

  const terminalName = route?.warehouse_name || warehouseStop?.warehouse_name || 'Terminal Facility';
  const terminalAddress = route?.warehouse_address || warehouseStop?.address || 'Terminal Receiving Area';

  const totalPickups =
    route?.stops?.filter((s) => s.stop_type === 'PICKUP').length || 0;
  const totalMass =
    route?.stops?.reduce(
      (acc, s) => acc + (s.collected_weight_kg || s.estimated_weight_kg || 0),
      0
    ) || 0;

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
      {/* Terminal Title */}
      <View style={styles.terminalHeader}>
        <View style={styles.factoryIconBox}>
          <Ionicons name="business-outline" size={20} color={colors.primary} />
        </View>
        <View style={styles.terminalInfo}>
          <View style={styles.destTag}>
            <Text style={styles.destTagText}>DESTINATION TERMINAL</Text>
          </View>
          <Text style={styles.terminalName} numberOfLines={1}>
            {terminalName}
          </Text>
          <Text style={styles.terminalAddress} numberOfLines={1}>
            {terminalAddress}
          </Text>
        </View>
      </View>

      {/* KPI Row */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Pickups</Text>
          <Text style={styles.kpiValue}>{totalPickups}</Text>
          <Text style={styles.kpiSub}>STOPS</Text>
        </View>
        <View style={[styles.kpiCard, styles.kpiCardActive]}>
          <Text style={styles.kpiLabel}>Total Mass</Text>
          <Text style={[styles.kpiValue, { color: colors.primary }]}>
            {totalMass.toFixed(1)} kg
          </Text>
          <Text style={[styles.kpiSub, { color: colors.primary }]}>VERIFIED</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Consignments</Text>
          <Text style={styles.kpiValue}>{totalPickups}</Text>
          <Text style={styles.kpiSub}>SECURED</Text>
        </View>
      </View>

      {/* Action / Success Banner */}
      {success ? (
        <View style={styles.successBanner}>
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <Text style={styles.successText}>
            Custody transferred to {terminalName}
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.handoverBtn, loading && styles.handoverBtnDisabled]}
          onPress={handleHandover}
          disabled={loading}
          activeOpacity={0.88}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <View style={styles.btnContent}>
              <Ionicons name="checkmark-circle" size={17} color="#FFFFFF" />
              <Text style={styles.handoverBtnText}>Complete Terminal Handover</Text>
            </View>
          )}
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
    gap: 12,
    marginBottom: spacing.md,
    ...shadows.subtle,
  },
  terminalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  factoryIconBox: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  terminalInfo: {
    flex: 1,
  },
  destTag: {
    backgroundColor: colors.lightAccent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.xs,
    alignSelf: 'flex-start',
    marginBottom: 2,
  },
  destTagText: {
    ...typography.labelSm,
    fontSize: 9,
    fontWeight: '700',
    color: colors.primary,
  },
  terminalName: {
    ...typography.headlineSm,
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  terminalAddress: {
    ...typography.bodySm,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radii.md,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  kpiCardActive: {
    backgroundColor: colors.lightAccent,
    borderColor: 'rgba(123, 145, 238, 0.4)',
  },
  kpiLabel: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.textSecondary,
  },
  kpiValue: {
    ...typography.monoNumbers,
    fontSize: 16,
    color: colors.primary,
    marginTop: 2,
  },
  kpiSub: {
    ...typography.labelSm,
    fontSize: 8,
    color: colors.textMuted,
    marginTop: 1,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.successContainer,
    padding: 10,
    borderRadius: radii.md,
  },
  successText: {
    ...typography.labelMd,
    fontSize: 12,
    fontWeight: '600',
    color: colors.success,
    flex: 1,
  },
  handoverBtn: {
    backgroundColor: colors.primaryAccent,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handoverBtnDisabled: {
    opacity: 0.6,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  handoverBtnText: {
    ...typography.labelMd,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default TerminalHandoverCard;
