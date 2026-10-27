import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../../theme';

interface ClockOutModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  driverName?: string;
  driverId?: string;
}

export const ClockOutModal: React.FC<ClockOutModalProps> = ({
  visible,
  onClose,
  onConfirm,
  driverName = 'Courier',
  driverId = 'DRV',
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={styles.dialog}>
          {/* Logout Icon */}
          <View style={styles.iconCircle}>
            <Ionicons name="log-out" size={24} color={colors.error} />
          </View>

          {/* Heading */}
          <View style={styles.textCenter}>
            <Text style={styles.title}>Confirm End of Shift</Text>
            <Text style={styles.body}>
              You are about to submit the signed electronic logbook for {driverName} ({driverId}). All custody manifests will lock permanently.
            </Text>
          </View>

          {/* Shift Details Box */}
          <View style={styles.detailsBox}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Shift Status:</Text>
              <Text style={styles.detailVal}>Shift Completed</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Final Custody State:</Text>
              <Text style={styles.detailVal}>Manifests Transferred & Locked</Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.confirmBtn} onPress={onConfirm} activeOpacity={0.88}>
              <Ionicons name="lock-closed" size={16} color="#FFFFFF" />
              <Text style={styles.confirmBtnText}>Yes, Sign & Clock Out</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Cancel & Return to Route</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.gutter,
  },
  dialog: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
    gap: 12,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.errorContainer,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  textCenter: {
    alignItems: 'center',
    gap: 6,
  },
  title: {
    ...typography.headlineSm,
    fontSize: 17,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
  },
  body: {
    ...typography.bodySm,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  detailsBox: {
    backgroundColor: colors.surfaceLow,
    borderRadius: radii.lg,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailLabel: {
    ...typography.bodySm,
    fontSize: 11,
    color: colors.textSecondary,
  },
  detailVal: {
    ...typography.labelMd,
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink,
  },
  actions: {
    gap: 8,
    marginTop: 4,
  },
  confirmBtn: {
    height: 48,
    backgroundColor: colors.error,
    borderRadius: radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  confirmBtnText: {
    ...typography.labelLg,
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  cancelBtn: {
    height: 44,
    backgroundColor: colors.surfaceLow,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelBtnText: {
    ...typography.labelMd,
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});

export default ClockOutModal;
