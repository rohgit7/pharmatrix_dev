import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../../theme';

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
      <Text style={styles.title}>Shift Completion Actions</Text>

      {/* Button 1: Download Custody Manifest PDF */}
      <TouchableOpacity
        style={styles.actionRow}
        onPress={onDownloadManifest}
        activeOpacity={0.7}
        disabled={isDownloading}
      >
        <View style={styles.rowLeft}>
          <View style={styles.pdfIconBox}>
            <Ionicons name="document-text" size={18} color={colors.primaryDark} />
          </View>
          <Text style={styles.actionTitle}>Download Custody Manifest PDF</Text>
        </View>
        <Ionicons name="download-outline" size={18} color={colors.textSecondary} />
      </TouchableOpacity>

      {/* Button 2: Post-Trip Inspection */}
      <TouchableOpacity style={styles.actionRow} onPress={onPostTripInspection} activeOpacity={0.7}>
        <View style={styles.rowLeft}>
          <View style={styles.checkIconBox}>
            <Ionicons name="checkbox-outline" size={18} color={colors.textSecondary} />
          </View>
          <Text style={styles.actionTitle}>Complete Post-Trip Inspection</Text>
        </View>
        <View style={styles.itemsBadge}>
          <Text style={styles.itemsBadgeText}>14/14 Items</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
        </View>
      </TouchableOpacity>

      {/* Button 3: Clock Out & End Shift */}
      <TouchableOpacity style={styles.clockOutBtn} onPress={onClockOut} activeOpacity={0.88}>
        <Ionicons name="time" size={18} color={colors.onErrorContainer} />
        <Text style={styles.clockOutText}>Clock Out & End Shift</Text>
      </TouchableOpacity>
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
    gap: 10,
  },
  title: {
    ...typography.headlineSm,
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceLow,
    padding: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  pdfIconBox: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIconBox: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    ...typography.labelMd,
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink,
  },
  itemsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemsBadgeText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.primaryDark,
    backgroundColor: colors.primaryTint,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.full,
    fontWeight: '700',
  },
  clockOutBtn: {
    backgroundColor: colors.errorContainer,
    borderRadius: radii.lg,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(217, 75, 56, 0.4)',
    marginTop: 2,
  },
  clockOutText: {
    ...typography.labelLg,
    fontSize: 13,
    fontWeight: '700',
    color: colors.onErrorContainer,
  },
});

export default ShiftActionsCard;
