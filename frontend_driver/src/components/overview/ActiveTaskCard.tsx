import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../../theme';
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
        <Ionicons name="clipboard-outline" size={40} color={colors.textOutline} />
        <Text style={styles.emptyTitle}>No Active Assignment</Text>
        <Text style={styles.emptySub}>All assigned route stops for today are completed.</Text>
      </View>
    );
  }

  const facilityName = stop.customer_name || stop.location_name || stop.warehouse_name || 'Assigned Stop';
  const manifestText = stop.estimated_weight_kg
    ? `${stop.estimated_weight_kg} kg estimated • Regulated Waste`
    : (stop.pickup_code ? `Consignment #${stop.pickup_code}` : 'Consignment Pickup');

  // Determine current pipeline step
  let stepNumber = 1;
  let stepLabel = 'Step 1 of 4 Ready';
  if (stop.execution_status === 'ARRIVED') {
    stepNumber = stop.qr_verified ? 3 : 2;
    stepLabel = stop.qr_verified ? 'Step 3 of 4: QR Tag' : 'Step 2 of 4: Weigh';
  } else if (stop.execution_status === 'IN_PROGRESS') {
    stepNumber = 4;
    stepLabel = 'Step 4 of 4: OTP Signoff';
  } else if (stop.execution_status === 'COMPLETED') {
    stepNumber = 4;
    stepLabel = 'Completed';
  }

  const ctaTitle =
    stop.execution_status === 'ARRIVED'
      ? 'Resume Verification Pipeline →'
      : `Execute Stop ${stopIndex} (Launches Navigation) →`;

  const dockStatusText = stop.stop_type === 'WAREHOUSE'
    ? 'Terminal Offload'
    : (stop.execution_status === 'ARRIVED' ? 'Arrived at Receiving' : 'In Transit');

  return (
    <View style={styles.card}>
      {/* Top Strip */}
      <View style={styles.topStrip}>
        <View style={styles.stopSequenceRow}>
          <View style={styles.pulsingIndicator} />
          <Text style={styles.topStripText}>
            STOP {stopIndex} OF {totalStops}: {facilityName.toUpperCase()}
          </Text>
        </View>
        <View style={styles.autoAdvanceBadge}>
          <Ionicons name="flash" size={12} color={colors.primaryDark} />
          <Text style={styles.autoAdvanceText}>Auto-Advancing</Text>
        </View>
      </View>

      {/* Main Body */}
      <View style={styles.body}>
        {/* Destination Pill & Distance */}
        <View style={styles.metaRow}>
          <View style={styles.locationPill}>
            <Ionicons name="business" size={14} color={colors.primaryDark} />
            <Text style={styles.locationPillText} numberOfLines={1}>
              {facilityName}
            </Text>
          </View>
          <View style={styles.dockDistanceBadge}>
            <Text style={styles.dockDistanceText}>{dockStatusText}</Text>
          </View>
        </View>

        {/* Action Title */}
        <Text style={styles.taskTitle}>
          {stop.stop_type === 'WAREHOUSE' ? 'Terminal Facility Handover' : 'Pickup Consignment'}
        </Text>

        {/* Manifest Summary */}
        <View style={styles.manifestBox}>
          <Ionicons name="cube-outline" size={17} color={colors.primaryAction} />
          <Text style={styles.manifestText}>
            <Text style={styles.manifestBold}>Manifest: </Text>
            {manifestText}
          </Text>
        </View>

        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={18} color={colors.primaryAction} />
          <Text style={styles.infoText}>
            <Text style={styles.infoBold}>Auto-Advancing Pipeline Active: </Text>
            Executing stop initiates live navigation, on arrival triggers manual weight entry, QR tag, and OTP signoff.
          </Text>
        </View>

        {/* Pipeline Progression Component */}
        <View style={styles.pipelineBox}>
          <View style={styles.pipelineHeader}>
            <Text style={styles.pipelineTitle}>Pipeline Progression</Text>
            <View style={styles.pipelineStatusBadge}>
              <Text style={styles.pipelineStatusText}>{stepLabel}</Text>
            </View>
          </View>

          {/* 4 Step Bars */}
          <View style={styles.barsGrid}>
            <View
              style={[
                styles.stepBar,
                stepNumber >= 1 ? styles.stepBarActive : styles.stepBarInactive,
              ]}
            />
            <View
              style={[
                styles.stepBar,
                stepNumber >= 2 ? styles.stepBarActive : styles.stepBarInactive,
              ]}
            />
            <View
              style={[
                styles.stepBar,
                stepNumber >= 3 ? styles.stepBarActive : styles.stepBarInactive,
              ]}
            />
            <View
              style={[
                styles.stepBar,
                stepNumber >= 4 ? styles.stepBarActive : styles.stepBarInactive,
              ]}
            />
          </View>

          {/* Step Labels */}
          <View style={styles.labelsGrid}>
            <Text style={[styles.stepLabelText, stepNumber >= 1 && styles.stepLabelActive]}>
              1. Navigate
            </Text>
            <Text style={[styles.stepLabelText, stepNumber >= 2 && styles.stepLabelActive]}>
              2. Weigh & Seal
            </Text>
            <Text style={[styles.stepLabelText, stepNumber >= 3 && styles.stepLabelActive]}>
              3. QR & Tag
            </Text>
            <Text style={[styles.stepLabelText, stepNumber >= 4 && styles.stepLabelActive]}>
              4. OTP Sign
            </Text>
          </View>
        </View>

        {/* Primary CTA */}
        <TouchableOpacity
          style={[styles.ctaButton, isLoading && styles.ctaDisabled]}
          onPress={onExecute}
          activeOpacity={0.88}
          disabled={isLoading}
        >
          <Ionicons name="navigate" size={18} color="#FFFFFF" />
          <Text style={styles.ctaText}>{ctaTitle}</Text>
        </TouchableOpacity>

        {/* Hands-free note */}
        <View style={styles.handsFreeRow}>
          <Ionicons name="sync" size={13} color={colors.primaryAction} />
          <Text style={styles.handsFreeText}>Hands-free progression enabled upon execution</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
    overflow: 'hidden',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: {
    ...typography.headlineSm,
    color: colors.ink,
    marginTop: 12,
  },
  emptySub: {
    ...typography.bodySm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  topStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(229, 235, 255, 0.4)',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  stopSequenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  pulsingIndicator: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.primaryDark,
  },
  topStripText: {
    ...typography.labelSm,
    fontSize: 10,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: 0.5,
  },
  autoAdvanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryTint,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(123, 145, 238, 0.4)',
  },
  autoAdvanceText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  body: {
    padding: spacing.md,
    gap: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryTint,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(123, 145, 238, 0.3)',
    flex: 1,
  },
  locationPillText: {
    ...typography.labelSm,
    fontSize: 11,
    color: colors.primaryDark,
    fontWeight: '700',
    flex: 1,
  },
  dockDistanceBadge: {
    backgroundColor: colors.surfaceLow,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dockDistanceText: {
    ...typography.bodySm,
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  taskTitle: {
    ...typography.headlineMd,
    fontSize: 22,
    color: colors.ink,
    fontWeight: '700',
    marginTop: 2,
  },
  manifestBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceLow,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  manifestText: {
    ...typography.bodyMd,
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  manifestBold: {
    fontWeight: '700',
    color: colors.ink,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(229, 235, 255, 0.6)',
    padding: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(123, 145, 238, 0.3)',
  },
  infoText: {
    ...typography.bodySm,
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
    flex: 1,
  },
  infoBold: {
    fontWeight: '700',
    color: colors.onPrimaryContainer,
  },
  pipelineBox: {
    backgroundColor: colors.surfaceLow,
    padding: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  pipelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pipelineTitle: {
    ...typography.labelMd,
    fontWeight: '700',
    color: colors.ink,
  },
  pipelineStatusBadge: {
    backgroundColor: colors.primaryTint,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(123, 145, 238, 0.3)',
  },
  pipelineStatusText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  barsGrid: {
    flexDirection: 'row',
    gap: 6,
    width: '100%',
    paddingTop: 2,
  },
  stepBar: {
    flex: 1,
    height: 7,
    borderRadius: radii.full,
  },
  stepBarActive: {
    backgroundColor: colors.primaryDark,
  },
  stepBarInactive: {
    backgroundColor: colors.border,
  },
  labelsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  stepLabelText: {
    ...typography.labelSm,
    fontSize: 9,
    color: colors.textOutline,
    textAlign: 'center',
    flex: 1,
  },
  stepLabelActive: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  ctaButton: {
    backgroundColor: colors.primaryAction,
    height: 52,
    borderRadius: radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  ctaDisabled: {
    opacity: 0.6,
  },
  ctaText: {
    ...typography.labelLg,
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  handsFreeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  handsFreeText: {
    ...typography.bodySm,
    fontSize: 11,
    color: colors.textSecondary,
  },
});

export default ActiveTaskCard;
