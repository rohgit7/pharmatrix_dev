import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, typography } from '../../theme';

interface StepProgressionBarProps {
  currentStep: 2 | 3 | 4 | 5;
  weightRecorded?: boolean;
  qrVerified?: boolean;
  otpVerified?: boolean;
  proofUploaded?: boolean;
  weightKg?: number;
}

export const StepProgressionBar: React.FC<StepProgressionBarProps> = ({
  currentStep,
  weightRecorded = true,
  qrVerified = false,
  otpVerified = false,
  proofUploaded = false,
  weightKg = 0,
}) => {
  return (
    <View style={styles.container}>
      {/* Step 2: Weigh */}
      <View style={[styles.stepItem, currentStep === 2 && styles.activeStepItem]}>
        <View
          style={[
            styles.stepCircle,
            weightRecorded ? styles.doneCircle : currentStep === 2 ? styles.activeCircle : styles.pendingCircle,
          ]}
        >
          {weightRecorded ? (
            <Ionicons name="checkmark" size={12} color="#FFFFFF" />
          ) : (
            <Text style={styles.stepNumText}>2</Text>
          )}
        </View>
        <View style={styles.stepTextCol}>
          <Text style={[styles.stepTitle, currentStep === 2 && styles.activeStepTitle]} numberOfLines={1}>
            Weigh
          </Text>
          <Text style={[styles.stepSub, weightRecorded && styles.doneStepSub]} numberOfLines={1}>
            {weightKg > 0 ? `${weightKg.toFixed(1)}kg` : (weightRecorded ? 'Recorded' : 'Pending')}
          </Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={10} color={colors.border} />

      {/* Step 3: QR Tag */}
      <View style={[styles.stepItem, currentStep === 3 && styles.activeStepItem]}>
        <View
          style={[
            styles.stepCircle,
            qrVerified ? styles.doneCircle : currentStep === 3 ? styles.activeCircle : styles.pendingCircle,
          ]}
        >
          {qrVerified ? (
            <Ionicons name="checkmark" size={12} color="#FFFFFF" />
          ) : (
            <Text style={[styles.stepNumText, currentStep === 3 && styles.activeNumText]}>3</Text>
          )}
        </View>
        <View style={styles.stepTextCol}>
          <Text style={[styles.stepTitle, currentStep === 3 && styles.activeStepTitle]} numberOfLines={1}>
            QR Tag
          </Text>
          <Text style={[styles.stepSub, qrVerified && styles.doneStepSub]} numberOfLines={1}>
            {qrVerified ? 'Verified' : 'Scan'}
          </Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={10} color={colors.border} />

      {/* Step 4: OTP */}
      <View style={[styles.stepItem, currentStep === 4 && styles.activeStepItem]}>
        <View
          style={[
            styles.stepCircle,
            otpVerified ? styles.doneCircle : currentStep === 4 ? styles.activeCircle : styles.pendingCircle,
          ]}
        >
          {otpVerified ? (
            <Ionicons name="checkmark" size={12} color="#FFFFFF" />
          ) : (
            <Text style={[styles.stepNumText, currentStep === 4 && styles.activeNumText]}>4</Text>
          )}
        </View>
        <View style={styles.stepTextCol}>
          <Text style={[styles.stepTitle, currentStep === 4 && styles.activeStepTitle]} numberOfLines={1}>
            OTP
          </Text>
          <Text style={[styles.stepSub, otpVerified && styles.doneStepSub]} numberOfLines={1}>
            {otpVerified ? 'Valid' : 'Sign'}
          </Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={10} color={colors.border} />

      {/* Step 5: Proof Photo */}
      <View style={[styles.stepItem, currentStep === 5 && styles.activeStepItem]}>
        <View
          style={[
            styles.stepCircle,
            proofUploaded ? styles.doneCircle : currentStep === 5 ? styles.activeCircle : styles.pendingCircle,
          ]}
        >
          {proofUploaded ? (
            <Ionicons name="checkmark" size={12} color="#FFFFFF" />
          ) : (
            <Text style={[styles.stepNumText, currentStep === 5 && styles.activeNumText]}>5</Text>
          )}
        </View>
        <View style={styles.stepTextCol}>
          <Text style={[styles.stepTitle, currentStep === 5 && styles.activeStepTitle]} numberOfLines={1}>
            Proof
          </Text>
          <Text style={[styles.stepSub, proofUploaded && styles.doneStepSub]} numberOfLines={1}>
            {proofUploaded ? 'Photo OK' : 'Capture'}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    gap: 4,
  },
  stepItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
    paddingVertical: 3,
    borderRadius: radii.md,
  },
  activeStepItem: {
    backgroundColor: colors.primaryTint,
    borderWidth: 1,
    borderColor: 'rgba(123, 145, 238, 0.4)',
  },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneCircle: {
    backgroundColor: colors.success,
  },
  activeCircle: {
    backgroundColor: colors.primaryDark,
    borderWidth: 2,
    borderColor: colors.primaryAction,
  },
  pendingCircle: {
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepNumText: {
    ...typography.labelSm,
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  activeNumText: {
    color: '#FFFFFF',
  },
  stepTextCol: {
    flex: 1,
  },
  stepTitle: {
    ...typography.labelSm,
    fontSize: 10,
    fontWeight: '700',
    color: colors.ink,
  },
  activeStepTitle: {
    color: colors.onPrimaryContainer,
  },
  stepSub: {
    ...typography.bodySm,
    fontSize: 8.5,
    color: colors.textSecondary,
    marginTop: 1,
  },
  doneStepSub: {
    color: colors.success,
    fontWeight: '600',
  },
});

export default StepProgressionBar;
