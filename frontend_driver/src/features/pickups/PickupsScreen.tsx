import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../../theme';
import { useDriverRoute } from '../../hooks/useDriverRoute';
import { FacilityHeaderCard } from '../../components/pickups/FacilityHeaderCard';
import { StepProgressionBar } from '../../components/pickups/StepProgressionBar';
import { ConsignmentWeighingCard } from '../../components/pickups/ConsignmentWeighingCard';
import { QRTagCard } from '../../components/pickups/QRTagCard';
import { OTPVerificationCard } from '../../components/pickups/OTPVerificationCard';
import { DiscrepancyModal } from '../../components/pickups/DiscrepancyModal';
import { CameraScannerModal } from '../../components/pickups/CameraScannerModal';
import { CollectionProofCard } from '../../components/pickups/CollectionProofCard';
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
  const [cameraModalVisible, setCameraModalVisible] = useState<boolean>(false);
  const [discrepancyModalVisible, setDiscrepancyModalVisible] = useState<boolean>(false);
  const [completingPickup, setCompletingPickup] = useState<boolean>(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{ title: string; sub: string } | null>(null);

  React.useEffect(() => {
    if (activeStop) {
      setTotalWeight(activeStop.collected_weight_kg || activeStop.estimated_weight_kg || 0);
    }
  }, [activeStop?.id, activeStop?.collected_weight_kg, activeStop?.estimated_weight_kg]);

  const qrVerified = activeStop?.qr_verified || false;
  const otpVerified = activeStop?.otp_verified || false;
  const proofUploaded = activeStop?.proof_uploaded || false;

  const currentStepNum: 2 | 3 | 4 | 5 = !qrVerified ? 3 : !otpVerified ? 4 : !proofUploaded ? 5 : 5;

  const handleScanQRSuccess = async (scannedCode: string) => {
    if (!activeStop || !route) return;
    try {
      const res = await scanQR(activeStop.id, scannedCode);
      if (res?.otp) {
        setOtpDigits(res.otp.split(''));
      }
      showFeedback('Pickup QR Code Verified', 'Container sealed and verified on blockchain chain-of-custody.');
    } catch (err: any) {
      Alert.alert('QR Verification Error', err.message || 'Invalid QR code.');
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
      Alert.alert('OTP Resent', res.message || 'New OTP generated and delivered to customer.');
    } catch (err: any) {
      Alert.alert('Resend Failed', err.message || 'Could not resend OTP.');
    } finally {
      setIsResendingOtp(false);
    }
  };

  const handlePrintSlip = async () => {
    if (!activeStop) return;
    const success = await printService.printPickupSlip(activeStop, totalWeight);
    if (!success) {
      Alert.alert('Printer Unavailable', 'Bluetooth Zebra printer was not detected. Ready for fallback generation.');
    }
  };

  const showFeedback = (title: string, sub: string) => {
    setFeedbackBanner({ title, sub });
    setTimeout(() => {
      setFeedbackBanner(null);
    }, 3500);
  };

  const handleCompletePickup = async () => {
    if (!activeStop || !route) return;

    if (!tamperSealAffixed) {
      Alert.alert('Tamper Seal Required', 'Please confirm that the tamper seal has been attached and locked.');
      return;
    }

    if (!activeStop.qr_verified) {
      if (activeStop.pickup_code) {
        try {
          await scanQR(activeStop.id, activeStop.pickup_code);
        } catch {
          Alert.alert('QR Tag Required', 'Please scan or verify the consignment QR tag before completing this pickup.');
          return;
        }
      } else {
        Alert.alert('QR Tag Required', 'Please scan the consignment QR tag before completing this pickup.');
        return;
      }
    }

    if (!activeStop.otp_verified) {
      const fullOtp = otpDigits.join('').trim();
      if (fullOtp.length === 6) {
        try {
          await verifyOTP(activeStop.id, fullOtp);
        } catch (err: any) {
          Alert.alert('Invalid OTP', err.message || 'Customer 6-digit confirmation PIN verification failed.');
          return;
        }
      } else {
        Alert.alert('Customer OTP Required', 'Please enter the 6-digit customer confirmation PIN provided by the clinic representative.');
        return;
      }
    }

    if (!activeStop.proof_uploaded) {
      Alert.alert(
        'Collection Proof Required',
        'Regulations require photo proof of the sealed consignment before custody transfer can be completed. Please capture or upload a proof photo below.'
      );
      return;
    }

    setCompletingPickup(true);
    try {
      // 3. Complete stop with recorded weight via backend API
      const res = await completeStop(activeStop.id, totalWeight);

      const nextStop = res?.nextStop;
      const targetLabel = nextStop
        ? (nextStop.stop_type === 'WAREHOUSE'
            ? 'Terminal Handover'
            : `Stop ${nextStop.sequence_number}: ${nextStop.customer_name || 'Next Destination'}`)
        : 'Terminal Handover';

      showFeedback(
        'Pickup Completed • Manifest Sealed',
        `Routing to ${targetLabel}...`
      );

      // Smooth auto-advance transition to next stop or terminal handover
      setTimeout(() => {
        if (!nextStop || nextStop.stop_type === 'WAREHOUSE') {
          onNavigateToTab('profile');
        } else {
          onNavigateToTab('routes');
        }
      }, 1200);
    } catch (err: any) {
      Alert.alert('Completion Error', err.message || 'Could not complete pickup.');
    } finally {
      setCompletingPickup(false);
    }
  };

  const handleDiscrepancySubmit = async (reason: string) => {
    if (!activeStop || !route) return;
    try {
      await failStop(activeStop.id, reason);
      setDiscrepancyModalVisible(false);
      showFeedback('Discrepancy Reported', 'Stop logged as exception. Dispatch has been alerted.');
      setTimeout(() => {
        onNavigateToTab('routes');
      }, 1000);
    } catch (err: any) {
      Alert.alert('Report Error', err.message || 'Could not submit exception.');
    }
  };

  if (isLoading && !route) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primaryAction} />
        <Text style={styles.loadingText}>Loading pickup manifest...</Text>
      </View>
    );
  }

  if (!route) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="cube-outline" size={48} color={colors.textSecondary} />
        <Text style={[typography.headlineSm, { color: colors.textPrimary, marginTop: 8 }]}>
          No Active Pickup Manifest
        </Text>
        <Text style={styles.loadingText}>
          No route assigned or pending pickup collections for today.
        </Text>
        <TouchableOpacity
          style={{
            marginTop: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: colors.primaryDark,
            paddingVertical: 12,
            paddingHorizontal: 20,
            borderRadius: radii.md,
          }}
          onPress={() => onNavigateToTab('operations')}
        >
          <Ionicons name="arrow-back" size={16} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
            Return to Operations
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!activeStop || activeStop.stop_type === 'WAREHOUSE') {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="checkmark-done-circle-outline" size={56} color={colors.success} />
        <Text style={[typography.headlineSm, { color: colors.textPrimary, marginTop: 8 }]}>
          All Consignments Picked Up
        </Text>
        <Text style={[styles.loadingText, { textAlign: 'center', maxWidth: 280 }]}>
          All field collections are complete. Proceed to the terminal warehouse to finalize custody handover and shift sign-off.
        </Text>
        <TouchableOpacity
          style={{
            marginTop: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: colors.primaryAction,
            paddingVertical: 14,
            paddingHorizontal: 24,
            borderRadius: radii.md,
          }}
          onPress={() => onNavigateToTab('profile')}
        >
          <Ionicons name="business" size={18} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>
            Go to Terminal Handover
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (activeStop.execution_status === 'PENDING') {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="navigate-circle-outline" size={56} color={colors.primaryAction} />
        <Text style={[typography.headlineSm, { color: colors.textPrimary, marginTop: 8, textAlign: 'center' }]}>
          En Route to Stop {activeStop.sequence_number}
        </Text>
        <Text style={[typography.labelLg, { color: colors.primaryDark, marginTop: 4, textAlign: 'center' }]}>
          {activeStop.customer_name || 'Assigned Facility'}
        </Text>
        <Text style={[styles.loadingText, { textAlign: 'center', maxWidth: 300, marginTop: 8 }]}>
          You must arrive at the facility and confirm arrival before starting consignment weighing, QR tagging, and proof collection.
        </Text>
        <TouchableOpacity
          style={{
            marginTop: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: colors.primaryDark,
            paddingVertical: 14,
            paddingHorizontal: 24,
            borderRadius: radii.md,
          }}
          onPress={() => onNavigateToTab('routes')}
        >
          <Ionicons name="map" size={18} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>
            Open Navigation to Stop {activeStop.sequence_number}
          </Text>
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
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

  return (
    <View style={styles.wrapper}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refreshRoute} tintColor={colors.primaryDark} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Facility Header Card */}
        <FacilityHeaderCard
          stop={activeStop}
          stopIndex={stats.currentStopIndex}
          totalStops={stats.totalStops}
        />

        {/* Step Progression Bar (1. Arrived -> 2. Weight -> 3. QR -> 4. OTP -> 5. Proof) */}
        <StepProgressionBar
          currentStep={currentStepNum}
          weightRecorded={true}
          qrVerified={qrVerified}
          otpVerified={otpVerified}
          proofUploaded={proofUploaded}
          weightKg={totalWeight}
        />

        {/* Section 1: Manual Weight Entry */}
        <ConsignmentWeighingCard
          totalWeight={totalWeight}
          onWeightChange={setTotalWeight}
        />

        {/* Section 2: Step 3 QR Tag Generation & Container Seal */}
        <QRTagCard
          stop={activeStop}
          totalWeight={totalWeight}
          qrVerified={qrVerified}
          tamperSealAffixed={tamperSealAffixed}
          onToggleTamperSeal={() => setTamperSealAffixed(!tamperSealAffixed)}
          onScanPress={() => setCameraModalVisible(true)}
          onPrintPress={handlePrintSlip}
        />

        {/* Section 3: Step 4 Customer OTP Signoff */}
        <OTPVerificationCard
          otp={otpDigits}
          onChangeOtp={setOtpDigits}
          isVerified={otpVerified}
          onResendOtp={handleResendOtp}
          isResending={isResendingOtp}
          pharmacistName={activeStop?.customer_name || 'Clinic Representative'}
        />

        {/* Section 4: Step 5 Photo Proof of Collection (/api/driver/routes/{route_id}/stops/{stop_id}/proof) */}
        <CollectionProofCard
          stop={activeStop}
          isQrVerified={qrVerified}
          isOtpVerified={otpVerified}
          onProofUploaded={() => {
            showFeedback(
              'Collection Proof Uploaded',
              'Consignment photo securely archived and sealed on Pharmatrix Cloud.'
            );
          }}
        />

        {/* Primary Action Button: Complete Pickup & Auto-Advance */}
        <View style={styles.completeActionBox}>
          <TouchableOpacity
            style={[styles.completeBtn, (completingPickup || actionLoading) && styles.completeBtnDisabled]}
            onPress={handleCompletePickup}
            disabled={completingPickup || actionLoading}
            activeOpacity={0.88}
          >
            {completingPickup || actionLoading ? (
              <ActivityIndicator color={colors.onPrimaryContainer} size="small" />
            ) : (
              <>
                <View style={styles.completeTitleRow}>
                  <Ionicons name="checkmark-done-circle" size={20} color={colors.onPrimaryContainer} />
                  <Text style={styles.completeTitle}>
                    Complete Pickup & Auto-Advance to {nextStopLabel}
                  </Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.onPrimaryContainer} />
                </View>
                <Text style={styles.completeSub}>
                  Saves handover manifest & launches route to next scheduled stop
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
          <Ionicons name="navigate-circle" size={24} color={colors.primaryAction} />
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
    backgroundColor: colors.canvas,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.gutter,
    gap: 12,
    paddingBottom: 28,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.canvas,
    gap: 10,
  },
  loadingText: {
    ...typography.bodySm,
    color: colors.textSecondary,
    fontSize: 12,
  },
  completeActionBox: {
    marginTop: 4,
  },
  completeBtn: {
    backgroundColor: colors.primaryAction,
    minHeight: 56,
    borderRadius: radii.xl,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  completeBtnDisabled: {
    opacity: 0.6,
  },
  completeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  completeTitle: {
    ...typography.labelLg,
    fontSize: 14,
    fontWeight: '700',
    color: colors.onPrimaryContainer,
  },
  completeSub: {
    ...typography.bodySm,
    fontSize: 10.5,
    color: colors.onPrimaryContainer,
    opacity: 0.85,
    marginTop: 2,
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
    ...typography.labelMd,
    fontSize: 12,
    color: colors.error,
    fontWeight: '700',
  },
  feedbackToast: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    backgroundColor: colors.ink,
    borderRadius: radii.xl,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.primaryAction,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
    zIndex: 100,
  },
  feedbackTitle: {
    ...typography.labelMd,
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  feedbackSub: {
    ...typography.bodySm,
    fontSize: 11,
    color: '#D1D5DB',
    marginTop: 1,
  },
});

export default PickupsScreen;
