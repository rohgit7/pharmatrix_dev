import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, typography } from '../../theme';

interface QuickStatsStripProps {
  vehicleReg?: string | null;
  completedStops: number;
  totalStops: number;
}

export const QuickStatsStrip: React.FC<QuickStatsStripProps> = ({
  vehicleReg,
  completedStops,
  totalStops,
}) => {
  return (
    <View style={styles.container}>
      {/* Cold Chain Card */}
      <View style={styles.statCard}>
        <View style={styles.cardLeft}>
          <View style={[styles.iconBox, { backgroundColor: '#E0F2FE' }]}>
            <Ionicons name="snow" size={18} color="#0284C7" />
          </View>
          <View>
            <Text style={styles.titleText}>Cold Chain</Text>
            <Text style={styles.subText}>{totalStops > 0 ? 'Protocol Active' : 'Standby'}</Text>
          </View>
        </View>
        <View style={styles.emeraldDot} />
      </View>

      {/* Vehicle Status Card */}
      <View style={styles.statCard}>
        <View style={styles.cardLeft}>
          <View style={[styles.iconBox, { backgroundColor: colors.primaryTint }]}>
            <Ionicons name="bus-outline" size={18} color={colors.primaryDark} />
          </View>
          <View>
            <Text style={styles.titleText}>{vehicleReg || 'Service Vehicle'}</Text>
            <Text style={styles.subText}>{totalStops > 0 ? 'On Route' : 'Standby'}</Text>
          </View>
        </View>
        <View style={styles.counterBadge}>
          <Text style={styles.counterText}>
            {completedStops} / {totalStops}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    ...typography.labelMd,
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  subText: {
    ...typography.bodySm,
    fontSize: 11,
    color: colors.textSecondary,
  },
  emeraldDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  counterBadge: {
    backgroundColor: colors.primaryTint,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(123, 145, 238, 0.3)',
  },
  counterText: {
    ...typography.labelSm,
    fontSize: 11,
    color: colors.primaryDark,
    fontWeight: '700',
  },
});

export default QuickStatsStrip;
