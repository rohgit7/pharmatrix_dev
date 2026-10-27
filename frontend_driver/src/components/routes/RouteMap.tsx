import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import Svg, { Rect, Path, Circle, Defs, LinearGradient, Stop, Pattern } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, typography } from '../../theme';
import { RouteStop } from '../../types/api';

interface RouteMapProps {
  currentStop: RouteStop | null;
  onRecenter?: () => void;
  onToast?: (msg: string) => void;
}

export const RouteMap: React.FC<RouteMapProps> = ({ currentStop, onRecenter, onToast }) => {
  const [trafficActive, setTrafficActive] = useState<boolean>(false);
  const [recalculating, setRecalculating] = useState<boolean>(false);

  const destinationLabel = currentStop
    ? currentStop.customer_name || currentStop.location_name || currentStop.warehouse_name || 'Destination'
    : 'Assigned Destination';

  const handleRecenter = () => {
    onToast?.('GPS Centered to Courier Position');
    onRecenter?.();
  };

  const handleTrafficToggle = () => {
    const next = !trafficActive;
    setTrafficActive(next);
    onToast?.(next ? 'Live traffic active: Hazmat Corridor clear' : 'Traffic layer disabled');
  };

  const handleRecalculate = () => {
    setRecalculating(true);
    onToast?.('Recalculating HAZMAT compliant route...');
    setTimeout(() => setRecalculating(false), 1200);
  };

  return (
    <View style={styles.container}>
      {/* Visual Vector Road Network Simulation */}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#4158B1" />
            <Stop offset="100%" stopColor="#7B91EE" />
          </LinearGradient>
        </Defs>

        {/* City Blocks Base */}
        <Rect width="100%" height="100%" fill="#F8ECDD" />

        {/* Road Grid */}
        <Path
          d="M-20,100 L450,100 M-20,220 L450,220 M90,-20 L90,380 M270,-20 L270,380 M180,-20 L180,380"
          stroke="#EADFD0"
          strokeWidth="10"
        />

        {/* Secondary White Avenue */}
        <Path
          d="M 30,50 Q 80,100 130,140 T 220,170 T 310,250"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="14"
          strokeLinecap="round"
        />

        {/* Active Hazmat Route Line */}
        <Path
          d="M 60,70 L 120,130 L 195,130 L 195,210 L 285,210 L 285,260"
          fill="none"
          stroke="url(#routeGradient)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Route Waypoint Pulsing Circle */}
        <Circle cx="195" cy="130" r="10" fill="#DDE1FF" opacity={0.8} />
        <Circle cx="195" cy="130" r="4.5" fill="#4158B1" />
      </Svg>

      {/* VAN Marker */}
      <View style={[styles.markerVan, { top: 60, left: 50 }]}>
        <View style={styles.vanPinCircle}>
          <Ionicons name="navigate" size={18} color="#FFFFFF" />
        </View>
        <View style={styles.vanBadge}>
          <Text style={styles.vanText}>COURIER</Text>
          <Text style={styles.speedText}>In Transit</Text>
        </View>
      </View>

      {/* Destination Clinic Marker */}
      <View style={[styles.markerDest, { top: 220, left: 160 }]}>
        <View style={styles.destBubble}>
          <Ionicons name="business" size={13} color="#FFFFFF" />
          <Text style={styles.destText} numberOfLines={1}>
            {destinationLabel}
          </Text>
        </View>
        <View style={styles.destPinArrow} />
        <View style={styles.destDot} />
      </View>

      {/* North Locked Chip */}
      <View style={styles.northLockedChip}>
        <Ionicons name="compass-outline" size={14} color={colors.primaryDark} />
        <Text style={styles.northLockedText}>NORTH LOCKED</Text>
      </View>

      {/* Controls: Re-center, Traffic, Recalculate */}
      <View style={styles.controlsColumn}>
        <TouchableOpacity style={styles.controlBtn} onPress={handleRecenter} activeOpacity={0.8}>
          <Ionicons name="locate" size={18} color={colors.primaryDark} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.controlBtn, trafficActive && styles.controlBtnActive]}
          onPress={handleTrafficToggle}
          activeOpacity={0.8}
        >
          <Ionicons name="git-branch-outline" size={18} color={trafficActive ? colors.primaryDark : colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.controlBtn, recalculating && styles.controlBtnActive]}
          onPress={handleRecalculate}
          activeOpacity={0.8}
        >
          <Ionicons name="refresh" size={18} color={colors.error} />
        </TouchableOpacity>
      </View>

      {/* Active Hazmat Corridor Footer */}
      <View style={styles.hazmatFooter}>
        <View style={styles.hazmatPulseDot} />
        <Text style={styles.hazmatText}>Active Hazmat Corridor</Text>
        <Text style={styles.hazmatDivider}>•</Text>
        <Text style={styles.hazmatSpeed}>Speed limit: 50 km/h</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 300,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.xl,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  markerVan: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 20,
  },
  vanPinCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    transform: [{ rotate: '45deg' }],
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  vanBadge: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.ink,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  vanText: {
    ...typography.labelSm,
    fontSize: 9,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  speedText: {
    ...typography.labelSm,
    fontSize: 9,
    color: colors.primaryTint,
  },
  markerDest: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 20,
  },
  destBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryDark,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
    maxWidth: 180,
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
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.primaryDark,
  },
  destDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primaryDark,
    borderWidth: 2,
    borderColor: colors.primaryTint,
    marginTop: 2,
  },
  northLockedChip: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  northLockedText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.ink,
    fontWeight: '700',
  },
  controlsColumn: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 30,
    gap: 8,
  },
  controlBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  controlBtnActive: {
    backgroundColor: colors.primaryTint,
    borderColor: colors.primaryAction,
  },
  hazmatFooter: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hazmatPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primaryDark,
  },
  hazmatText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.ink,
    fontWeight: '600',
  },
  hazmatDivider: {
    color: colors.textOutline,
    fontSize: 10,
  },
  hazmatSpeed: {
    ...typography.bodySm,
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});

export default RouteMap;
