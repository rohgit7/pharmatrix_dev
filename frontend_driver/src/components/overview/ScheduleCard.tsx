import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography, shadows } from '../../theme';
import { RouteStop } from '../../types/api';

interface ScheduleCardProps {
  stops: RouteStop[];
  activeStopId?: number;
  onSelectStop: (stop: RouteStop) => void;
}

export const ScheduleCard: React.FC<ScheduleCardProps> = ({
  stops,
  activeStopId,
  onSelectStop,
}) => {
  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Ionicons name="calendar-outline" size={16} color={colors.primary} />
          <Text style={styles.headerTitle}>Route Stops</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{stops.length} Total</Text>
        </View>
      </View>

      {/* List */}
      <View style={styles.list}>
        {stops.map((stop, index) => {
          const isActive =
            stop.id === activeStopId ||
            stop.execution_status === 'ARRIVED' ||
            stop.execution_status === 'IN_PROGRESS';
          const isCompleted = stop.execution_status === 'COMPLETED';
          const isFailed = stop.execution_status === 'FAILED';
          const facilityName =
            stop.customer_name ||
            stop.location_name ||
            stop.warehouse_name ||
            `Stop ${index + 1}`;
          const time = stop.arrival_time
            ? new Date(stop.arrival_time).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })
            : `${9 + index}:00 AM`;

          return (
            <TouchableOpacity
              key={stop.id || index}
              style={[styles.stopRow, isActive && styles.activeStopRow]}
              onPress={() => onSelectStop(stop)}
              activeOpacity={0.7}
            >
              <View style={styles.leftGroup}>
                <View
                  style={[
                    styles.seqCircle,
                    isActive && styles.activeSeqCircle,
                    isCompleted && styles.completedSeqCircle,
                    isFailed && styles.failedSeqCircle,
                  ]}
                >
                  {isCompleted ? (
                    <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                  ) : (
                    <Text
                      style={[
                        styles.seqText,
                        isActive && styles.activeSeqText,
                        isCompleted && styles.completedSeqText,
                      ]}
                    >
                      {stop.sequence_number || index + 1}
                    </Text>
                  )}
                </View>

                <View style={styles.stopInfo}>
                  <Text
                    style={[styles.facilityName, isActive && styles.activeFacilityName]}
                    numberOfLines={1}
                  >
                    {facilityName}
                  </Text>
                  <Text
                    style={[styles.subDetail, isActive && styles.activeSubDetail]}
                    numberOfLines={1}
                  >
                    {time}  {stop.address || 'Dock Receiving'}
                  </Text>
                </View>
              </View>

              {/* Status Badge */}
              <View
                style={[
                  styles.statusBadge,
                  isActive && styles.activeBadge,
                  isCompleted && styles.completedBadge,
                  isFailed && styles.failedBadge,
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    isActive && styles.activeBadgeText,
                    isCompleted && styles.completedBadgeText,
                    isFailed && styles.failedBadgeText,
                  ]}
                >
                  {isCompleted
                    ? 'Completed'
                    : isActive
                    ? 'Active'
                    : isFailed
                    ? 'Failed'
                    : 'Queued'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
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
    marginBottom: spacing.lg,
    ...shadows.subtle,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.secondary,
    paddingBottom: 10,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    ...typography.headlineSm,
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  countBadge: {
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  countText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  list: {
    gap: 6,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.secondary,
    backgroundColor: colors.background,
  },
  activeStopRow: {
    backgroundColor: colors.lightAccent,
    borderColor: colors.primaryAccent,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  seqCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeSeqCircle: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  completedSeqCircle: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  failedSeqCircle: {
    backgroundColor: colors.error,
    borderColor: colors.error,
  },
  seqText: {
    ...typography.labelSm,
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  activeSeqText: {
    color: '#FFFFFF',
  },
  completedSeqText: {
    color: '#FFFFFF',
  },
  stopInfo: {
    flex: 1,
  },
  facilityName: {
    ...typography.labelMd,
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  activeFacilityName: {
    color: colors.primary,
  },
  subDetail: {
    ...typography.bodySm,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  activeSubDetail: {
    color: colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  activeBadge: {
    backgroundColor: colors.surface,
    borderColor: colors.primaryAccent,
  },
  completedBadge: {
    backgroundColor: colors.successContainer,
    borderColor: 'rgba(22, 163, 74, 0.2)',
  },
  failedBadge: {
    backgroundColor: colors.errorContainer,
    borderColor: 'rgba(220, 38, 38, 0.2)',
  },
  statusBadgeText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  activeBadgeText: {
    color: colors.primary,
  },
  completedBadgeText: {
    color: colors.success,
  },
  failedBadgeText: {
    color: colors.error,
  },
});

export default ScheduleCard;
