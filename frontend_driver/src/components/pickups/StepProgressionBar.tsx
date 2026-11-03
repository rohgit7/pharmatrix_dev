import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, typography } from '../../theme';

export type StepNumber = 1 | 2 | 3 | 4 | 5;

interface StepProgressionBarProps {
  currentStep: StepNumber;
  isArrived: boolean;
  weightRecorded: boolean;
  qrVerified: boolean;
  otpVerified: boolean;
  proofUploaded: boolean;
  weightKg?: number;
  onSelectStep?: (step: StepNumber) => void;
}

export const StepProgressionBar: React.FC<StepProgressionBarProps> = ({
  currentStep,
  isArrived,
  weightRecorded = true,
  qrVerified = false,
  otpVerified = false,
  proofUploaded = false,
  weightKg = 0,
  onSelectStep,
}) => {
  const steps: {
    num: StepNumber;
    label: string;
    sub: string;
    done: boolean;
    active: boolean;
    icon: keyof typeof Ionicons.glyphMap;
  }[] = [
    {
      num: 1,
      label: 'Arrive',
      sub: isArrived ? 'Checked In' : 'Pending',
      done: isArrived,
      active: currentStep === 1,
      icon: 'location',
    },
    {
      num: 2,
      label: 'Weigh',
      sub: weightKg > 0 ? `${weightKg.toFixed(1)}kg` : (weightRecorded ? 'Recorded' : 'Enter kg'),
      done: weightRecorded && isArrived,
      active: currentStep === 2,
      icon: 'speedometer',
    },
    {
      num: 3,
      label: 'QR Tag',
      sub: qrVerified ? 'Verified' : 'Scan',
      done: qrVerified,
      active: currentStep === 3,
      icon: 'qr-code',
    },
    {
      num: 4,
      label: 'OTP PIN',
      sub: otpVerified ? 'Signed' : 'Enter',
      done: otpVerified,
      active: currentStep === 4,
      icon: 'keypad',
    },
    {
      num: 5,
      label: 'Proof',
      sub: proofUploaded ? 'Photo OK' : 'Capture',
      done: proofUploaded,
      active: currentStep === 5,
      icon: 'camera',
    },
  ];

  return (
    <View style={styles.container}>
      {steps.map((step, idx) => (
        <React.Fragment key={step.num}>
          <TouchableOpacity
            style={[styles.stepItem, step.active && styles.activeStepItem]}
            onPress={() => onSelectStep?.(step.num)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.stepCircle,
                step.done
                  ? styles.doneCircle
                  : step.active
                  ? styles.activeCircle
                  : styles.pendingCircle,
              ]}
            >
              {step.done ? (
                <Ionicons name="checkmark" size={11} color="#FFFFFF" />
              ) : (
                <Text
                  style={[
                    styles.stepNumText,
                    step.active && styles.activeNumText,
                  ]}
                >
                  {step.num}
                </Text>
              )}
            </View>

            <View style={styles.stepTextCol}>
              <Text
                style={[
                  styles.stepTitle,
                  step.active && styles.activeStepTitle,
                ]}
                numberOfLines={1}
              >
                {step.label}
              </Text>
              <Text
                style={[
                  styles.stepSub,
                  step.done && styles.doneStepSub,
                ]}
                numberOfLines={1}
              >
                {step.sub}
              </Text>
            </View>
          </TouchableOpacity>

          {idx < steps.length - 1 && (
            <Ionicons name="chevron-forward" size={9} color={colors.border} />
          )}
        </React.Fragment>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.xl,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#EADFD0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#201E1C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    gap: 2,
  },
  stepItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 3,
    paddingVertical: 4,
    borderRadius: radii.md,
  },
  activeStepItem: {
    backgroundColor: '#E5EBFF',
    borderWidth: 1,
    borderColor: 'rgba(123, 145, 238, 0.4)',
  },
  stepCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneCircle: {
    backgroundColor: colors.success,
  },
  activeCircle: {
    backgroundColor: '#3B52B6',
    borderWidth: 1.5,
    borderColor: '#7B91EE',
  },
  pendingCircle: {
    backgroundColor: '#F5EFE6',
    borderWidth: 1,
    borderColor: '#EADFD0',
  },
  stepNumText: {
    ...typography.labelSm,
    fontSize: 10,
    color: '#8A8279',
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
    fontSize: 9.5,
    fontWeight: '700',
    color: '#201E1C',
  },
  activeStepTitle: {
    color: '#3B52B6',
  },
  stepSub: {
    ...typography.bodySm,
    fontSize: 8,
    color: '#8A8279',
    marginTop: 0.5,
  },
  doneStepSub: {
    color: colors.success,
    fontWeight: '600',
  },
});

export default StepProgressionBar;
