import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../../theme';
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
          <View style={styles.calendarIconBox}>
            <Ionicons name="calendar-outline" size={16} color={colors.primaryDark} />
          </View>
          <Text style={styles.headerTitle}>Today's Schedule</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{stops.length} Stops Total</Text>
        </View>
      </View>

      {/* List */}
      <View style={styles.list}>
        {stops.map((stop, index) => {
          const isActive = stop.id === activeStopId || (stop.execution_status === 'ARRIVED' || stop.execution_status === 'IN_PROGRESS');
          const isCompleted = stop.execution_status === 'COMPLETED';
          const isFailed = stop.execution_status === 'FAILED';
          const facilityName = stop.customer_name || stop.location_name || stop.warehouse_name || `Stop ${index + 1}`;
          const time = stop.arrival_time ? new Date(stop.arrival_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : `${9 + index}:00 AM`;

          return (
            <TouchableOpacity
              key={stop.id || index}
              style={[
                styles.stopRow,
                isActive && styles.activeStopRow,
              ]}
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
                  <Text style={[styles.facilityName, isActive && styles.activeFacilityName]} numberOfLines={1}>
                    {facilityName}
                  </Text>
                  <Text style={[styles.subDetail, isActive && styles.activeSubDetail]} numberOfLines={1}>
                    {time} • {stop.address || 'Dock Receiving'}
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
                  {isCompleted ? 'Completed' : isActive ? 'Active' : isFailed ? 'Failed' : 'Queued'}
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
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calendarIconBox: {
    width: 28,
    height: 28,
    borderRadius: radii.md,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.headlineSm,
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },
  countBadge: {
    backgroundColor: colors.primaryTint,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(123, 145, 238, 0.3)',
  },
  countText: {
    ...typography.labelSm,
    fontSize: 11,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  list: {
    gap: 8,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceLow,
  },
  activeStopRow: {
    backgroundColor: colors.primaryTint,
    borderColor: 'rgba(123, 145, 238, 0.6)',
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  seqCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeSeqCircle: {
    backgroundColor: colors.primaryDark,
  },
  completedSeqCircle: {
    backgroundColor: colors.success,
  },
  failedSeqCircle: {
    backgroundColor: colors.error,
  },
  seqText: {
    ...typography.labelSm,
    fontSize: 12,
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
    color: colors.ink,
  },
  activeFacilityName: {
    color: colors.onPrimaryContainer,
  },
  subDetail: {
    ...typography.bodySm,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  activeSubDetail: {
    color: colors.primaryDark,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeBadge: {
    backgroundColor: '#FFFFFF',
    borderColor: colors.primaryAction,
  },
  completedBadge: {
    backgroundColor: colors.successContainer,
    borderColor: colors.success,
  },
  failedBadge: {
    backgroundColor: colors.errorContainer,
    borderColor: colors.error,
  },
  statusBadgeText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  activeBadgeText: {
    color: colors.primaryDark,
  },
  completedBadgeText: {
    color: colors.success,
  },
  failedBadgeText: {
    color: colors.error,
  },
});

export default ScheduleCard;
