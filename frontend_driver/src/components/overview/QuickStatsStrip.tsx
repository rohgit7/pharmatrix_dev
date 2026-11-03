import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography, shadows } from '../../theme';

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
  const percent = totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0;

  return (
    <View style={styles.container}>
      {/* Vehicle Status Card */}
      <View style={styles.statCard}>
        <View style={styles.iconBox}>
          <Ionicons name="car-outline" size={17} color={colors.primary} />
        </View>
        <View style={styles.textColumn}>
          <Text style={styles.titleText} numberOfLines={1}>
            {vehicleReg || 'Assigned Vehicle'}
          </Text>
          <Text style={styles.subText}>
            {totalStops > 0 ? 'Active Route' : 'Standby'}
          </Text>
        </View>
      </View>

      {/* Progress Card */}
      <View style={styles.statCard}>
        <View style={[styles.iconBox, { backgroundColor: colors.lightAccent }]}>
          <Ionicons name="checkmark-done" size={17} color={colors.primary} />
        </View>
        <View style={styles.textColumn}>
          <Text style={styles.titleText}>
            {completedStops} of {totalStops} Done
          </Text>
          <Text style={styles.subText}>{percent}% completed</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.secondary,
    gap: 8,
    ...shadows.subtle,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textColumn: {
    flex: 1,
  },
  titleText: {
    ...typography.labelMd,
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  subText: {
    ...typography.bodySm,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
});

export default QuickStatsStrip;
