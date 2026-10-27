import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../../theme';
import { RouteStop } from '../../types/api';

interface FacilityHeaderCardProps {
  stop: RouteStop | null;
  stopIndex: number;
  totalStops: number;
}

export const FacilityHeaderCard: React.FC<FacilityHeaderCardProps> = ({
  stop,
  stopIndex,
  totalStops,
}) => {
  if (!stop) return null;

  const facilityName = stop.customer_name || stop.location_name || stop.warehouse_name || 'Assigned Stop';
  const pickupCode = stop.pickup_code || `PK-${(stop.id || 1000) * 7}-CY`;

  return (
    <View style={styles.card}>
      {/* Top badges */}
      <View style={styles.topBadgesRow}>
        <View style={styles.leftPills}>
          <View style={styles.stopPill}>
            <Text style={styles.stopPillText}>
              STOP {stopIndex} OF {totalStops}
            </Text>
          </View>
          <View style={styles.pkPill}>
            <Text style={styles.pkPillText}>{pickupCode}</Text>
          </View>
        </View>

        <View style={styles.liveVerificationBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE VERIFICATION</Text>
        </View>
      </View>

      {/* Facility Name & Detail */}
      <View style={styles.facilityRow}>
        <View style={styles.infoCol}>
          <Text style={styles.facilityName} numberOfLines={1}>
            {facilityName}
          </Text>
          <View style={styles.subDetailRow}>
            <Ionicons name="location-outline" size={13} color={colors.textOutline} />
            <Text style={styles.subDetailText} numberOfLines={1}>
              Bay 4 Receiving • {stop.address}
            </Text>
          </View>
        </View>

        <View style={styles.onScheduleBadge}>
          <Ionicons name="time-outline" size={12} color={colors.success} />
          <Text style={styles.onScheduleText}>On Schedule</Text>
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    gap: 10,
  },
  topBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stopPill: {
    backgroundColor: colors.primaryTint,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(123, 145, 238, 0.4)',
  },
  stopPillText: {
    ...typography.labelSm,
    fontSize: 10,
    fontWeight: '700',
    color: colors.onPrimaryContainer,
  },
  pkPill: {
    backgroundColor: colors.surfaceHigh,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pkPillText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  liveVerificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.successContainer,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(30, 142, 90, 0.3)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  liveText: {
    ...typography.labelSm,
    fontSize: 10,
    fontWeight: '700',
    color: colors.success,
  },
  facilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(234, 223, 208, 0.4)',
    paddingTop: 8,
    gap: 8,
  },
  infoCol: {
    flex: 1,
  },
  facilityName: {
    ...typography.headlineSm,
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
  },
  subDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  subDetailText: {
    ...typography.bodySm,
    fontSize: 11,
    color: colors.textSecondary,
    flex: 1,
  },
  onScheduleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.successContainer,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(30, 142, 90, 0.3)',
  },
  onScheduleText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.success,
    fontWeight: '700',
  },
});

export default FacilityHeaderCard;
