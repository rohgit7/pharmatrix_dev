import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../../theme';
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
      {/* Accordion Trigger Header */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <View style={styles.listIconBox}>
            <Ionicons name="list" size={17} color={colors.primaryDark} />
          </View>
          <View>
            <Text style={styles.title}>Route Itinerary ({stops.length} Stops)</Text>
            <Text style={styles.subtitle}>Tap to inspect sequence & manifest counts</Text>
          </View>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textOutline}
        />
      </TouchableOpacity>

      {/* Collapsible List */}
      {expanded && (
        <View style={styles.list}>
          {stops.map((stop, index) => {
            const isActive = stop.id === activeStopId || (stop.execution_status === 'ARRIVED' || stop.execution_status === 'IN_PROGRESS');
            const isCompleted = stop.execution_status === 'COMPLETED';
            const isWarehouse = stop.stop_type === 'WAREHOUSE';
            const facilityName = stop.customer_name || stop.location_name || stop.warehouse_name || `Stop ${index + 1}`;
            const timeStr = `${10 + Math.floor(index / 2)}:${(index % 2) * 30 || '15'} AM`;

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
                  <Text style={[styles.nameText, isActive && styles.activeNameText]} numberOfLines={1}>
                    {stop.sequence_number || index + 1}. {facilityName}
                  </Text>
                  <Text style={[styles.metaText, isActive && styles.activeMetaText]} numberOfLines={1}>
                    {isWarehouse
                      ? 'Final Offload & Manifest Sign-off'
                      : stop.estimated_weight_kg
                      ? `${stop.estimated_weight_kg} kg • ${stop.execution_status}`
                      : `${2 + index} Totes • Queued Next`}
                  </Text>
                </View>

                {/* Time Badge */}
                <View style={[styles.timeBadge, isActive && styles.activeTimeBadge]}>
                  <Text style={[styles.timeText, isActive && styles.activeTimeText]}>
                    {timeStr}
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
    gap: 10,
  },
  listIconBox: {
    width: 30,
    height: 30,
    borderRadius: radii.md,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.headlineSm,
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  subtitle: {
    ...typography.bodySm,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  list: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 4,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  activeRow: {
    backgroundColor: colors.primaryTint,
    borderRadius: radii.lg,
    paddingHorizontal: 8,
    marginVertical: 2,
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(234, 223, 208, 0.5)',
  },
  seqCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
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
  warehouseSeqCircle: {
    backgroundColor: colors.textSecondary,
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
  infoCol: {
    flex: 1,
  },
  nameText: {
    ...typography.labelMd,
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  activeNameText: {
    color: colors.onPrimaryContainer,
  },
  metaText: {
    ...typography.bodySm,
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 1,
  },
  activeMetaText: {
    color: colors.primaryDark,
  },
  timeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  activeTimeBadge: {
    backgroundColor: colors.primaryAction,
  },
  timeText: {
    ...typography.bodySm,
    fontSize: 10,
    color: colors.textOutline,
    fontWeight: '600',
  },
  activeTimeText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});

export default RouteItineraryAccordion;
