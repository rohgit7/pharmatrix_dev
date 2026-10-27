import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../../theme';
import { DriverProfile } from '../../types/api';

interface ActiveDutyProfileCardProps {
  driver: DriverProfile | null;
  vehicleReg?: string | null;
}

export const ActiveDutyProfileCard: React.FC<ActiveDutyProfileCardProps> = ({
  driver,
  vehicleReg,
}) => {
  const driverName = driver?.name || 'Courier';
  const badgeId = driver?.employee_id || (driver?.id ? `DRV-${driver.id.toString().padStart(4, '0')}` : 'Active');

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Active Duty Profile</Text>
        <View style={styles.shiftBadge}>
          <Text style={styles.shiftBadgeText}>Shift In Progress</Text>
        </View>
      </View>

      {/* Driver Card */}
      <View style={styles.driverRow}>
        <View style={styles.avatarBox}>
          <Ionicons name="person" size={28} color={colors.primaryDark} />
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
              ? `License #${driver.license_number}${driver.license_expiry ? ` (Exp: ${driver.license_expiry})` : ''}`
              : 'Commercial Driver License (Active)'}
          </Text>
          <View style={styles.ratingRow}>
            <Ionicons name="shield-checkmark" size={13} color={colors.success} />
            <Text style={styles.ratingText}>{driver?.status || 'Active'}</Text>
            <Text style={styles.ratingSub}>
              {driver?.phone ? `• Tel: ${driver.phone}` : '• Verified Courier'}
            </Text>
          </View>
        </View>
      </View>

      {/* Vehicle Telemetry Box */}
      <View style={styles.vehicleBox}>
        <View style={styles.vehicleHeader}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="bus-outline" size={16} color={colors.primaryDark} />
              <Text style={styles.vehicleName} numberOfLines={1}>
                {vehicleReg ? `Vehicle ${vehicleReg}` : 'Fleet Transport Unit'}
              </Text>
            </View>
            <Text style={styles.vehicleType}>HazMat Compliant Waste Unit</Text>
          </View>
          <View style={styles.plateBadge}>
            <Text style={styles.plateText}>{vehicleReg || 'Assigned'}</Text>
          </View>
        </View>

        {/* 3 Telemetry Metrics */}
        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Driver User ID</Text>
            <Text style={styles.metricVal}>{driver?.user_id || driver?.id || 1}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Driver Status</Text>
            <Text style={[styles.metricVal, { color: colors.primaryDark }]}>{driver?.status || 'ACTIVE'}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Availability</Text>
            <Text style={styles.metricVal}>{driver?.is_available ? 'Available' : 'Assigned'}</Text>
          </View>
        </View>

        {/* VIN & Sensor Calibration */}
        <View style={styles.vinRow}>
          <Text style={styles.vinText}>Registration: {vehicleReg || 'Assigned per Route'}</Text>
          <View style={styles.sensorStatus}>
            <View style={styles.sensorDot} />
            <Text style={styles.sensorText}>Compliance Verified</Text>
          </View>
        </View>
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
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    gap: 12,
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
    color: colors.ink,
  },
  shiftBadge: {
    backgroundColor: colors.surfaceHigh,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  shiftBadgeText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceLow,
    padding: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarBox: {
    width: 48,
    height: 48,
    borderRadius: radii.lg,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(123, 145, 238, 0.4)',
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
    color: colors.ink,
  },
  drvBadge: {
    backgroundColor: colors.primaryTint,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  drvBadgeText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  licenseText: {
    ...typography.bodySm,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  ratingText: {
    ...typography.labelMd,
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink,
  },
  ratingSub: {
    ...typography.bodySm,
    fontSize: 10,
    color: colors.textSecondary,
  },
  vehicleBox: {
    backgroundColor: colors.surfaceLow,
    borderRadius: radii.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  vehicleName: {
    ...typography.labelLg,
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  vehicleType: {
    ...typography.bodySm,
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 1,
  },
  plateBadge: {
    backgroundColor: colors.surfaceHigh,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  plateText: {
    ...typography.labelSm,
    fontSize: 10,
    fontWeight: '700',
    color: colors.ink,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: radii.md,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricLabel: {
    ...typography.bodySm,
    fontSize: 10,
    color: colors.textSecondary,
  },
  metricVal: {
    ...typography.labelMd,
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
    marginTop: 2,
  },
  vinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(234, 223, 208, 0.5)',
    paddingTop: 6,
  },
  vinText: {
    ...typography.bodySm,
    fontSize: 10,
    color: colors.textSecondary,
  },
  sensorStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sensorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primaryDark,
  },
  sensorText: {
    ...typography.labelSm,
    fontSize: 9,
    color: colors.primaryDark,
    fontWeight: '700',
  },
});

export default ActiveDutyProfileCard;
