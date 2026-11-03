import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography, shadows } from '../../theme';
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

  const facilityName =
    stop.customer_name ||
    stop.location_name ||
    stop.warehouse_name ||
    'Assigned Stop';

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
          {stop.pickup_code ? (
            <View style={styles.pkPill}>
              <Text style={styles.pkPillText}>#{stop.pickup_code}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.liveVerificationBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>VERIFICATION PIPELINE</Text>
        </View>
      </View>

      {/* Facility Name & Detail */}
      <View style={styles.facilityRow}>
        <View style={styles.infoCol}>
          <Text style={styles.facilityName} numberOfLines={1}>
            {facilityName}
          </Text>
          {stop.address ? (
            <View style={styles.subDetailRow}>
              <Ionicons name="location-outline" size={13} color={colors.textMuted} />
              <Text style={styles.subDetailText} numberOfLines={1}>
                {stop.address}
              </Text>
            </View>
          ) : null}
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
    gap: 8,
    marginBottom: spacing.md,
    ...shadows.subtle,
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
    backgroundColor: colors.lightAccent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.xs,
  },
  stopPillText: {
    ...typography.labelSm,
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  pkPill: {
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.secondary,
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
    gap: 4,
    backgroundColor: colors.successContainer,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
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
    borderTopColor: colors.secondary,
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
    color: colors.primary,
  },
  subDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  subDetailText: {
    ...typography.bodySm,
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
});

export default FacilityHeaderCard;
