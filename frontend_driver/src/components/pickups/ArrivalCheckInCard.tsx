import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography, shadows } from '../../theme';
import { RouteStop } from '../../types/api';
import {
  getCurrentDriverLocation,
  calculateDistanceMeters,
  GEOFENCE_RADIUS_METERS,
  GeoCoordinates,
} from '../../utils/geo';

interface ArrivalCheckInCardProps {
  stop: RouteStop | null;
  stopIndex: number;
  totalStops: number;
  onConfirmArrival: (coords: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
  }) => Promise<void>;
  isLoading?: boolean;
}

export const ArrivalCheckInCard: React.FC<ArrivalCheckInCardProps> = ({
  stop,
  stopIndex,
  totalStops,
  onConfirmArrival,
  isLoading = false,
}) => {
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [driverCoords, setDriverCoords] = useState<GeoCoordinates | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);

  if (!stop) return null;

  const isArrived =
    stop.execution_status === 'ARRIVED' ||
    stop.execution_status === 'IN_PROGRESS' ||
    stop.execution_status === 'COMPLETED';

  const facilityName =
    stop.customer_name || stop.location_name || stop.warehouse_name || 'Assigned Stop';
  const arrivedTimeFormatted = stop.arrived_at
    ? new Date(stop.arrived_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  const stopHasCoords =
    typeof stop.latitude === 'number' &&
    typeof stop.longitude === 'number' &&
    !isNaN(stop.latitude) &&
    !isNaN(stop.longitude);

  const refreshLocation = useCallback(async () => {
    if (isArrived) return;
    setGpsLoading(true);
    setGpsError(null);

    try {
      const coords = await getCurrentDriverLocation();
      setDriverCoords(coords);

      if (stopHasCoords) {
        const dist = calculateDistanceMeters(
          coords.latitude,
          coords.longitude,
          stop.latitude!,
          stop.longitude!
        );
        setDistanceMeters(dist);
      } else {
        setDistanceMeters(0);
      }
    } catch (err: any) {
      setGpsError(err?.message || 'Unable to retrieve GPS coordinates.');
      setDriverCoords(null);
      setDistanceMeters(null);
    } finally {
      setGpsLoading(false);
    }
  }, [isArrived, stopHasCoords, stop.latitude, stop.longitude]);

  useEffect(() => {
    if (!isArrived) {
      refreshLocation();
    }
  }, [isArrived, stop.id, refreshLocation]);

  const isWithinGeofence =
    !stopHasCoords ||
    (distanceMeters !== null && distanceMeters <= GEOFENCE_RADIUS_METERS);

  const canProceed =
    !isArrived &&
    !gpsLoading &&
    driverCoords !== null &&
    isWithinGeofence &&
    !isLoading;

  const handleArrivalPress = async () => {
    if (!driverCoords) {
      await refreshLocation();
      return;
    }
    if (!isWithinGeofence && stopHasCoords) {
      return;
    }

    await onConfirmArrival({
      latitude: driverCoords.latitude,
      longitude: driverCoords.longitude,
      accuracy: driverCoords.accuracy,
    });
  };

  const openNavigation = () => {
    if (!stop.latitude || !stop.longitude) return;
    const label = encodeURIComponent(facilityName);
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${stop.latitude},${stop.longitude}`,
      android: `geo:0,0?q=${stop.latitude},${stop.longitude}(${label})`,
      default: `https://www.google.com/maps/search/?api=1&query=${stop.latitude},${stop.longitude}`,
    });
    if (url) {
      Linking.openURL(url).catch(() => {});
    }
  };

  const handlePhoneCall = () => {
    if (stop.customer_phone) {
      Linking.openURL(`tel:${stop.customer_phone}`).catch(() => {});
    }
  };

  return (
    <View style={[styles.card, isArrived ? styles.cardArrived : styles.cardPending]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>STEP 1: LOCATION ARRIVAL</Text>
        </View>

        <View style={[styles.statusPill, isArrived && styles.statusPillDone]}>
          <View style={[styles.statusDot, isArrived && styles.dotGreen]} />
          <Text style={[styles.statusPillText, isArrived && styles.statusPillTextDone]}>
            {isArrived ? `Arrived ${arrivedTimeFormatted || ''}` : 'Pending Arrival'}
          </Text>
        </View>
      </View>

      {/* Facility Information */}
      <View style={styles.facilitySection}>
        <View style={{ flex: 1 }}>
          <Text style={styles.facilityTitle}>{facilityName}</Text>
          {stop.address ? (
            <View style={styles.addressRow}>
              <Ionicons name="location-outline" size={13} color={colors.textMuted} />
              <Text style={styles.addressText} numberOfLines={1}>
                {stop.address}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.quickActionButtons}>
          {stop.customer_phone ? (
            <TouchableOpacity
              style={styles.iconCircleBtn}
              onPress={handlePhoneCall}
              activeOpacity={0.7}
            >
              <Ionicons name="call-outline" size={16} color={colors.primary} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.iconCircleBtn}
            onPress={openNavigation}
            activeOpacity={0.7}
          >
            <Ionicons name="map-outline" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Arrived Confirmation or Live Geofence Interface */}
      {isArrived ? (
        <View style={styles.arrivedBanner}>
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <Text style={styles.arrivedBannerTitle}>
            Arrival verified within {GEOFENCE_RADIUS_METERS}m geofence
          </Text>
        </View>
      ) : (
        <View style={styles.pendingActionSection}>
          <View style={styles.geofenceBox}>
            <View style={styles.geofenceHeader}>
              <Text style={styles.geofenceTitle}>GPS Verification</Text>
              <TouchableOpacity
                onPress={refreshLocation}
                disabled={gpsLoading}
                style={styles.refreshGpsBtn}
                activeOpacity={0.7}
              >
                {gpsLoading ? (
                  <ActivityIndicator size="small" color={colors.primaryAccent} />
                ) : (
                  <View style={styles.refreshContent}>
                    <Ionicons name="refresh" size={12} color={colors.primary} />
                    <Text style={styles.refreshGpsText}>Refresh GPS</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {gpsError ? (
              <View style={styles.gpsErrorBox}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
                <Text style={styles.gpsErrorText}>{gpsError}</Text>
              </View>
            ) : gpsLoading ? (
              <View style={styles.gpsLoadingBox}>
                <ActivityIndicator size="small" color={colors.primaryAccent} />
                <Text style={styles.gpsLoadingText}>Locating device...</Text>
              </View>
            ) : (
              <View style={styles.gpsStatsRow}>
                <View style={styles.statCol}>
                  <Text style={styles.statLabel}>Distance to Site</Text>
                  <Text
                    style={[
                      styles.statVal,
                      isWithinGeofence ? styles.statValSuccess : styles.statValWarning,
                    ]}
                  >
                    {distanceMeters !== null ? `${distanceMeters} m` : 'Calculating...'}
                  </Text>
                </View>

                <View style={styles.statCol}>
                  <Text style={styles.statLabel}>Geofence Limit</Text>
                  <Text style={styles.statVal}>{GEOFENCE_RADIUS_METERS} m</Text>
                </View>

                <View style={styles.statCol}>
                  <Text style={styles.statLabel}>GPS Status</Text>
                  <Text style={[styles.statVal, isWithinGeofence && styles.statValSuccess]}>
                    {isWithinGeofence ? 'In Range' : 'Out of Range'}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Action Button */}
          <TouchableOpacity
            style={[
              styles.confirmArrivalBtn,
              !canProceed && styles.btnDisabled,
            ]}
            onPress={handleArrivalPress}
            disabled={!canProceed}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <View style={styles.btnContent}>
                <Ionicons
                  name={isWithinGeofence ? 'location' : 'lock-closed'}
                  size={16}
                  color="#FFFFFF"
                />
                <Text style={styles.confirmArrivalBtnText}>
                  {isWithinGeofence
                    ? 'Confirm Location Arrival'
                    : `Outside Geofence (${distanceMeters ?? '...'}m away)`}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}
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
    marginBottom: spacing.md,
    ...shadows.subtle,
  },
  cardPending: {
    borderColor: colors.primaryAccent,
  },
  cardArrived: {
    borderColor: colors.secondary,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepBadge: {
    backgroundColor: colors.lightAccent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.xs,
  },
  stepBadgeText: {
    ...typography.labelSm,
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  statusPillDone: {
    backgroundColor: colors.successContainer,
    borderColor: 'rgba(22, 163, 74, 0.2)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.warning,
  },
  dotGreen: {
    backgroundColor: colors.success,
  },
  statusPillText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  statusPillTextDone: {
    color: colors.success,
  },
  facilitySection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  facilityTitle: {
    ...typography.headlineSm,
    fontSize: 17,
    fontWeight: '700',
    color: colors.primary,
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
  quickActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconCircleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrivedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.successContainer,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  arrivedBannerTitle: {
    ...typography.bodySm,
    fontSize: 12,
    fontWeight: '600',
    color: colors.success,
    flex: 1,
  },
  pendingActionSection: {
    gap: 10,
  },
  geofenceBox: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.secondary,
    padding: 10,
    gap: 8,
  },
  geofenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  geofenceTitle: {
    ...typography.labelMd,
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  refreshGpsBtn: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  refreshContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  refreshGpsText: {
    ...typography.bodySm,
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
  },
  gpsErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.errorContainer,
    padding: 8,
    borderRadius: radii.xs,
  },
  gpsErrorText: {
    ...typography.bodySm,
    fontSize: 11,
    color: colors.error,
    flex: 1,
  },
  gpsLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  gpsLoadingText: {
    ...typography.bodySm,
    fontSize: 12,
    color: colors.textSecondary,
  },
  gpsStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  statCol: {
    flex: 1,
  },
  statLabel: {
    ...typography.labelSm,
    fontSize: 9,
    color: colors.textMuted,
    marginBottom: 2,
  },
  statVal: {
    ...typography.labelMd,
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  statValSuccess: {
    color: colors.success,
  },
  statValWarning: {
    color: colors.warning,
  },
  confirmArrivalBtn: {
    backgroundColor: colors.primaryAccent,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  confirmArrivalBtnText: {
    ...typography.labelMd,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default ArrivalCheckInCard;
