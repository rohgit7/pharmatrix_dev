import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../../theme';
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

  // Refresh driver GPS coordinates
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
      setGpsError(err?.message || 'Unable to retrieve device GPS coordinates.');
      setDriverCoords(null);
      setDistanceMeters(null);
    } finally {
      setGpsLoading(false);
    }
  }, [isArrived, stopHasCoords, stop.latitude, stop.longitude]);

  // Fetch GPS automatically when viewing an un-arrived stop
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
      return; // Strictly prevented
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
      {/* Top Step Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={[styles.stepBadge, isArrived ? styles.stepBadgeDone : styles.stepBadgePending]}>
            <Ionicons
              name={isArrived ? 'checkmark' : 'navigate'}
              size={12}
              color={isArrived ? '#FFFFFF' : '#3B52B6'}
            />
            <Text style={[styles.stepBadgeText, isArrived && styles.stepBadgeTextDone]}>
              STEP 1: GPS GEOFENCE CHECK-IN
            </Text>
          </View>
        </View>

        <View style={[styles.statusPill, isArrived ? styles.statusPillDone : styles.statusPillPending]}>
          <View style={[styles.statusDot, isArrived ? styles.dotGreen : styles.dotAmber]} />
          <Text style={[styles.statusPillText, isArrived && styles.statusPillTextDone]}>
            {isArrived ? `Arrived at ${arrivedTimeFormatted || 'Facility'}` : 'Awaiting Arrival Check-In'}
          </Text>
        </View>
      </View>

      {/* Facility Information */}
      <View style={styles.facilitySection}>
        <View style={{ flex: 1 }}>
          <Text style={styles.facilityTitle}>{facilityName}</Text>
          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={13} color="#5C554E" />
            <Text style={styles.addressText} numberOfLines={2}>
              {stop.address || 'Facility Receiving Entrance'}
            </Text>
          </View>
        </View>

        <View style={styles.quickActionButtons}>
          {stop.customer_phone ? (
            <TouchableOpacity style={styles.iconCircleBtn} onPress={handlePhoneCall} activeOpacity={0.7}>
              <Ionicons name="call" size={17} color="#3B52B6" />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.iconCircleBtn} onPress={openNavigation} activeOpacity={0.7}>
            <Ionicons name="map-outline" size={17} color="#3B52B6" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Arrived Confirmation or Live Geofence Interface */}
      {isArrived ? (
        <View style={styles.arrivedBanner}>
          <View style={styles.arrivedBannerLeft}>
            <Ionicons name="shield-checkmark" size={20} color={colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={styles.arrivedBannerTitle}>Arrival Verified via GPS Geofence</Text>
              <Text style={styles.arrivedBannerSub}>
                Coordinates stamped • Facility check-in verified • Proceed to consignment weighing
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.pendingActionSection}>
          {/* Live GPS Readout and Geofence Verification Status */}
          <View style={styles.geofenceBox}>
            <View style={styles.geofenceHeader}>
              <View style={styles.geofenceHeaderLeft}>
                <Ionicons
                  name={gpsLoading ? 'sync' : 'radio-outline'}
                  size={15}
                  color={isWithinGeofence ? colors.success : '#D97706'}
                />
                <Text style={styles.geofenceTitle}>Real-time GPS Distance Check</Text>
              </View>

              <TouchableOpacity
                onPress={refreshLocation}
                disabled={gpsLoading}
                style={styles.refreshGpsBtn}
                activeOpacity={0.7}
              >
                {gpsLoading ? (
                  <ActivityIndicator size="small" color="#3B52B6" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Ionicons name="refresh" size={12} color="#3B52B6" />
                    <Text style={styles.refreshGpsText}>Refresh GPS</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* GPS Error Alert */}
            {gpsError ? (
              <View style={styles.gpsErrorBox}>
                <Ionicons name="alert-circle" size={18} color="#DC2626" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.gpsErrorTitle}>Location Unavailable</Text>
                  <Text style={styles.gpsErrorSub}>{gpsError}</Text>
                </View>
              </View>
            ) : gpsLoading ? (
              <View style={styles.gpsLoadingBox}>
                <ActivityIndicator size="small" color="#3B52B6" />
                <Text style={styles.gpsLoadingText}>Acquiring high-accuracy satellite fix...</Text>
              </View>
            ) : (
              <View style={styles.gpsStatsRow}>
                <View style={styles.statCol}>
                  <Text style={styles.statLabel}>Distance to Facility</Text>
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
                  <Text style={styles.statLabel}>Required Radius</Text>
                  <Text style={styles.statVal}>&le; {GEOFENCE_RADIUS_METERS} m</Text>
                </View>

                <View style={styles.statCol}>
                  <Text style={styles.statLabel}>GPS Precision</Text>
                  <Text style={styles.statVal}>
                    {driverCoords?.accuracy ? `&plusmn;${Math.round(driverCoords.accuracy)}m` : 'Normal'}
                  </Text>
                </View>
              </View>
            )}

            {/* Geofence Threshold Alert Message */}
            {!gpsLoading && !gpsError && (
              <View
                style={[
                  styles.geofenceStatusBanner,
                  isWithinGeofence ? styles.statusBannerSuccess : styles.statusBannerWarning,
                ]}
              >
                <Ionicons
                  name={isWithinGeofence ? 'checkmark-circle' : 'warning-outline'}
                  size={16}
                  color={isWithinGeofence ? '#15803D' : '#B45309'}
                />
                <Text
                  style={[
                    styles.geofenceStatusText,
                    isWithinGeofence ? styles.statusTextSuccess : styles.statusTextWarning,
                  ]}
                >
                  {isWithinGeofence
                    ? `Within ${GEOFENCE_RADIUS_METERS}m geofence. Ready to stamp arrival.`
                    : `Outside geofence (${distanceMeters}m away). Move closer to facility (&le;${GEOFENCE_RADIUS_METERS}m) to check in.`}
                </Text>
              </View>
            )}
          </View>

          {/* Location Check-in Button */}
          <TouchableOpacity
            style={[
              styles.confirmArrivalBtn,
              !canProceed && styles.btnDisabled,
              !isWithinGeofence && styles.btnOutsideGeofence,
            ]}
            onPress={handleArrivalPress}
            disabled={!canProceed}
            activeOpacity={0.88}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <View style={styles.btnContent}>
                <Ionicons
                  name={isWithinGeofence ? 'location' : 'lock-closed'}
                  size={18}
                  color="#FFFFFF"
                />
                <Text style={styles.confirmArrivalBtnText}>
                  {isWithinGeofence
                    ? 'Stamp Location Reached & Check In'
                    : `Outside Geofence (${distanceMeters ?? '...'}m away)`}
                </Text>
                {isWithinGeofence && (
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                )}
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
    backgroundColor: '#FFFFFF',
    borderRadius: radii.xl,
    padding: spacing.md,
    borderWidth: 1.5,
    shadowColor: '#201E1C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  cardPending: {
    borderColor: '#3B52B6',
    backgroundColor: '#FAF8F5',
  },
  cardArrived: {
    borderColor: '#C6F6D5',
    backgroundColor: '#FFFFFF',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: radii.full,
  },
  stepBadgePending: {
    backgroundColor: '#E5EBFF',
    borderWidth: 1,
    borderColor: 'rgba(59, 82, 182, 0.3)',
  },
  stepBadgeDone: {
    backgroundColor: colors.success,
  },
  stepBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#3B52B6',
    letterSpacing: 0.4,
  },
  stepBadgeTextDone: {
    color: '#FFFFFF',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  statusPillPending: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  statusPillDone: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#C6F6D5',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotAmber: {
    backgroundColor: '#D97706',
  },
  dotGreen: {
    backgroundColor: colors.success,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
  },
  statusPillTextDone: {
    color: colors.success,
  },
  facilitySection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  facilityTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#201E1C',
    letterSpacing: -0.3,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  addressText: {
    fontSize: 12,
    color: '#5C554E',
    fontWeight: '500',
    flex: 1,
  },
  quickActionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  iconCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E5EBFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 82, 182, 0.2)',
  },
  arrivedBanner: {
    backgroundColor: '#F0FDF4',
    padding: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  arrivedBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  arrivedBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.success,
  },
  arrivedBannerSub: {
    fontSize: 10.5,
    color: '#5C554E',
    marginTop: 1,
  },
  pendingActionSection: {
    gap: 10,
  },
  geofenceBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EADFD0',
    borderRadius: radii.lg,
    padding: 12,
    gap: 10,
  },
  geofenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  geofenceHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  geofenceTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#201E1C',
  },
  refreshGpsBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#E5EBFF',
    borderRadius: radii.sm,
  },
  refreshGpsText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#3B52B6',
  },
  gpsErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 8,
    borderRadius: radii.md,
  },
  gpsErrorTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#DC2626',
  },
  gpsErrorSub: {
    fontSize: 10,
    color: '#991B1B',
    marginTop: 2,
  },
  gpsLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  gpsLoadingText: {
    fontSize: 11,
    color: '#757683',
    fontWeight: '500',
  },
  gpsStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FDFBF8',
    padding: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#F2E7D7',
  },
  statCol: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#757683',
    textTransform: 'uppercase',
  },
  statVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#201E1C',
    marginTop: 2,
  },
  statValSuccess: {
    color: '#15803D',
  },
  statValWarning: {
    color: '#DC2626',
  },
  geofenceStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: radii.md,
  },
  statusBannerSuccess: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  statusBannerWarning: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  geofenceStatusText: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
    lineHeight: 15,
  },
  statusTextSuccess: {
    color: '#15803D',
  },
  statusTextWarning: {
    color: '#B45309',
  },
  confirmArrivalBtn: {
    backgroundColor: '#3B52B6',
    borderRadius: radii.lg,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3B52B6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  btnOutsideGeofence: {
    backgroundColor: '#9CA3AF',
    shadowColor: '#9CA3AF',
  },
  confirmArrivalBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnDisabled: {
    opacity: 0.7,
  },
});

export default ArrivalCheckInCard;
