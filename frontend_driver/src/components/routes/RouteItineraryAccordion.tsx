import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography, shadows } from '../../theme';
import { RouteStop } from '../../types/api';

interface RouteItineraryAccordionProps {
  stops: RouteStop[];
  activeStopId?: number;
  onSelectStop?: (stop: RouteStop) => void;
}

export const RouteItineraryAccordion: React.FC<RouteItineraryAccordionProps> = ({
  stops,
  activeStopId,
  onSelectStop,
}) => {
  const [expanded, setExpanded] = useState<boolean>(true);

  return (
    <View style={styles.container}>
      {/* Header */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <Ionicons name="list-outline" size={17} color={colors.primary} />
          <Text style={styles.title}>Route Itinerary ({stops.length} Stops)</Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textMuted}
        />
      </TouchableOpacity>

      {/* List */}
      {expanded && (
        <View style={styles.list}>
          {stops.map((stop, index) => {
            const isActive =
              stop.id === activeStopId ||
              stop.execution_status === 'ARRIVED' ||
              stop.execution_status === 'IN_PROGRESS';
            const isCompleted = stop.execution_status === 'COMPLETED';
            const isWarehouse = stop.stop_type === 'WAREHOUSE';
            const facilityName =
              stop.customer_name ||
              stop.location_name ||
              stop.warehouse_name ||
              `Stop ${index + 1}`;

            return (
              <TouchableOpacity
                key={stop.id || index}
                style={[
                  styles.stopRow,
                  isActive && styles.activeRow,
                  index < stops.length - 1 && styles.borderBottom,
                ]}
                onPress={() => onSelectStop?.(stop)}
                activeOpacity={0.7}
              >
                {/* Sequence Circle */}
                <View
                  style={[
                    styles.seqCircle,
                    isActive && styles.activeSeqCircle,
                    isCompleted && styles.completedSeqCircle,
                    isWarehouse && styles.warehouseSeqCircle,
                  ]}
                >
                  {isCompleted ? (
                    <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                  ) : isWarehouse ? (
                    <Ionicons name="business" size={12} color="#FFFFFF" />
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

                {/* Details */}
                <View style={styles.infoCol}>
                  <Text
                    style={[styles.nameText, isActive && styles.activeNameText]}
                    numberOfLines={1}
                  >
                    {stop.sequence_number || index + 1}. {facilityName}
                  </Text>
                  <Text
                    style={[styles.metaText, isActive && styles.activeMetaText]}
                    numberOfLines={1}
                  >
                    {isWarehouse
                      ? 'Terminal Offload'
                      : stop.estimated_weight_kg
                      ? `${stop.estimated_weight_kg} kg est.`
                      : 'Standard Collection'}
                  </Text>
                </View>

                {/* Status Pill */}
                <View style={[styles.statusPill, isCompleted && styles.statusPillCompleted]}>
                  <Text style={[styles.statusPillText, isCompleted && styles.statusPillTextCompleted]}>
                    {isCompleted ? 'Done' : isActive ? 'Active' : 'Pending'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.secondary,
    marginBottom: spacing.md,
    ...shadows.subtle,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    ...typography.headlineSm,
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  list: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.secondary,
    paddingTop: 4,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  activeRow: {
    backgroundColor: colors.lightAccent,
    borderRadius: radii.sm,
    paddingHorizontal: 6,
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(234, 223, 208, 0.4)',
  },
  seqCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.background,
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
  warehouseSeqCircle: {
    backgroundColor: colors.primaryAccent,
    borderColor: colors.primaryAccent,
  },
  seqText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  activeSeqText: {
    color: '#FFFFFF',
  },
  completedSeqText: {
    color: '#FFFFFF',
  },
  infoCol: {
    flex: 1,
  },
  nameText: {
    ...typography.labelMd,
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  activeNameText: {
    color: colors.primary,
  },
  metaText: {
    ...typography.bodySm,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  activeMetaText: {
    color: colors.textSecondary,
  },
  statusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.xs,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  statusPillCompleted: {
    backgroundColor: colors.successContainer,
    borderColor: 'rgba(22, 163, 74, 0.2)',
  },
  statusPillText: {
    ...typography.labelSm,
    fontSize: 9,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  statusPillTextCompleted: {
    color: colors.success,
  },
});

export default RouteItineraryAccordion;
