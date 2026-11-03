import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography, shadows } from '../../theme';
import { RouteStop } from '../../types/api';

interface ActiveTaskCardProps {
  stop: RouteStop | null;
  stopIndex: number;
  totalStops: number;
  onExecute: () => void;
  isLoading?: boolean;
}

export const ActiveTaskCard: React.FC<ActiveTaskCardProps> = ({
  stop,
  stopIndex,
  totalStops,
  onExecute,
  isLoading = false,
}) => {
  if (!stop) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="checkmark-circle-outline" size={36} color={colors.success} />
        <Text style={styles.emptyTitle}>All Stops Completed</Text>
        <Text style={styles.emptySub}>Assigned route itinerary for today is completed.</Text>
      </View>
    );
  }

  const facilityName = stop.customer_name || stop.location_name || stop.warehouse_name || 'Assigned Stop';
  const isArrived = stop.execution_status === 'ARRIVED' || stop.execution_status === 'IN_PROGRESS';
  const ctaLabel = isArrived ? 'Open Verification Workflow' : 'Navigate to Stop';

  return (
    <View style={styles.card}>
      {/* Header Tag Row */}
      <View style={styles.topRow}>
        <View style={styles.sequenceChip}>
          <Text style={styles.sequenceText}>
            STOP {stopIndex} OF {totalStops}
          </Text>
        </View>
        <View style={[styles.statusChip, isArrived && styles.statusChipArrived]}>
          <View style={[styles.statusDot, isArrived && styles.statusDotArrived]} />
          <Text style={[styles.statusChipText, isArrived && styles.statusChipTextArrived]}>
            {isArrived ? 'On Site' : 'En Route'}
          </Text>
        </View>
      </View>

      {/* Main Info */}
      <View style={styles.body}>
        <Text style={styles.facilityTitle} numberOfLines={1}>
          {facilityName}
        </Text>
        {stop.address ? (
          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={14} color={colors.textMuted} />
            <Text style={styles.addressText} numberOfLines={1}>
              {stop.address}
            </Text>
          </View>
        ) : null}

        <View style={styles.metaRow}>
          <View style={styles.metaBadge}>
            <Ionicons name="cube-outline" size={13} color={colors.primaryAccent} />
            <Text style={styles.metaText}>
              {stop.stop_type === 'WAREHOUSE'
                ? 'Terminal Handover'
                : stop.estimated_weight_kg
                ? `${stop.estimated_weight_kg} kg estimated`
                : 'Medical Waste Pickup'}
            </Text>
          </View>

          {stop.pickup_code ? (
            <View style={styles.codeBadge}>
              <Text style={styles.codeText}>#{stop.pickup_code}</Text>
            </View>
          ) : null}
        </View>

        {/* Action Button */}
        <TouchableOpacity
          style={[styles.ctaButton, isLoading && styles.ctaDisabled]}
          onPress={onExecute}
          activeOpacity={0.85}
          disabled={isLoading}
        >
          <Ionicons
            name={isArrived ? 'checkmark-circle' : 'navigate'}
            size={16}
            color="#FFFFFF"
          />
          <Text style={styles.ctaText}>{ctaLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.secondary,
    overflow: 'hidden',
    marginBottom: spacing.md,
    ...shadows.subtle,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.secondary,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.headlineSm,
    color: colors.primary,
    marginTop: 8,
  },
  emptySub: {
    ...typography.bodySm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.secondary,
  },
  sequenceChip: {
    backgroundColor: colors.lightAccent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.xs,
  },
  sequenceText: {
    ...typography.labelSm,
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  statusChipArrived: {
    backgroundColor: colors.successContainer,
    borderColor: 'rgba(22, 163, 74, 0.2)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primaryAccent,
  },
  statusDotArrived: {
    backgroundColor: colors.success,
  },
  statusChipText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.textSecondary,
  },
  statusChipTextArrived: {
    color: colors.success,
  },
  body: {
    padding: spacing.md,
    gap: 10,
  },
  facilityTitle: {
    ...typography.headlineSm,
    fontSize: 18,
    color: colors.primary,
    fontWeight: '700',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addressText: {
    ...typography.bodySm,
    color: colors.textSecondary,
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  metaText: {
    ...typography.bodySm,
    fontSize: 11,
    color: colors.textSecondary,
  },
  codeBadge: {
    backgroundColor: colors.lightAccent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  codeText: {
    ...typography.monoNumbers,
    fontSize: 11,
    color: colors.primary,
  },
  ctaButton: {
    backgroundColor: colors.primaryAccent,
    height: 44,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  ctaDisabled: {
    opacity: 0.6,
  },
  ctaText: {
    ...typography.labelMd,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default ActiveTaskCard;
