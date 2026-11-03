import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../../theme';

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
        <View style={styles.headerLeft}>
          <View style={styles.scaleIconBox}>
            <Ionicons name="speedometer-outline" size={17} color="#3B52B6" />
          </View>
          <View>
            <Text style={styles.stepTitle}>STEP 2: CONSIGNMENT WEIGHING</Text>
            <Text style={styles.subTitle}>Scale readout • Verified by driver</Text>
          </View>
        </View>

        <View style={[styles.recordedBadge, isRecorded && styles.recordedBadgeActive]}>
          <Ionicons
            name={isRecorded ? 'checkmark-circle' : 'scale-outline'}
            size={13}
            color={isRecorded ? colors.success : '#8A8279'}
          />
          <Text style={[styles.recordedText, isRecorded && styles.recordedTextActive]}>
            {isRecorded ? `${totalWeight.toFixed(1)} kg Recorded` : 'Enter Weight'}
          </Text>
        </View>
      </View>

      {/* Total Weight Readout & Step Buttons */}
      <View style={styles.totalBlock}>
        <View>
          <Text style={styles.totalLabel}>CONSIGNMENT NET MASS</Text>
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
            <Text style={styles.stepBtnText}>-½</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.stepBtnPlus}
            onPress={() => adjustWeight(0.5)}
            activeOpacity={0.7}
          >
            <Text style={styles.stepBtnPlusText}>+½</Text>
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
          <Ionicons name="create-outline" size={15} color="#5C554E" />
          <Text style={styles.manualInputLabel}>Type Exact Weight:</Text>
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
            placeholderTextColor="#A89D91"
            keyboardType="decimal-pad"
          />
          <Text style={styles.weightInputUnit}>kg</Text>
        </View>
      </View>

      {/* Packaging Category breakdown */}
      <View style={styles.breakdownBox}>
        <View style={styles.packagingRow}>
          <View style={styles.wasteIconBox}>
            <Ionicons name="medical" size={15} color="#DC2626" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.wasteTitle}>Regulated Biohazard Pharmaceutical Waste</Text>
            <Text style={styles.wasteSub}>DOT UN3291 • Hazardous Consignment Packaging</Text>
          </View>
          <View style={styles.sealVerifiedPill}>
            <Ionicons name="lock-closed" size={11} color="#3B52B6" />
            <Text style={styles.sealVerifiedText}>Bag Sealed</Text>
          </View>
        </View>
      </View>

      {/* Advance button */}
      {onProceedToQR && isRecorded && (
        <TouchableOpacity
          style={styles.proceedBtn}
          onPress={onProceedToQR}
          activeOpacity={0.85}
        >
          <Text style={styles.proceedBtnText}>Next: Verify QR Tag & Seal</Text>
          <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.xl,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: '#EADFD0',
    shadowColor: '#201E1C',
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
    width: 32,
    height: 32,
    borderRadius: radii.md,
    backgroundColor: '#E5EBFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 82, 182, 0.25)',
  },
  stepTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#3B52B6',
    letterSpacing: 0.4,
  },
  subTitle: {
    ...typography.bodySm,
    fontSize: 11,
    color: '#5C554E',
    marginTop: 1,
  },
  recordedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5EFE6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: '#EADFD0',
  },
  recordedBadgeActive: {
    backgroundColor: '#E8F5E9',
    borderColor: '#C6F6D5',
  },
  recordedText: {
    fontSize: 10,
    color: '#8A8279',
    fontWeight: '700',
  },
  recordedTextActive: {
    color: colors.success,
  },
  totalBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF8F5',
    padding: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#EADFD0',
  },
  totalLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#8A8279',
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
    fontSize: 28,
    fontWeight: '800',
    color: '#201E1C',
  },
  totalUnit: {
    fontSize: 16,
    fontWeight: '800',
    color: '#3B52B6',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stepBtnMinus: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    backgroundColor: '#F5EFE6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EADFD0',
  },
  stepBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#201E1C',
  },
  stepBtnPlus: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    backgroundColor: '#E5EBFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 82, 182, 0.3)',
  },
  stepBtnPlusText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#3B52B6',
  },
  manualInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  inputLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  manualInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5C554E',
  },
  weightInputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weightInput: {
    width: 76,
    height: 36,
    backgroundColor: '#FAF8F5',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#EADFD0',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
    fontSize: 15,
    color: '#201E1C',
  },
  weightInputUnit: {
    fontSize: 12,
    color: '#5C554E',
    fontWeight: '700',
  },
  breakdownBox: {
    backgroundColor: '#FAF8F5',
    padding: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#EADFD0',
  },
  packagingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wasteIconBox: {
    width: 30,
    height: 30,
    borderRadius: radii.sm,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wasteTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#201E1C',
  },
  wasteSub: {
    fontSize: 10,
    color: '#8A8279',
    marginTop: 1,
  },
  sealVerifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E5EBFF',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  sealVerifiedText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#3B52B6',
  },
  proceedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#3B52B6',
    height: 44,
    borderRadius: radii.md,
    marginTop: 4,
  },
  proceedBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});

export default ConsignmentWeighingCard;
