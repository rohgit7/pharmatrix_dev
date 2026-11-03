import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography, shadows } from '../../theme';

interface ConsignmentWeighingCardProps {
  totalWeight: number;
  onWeightChange: (weight: number) => void;
  onProceedToQR?: () => void;
}

export const ConsignmentWeighingCard: React.FC<ConsignmentWeighingCardProps> = ({
  totalWeight,
  onWeightChange,
  onProceedToQR,
}) => {
  const adjustWeight = (delta: number) => {
    const next = Math.max(0.1, Math.round((totalWeight + delta) * 10) / 10);
    onWeightChange(next);
  };

  const isRecorded = totalWeight > 0;

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>STEP 2: CONSIGNMENT WEIGHING</Text>
        </View>

        <View style={[styles.recordedBadge, isRecorded && styles.recordedBadgeActive]}>
          <Ionicons
            name={isRecorded ? 'checkmark-circle' : 'scale-outline'}
            size={12}
            color={isRecorded ? colors.success : colors.textMuted}
          />
          <Text style={[styles.recordedText, isRecorded && styles.recordedTextActive]}>
            {isRecorded ? `${totalWeight.toFixed(1)} kg Recorded` : 'Enter Weight'}
          </Text>
        </View>
      </View>

      {/* Total Weight Readout & Step Buttons */}
      <View style={styles.totalBlock}>
        <View>
          <Text style={styles.totalLabel}>NET MASS</Text>
          <View style={styles.totalValueRow}>
            <Text style={styles.totalNumber}>{totalWeight.toFixed(1)}</Text>
            <Text style={styles.totalUnit}>kg</Text>
          </View>
        </View>

        {/* Stepper controls */}
        <View style={styles.stepperContainer}>
          <TouchableOpacity
            style={styles.stepBtnMinus}
            onPress={() => adjustWeight(-1.0)}
            activeOpacity={0.7}
          >
            <Text style={styles.stepBtnText}>-1</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.stepBtnMinus}
            onPress={() => adjustWeight(-0.5)}
            activeOpacity={0.7}
          >
            <Text style={styles.stepBtnText}>-0.5</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.stepBtnPlus}
            onPress={() => adjustWeight(0.5)}
            activeOpacity={0.7}
          >
            <Text style={styles.stepBtnPlusText}>+0.5</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.stepBtnPlus}
            onPress={() => adjustWeight(1.0)}
            activeOpacity={0.7}
          >
            <Text style={styles.stepBtnPlusText}>+1</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Manual Input Row */}
      <View style={styles.manualInputRow}>
        <View style={styles.inputLabelGroup}>
          <Ionicons name="create-outline" size={15} color={colors.textSecondary} />
          <Text style={styles.manualInputLabel}>Type Exact Weight</Text>
        </View>

        <View style={styles.weightInputGroup}>
          <TextInput
            style={styles.weightInput}
            value={totalWeight > 0 ? totalWeight.toString() : ''}
            onChangeText={(val) => {
              const cleaned = val.replace(/[^0-9.]/g, '');
              const n = parseFloat(cleaned) || 0;
              onWeightChange(Math.max(0, Math.round(n * 10) / 10));
            }}
            placeholder="0.0"
            placeholderTextColor={colors.textOutline}
            keyboardType="decimal-pad"
          />
          <Text style={styles.weightInputUnit}>kg</Text>
        </View>
      </View>

      {/* Category info */}
      <View style={styles.categoryBox}>
        <Ionicons name="shield-outline" size={14} color={colors.primaryAccent} />
        <Text style={styles.categoryText}>Regulated Biomedical Waste</Text>
      </View>

      {/* Advance button */}
      {onProceedToQR && isRecorded && (
        <TouchableOpacity
          style={styles.proceedBtn}
          onPress={onProceedToQR}
          activeOpacity={0.85}
        >
          <Text style={styles.proceedBtnText}>Confirm Weight & Proceed to QR Tag</Text>
          <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
        </TouchableOpacity>
      )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepBadge: {
    backgroundColor: colors.lightAccent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.xs,
  },
  stepBadgeText: {
    ...typography.labelSm,
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  recordedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.secondary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  recordedBadgeActive: {
    backgroundColor: colors.successContainer,
    borderColor: 'rgba(22, 163, 74, 0.2)',
  },
  recordedText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  recordedTextActive: {
    color: colors.success,
  },
  totalBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderRadius: radii.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  totalLabel: {
    ...typography.labelSm,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  totalValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 2,
  },
  totalNumber: {
    ...typography.monoNumbers,
    fontSize: 26,
    color: colors.primary,
  },
  totalUnit: {
    ...typography.bodySm,
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  stepperContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  stepBtnMinus: {
    width: 38,
    height: 38,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnPlus: {
    width: 38,
    height: 38,
    borderRadius: radii.sm,
    backgroundColor: colors.lightAccent,
    borderWidth: 1,
    borderColor: 'rgba(123, 145, 238, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    ...typography.labelMd,
    fontSize: 12,
    color: colors.primary,
  },
  stepBtnPlusText: {
    ...typography.labelMd,
    fontSize: 12,
    color: colors.primary,
  },
  manualInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  manualInputLabel: {
    ...typography.bodySm,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  weightInputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.secondary,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    height: 38,
    gap: 4,
  },
  weightInput: {
    ...typography.monoNumbers,
    fontSize: 15,
    color: colors.primary,
    minWidth: 50,
    textAlign: 'right',
    padding: 0,
  },
  weightInputUnit: {
    ...typography.bodySm,
    fontSize: 12,
    color: colors.textMuted,
  },
  categoryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  categoryText: {
    ...typography.bodySm,
    fontSize: 11,
    color: colors.textSecondary,
  },
  proceedBtn: {
    backgroundColor: colors.primaryAccent,
    height: 42,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  proceedBtnText: {
    ...typography.labelMd,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default ConsignmentWeighingCard;
