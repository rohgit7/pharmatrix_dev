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
import { colors, radii, spacing, typography } from '../../theme';
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
    activeStop?.collected_weight_kg || activeStop?.estimated_weight_kg || 4.5
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

  // Determine current active step dynamically
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
  }, [activeStop?.id, activeStop?.execution_status, activeStop?.qr_verified, activeStop?.otp_verified, activeStop?.proof_uploaded]);

  const showFeedback = (title: string, sub: string) => {
    setFeedbackBanner({ title, sub });
    setTimeout(() => {
      setFeedbackBanner(null);
    }, 3500);
  };

  // Step 1: Confirm Location Reached with GPS Geofence Check
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
        'Arrival Confirmed • Location Stamped',
        `Checked in at ${activeStop.customer_name || 'Facility'}. Beginning consignment weigh-in.`
      );
      setActiveStepTab(2);
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 220, animated: true });
      }, 300);
    } catch (err: any) {
      Alert.alert('Arrival Check-in Error', err?.message || 'Failed to stamp location arrival.');
    }
  };

  // Step 3: Scan / Match QR
  const handleScanQRSuccess = async (scannedCode: string) => {
    if (!activeStop || !route) return;
    try {
      const res = await scanQR(activeStop.id, scannedCode);
      if (res?.otp) {
        setOtpDigits(res.otp.split(''));
      }
      showFeedback(
        'Pickup QR Verified & Synced',
        'Consignment container sealed & linked to digital chain-of-custody.'
      );
      setActiveStepTab(4);
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 460, animated: true });
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
      showFeedback(
        'Customer Handover PIN Verified',
        'Custody handover digitally authorized by clinic representative.'
      );
      setActiveStepTab(5);
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 700, animated: true });
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
        res.message || 'New 6-digit confirmation PIN generated and sent to customer.'
      );
    } catch (err: any) {
      Alert.alert('Resend Failed', err?.message || 'Could not resend OTP.');
    } finally {
      setIsResendingOtp(false);
    }
  };

  const handlePrintSlip = async () => {
    if (!activeStop) return;
    const success = await printService.printPickupSlip(activeStop, totalWeight);
    if (!success) {
      Alert.alert('Zebra Printer Ready', 'Pickup slip generated. Ready for Bluetooth mobile printer.');
    }
  };

  // Final Action: Complete Pickup & Advance
  const handleCompletePickup = async () => {
    if (!activeStop || !route) return;

    // 0. If stop is already completed, advance directly to the Route Execution page
    if (activeStop.execution_status === 'COMPLETED') {
      showFeedback('Pickup Already Completed', 'Opening Route Execution...');
      onNavigateToTab('routes');
      return;
    }

    if (!isArrived) {
      Alert.alert('Location Check-in Required', 'Please stamp your arrival at the facility (Step 1) before completing this pickup.');
      setActiveStepTab(1);
      return;
    }

    if (totalWeight <= 0) {
      Alert.alert('Weigh-in Required', 'Please enter or confirm the consignment weight (Step 2).');
      setActiveStepTab(2);
      return;
    }

    if (!tamperSealAffixed) {
      Alert.alert('Tamper Seal Required', 'Please confirm that the tamper seal has been attached and locked (Step 3).');
      setActiveStepTab(3);
      return;
    }

    if (!activeStop.qr_verified) {
      Alert.alert('QR Tag Required', 'Please scan or match the consignment QR code (Step 3) before completing this pickup.');
      setActiveStepTab(3);
      return;
    }

    if (!activeStop.otp_verified) {
      const fullOtp = otpDigits.join('').trim();
      if (fullOtp.length === 6) {
        try {
          await handleVerifyOtp(fullOtp);
        } catch (err: any) {
          Alert.alert('Invalid OTP PIN', err?.message || 'Customer confirmation PIN verification failed (Step 4).');
          setActiveStepTab(4);
          return;
        }
      } else {
        Alert.alert('Customer PIN Required', 'Please enter the 6-digit confirmation PIN provided by the clinic representative (Step 4).');
        setActiveStepTab(4);
        return;
      }
    }

    if (!activeStop.proof_uploaded) {
      Alert.alert(
        'Collection Photo Proof Required',
        'Regulations require photo proof of the sealed consignment container (Step 5) before custody transfer can be completed. Tap "Take Photo" or "Instant Specimen Photo".'
      );
      setActiveStepTab(5);
      return;
    }

    setCompletingPickup(true);
    try {
      const res = await completeStop(activeStop.id, totalWeight);
      const nextStop = res?.nextStop;
      const targetLabel = nextStop
        ? (nextStop.stop_type === 'WAREHOUSE'
            ? 'Terminal Facility Handover'
            : `Stop ${nextStop.sequence_number}: ${nextStop.customer_name || 'Next Destination'}`)
        : 'Terminal Handover';

      showFeedback(
        'Pickup Complete • Manifest Sealed',
        `Advancing route to ${targetLabel}...`
      );

      // Always advance to Route Execution page
      setTimeout(() => {
        onNavigateToTab('routes');
      }, 400);
    } catch (err: any) {
      // If backend says the stop was already completed or arrived at, synchronize and advance to Route Execution!
      if (
        err?.message?.includes('already') ||
        err?.message?.includes('arrived at before completion') ||
        err?.status === 400
      ) {
        showFeedback('Pickup Synchronized', 'Opening Route Execution...');
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
      showFeedback('Discrepancy Logged', 'Stop marked with exception. Dispatch alerted.');
      setTimeout(() => {
        onNavigateToTab('routes');
      }, 900);
    } catch (err: any) {
      Alert.alert('Report Error', err?.message || 'Could not record exception.');
    }
  };

  if (isLoading && !route) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3B52B6" />
        <Text style={styles.loadingText}>Synchronizing pickup manifest...</Text>
      </View>
    );
  }

  if (!route) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="cube-outline" size={48} color="#8A8279" />
        <Text style={[typography.headlineSm, { color: '#201E1C', marginTop: 8 }]}>
          No Active Route Assigned
        </Text>
        <Text style={styles.loadingText}>
          You do not have any pending pickup manifests scheduled for today.
        </Text>
        <TouchableOpacity
          style={styles.returnBtn}
          onPress={() => onNavigateToTab('operations')}
        >
          <Ionicons name="arrow-back" size={16} color="#FFFFFF" />
          <Text style={styles.returnBtnText}>Return to Operations</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!activeStop || activeStop.stop_type === 'WAREHOUSE') {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="checkmark-done-circle-outline" size={56} color={colors.success} />
        <Text style={[typography.headlineSm, { color: '#201E1C', marginTop: 8 }]}>
          All Collections Completed!
        </Text>
        <Text style={[styles.loadingText, { textAlign: 'center', maxWidth: 300 }]}>
          All field consignments are secured in vehicle. Proceed to the terminal warehouse to finalize offload and custody transfer.
        </Text>
        <TouchableOpacity
          style={styles.handoverNavBtn}
          onPress={() => onNavigateToTab('routes')}
        >
          <Ionicons name="navigate-outline" size={18} color="#FFFFFF" />
          <Text style={styles.handoverNavBtnText}>View Route Execution & Navigation</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentIdx = route?.stops ? route.stops.findIndex((s) => s.id === activeStop?.id) : -1;
  const nextStopInRoute = route?.stops && currentIdx !== -1 ? route.stops[currentIdx + 1] : null;
  const nextStopLabel = nextStopInRoute
    ? nextStopInRoute.stop_type === 'WAREHOUSE'
      ? 'Terminal Handover'
      : `Stop ${nextStopInRoute.sequence_number}: ${nextStopInRoute.customer_name || 'Next Destination'}`
    : 'Terminal Handover';

  const allStepsSatisfied = isArrived && weightRecorded && qrVerified && otpVerified && proofUploaded;

  return (
    <View style={styles.wrapper}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refreshRoute} tintColor="#3B52B6" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Facility Header Card */}
        <FacilityHeaderCard
          stop={activeStop}
          stopIndex={stats.currentStopIndex}
          totalStops={stats.totalStops}
        />

        {/* Interactive Step Progression Bar (1. Arrive -> 2. Weigh -> 3. QR -> 4. OTP -> 5. Proof) */}
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
            // Smooth scroll to relevant region
            if (step === 1) scrollViewRef.current?.scrollTo({ y: 0, animated: true });
            if (step === 2) scrollViewRef.current?.scrollTo({ y: 160, animated: true });
            if (step === 3) scrollViewRef.current?.scrollTo({ y: 350, animated: true });
            if (step === 4) scrollViewRef.current?.scrollTo({ y: 550, animated: true });
            if (step === 5) scrollViewRef.current?.scrollTo({ y: 750, animated: true });
          }}
        />

        {/* STEP 1: Arrival Check-In Card */}
        <ArrivalCheckInCard
          stop={activeStop}
          stopIndex={stats.currentStopIndex}
          totalStops={stats.totalStops}
          onConfirmArrival={handleConfirmArrival}
          isLoading={actionLoading}
        />

        {/* STEP 2: Consignment Weighing Card */}
        <ConsignmentWeighingCard
          totalWeight={totalWeight}
          onWeightChange={setTotalWeight}
          onProceedToQR={() => {
            setActiveStepTab(3);
            scrollViewRef.current?.scrollTo({ y: 360, animated: true });
          }}
        />

        {/* STEP 3: QR Tag & Tamper Seal Card */}
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
            scrollViewRef.current?.scrollTo({ y: 560, animated: true });
          }}
        />

        {/* STEP 4: Customer OTP Verification Card */}
        <OTPVerificationCard
          otp={otpDigits}
          onChangeOtp={setOtpDigits}
          isVerified={otpVerified}
          onVerify={handleVerifyOtp}
          onResendOtp={handleResendOtp}
          isResending={isResendingOtp}
          isVerifying={isVerifyingOtp}
          pharmacistName={activeStop?.customer_name || 'Clinic Representative'}
          expectedOtp={activeStop?.pickup_code ? activeStop.pickup_code.slice(-6) : undefined}
        />

        {/* STEP 5: Photo Proof of Collection Card */}
        <CollectionProofCard
          stop={activeStop}
          isQrVerified={qrVerified}
          isOtpVerified={otpVerified}
          onProofUploaded={() => {
            showFeedback(
              'Proof Photo Uploaded',
              'Consignment photo securely archived on Pharmatrix Cloud.'
            );
          }}
        />

        {/* Primary Action Button: Complete Pickup & Auto-Advance */}
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
            ) : isStopCompleted ? (
              <>
                <View style={styles.completeTitleRow}>
                  <Ionicons name="checkmark-done-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.completeTitle}>
                    Pickup Completed • Advance to Route Navigation
                  </Text>
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                </View>
                <Text style={styles.completeSub}>
                  Consignment secured • Tap to open Route Execution
                </Text>
              </>
            ) : (
              <>
                <View style={styles.completeTitleRow}>
                  <Ionicons
                    name={allStepsSatisfied ? 'checkmark-circle' : 'checkmark-done-circle'}
                    size={20}
                    color="#FFFFFF"
                  />
                  <Text style={styles.completeTitle}>
                    Complete Pickup & Advance to {nextStopLabel}
                  </Text>
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                </View>
                <Text style={styles.completeSub}>
                  {allStepsSatisfied
                    ? 'All 5 steps verified • Tap to seal manifest & launch next stop'
                    : 'Transfers legal custody & automatically advances route'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Secondary Action: Report Issue / Discrepancy */}
        <TouchableOpacity
          style={styles.discrepancyBtn}
          onPress={() => setDiscrepancyModalVisible(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="warning-outline" size={15} color={colors.error} />
          <Text style={styles.discrepancyText}>Report Issue / Discrepancy</Text>
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
        isLoading={actionLoading}
      />

      {/* Floating Animated Feedback Toast */}
      {feedbackBanner && (
        <View style={styles.feedbackToast}>
          <Ionicons name="checkmark-circle" size={24} color="#7B91EE" />
          <View style={{ flex: 1 }}>
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
    backgroundColor: '#FDFBF8',
  },
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.gutter,
    gap: 12,
    paddingBottom: 36,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDFBF8',
    gap: 10,
    padding: 24,
  },
  loadingText: {
    ...typography.bodySm,
    color: '#5C554E',
    fontSize: 12,
  },
  returnBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#3B52B6',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: radii.md,
  },
  returnBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  handoverNavBtn: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#3B52B6',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: radii.md,
  },
  handoverNavBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  completeActionBox: {
    marginTop: 6,
  },
  completeBtn: {
    backgroundColor: '#3B52B6',
    minHeight: 56,
    borderRadius: radii.xl,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3B52B6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  completeBtnReady: {
    backgroundColor: '#1E8E5A',
    shadowColor: '#1E8E5A',
  },
  completeBtnDisabled: {
    opacity: 0.65,
  },
  completeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  completeTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  completeSub: {
    fontSize: 11,
    color: '#E5EBFF',
    marginTop: 3,
    textAlign: 'center',
  },
  discrepancyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    alignSelf: 'center',
  },
  discrepancyText: {
    fontSize: 12,
    color: colors.error,
    fontWeight: '700',
  },
  feedbackToast: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    backgroundColor: '#201E1C',
    borderRadius: radii.xl,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#7B91EE',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
    zIndex: 100,
  },
  feedbackTitle: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  feedbackSub: {
    fontSize: 11,
    color: '#D1D5DB',
    marginTop: 1,
  },
});

export default PickupsScreen;
