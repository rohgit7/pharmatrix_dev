import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../../theme';

interface ConsignmentWeighingCardProps {
  totalWeight: number;
  onWeightChange: (weight: number) => void;
}

export const ConsignmentWeighingCard: React.FC<ConsignmentWeighingCardProps> = ({
  totalWeight,
  onWeightChange,
}) => {
  const adjustWeight = (delta: number) => {
    const next = Math.max(0.5, Math.round((totalWeight + delta) * 10) / 10);
    onWeightChange(next);
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.scaleIconBox}>
            <Ionicons name="speedometer-outline" size={17} color={colors.primaryDark} />
          </View>
          <View>
            <Text style={styles.title}>Manual Consignment Weighing</Text>
            <Text style={styles.subTitle}>Scale readout • Verified by courier</Text>
          </View>
        </View>

        <View style={styles.recordedBadge}>
          <Ionicons name="checkmark-circle" size={13} color={colors.success} />
          <Text style={styles.recordedText}>Recorded</Text>
        </View>
      </View>

      {/* Total Weight Readout & Step Buttons */}
      <View style={styles.totalBlock}>
        <View>
          <Text style={styles.totalLabel}>CONSIGNMENT TOTAL NET</Text>
          <View style={styles.totalValueRow}>
            <Text style={styles.totalNumber}>{totalWeight.toFixed(1)}</Text>
            <Text style={styles.totalUnit}>kg</Text>
          </View>
        </View>

        <View style={styles.stepperContainer}>
          <TouchableOpacity
            style={styles.stepBtnMinus}
            onPress={() => adjustWeight(-0.5)}
            activeOpacity={0.7}
          >
            <Text style={styles.stepBtnText}>−</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.stepBtnPlus}
            onPress={() => adjustWeight(0.5)}
            activeOpacity={0.7}
          >
            <Text style={styles.stepBtnPlusText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Drum Container Breakdown */}
      <View style={styles.breakdownHeader}>
        <Text style={styles.breakdownTitle}>CONSIGNMENT PACKAGING</Text>
        <Text style={styles.breakdownCount}>Verified Mass Breakdown</Text>
      </View>

      <View style={styles.containersList}>
        {/* Item 1: Regulated Medical Waste */}
        <View style={styles.containerRow}>
          <View style={styles.rowLeft}>
            <View style={[styles.typeIconBox, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="medical" size={15} color="#DC2626" />
            </View>
            <View style={styles.typeInfo}>
              <Text style={styles.typeName}>Regulated Hazardous Waste</Text>
              <Text style={styles.typeSub}>Verified Consignment Package</Text>
            </View>
          </View>
          <View style={styles.weightInputGroup}>
            <TextInput
              style={styles.weightInput}
              value={totalWeight > 0 ? totalWeight.toString() : ''}
              onChangeText={(val) => {
                const n = parseFloat(val) || 0;
                onWeightChange(Math.max(0, Math.round(n * 10) / 10));
              }}
              placeholder="0.0"
              keyboardType="decimal-pad"
            />
            <Text style={styles.weightInputUnit}>kg</Text>
          </View>
        </View>
      </View>
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scaleIconBox: {
    width: 28,
    height: 28,
    borderRadius: radii.md,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(123, 145, 238, 0.3)',
  },
  title: {
    ...typography.headlineSm,
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  subTitle: {
    ...typography.bodySm,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  recordedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.successContainer,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(30, 142, 90, 0.3)',
  },
  recordedText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.success,
    fontWeight: '700',
  },
  totalBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceLow,
    padding: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  totalLabel: {
    ...typography.labelSm,
    fontSize: 10,
    fontWeight: '700',
    color: colors.textOutline,
    letterSpacing: 0.6,
  },
  totalValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 2,
    borderBottomWidth: 2,
    borderBottomColor: colors.primaryDark,
    paddingBottom: 2,
  },
  totalNumber: {
    ...typography.monoNumbers,
    fontSize: 26,
    fontWeight: '700',
    color: colors.ink,
  },
  totalUnit: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    padding: 4,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepBtnMinus: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceLow,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepBtnText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.ink,
  },
  stepBtnPlus: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(123, 145, 238, 0.4)',
  },
  stepBtnPlusText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.onPrimaryContainer,
  },
  breakdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  breakdownTitle: {
    ...typography.labelSm,
    fontSize: 10,
    fontWeight: '700',
    color: colors.textOutline,
    letterSpacing: 0.5,
  },
  breakdownCount: {
    ...typography.bodySm,
    fontSize: 10,
    color: colors.textSecondary,
  },
  containersList: {
    gap: 8,
  },
  containerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 10,
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
  typeIconBox: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeInfo: {
    flex: 1,
  },
  typeName: {
    ...typography.labelMd,
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  typeSub: {
    ...typography.bodySm,
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 1,
  },
  weightInputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  weightInput: {
    width: 54,
    height: 32,
    backgroundColor: colors.canvas,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
    fontSize: 13,
    color: colors.ink,
  },
  weightInputUnit: {
    ...typography.bodySm,
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});

export default ConsignmentWeighingCard;
