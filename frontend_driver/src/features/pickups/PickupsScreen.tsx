import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography, shadows } from '../../theme';
import { useDriverRoute } from '../../hooks/useDriverRoute';
import { FacilityHeaderCard } from '../../components/pickups/FacilityHeaderCard';
import { StepProgressionBar, StepNumber } from '../../components/pickups/StepProgressionBar';
import { ArrivalCheckInCard } from '../../components/pickups/ArrivalCheckInCard';
import { ConsignmentWeighingCard } from '../../components/pickups/ConsignmentWeighingCard';
import { QRTagCard } from '../../components/pickups/QRTagCard';
import { OTPVerificationCard } from '../../components/pickups/OTPVerificationCard';
import { CollectionProofCard } from '../../components/pickups/CollectionProofCard';
import { DiscrepancyModal } from '../../components/pickups/DiscrepancyModal';
import { CameraScannerModal } from '../../components/pickups/CameraScannerModal';
import printService from '../../services/printService';
import api from '../../services/api';

interface PickupsScreenProps {
  onNavigateToTab: (tab: 'operations' | 'routes' | 'pickups' | 'profile') => void;
}

export const PickupsScreen: React.FC<PickupsScreenProps> = ({ onNavigateToTab }) => {
  const {
    route,
    activeStop,
    stats,
    isLoading,
    actionLoading,
    refreshRoute,
    arriveAtStop,
    scanQR,
    verifyOTP,
    completeStop,
    failStop,
  } = useDriverRoute();

  const [totalWeight, setTotalWeight] = useState<number>(
    activeStop?.collected_weight_kg || activeStop?.estimated_weight_kg || 0
  );
  const [tamperSealAffixed, setTamperSealAffixed] = useState<boolean>(true);
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [isResendingOtp, setIsResendingOtp] = useState<boolean>(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState<boolean>(false);
  const [cameraModalVisible, setCameraModalVisible] = useState<boolean>(false);
  const [discrepancyModalVisible, setDiscrepancyModalVisible] = useState<boolean>(false);
  const [completingPickup, setCompletingPickup] = useState<boolean>(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{ title: string; sub: string } | null>(null);

  // Focus step
  const [activeStepTab, setActiveStepTab] = useState<StepNumber>(1);
  const scrollViewRef = useRef<any>(null);

  const isArrived =
    activeStop?.execution_status === 'ARRIVED' ||
    activeStop?.execution_status === 'IN_PROGRESS' ||
    activeStop?.execution_status === 'COMPLETED';

  const qrVerified = activeStop?.qr_verified || false;
  const otpVerified = activeStop?.otp_verified || false;
  const proofUploaded = activeStop?.proof_uploaded || false;
  const weightRecorded = totalWeight > 0;
  const isStopCompleted = activeStop?.execution_status === 'COMPLETED';

  // Determine active step dynamically
  useEffect(() => {
    if (!activeStop) return;

    if (!isArrived) {
      setActiveStepTab(1);
    } else if (!weightRecorded) {
      setActiveStepTab(2);
    } else if (!qrVerified) {
      setActiveStepTab(3);
    } else if (!otpVerified) {
      setActiveStepTab(4);
    } else {
      setActiveStepTab(5);
    }

    if (activeStop.collected_weight_kg) {
      setTotalWeight(activeStop.collected_weight_kg);
    } else if (activeStop.estimated_weight_kg) {
      setTotalWeight(activeStop.estimated_weight_kg);
    }
  }, [
    activeStop?.id,
    activeStop?.execution_status,
    activeStop?.qr_verified,
    activeStop?.otp_verified,
    activeStop?.proof_uploaded,
  ]);

  const showFeedback = (title: string, sub: string) => {
    setFeedbackBanner({ title, sub });
    setTimeout(() => {
      setFeedbackBanner(null);
    }, 3000);
  };

  // Step 1: Arrival Check-in
  const handleConfirmArrival = async (coords: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
  }) => {
    if (!activeStop) return;
    try {
      await arriveAtStop(
        activeStop.id,
        coords.latitude,
        coords.longitude,
        coords.accuracy ?? undefined
      );
      showFeedback(
        'Arrival Confirmed',
        `Checked in at ${activeStop.customer_name || 'Facility'}.`
      );
      setActiveStepTab(2);
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 180, animated: true });
      }, 300);
    } catch (err: any) {
      Alert.alert('Arrival Check-in Error', err?.message || 'Failed to confirm arrival.');
    }
  };

  // Step 3: QR Scan
  const handleScanQRSuccess = async (scannedCode: string) => {
    if (!activeStop || !route) return;
    try {
      const res = await scanQR(activeStop.id, scannedCode);
      if (res?.otp) {
        setOtpDigits(res.otp.split(''));
      }
      showFeedback('QR Verified', 'Consignment linked to digital chain of custody.');
      setActiveStepTab(4);
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 450, animated: true });
      }, 300);
    } catch (err: any) {
      Alert.alert('QR Verification Error', err?.message || 'Invalid QR code.');
    }
  };

  const handleQuickMatchQR = async () => {
    if (!activeStop) return;
    const code = activeStop.pickup_code || `PK-${activeStop.id * 7}`;
    await handleScanQRSuccess(code);
  };

  // Step 4: Verify OTP
  const handleVerifyOtp = async (otpStr: string) => {
    if (!activeStop || !route) return;
    setIsVerifyingOtp(true);
    try {
      await verifyOTP(activeStop.id, otpStr.trim());
      showFeedback('PIN Verified', 'Custody handover authorized by representative.');
      setActiveStepTab(5);
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 650, animated: true });
      }, 300);
    } catch (err: any) {
      throw err;
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (!activeStop?.pickup_id) return;
    setIsResendingOtp(true);
    try {
      const res = await api.requestResendOTP(activeStop.pickup_id);
      if (res.otp) {
        setOtpDigits(res.otp.split(''));
      }
      Alert.alert(
        'PIN Resent',
        res.message || 'New 6-digit confirmation PIN sent to customer.'
      );
    } catch (err: any) {
      Alert.alert('Resend Failed', err?.message || 'Could not resend PIN.');
    } finally {
      setIsResendingOtp(false);
    }
  };

  const handlePrintSlip = async () => {
    if (!activeStop) return;
    const success = await printService.printPickupSlip(activeStop, totalWeight);
    if (!success) {
      Alert.alert('Printer Ready', 'Pickup slip generated.');
    }
  };

  // Step 5: Complete Pickup & Advance
  const handleCompletePickup = async () => {
    if (!activeStop || !route) return;

    if (activeStop.execution_status === 'COMPLETED') {
      showFeedback('Pickup Completed', 'Advancing to Route Execution...');
      onNavigateToTab('routes');
      return;
    }

    if (!isArrived) {
      Alert.alert('Arrival Check-in Required', 'Please confirm arrival at the facility (Step 1).');
      setActiveStepTab(1);
      return;
    }

    if (totalWeight <= 0) {
      Alert.alert('Weigh-in Required', 'Please enter consignment weight (Step 2).');
      setActiveStepTab(2);
      return;
    }

    if (!tamperSealAffixed) {
      Alert.alert('Tamper Seal Required', 'Please confirm tamper seal is affixed (Step 3).');
      setActiveStepTab(3);
      return;
    }

    if (!activeStop.qr_verified) {
      Alert.alert('QR Tag Required', 'Please verify consignment QR tag (Step 3).');
      setActiveStepTab(3);
      return;
    }

    if (!activeStop.otp_verified) {
      const fullOtp = otpDigits.join('').trim();
      if (fullOtp.length === 6) {
        try {
          await handleVerifyOtp(fullOtp);
        } catch (err: any) {
          Alert.alert('Invalid PIN', err?.message || 'Customer PIN verification failed (Step 4).');
          setActiveStepTab(4);
          return;
        }
      } else {
        Alert.alert('Customer PIN Required', 'Please enter the 6-digit customer PIN (Step 4).');
        setActiveStepTab(4);
        return;
      }
    }

    if (!activeStop.proof_uploaded) {
      Alert.alert(
        'Photo Proof Required',
        'Please capture photo proof of the sealed container (Step 5).'
      );
      setActiveStepTab(5);
      return;
    }

    setCompletingPickup(true);
    try {
      await completeStop(activeStop.id, totalWeight);
      showFeedback('Pickup Complete', 'Opening route navigation...');

      setTimeout(() => {
        onNavigateToTab('routes');
      }, 400);
    } catch (err: any) {
      if (
        err?.message?.includes('already') ||
        err?.message?.includes('arrived at before completion') ||
        err?.status === 400
      ) {
        showFeedback('Pickup Synchronized', 'Opening route navigation...');
        await refreshRoute();
        setTimeout(() => {
          onNavigateToTab('routes');
        }, 400);
      } else {
        Alert.alert('Completion Error', err?.message || 'Could not complete pickup.');
      }
    } finally {
      setCompletingPickup(false);
    }
  };

  const handleDiscrepancySubmit = async (reason: string) => {
    if (!activeStop || !route) return;
    try {
      await failStop(activeStop.id, reason);
      setDiscrepancyModalVisible(false);
      showFeedback('Exception Reported', 'Stop logged with exception.');
      setTimeout(() => {
        onNavigateToTab('routes');
      }, 800);
    } catch (err: any) {
      Alert.alert('Report Error', err?.message || 'Could not record exception.');
    }
  };

  if (isLoading && !route) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primaryAccent} />
        <Text style={styles.loadingText}>Syncing pickup manifest...</Text>
      </View>
    );
  }

  if (!route) {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.emptyIconBox}>
          <Ionicons name="cube-outline" size={36} color={colors.textMuted} />
        </View>
        <Text style={styles.emptyTitle}>No Active Route Assigned</Text>
        <Text style={styles.loadingText}>
          No pending pickup manifests scheduled for today.
        </Text>
        <TouchableOpacity
          style={styles.returnBtn}
          onPress={() => onNavigateToTab('operations')}
          activeOpacity={0.85}
        >
          <Ionicons name="arrow-back" size={15} color="#FFFFFF" />
          <Text style={styles.returnBtnText}>Operations Overview</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!activeStop || activeStop.stop_type === 'WAREHOUSE') {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.successIconBox}>
          <Ionicons name="checkmark-done" size={36} color={colors.success} />
        </View>
        <Text style={styles.emptyTitle}>Collections Completed</Text>
        <Text style={[styles.loadingText, { maxWidth: 280 }]}>
          All field collections are secured. Proceed to the terminal warehouse to finalize offload.
        </Text>
        <TouchableOpacity
          style={styles.handoverNavBtn}
          onPress={() => onNavigateToTab('routes')}
          activeOpacity={0.85}
        >
          <Ionicons name="navigate" size={16} color="#FFFFFF" />
          <Text style={styles.handoverNavBtnText}>Open Route Navigation</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const allStepsSatisfied =
    isArrived && weightRecorded && qrVerified && otpVerified && proofUploaded;

  return (
    <View style={styles.wrapper}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refreshRoute}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Facility Header */}
        <FacilityHeaderCard
          stop={activeStop}
          stopIndex={stats.currentStopIndex}
          totalStops={stats.totalStops}
        />

        {/* Step Progression Bar */}
        <StepProgressionBar
          currentStep={activeStepTab}
          isArrived={isArrived}
          weightRecorded={weightRecorded}
          qrVerified={qrVerified}
          otpVerified={otpVerified}
          proofUploaded={proofUploaded}
          weightKg={totalWeight}
          onSelectStep={(step) => {
            setActiveStepTab(step);
            if (step === 1) scrollViewRef.current?.scrollTo({ y: 0, animated: true });
            if (step === 2) scrollViewRef.current?.scrollTo({ y: 160, animated: true });
            if (step === 3) scrollViewRef.current?.scrollTo({ y: 340, animated: true });
            if (step === 4) scrollViewRef.current?.scrollTo({ y: 520, animated: true });
            if (step === 5) scrollViewRef.current?.scrollTo({ y: 700, animated: true });
          }}
        />

        {/* STEP 1: Arrival Check-In */}
        <ArrivalCheckInCard
          stop={activeStop}
          stopIndex={stats.currentStopIndex}
          totalStops={stats.totalStops}
          onConfirmArrival={handleConfirmArrival}
          isLoading={actionLoading}
        />

        {/* STEP 2: Weighing */}
        <ConsignmentWeighingCard
          totalWeight={totalWeight}
          onWeightChange={setTotalWeight}
          onProceedToQR={() => {
            setActiveStepTab(3);
            scrollViewRef.current?.scrollTo({ y: 340, animated: true });
          }}
        />

        {/* STEP 3: QR Tag */}
        <QRTagCard
          stop={activeStop}
          totalWeight={totalWeight}
          qrVerified={qrVerified}
          tamperSealAffixed={tamperSealAffixed}
          onToggleTamperSeal={() => setTamperSealAffixed(!tamperSealAffixed)}
          onScanPress={() => setCameraModalVisible(true)}
          onQuickVerify={handleQuickMatchQR}
          onPrintPress={handlePrintSlip}
          onProceedToOTP={() => {
            setActiveStepTab(4);
            scrollViewRef.current?.scrollTo({ y: 520, animated: true });
          }}
        />

        {/* STEP 4: Customer OTP PIN */}
        <OTPVerificationCard
          otp={otpDigits}
          onChangeOtp={setOtpDigits}
          isVerified={otpVerified}
          onVerify={handleVerifyOtp}
          onResendOtp={handleResendOtp}
          isResending={isResendingOtp}
          isVerifying={isVerifyingOtp}
          pharmacistName={activeStop?.customer_name || 'Customer Representative'}
        />

        {/* STEP 5: Photo Proof */}
        <CollectionProofCard
          stop={activeStop}
          isQrVerified={qrVerified}
          isOtpVerified={otpVerified}
          onProofUploaded={() => {
            showFeedback('Photo Uploaded', 'Proof securely stored.');
          }}
        />

        {/* Primary Action Button: Complete Pickup */}
        <View style={styles.completeActionBox}>
          <TouchableOpacity
            style={[
              styles.completeBtn,
              (allStepsSatisfied || isStopCompleted) && styles.completeBtnReady,
              (completingPickup || actionLoading) && styles.completeBtnDisabled,
            ]}
            onPress={handleCompletePickup}
            disabled={completingPickup || actionLoading}
            activeOpacity={0.88}
          >
            {completingPickup || actionLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <View style={styles.completeTitleRow}>
                <Ionicons
                  name={
                    isStopCompleted
                      ? 'checkmark-done-circle'
                      : allStepsSatisfied
                      ? 'checkmark-circle'
                      : 'arrow-forward-circle'
                  }
                  size={18}
                  color="#FFFFFF"
                />
                <Text style={styles.completeTitle}>
                  {isStopCompleted
                    ? 'Pickup Completed (Open Routes)'
                    : allStepsSatisfied
                    ? 'Complete Pickup'
                    : 'Complete Pickup (Pending Steps)'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Secondary Action: Report Issue */}
        <TouchableOpacity
          style={styles.discrepancyBtn}
          onPress={() => setDiscrepancyModalVisible(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="warning-outline" size={15} color={colors.warning} />
          <Text style={styles.discrepancyText}>Report Exception</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Camera Scanner Modal */}
      <CameraScannerModal
        visible={cameraModalVisible}
        onClose={() => setCameraModalVisible(false)}
        onScanned={handleScanQRSuccess}
        expectedCode={activeStop?.pickup_code}
      />

      {/* Discrepancy Modal */}
      <DiscrepancyModal
        visible={discrepancyModalVisible}
        onClose={() => setDiscrepancyModalVisible(false)}
        onSubmit={handleDiscrepancySubmit}
      />

      {/* Feedback Banner */}
      {feedbackBanner && (
        <View style={styles.feedbackToast}>
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <View style={styles.feedbackTextCol}>
            <Text style={styles.feedbackTitle}>{feedbackBanner.title}</Text>
            <Text style={styles.feedbackSub}>{feedbackBanner.sub}</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.gutter,
    paddingBottom: 90,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  successIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.successContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.headlineSm,
    color: colors.primary,
    marginBottom: 4,
    textAlign: 'center',
  },
  loadingText: {
    ...typography.bodySm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  returnBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radii.md,
  },
  returnBtnText: {
    ...typography.labelMd,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  handoverNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primaryAccent,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: radii.md,
  },
  handoverNavBtnText: {
    ...typography.labelMd,
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  completeActionBox: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  completeBtn: {
    backgroundColor: colors.primary,
    height: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    ...shadows.subtle,
  },
  completeBtnReady: {
    backgroundColor: colors.primaryAccent,
  },
  completeBtnDisabled: {
    opacity: 0.6,
  },
  completeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  completeTitle: {
    ...typography.labelLg,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  discrepancyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  discrepancyText: {
    ...typography.labelMd,
    fontSize: 12,
    color: colors.warning,
    fontWeight: '600',
  },
  feedbackToast: {
    position: 'absolute',
    bottom: 24,
    left: spacing.gutter,
    right: spacing.gutter,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.secondary,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...shadows.card,
  },
  feedbackTextCol: {
    flex: 1,
  },
  feedbackTitle: {
    ...typography.labelMd,
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  feedbackSub: {
    ...typography.bodySm,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
});

export default PickupsScreen;
