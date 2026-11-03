import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography, shadows } from '../../theme';

interface DiscrepancyModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  isLoading?: boolean;
}

const PRESET_ISSUES = [
  'Weight discrepancy (>10% variance)',
  'Customer / Pharmacist unavailable',
  'Packaging damage or leak observed',
  'Access restricted / gate closed',
];

export const DiscrepancyModal: React.FC<DiscrepancyModalProps> = ({
  visible,
  onClose,
  onSubmit,
  isLoading = false,
}) => {
  const [selectedIssue, setSelectedIssue] = useState<string>('');
  const [customNotes, setCustomNotes] = useState<string>('');

  const handleSelect = (issue: string) => {
    setSelectedIssue(issue);
  };

  const handleConfirm = () => {
    const finalReason = customNotes.trim()
      ? `${selectedIssue || 'Operational Exception'}: ${customNotes.trim()}`
      : selectedIssue || 'Operational Exception reported by driver';
    onSubmit(finalReason);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Ionicons name="warning-outline" size={18} color={colors.warning} />
              <Text style={styles.title}>Report Exception</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Preset Buttons */}
          <View style={styles.presetsList}>
            {PRESET_ISSUES.map((issue) => {
              const isSelected = selectedIssue === issue;
              return (
                <TouchableOpacity
                  key={issue}
                  style={[styles.issueBtn, isSelected && styles.issueBtnSelected]}
                  onPress={() => handleSelect(issue)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.issueBtnText, isSelected && styles.issueBtnTextSelected]}>
                    {issue}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={16} color={colors.primaryAccent} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Additional Notes */}
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>Notes</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Provide additional details..."
              placeholderTextColor={colors.textOutline}
              multiline
              numberOfLines={3}
              value={customNotes}
              onChangeText={setCustomNotes}
            />
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[
                styles.submitBtn,
                !selectedIssue && !customNotes.trim() && styles.submitBtnDisabled,
              ]}
              onPress={handleConfirm}
              disabled={isLoading || (!selectedIssue && !customNotes.trim())}
              activeOpacity={0.88}
            >
              <Ionicons name="alert-circle-outline" size={16} color="#FFFFFF" />
              <Text style={styles.submitBtnText}>
                {isLoading ? 'Submitting...' : 'Submit Exception'}
              </Text>
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
    justifyContent: 'center',
    padding: spacing.gutter,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.secondary,
    gap: 10,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
    ...shadows.modal,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.secondary,
    paddingBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    ...typography.headlineSm,
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  presetsList: {
    gap: 6,
  },
  issueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    padding: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  issueBtnSelected: {
    backgroundColor: colors.lightAccent,
    borderColor: colors.primaryAccent,
  },
  issueBtnText: {
    ...typography.labelMd,
    fontSize: 12,
    color: colors.primary,
    flex: 1,
  },
  issueBtnTextSelected: {
    fontWeight: '700',
  },
  notesBox: {
    gap: 4,
  },
  notesLabel: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '700',
  },
  notesInput: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.secondary,
    padding: 8,
    fontSize: 12,
    color: colors.primary,
    textAlignVertical: 'top',
    minHeight: 56,
  },
  actions: {
    gap: 6,
    marginTop: 4,
  },
  submitBtn: {
    backgroundColor: colors.error,
    height: 44,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    ...typography.labelMd,
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  cancelBtn: {
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  cancelBtnText: {
    ...typography.labelMd,
    fontSize: 12,
    color: colors.primary,
  },
});

export default DiscrepancyModal;
