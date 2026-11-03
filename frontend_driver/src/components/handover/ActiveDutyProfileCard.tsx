import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography, shadows } from '../../theme';
import { DriverProfile } from '../../types/api';

interface ActiveDutyProfileCardProps {
  driver: DriverProfile | null;
  vehicleReg?: string | null;
}

export const ActiveDutyProfileCard: React.FC<ActiveDutyProfileCardProps> = ({
  driver,
  vehicleReg,
}) => {
  const driverName = driver?.name || 'Driver';
  const badgeId =
    driver?.employee_id ||
    (driver?.id ? `DRV-${driver.id.toString().padStart(4, '0')}` : 'Active');

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Driver Profile</Text>
        <View style={styles.shiftBadge}>
          <Text style={styles.shiftBadgeText}>Active Shift</Text>
        </View>
      </View>

      {/* Driver Card */}
      <View style={styles.driverRow}>
        <View style={styles.avatarBox}>
          <Ionicons name="person" size={24} color={colors.primary} />
        </View>
        <View style={styles.driverInfo}>
          <View style={styles.driverNameRow}>
            <Text style={styles.driverName} numberOfLines={1}>
              {driverName}
            </Text>
            <View style={styles.drvBadge}>
              <Text style={styles.drvBadgeText}>{badgeId}</Text>
            </View>
          </View>
          <Text style={styles.licenseText}>
            {driver?.license_number
              ? `License #${driver.license_number}`
              : 'Commercial License (Active)'}
          </Text>
          <View style={styles.statusRow}>
            <Ionicons name="shield-checkmark" size={12} color={colors.success} />
            <Text style={styles.statusText}>{driver?.status || 'Active'}</Text>
          </View>
        </View>
      </View>

      {/* Vehicle Box */}
      <View style={styles.vehicleBox}>
        <View style={styles.vehicleHeader}>
          <View style={styles.vehicleLeft}>
            <Ionicons name="car-outline" size={16} color={colors.primary} />
            <Text style={styles.vehicleName} numberOfLines={1}>
              {vehicleReg ? `Vehicle ${vehicleReg}` : 'Assigned Vehicle'}
            </Text>
          </View>
          <View style={styles.plateBadge}>
            <Text style={styles.plateText}>{vehicleReg || 'Assigned'}</Text>
          </View>
        </View>

        {/* Telemetry Metrics */}
        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Driver ID</Text>
            <Text style={styles.metricVal}>{driver?.user_id || driver?.id || 1}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Status</Text>
            <Text style={[styles.metricVal, { color: colors.primary }]}>
              {driver?.status || 'ACTIVE'}
            </Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Availability</Text>
            <Text style={styles.metricVal}>
              {driver?.is_available ? 'Available' : 'Assigned'}
            </Text>
          </View>
        </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...typography.headlineSm,
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  shiftBadge: {
    backgroundColor: colors.lightAccent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  shiftBadgeText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.primary,
    fontWeight: '600',
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.background,
    padding: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverInfo: {
    flex: 1,
  },
  driverNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  driverName: {
    ...typography.headlineSm,
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  drvBadge: {
    backgroundColor: colors.lightAccent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.xs,
  },
  drvBadgeText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.primary,
    fontWeight: '700',
  },
  licenseText: {
    ...typography.bodySm,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  statusText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.success,
    fontWeight: '600',
  },
  vehicleBox: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.secondary,
    gap: 8,
  },
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vehicleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  vehicleName: {
    ...typography.labelMd,
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  plateBadge: {
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  plateText: {
    ...typography.labelSm,
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  metricLabel: {
    ...typography.labelSm,
    fontSize: 9,
    color: colors.textMuted,
  },
  metricVal: {
    ...typography.labelMd,
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 2,
  },
});

export default ActiveDutyProfileCard;
