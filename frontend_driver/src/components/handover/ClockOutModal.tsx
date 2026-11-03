import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography, shadows } from '../../theme';

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
  driverName = 'Driver',
  driverId = 'DRV',
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={styles.dialog}>
          {/* Icon */}
          <View style={styles.iconCircle}>
            <Ionicons name="log-out-outline" size={22} color={colors.error} />
          </View>

          {/* Heading */}
          <View style={styles.textCenter}>
            <Text style={styles.title}>Confirm End of Shift</Text>
            <Text style={styles.body}>
              End shift and clock out for {driverName} ({driverId})?
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={onConfirm}
              activeOpacity={0.88}
            >
              <Text style={styles.confirmBtnText}>Yes, Clock Out</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
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
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.secondary,
    gap: 12,
    ...shadows.modal,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.errorContainer,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  textCenter: {
    alignItems: 'center',
    gap: 4,
  },
  title: {
    ...typography.headlineSm,
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
  },
  body: {
    ...typography.bodySm,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  actions: {
    gap: 8,
    marginTop: 4,
  },
  confirmBtn: {
    height: 44,
    backgroundColor: colors.error,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    ...typography.labelMd,
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  cancelBtn: {
    height: 40,
    backgroundColor: colors.background,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  cancelBtnText: {
    ...typography.labelMd,
    fontSize: 12,
    color: colors.primary,
  },
});

export default ClockOutModal;
