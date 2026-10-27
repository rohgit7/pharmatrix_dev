import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { DriverRouteStopResponse } from '@/types/api';

interface RouteLocationsMapProps {
  stops: DriverRouteStopResponse[];
  driverLocation: { latitude: number; longitude: number } | null;
  selectedStopId: number | null;
  onSelectStop: (stop: DriverRouteStopResponse) => void;
}

function hasCoordinates(
  stop: DriverRouteStopResponse
): stop is DriverRouteStopResponse & { latitude: number; longitude: number } {
  return stop.latitude != null && stop.longitude != null;
}

function getStopColor(stop: DriverRouteStopResponse): string {
  if (stop.execution_status === 'COMPLETED') return '#15803D';
  if (stop.execution_status === 'FAILED') return '#DC2626';
  if (stop.execution_status === 'ARRIVED' || stop.execution_status === 'IN_PROGRESS') {
    return Colors.primary;
  }
  return '#BBAE9D';
}

export function RouteLocationsMap({
  stops,
  driverLocation,
  selectedStopId,
  onSelectStop,
}: RouteLocationsMapProps) {
  const points = useMemo(() => {
    const geocodedStops = stops.filter(hasCoordinates);
    const coordinates = [
      ...geocodedStops.map((stop) => ({
        latitude: stop.latitude,
        longitude: stop.longitude,
      })),
      ...(driverLocation ? [driverLocation] : []),
    ];

    if (coordinates.length === 0) return [];

    const minLatitude = Math.min(...coordinates.map((point) => point.latitude));
    const maxLatitude = Math.max(...coordinates.map((point) => point.latitude));
    const minLongitude = Math.min(...coordinates.map((point) => point.longitude));
    const maxLongitude = Math.max(...coordinates.map((point) => point.longitude));
    const latitudeSpan = Math.max(maxLatitude - minLatitude, 0.002);
    const longitudeSpan = Math.max(maxLongitude - minLongitude, 0.002);

    return geocodedStops.map((stop) => ({
      stop,
      left: 12 + ((stop.longitude - minLongitude) / longitudeSpan) * 76,
      top: 12 + ((maxLatitude - stop.latitude) / latitudeSpan) * 68,
    }));
  }, [stops, driverLocation]);

  const driverPoint = useMemo(() => {
    if (!driverLocation) return null;
    const coordinates = [
      ...stops.filter(hasCoordinates).map((stop) => ({
        latitude: stop.latitude,
        longitude: stop.longitude,
      })),
      driverLocation,
    ];
    const minLatitude = Math.min(...coordinates.map((point) => point.latitude));
    const maxLatitude = Math.max(...coordinates.map((point) => point.latitude));
    const minLongitude = Math.min(...coordinates.map((point) => point.longitude));
    const maxLongitude = Math.max(...coordinates.map((point) => point.longitude));
    const latitudeSpan = Math.max(maxLatitude - minLatitude, 0.002);
    const longitudeSpan = Math.max(maxLongitude - minLongitude, 0.002);

    return {
      left: 12 + ((driverLocation.longitude - minLongitude) / longitudeSpan) * 76,
      top: 12 + ((maxLatitude - driverLocation.latitude) / latitudeSpan) * 68,
    };
  }, [stops, driverLocation]);

  const locatedStopCount = points.length;

  return (
    <View>
      <View
        accessibilityLabel={`Location overview with ${locatedStopCount} stops with coordinates${
          driverLocation ? ' and your current location' : ''
        }`}
        style={styles.map}
      >
        {[25, 50, 75].map((position) => (
          <View
            key={`vertical-${position}`}
            pointerEvents="none"
            style={[styles.gridLineVertical, { left: `${position}%` }]}
          />
        ))}
        {[25, 50, 75].map((position) => (
          <View
            key={`horizontal-${position}`}
            pointerEvents="none"
            style={[styles.gridLineHorizontal, { top: `${position}%` }]}
          />
        ))}

        {points.map(({ stop, left, top }) => {
          const selected = selectedStopId === stop.id;
          return (
            <TouchableOpacity
              key={stop.id ?? `${stop.sequence_number}-${stop.stop_type}`}
              accessibilityRole="button"
              accessibilityLabel={`Stop ${stop.sequence_number}, ${
                stop.customer_name || stop.location_name || stop.warehouse_name || 'route stop'
              }, ${stop.execution_status.toLowerCase()}`}
              onPress={() => onSelectStop(stop)}
              activeOpacity={0.85}
              style={[
                styles.stopMarker,
                {
                  left: `${left}%`,
                  top: `${top}%`,
                  backgroundColor: getStopColor(stop),
                  borderColor: selected ? Colors.brandDark : Colors.surface,
                },
              ]}
            >
              <Text style={styles.stopMarkerText}>{stop.sequence_number}</Text>
            </TouchableOpacity>
          );
        })}

        {driverPoint ? (
          <View
            accessibilityLabel="Your current location"
            style={[
              styles.driverMarker,
              { left: `${driverPoint.left}%`, top: `${driverPoint.top}%` },
            ]}
          >
            <View style={styles.driverMarkerCore} />
          </View>
        ) : null}

        {locatedStopCount === 0 ? (
          <View style={styles.noCoordinates}>
            <Ionicons name="location-outline" size={23} color={Colors.textSecondary} />
            <Text style={styles.noCoordinatesText}>
              No stop coordinates are available for this route.
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.mapLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
          <Text style={styles.legendText}>Current / active</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#15803D' }]} />
          <Text style={styles.legendText}>Completed</Text>
        </View>
        {driverLocation ? (
          <View style={styles.legendItem}>
            <View style={styles.driverLegendDot} />
            <Text style={styles.legendText}>You</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.disclaimer}>
        Pins use the assigned coordinates only. This view does not show road routing; use Maps for directions.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    height: 270,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    position: 'relative',
  },
  gridLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: Colors.cardBorder,
    opacity: 0.55,
  },
  gridLineHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: Colors.cardBorder,
    opacity: 0.55,
  },
  stopMarker: {
    position: 'absolute',
    width: 34,
    height: 34,
    marginLeft: -17,
    marginTop: -17,
    borderRadius: Radius.full,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  stopMarkerText: {
    color: Colors.white,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
  },
  driverMarker: {
    position: 'absolute',
    width: 24,
    height: 24,
    marginLeft: -12,
    marginTop: -12,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(123, 145, 238, 0.28)',
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  driverMarkerCore: {
    width: 10,
    height: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    borderWidth: 1,
    borderColor: Colors.surface,
  },
  noCoordinates: {
    position: 'absolute',
    left: Spacing.xl,
    right: Spacing.xl,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  noCoordinatesText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
    textAlign: 'center',
  },
  mapLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: Radius.full,
  },
  driverLegendDot: {
    width: 10,
    height: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.primaryLight,
  },
  legendText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.xs,
  },
  disclaimer: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.xs,
    lineHeight: 17,
    marginTop: Spacing.sm,
  },
});
