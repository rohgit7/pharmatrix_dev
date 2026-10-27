import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../../theme';

interface DiscrepancyModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  isLoading?: boolean;
}

const PRESET_ISSUES = [
  'Weight Mismatch (>10% discrepancy)',
  'Customer OTP Unavailable / Pharmacist Absent',
  'Container Seal Damaged or Leaking',
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
      ? `${selectedIssue || 'Operational Discrepancy'}: ${customNotes.trim()}`
      : selectedIssue || 'Operational Discrepancy reported by courier';
    onSubmit(finalReason);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Ionicons name="warning-outline" size={20} color={colors.error} />
              <Text style={styles.title}>Log Field Discrepancy</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.prompt}>Select issue to notify Dispatch immediately:</Text>

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
                  {isSelected && <Ionicons name="checkmark-circle" size={16} color={colors.primaryDark} />}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Additional Notes */}
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>Additional Context / Observations:</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="e.g., Clinic supervisor unavailable until 3 PM..."
              placeholderTextColor={colors.textOutline}
              multiline
              numberOfLines={3}
              value={customNotes}
              onChangeText={setCustomNotes}
            />
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[
                styles.submitBtn,
                (!selectedIssue && !customNotes.trim()) && styles.submitBtnDisabled,
              ]}
              onPress={handleConfirm}
              disabled={isLoading || (!selectedIssue && !customNotes.trim())}
              activeOpacity={0.88}
            >
              <Ionicons name="alert-circle" size={17} color="#FFFFFF" />
              <Text style={styles.submitBtnText}>
                {isLoading ? 'Submitting...' : 'Submit Field Exception'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Cancel & Return</Text>
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
    justifyContent: 'flex-end',
    padding: spacing.gutter,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
    gap: 12,
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    ...typography.headlineSm,
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },
  prompt: {
    ...typography.bodySm,
    fontSize: 12,
    color: colors.textSecondary,
  },
  presetsList: {
    gap: 8,
  },
  issueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceLow,
    padding: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  issueBtnSelected: {
    backgroundColor: colors.primaryTint,
    borderColor: colors.primaryAction,
  },
  issueBtnText: {
    ...typography.labelMd,
    fontSize: 12,
    color: colors.ink,
    flex: 1,
  },
  issueBtnTextSelected: {
    color: colors.onPrimaryContainer,
    fontWeight: '700',
  },
  notesBox: {
    gap: 4,
  },
  notesLabel: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.textOutline,
    fontWeight: '700',
  },
  notesInput: {
    backgroundColor: colors.surfaceLow,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
    fontSize: 12,
    color: colors.ink,
    textAlignVertical: 'top',
    minHeight: 60,
  },
  actions: {
    gap: 8,
    marginTop: 4,
  },
  submitBtn: {
    backgroundColor: colors.error,
    height: 48,
    borderRadius: radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    ...typography.labelLg,
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  cancelBtn: {
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceLow,
  },
  cancelBtnText: {
    ...typography.labelMd,
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});

export default DiscrepancyModal;
