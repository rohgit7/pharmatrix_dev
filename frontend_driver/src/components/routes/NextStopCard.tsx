import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../../theme';
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

  const facilityName = stop.customer_name || stop.location_name || stop.warehouse_name || 'Assigned Stop';
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

  const isArrived = stop.execution_status === 'ARRIVED' || stop.execution_status === 'IN_PROGRESS';
  const isCompleted = stop.execution_status === 'COMPLETED';
  const isWarehouse = stop.stop_type === 'WAREHOUSE';

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
            <View style={styles.biohazardBadge}>
              <View style={styles.bioDot} />
              <Text style={styles.bioText}>
                {stop.stop_type === 'WAREHOUSE' ? 'Terminal' : 'Regulated Waste'}
              </Text>
            </View>
          </View>
          <Text style={styles.facilityTitle} numberOfLines={1}>
            {facilityName}
          </Text>
          <View style={styles.addressRow}>
            <Ionicons name="location-sharp" size={13} color={colors.textOutline} />
            <Text style={styles.addressText} numberOfLines={1}>
              {stop.address || 'Service Entrance'}
            </Text>
          </View>
        </View>

        {/* Call Button */}
        {phone ? (
          <TouchableOpacity style={styles.callButton} onPress={handleCall} activeOpacity={0.7}>
            <Ionicons name="call" size={19} color={colors.primaryDark} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* 2-Column Info Strip */}
      <View style={styles.twoColStrip}>
        <View style={styles.col}>
          <Text style={styles.colLabel}>CONTACT PERSON</Text>
          <Text style={styles.colValue} numberOfLines={1}>
            {stop.customer_name || 'Clinic Representative'}
          </Text>
          <Text style={styles.colSub}>
            {stop.customer_phone || 'Staff Representative'}
          </Text>
        </View>
        <View style={[styles.col, styles.colBorder]}>
          <Text style={styles.colLabel}>INSTRUCTION</Text>
          <Text style={styles.colValue} numberOfLines={1}>
            {stop.notes ? stop.notes.slice(0, 22) : 'Receiving Dock'}
          </Text>
          <Text style={styles.colSub}>
            {stop.notes ? stop.notes : 'Present Driver ID at receiving area'}
          </Text>
        </View>
      </View>

      {/* Manifest & External Maps Button */}
      <View style={styles.manifestMapsRow}>
        <View style={styles.manifestPill}>
          <Ionicons name="cube-outline" size={15} color={colors.primaryDark} />
          <Text style={styles.manifestPillText} numberOfLines={1}>
            {stop.estimated_weight_kg ? `${stop.estimated_weight_kg} kg estimated` : (stop.pickup_code ? `Consignment #${stop.pickup_code}` : 'Consignment Pickup')}
          </Text>
        </View>
        <TouchableOpacity style={styles.openMapsBtn} onPress={openExternalMaps} activeOpacity={0.7}>
          <Ionicons name="map-outline" size={14} color={colors.primaryDark} />
          <Text style={styles.openMapsText}>Open in Maps</Text>
        </TouchableOpacity>
      </View>

      {/* Arrival Trigger Button */}
      <View style={styles.arrivalActionBox}>
        <TouchableOpacity
          style={[
            styles.arrivedBtn,
            isArrived && styles.arrivedBtnDone,
            isCompleted && { backgroundColor: colors.success },
            isLoading && styles.arrivedBtnDisabled,
          ]}
          onPress={onArrived}
          activeOpacity={0.88}
          disabled={isLoading}
        >
          <Ionicons
            name={isCompleted ? 'checkmark-done-circle' : isArrived ? 'checkmark-circle' : 'navigate-circle'}
            size={20}
            color="#FFFFFF"
          />
          <Text style={styles.arrivedBtnText}>
            {isCompleted
              ? 'Stop Completed (Advance to Next) →'
              : isWarehouse
              ? 'Proceed to Terminal Handover →'
              : isArrived
              ? 'Arrived (Proceed to Verification) →'
              : 'I Have Arrived at Stop (Auto-Advance) →'}
          </Text>
        </TouchableOpacity>
        <View style={styles.geofenceNote}>
          <View style={styles.geofenceDot} />
          <Text style={styles.geofenceText}>
            Geofence confirmed • Auto-transitions to consignment recording
          </Text>
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
  topHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 12,
    gap: 8,
  },
  headerLeft: {
    flex: 1,
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  stopBadge: {
    backgroundColor: colors.surfaceHigh,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  stopBadgeText: {
    ...typography.labelSm,
    fontSize: 9,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  biohazardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.errorContainer,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  bioDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.error,
  },
  bioText: {
    ...typography.labelSm,
    fontSize: 9,
    color: colors.error,
    fontWeight: '700',
  },
  facilityTitle: {
    ...typography.headlineSm,
    fontSize: 17,
    fontWeight: '700',
    color: colors.ink,
    marginTop: 2,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  addressText: {
    ...typography.bodySm,
    fontSize: 11,
    color: colors.textSecondary,
    flex: 1,
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceLow,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  twoColStrip: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceLow,
    borderRadius: radii.lg,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  col: {
    flex: 1,
  },
  colBorder: {
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    paddingLeft: 10,
  },
  colLabel: {
    ...typography.labelSm,
    fontSize: 9,
    color: colors.textOutline,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  colValue: {
    ...typography.labelMd,
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    marginTop: 2,
  },
  colSub: {
    ...typography.bodySm,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  manifestMapsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  manifestPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceLow,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.md,
    flex: 1,
  },
  manifestPillText: {
    ...typography.bodySm,
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
    flex: 1,
  },
  openMapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surfaceLow,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  openMapsText: {
    ...typography.labelSm,
    fontSize: 11,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  arrivalActionBox: {
    gap: 6,
    paddingTop: 2,
  },
  arrivedBtn: {
    height: 52,
    backgroundColor: colors.primaryDark,
    borderRadius: radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  arrivedBtnDone: {
    backgroundColor: colors.primaryAction,
  },
  arrivedBtnDisabled: {
    opacity: 0.6,
  },
  arrivedBtnText: {
    ...typography.labelLg,
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  geofenceNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  geofenceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primaryDark,
  },
  geofenceText: {
    ...typography.bodySm,
    fontSize: 10,
    color: colors.textSecondary,
  },
});

export default NextStopCard;
