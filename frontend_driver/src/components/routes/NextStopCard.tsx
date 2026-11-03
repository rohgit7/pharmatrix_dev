import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography, shadows } from '../../theme';
import { RouteStop } from '../../types/api';

interface NextStopCardProps {
  stop: RouteStop | null;
  stopIndex: number;
  totalStops: number;
  onArrived: () => void;
  isLoading?: boolean;
}

export const NextStopCard: React.FC<NextStopCardProps> = ({
  stop,
  stopIndex,
  totalStops,
  onArrived,
  isLoading = false,
}) => {
  if (!stop) return null;

  const facilityName =
    stop.customer_name ||
    stop.location_name ||
    stop.warehouse_name ||
    'Assigned Stop';
  const phone = stop.customer_phone;

  const openExternalMaps = () => {
    const lat = stop.latitude;
    const lng = stop.longitude;
    const label = encodeURIComponent(facilityName);
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${lat},${lng}`,
      android: `geo:0,0?q=${lat},${lng}(${label})`,
      default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    });
    if (url) {
      Linking.openURL(url).catch(() => {});
    }
  };

  const handleCall = () => {
    if (phone) {
      Linking.openURL(`tel:${phone}`).catch(() => {});
    }
  };

  const isArrived =
    stop.execution_status === 'ARRIVED' || stop.execution_status === 'IN_PROGRESS';
  const isCompleted = stop.execution_status === 'COMPLETED';
  const isWarehouse = stop.stop_type === 'WAREHOUSE';

  const actionButtonText = isCompleted
    ? 'Stop Completed'
    : isWarehouse
    ? 'Proceed to Handover'
    : isArrived
    ? 'Open Verification Workflow'
    : 'Confirm Location Arrival';

  return (
    <View style={styles.card}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <View style={styles.tagsRow}>
            <View style={styles.stopBadge}>
              <Text style={styles.stopBadgeText}>
                STOP {stopIndex} OF {totalStops}
              </Text>
            </View>
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>
                {isWarehouse ? 'Terminal' : 'Regulated Waste'}
              </Text>
            </View>
          </View>

          <Text style={styles.facilityTitle} numberOfLines={1}>
            {facilityName}
          </Text>

          {stop.address ? (
            <View style={styles.addressRow}>
              <Ionicons name="location-outline" size={13} color={colors.textMuted} />
              <Text style={styles.addressText} numberOfLines={1}>
                {stop.address}
              </Text>
            </View>
          ) : null}
        </View>

        {phone ? (
          <TouchableOpacity
            style={styles.callButton}
            onPress={handleCall}
            activeOpacity={0.7}
            accessibilityLabel="Call Customer"
          >
            <Ionicons name="call-outline" size={18} color={colors.primary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Details Strip */}
      <View style={styles.infoStrip}>
        <View style={styles.infoCol}>
          <Text style={styles.colLabel}>CONTACT</Text>
          <Text style={styles.colValue} numberOfLines={1}>
            {stop.customer_name || 'Site Contact'}
          </Text>
        </View>
        <View style={[styles.infoCol, styles.colBorder]}>
          <Text style={styles.colLabel}>MANIFEST</Text>
          <Text style={styles.colValue} numberOfLines={1}>
            {stop.estimated_weight_kg
              ? `${stop.estimated_weight_kg} kg est.`
              : stop.pickup_code
              ? `#${stop.pickup_code}`
              : 'Standard Collection'}
          </Text>
        </View>
      </View>

      {/* Map Action Button */}
      <TouchableOpacity
        style={styles.openMapsBtn}
        onPress={openExternalMaps}
        activeOpacity={0.7}
      >
        <Ionicons name="map-outline" size={15} color={colors.primary} />
        <Text style={styles.openMapsText}>Navigate with Maps</Text>
      </TouchableOpacity>

      {/* Arrival Trigger Button */}
      <TouchableOpacity
        style={[
          styles.arrivedBtn,
          isArrived && styles.arrivedBtnDone,
          isCompleted && styles.arrivedBtnCompleted,
          isLoading && styles.arrivedBtnDisabled,
        ]}
        onPress={onArrived}
        activeOpacity={0.85}
        disabled={isLoading}
      >
        <Ionicons
          name={
            isCompleted
              ? 'checkmark-done-circle'
              : isArrived
              ? 'checkmark-circle'
              : 'location'
          }
          size={18}
          color="#FFFFFF"
        />
        <Text style={styles.arrivedBtnText}>{actionButtonText}</Text>
      </TouchableOpacity>
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
    gap: 12,
    marginBottom: spacing.md,
    ...shadows.subtle,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flex: 1,
    marginRight: 8,
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  stopBadge: {
    backgroundColor: colors.lightAccent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.xs,
  },
  stopBadgeText: {
    ...typography.labelSm,
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  typeBadge: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.secondary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.xs,
  },
  typeBadgeText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.textSecondary,
  },
  facilityTitle: {
    ...typography.headlineSm,
    fontSize: 18,
    color: colors.primary,
    fontWeight: '700',
    marginTop: 2,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  addressText: {
    ...typography.bodySm,
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  callButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoStrip: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.secondary,
    padding: 10,
  },
  infoCol: {
    flex: 1,
  },
  colBorder: {
    borderLeftWidth: 1,
    borderLeftColor: colors.secondary,
    paddingLeft: 12,
  },
  colLabel: {
    ...typography.labelSm,
    fontSize: 9,
    color: colors.textMuted,
    marginBottom: 2,
  },
  colValue: {
    ...typography.labelMd,
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  openMapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  openMapsText: {
    ...typography.labelMd,
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
  arrivedBtn: {
    backgroundColor: colors.primaryAccent,
    height: 46,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  arrivedBtnDone: {
    backgroundColor: colors.primary,
  },
  arrivedBtnCompleted: {
    backgroundColor: colors.success,
  },
  arrivedBtnDisabled: {
    opacity: 0.6,
  },
  arrivedBtnText: {
    ...typography.labelMd,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default NextStopCard;
