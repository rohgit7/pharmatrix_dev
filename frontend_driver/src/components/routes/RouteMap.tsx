import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Rect, Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography, shadows } from '../../theme';
import { RouteStop } from '../../types/api';

interface RouteMapProps {
  currentStop: RouteStop | null;
  onRecenter?: () => void;
  onToast?: (msg: string) => void;
}

export const RouteMap: React.FC<RouteMapProps> = ({ currentStop, onRecenter, onToast }) => {
  const [trafficActive, setTrafficActive] = useState<boolean>(false);

  const destinationLabel = currentStop
    ? currentStop.customer_name || currentStop.location_name || currentStop.warehouse_name || 'Destination'
    : 'Assigned Destination';

  const handleRecenter = () => {
    onToast?.('GPS Centered');
    onRecenter?.();
  };

  const handleTrafficToggle = () => {
    const next = !trafficActive;
    setTrafficActive(next);
    onToast?.(next ? 'Live traffic layer active' : 'Traffic layer disabled');
  };

  return (
    <View style={styles.container}>
      {/* Visual Vector Road Network */}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={colors.primary} />
            <Stop offset="100%" stopColor={colors.primaryAccent} />
          </LinearGradient>
        </Defs>

        {/* Canvas Base */}
        <Rect width="100%" height="100%" fill="#F8F4EE" />

        {/* Road Grid */}
        <Path
          d="M-20,100 L450,100 M-20,220 L450,220 M90,-20 L90,380 M270,-20 L270,380 M180,-20 L180,380"
          stroke={colors.secondary}
          strokeWidth="10"
        />

        {/* White Avenue */}
        <Path
          d="M 30,50 Q 80,100 130,140 T 220,170 T 310,250"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="14"
          strokeLinecap="round"
        />

        {/* Active Route Line */}
        <Path
          d="M 60,70 L 120,130 L 195,130 L 195,210 L 285,210 L 285,260"
          fill="none"
          stroke="url(#routeGradient)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Waypoint Indicator */}
        <Circle cx="195" cy="130" r="9" fill={colors.lightAccent} opacity={0.9} />
        <Circle cx="195" cy="130" r="4" fill={colors.primaryAccent} />
      </Svg>

      {/* Driver Pin */}
      <View style={[styles.markerVan, { top: 60, left: 50 }]}>
        <View style={styles.vanPinCircle}>
          <Ionicons name="navigate" size={16} color="#FFFFFF" />
        </View>
        <View style={styles.vanBadge}>
          <Text style={styles.vanText}>COURIER</Text>
        </View>
      </View>

      {/* Destination Marker */}
      <View style={[styles.markerDest, { top: 220, left: 160 }]}>
        <View style={styles.destBubble}>
          <Ionicons name="location" size={12} color="#FFFFFF" />
          <Text style={styles.destText} numberOfLines={1}>
            {destinationLabel}
          </Text>
        </View>
        <View style={styles.destPinArrow} />
      </View>

      {/* Map Control Buttons */}
      <View style={styles.controlsColumn}>
        <TouchableOpacity style={styles.controlBtn} onPress={handleRecenter} activeOpacity={0.8}>
          <Ionicons name="locate" size={17} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.controlBtn, trafficActive && styles.controlBtnActive]}
          onPress={handleTrafficToggle}
          activeOpacity={0.8}
        >
          <Ionicons
            name="layers-outline"
            size={17}
            color={trafficActive ? colors.primaryAccent : colors.textMuted}
          />
        </TouchableOpacity>
      </View>

      {/* Corridor Footer */}
      <View style={styles.footerBar}>
        <View style={styles.footerDot} />
        <Text style={styles.footerText}>Biomedical Waste Route Corridor</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 260,
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: colors.secondary,
    marginBottom: spacing.md,
    ...shadows.subtle,
  },
  markerVan: {
    position: 'absolute',
    alignItems: 'center',
  },
  vanPinCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  vanBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.xs,
    marginTop: 2,
  },
  vanText: {
    ...typography.labelSm,
    fontSize: 9,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  markerDest: {
    position: 'absolute',
    alignItems: 'center',
  },
  destBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryAccent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    maxWidth: 160,
  },
  destText: {
    ...typography.labelSm,
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  destPinArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 5,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.primaryAccent,
  },
  controlsColumn: {
    position: 'absolute',
    right: 12,
    top: 12,
    gap: 8,
  },
  controlBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlBtnActive: {
    borderColor: colors.primaryAccent,
    backgroundColor: colors.lightAccent,
  },
  footerBar: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  footerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  footerText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.primary,
    fontWeight: '600',
  },
});

export default RouteMap;
