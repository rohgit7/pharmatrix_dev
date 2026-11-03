import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography, shadows } from '../../theme';

interface ShiftActionsCardProps {
  onDownloadManifest: () => void;
  onPostTripInspection: () => void;
  onClockOut: () => void;
  isDownloading?: boolean;
}

export const ShiftActionsCard: React.FC<ShiftActionsCardProps> = ({
  onDownloadManifest,
  onPostTripInspection,
  onClockOut,
  isDownloading = false,
}) => {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Shift Actions</Text>

      {/* Button 1: Download Manifest PDF */}
      <TouchableOpacity
        style={styles.actionRow}
        onPress={onDownloadManifest}
        activeOpacity={0.7}
        disabled={isDownloading}
      >
        <View style={styles.rowLeft}>
          <View style={styles.iconBox}>
            <Ionicons name="document-text-outline" size={17} color={colors.primary} />
          </View>
          <Text style={styles.actionTitle}>Download Custody Manifest PDF</Text>
        </View>
        <Ionicons name="download-outline" size={16} color={colors.textMuted} />
      </TouchableOpacity>

      {/* Button 2: Post-Trip Inspection */}
      <TouchableOpacity
        style={styles.actionRow}
        onPress={onPostTripInspection}
        activeOpacity={0.7}
      >
        <View style={styles.rowLeft}>
          <View style={styles.iconBox}>
            <Ionicons name="checkbox-outline" size={17} color={colors.primary} />
          </View>
          <Text style={styles.actionTitle}>Post-Trip Vehicle Verification</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </TouchableOpacity>

      {/* Button 3: Clock Out */}
      <TouchableOpacity
        style={styles.clockOutBtn}
        onPress={onClockOut}
        activeOpacity={0.88}
      >
        <Ionicons name="log-out-outline" size={16} color={colors.error} />
        <Text style={styles.clockOutText}>Clock Out & End Shift</Text>
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
    gap: 10,
    marginBottom: spacing.md,
    ...shadows.subtle,
  },
  title: {
    ...typography.headlineSm,
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    padding: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    ...typography.labelMd,
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  clockOutBtn: {
    backgroundColor: colors.errorContainer,
    borderRadius: radii.md,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.2)',
    marginTop: 2,
  },
  clockOutText: {
    ...typography.labelMd,
    fontSize: 13,
    fontWeight: '700',
    color: colors.onErrorContainer,
  },
});

export default ShiftActionsCard;
