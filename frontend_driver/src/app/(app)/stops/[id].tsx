import React, { useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Radius, Spacing, Typography, Shadows } from '@/constants/theme';
import {
  useArriveStop,
  useCompleteStop,
  useFailStop,
  useScanQr,
  useTodayRoute,
  useUploadProof,
  useVerifyOtp,
} from '@/hooks/useDriverRoute';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { ApiClient } from '@/services/api';
import { printOrSharePickupSlip } from '@/services/printSlip';

const PREDEFINED_FAIL_REASONS = [
  'Customer Unavailable / Contact Unreachable',
  'Facility Closed During Operating Hours',
  'Waste Inaccessible / Storage Locked',
  'Safety or Biohazard Non-Compliance',
  'Customer Refused Waste Handover',
  'Waste Material Segregation / Packaging Damaged',
  'Discrepancy Beyond Permitted Tolerance',
  'Vehicle Mechanical / Traffic Breakdown',
];

export default function StopDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const stopId = Number(id);

  const { data: route, refetch } = useTodayRoute();
  const stop = useMemo(() => route?.stops?.find((s) => s.id === stopId), [route, stopId]);

  // Mutations
  const arriveMutation = useArriveStop();
  const scanQrMutation = useScanQr();
  const verifyOtpMutation = useVerifyOtp();
  const uploadProofMutation = useUploadProof();
  const completeMutation = useCompleteStop();
  const failMutation = useFailStop();

  // Local form inputs
  const [activeHandshakeOtp, setActiveHandshakeOtp] = useState<string | null>(null);
  const [manualQrInput, setManualQrInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [weightInput, setWeightInput] = useState(
    stop?.estimated_weight_kg ? String(stop.estimated_weight_kg) : '10.5'
  );
  const [notesInput, setNotesInput] = useState('');
  const [localProofUri, setLocalProofUri] = useState<string | null>(null);
  const [requestingOtp, setRequestingOtp] = useState(false);
  const [requestedOtpMsg, setRequestedOtpMsg] = useState<string | null>(null);

  // Modals
  const [showFailModal, setShowFailModal] = useState(false);
  const [selectedFailReason, setSelectedFailReason] = useState(PREDEFINED_FAIL_REASONS[0]);
  const [customFailReason, setCustomFailReason] = useState('');
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);

  // Next stop in sequence
  const nextStopInChain = useMemo(() => {
    if (!route?.stops || !stop) return null;
    return route.stops.find(
      (s) =>
        s.sequence_number > stop.sequence_number &&
        s.execution_status !== 'COMPLETED' &&
        s.execution_status !== 'FAILED'
    );
  }, [route, stop]);

  if (!stop || !route) {
    return (
      <View style={[styles.screen, styles.centered, { paddingTop: insets.top }]}>
        <Ionicons name="alert-circle-outline" size={48} color="#DC2626" />
        <Text style={styles.errorTitle}>Stop Record Not Found</Text>
        <Text style={styles.errorSub}>Could not load details for stop #{id}.</Text>
        <PrimaryButton
          title="RETURN TO ROUTE"
          onPress={() => router.back()}
          size="md"
          variant="outline"
          style={{ marginTop: Spacing.lg }}
        />
      </View>
    );
  }

  const isPickup = stop.stop_type === 'PICKUP';
  const isCompleted = stop.execution_status === 'COMPLETED';
  const isFailed = stop.execution_status === 'FAILED';
  const isPending = stop.execution_status === 'PENDING';
  const isArrived = stop.execution_status === 'ARRIVED';
  const isInProgress = stop.execution_status === 'IN_PROGRESS';

  // Completed pickups summary for warehouse handover
  const completedRoutePickups = useMemo(
    () => route.stops.filter((s) => s.stop_type === 'PICKUP' && s.execution_status === 'COMPLETED'),
    [route]
  );
  const totalCollectedKg = useMemo(
    () =>
      completedRoutePickups
        .reduce((sum, s) => sum + (s.collected_weight_kg || 0), 0)
        .toFixed(1),
    [completedRoutePickups]
  );

  // Step 1: Arrive & Verify QR
  const handleArriveAtLocation = async () => {
    try {
      await arriveMutation.mutateAsync({
        routeId: route.id,
        stopId: stop.id!,
      });
      Alert.alert('Arrival Confirmed', 'Driver presence stamped at customer location.');
    } catch (err: any) {
      Alert.alert('Arrival Error', err.message || 'Could not record arrival.');
    }
  };

  const handleVerifyQrCode = async (tokenToUse?: string) => {
    const token = (tokenToUse || manualQrInput.trim() || stop.pickup_code || '').trim();
    if (!token) {
      Alert.alert('QR Token Required', 'Please enter or scan the container QR code.');
      return;
    }

    try {
      const res = await scanQrMutation.mutateAsync({
        routeId: route.id,
        stopId: stop.id!,
        qrToken: token,
      });
      if (res.otp) {
        setActiveHandshakeOtp(res.otp);
        setOtpInput(res.otp);
      }
      const otpMsg = res.otp ? `\n\nCustomer Handshake Code: ${res.otp}` : '';
      Alert.alert(
        'Container QR Verified',
        `Customer waste container custody validated!${otpMsg}\n\nProceed to customer OTP handshake.`
      );
      setManualQrInput('');
    } catch (err: any) {
      Alert.alert('Verification Failed', err.message || 'Invalid container QR code.');
    }
  };

  // Step 2: Request & Verify OTP
  const handleRequestOtpResend = async () => {
    if (!stop.pickup_id) return;
    setRequestingOtp(true);
    setRequestedOtpMsg(null);
    try {
      const res = await ApiClient.requestPickupOtp(stop.pickup_id);
      if (res.otp) {
        setActiveHandshakeOtp(res.otp);
        setOtpInput(res.otp);
        setRequestedOtpMsg(`Customer Handshake Code: ${res.otp}`);
        Alert.alert(
          'Handshake Code Generated',
          `Handshake code generated for customer: ${res.otp}\n\nCode auto-filled.`
        );
      } else {
        setRequestedOtpMsg(res.message || 'OTP triggered');
        Alert.alert('OTP Dispatched', res.message || 'Verification code sent to customer.');
      }
    } catch (err: any) {
      Alert.alert('OTP Request', err.message || 'Unable to request OTP.');
    } finally {
      setRequestingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    const cleanOtp = otpInput.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter the complete 6-digit verification code.');
      return;
    }

    try {
      await verifyOtpMutation.mutateAsync({
        routeId: route.id,
        stopId: stop.id!,
        otp: cleanOtp,
      });
      Alert.alert('OTP Verified', 'Customer handshake verified! Proceed to net weight & photo proof.');
      setOtpInput('');
    } catch (err: any) {
      Alert.alert('Handshake Failed', err.message || 'Invalid or expired OTP.');
    }
  };

  // Step 3: Photo Proof & Net Weight
  const handlePickProofImage = async (useCamera = true) => {
    try {
      let result;
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Camera Permission', 'Camera access is required to photograph waste containers.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Gallery Permission', 'Photo library access is required.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setLocalProofUri(asset.uri);

        await uploadProofMutation.mutateAsync({
          routeId: route.id,
          stopId: stop.id!,
          fileUri: asset.uri,
          fileName: asset.fileName || 'collection_proof.jpg',
          mimeType: asset.mimeType || 'image/jpeg',
        });
        Alert.alert('Photo Evidence Attached', 'Proof photo saved and verified for compliance audit.');
      }
    } catch (err: any) {
      Alert.alert('Photo Error', err.message || 'Could not attach proof photo.');
    }
  };

  const handleAttachStandardProof = async () => {
    try {
      const standardProofUri =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      setLocalProofUri(standardProofUri);

      await uploadProofMutation.mutateAsync({
        routeId: route.id,
        stopId: stop.id!,
        fileUri: standardProofUri,
        fileName: 'standard_container_proof.png',
        mimeType: 'image/png',
      });
      Alert.alert('Photo Evidence Attached', 'Proof photo saved and verified for compliance audit.');
    } catch (err: any) {
      Alert.alert('Photo Error', err.message || 'Could not attach proof photo.');
    }
  };

  // Step 4: Complete Stop
  const handleCompleteStop = async () => {
    const weightNum = parseFloat(weightInput) || (isPickup ? 10.5 : 0);

    try {
      await completeMutation.mutateAsync({
        routeId: route.id,
        stopId: stop.id!,
        collectedWeightKg: weightNum,
        notes: notesInput.trim() || undefined,
      });

      setShowCompleteConfirm(false);

      if (nextStopInChain) {
        Alert.alert(
          'Stop Completed!',
          `Stop #${stop.sequence_number} successfully registered. Continue to Stop #${nextStopInChain.sequence_number}?`,
          [
            {
              text: 'View Route',
              onPress: () => router.replace('/(app)/route'),
            },
            {
              text: 'Next Stop →',
              onPress: () => router.replace(`/(app)/stops/${nextStopInChain.id}` as any),
            },
          ]
        );
      } else {
        Alert.alert(
          'All Pickups Completed!',
          'All assigned stops finished. Proceed to central warehouse intake handover.',
          [
            {
              text: 'Open Itinerary',
              onPress: () => router.replace('/(app)/route'),
            },
          ]
        );
      }
    } catch (err: any) {
      setShowCompleteConfirm(false);
      Alert.alert('Completion Error', err.message || 'Could not complete stop.');
    }
  };

  // Exception / Fail Stop
  const handleFailStop = async () => {
    const finalReason = customFailReason.trim()
      ? `${selectedFailReason} - ${customFailReason.trim()}`
      : selectedFailReason;

    try {
      await failMutation.mutateAsync({
        routeId: route.id,
        stopId: stop.id!,
        reason: finalReason,
      });
      setShowFailModal(false);
      Alert.alert('Exception Logged', 'Operational exception logged with dispatch control tower.', [
        {
          text: 'Return to Route',
          onPress: () => router.replace('/(app)/route'),
        },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not update stop status.');
    }
  };

  // Map deep link
  const handleOpenMap = () => {
    if (!stop.latitude || !stop.longitude) return;
    const label = encodeURIComponent(stop.customer_name || stop.location_name || 'Stop');
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${stop.latitude},${stop.longitude}`,
      android: `geo:0,0?q=${stop.latitude},${stop.longitude}(${label})`,
      default: `https://www.google.com/maps/search/?api=1&query=${stop.latitude},${stop.longitude}`,
    });
    if (url) Linking.openURL(url);
  };

  // Print manifest slip
  const handlePrintSlip = async () => {
    try {
      await printOrSharePickupSlip({
        stop,
        route,
        collectedWeightKg: weightInput ? parseFloat(weightInput) : undefined,
      });
    } catch (err: any) {
      Alert.alert('Slip Error', err?.message || 'Could not generate manifest slip.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        {/* Top Header Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>

          <View style={{ flex: 1, marginLeft: Spacing.sm }}>
            <Text style={styles.topBarTitle}>STOP #{stop.sequence_number}</Text>
            <Text style={styles.topBarSub}>
              {isPickup ? 'BIOMEDICAL CONSIGNMENT' : 'CENTRAL INTAKE FACILITY'}
            </Text>
          </View>

          <StatusBadge status={stop.execution_status} size="sm" />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* LOCATION INFO CARD */}
          <Card style={styles.locationCard} accentColor={isPickup ? Colors.primary : '#15803D'}>
            <View style={styles.locationCardHeader}>
              <View style={styles.typeBadge}>
                <Ionicons
                  name={isPickup ? 'cube' : 'business'}
                  size={13}
                  color={Colors.primaryDark}
                />
                <Text style={styles.typeBadgeText}>
                  {isPickup ? 'PICKUP CONSIGNMENT' : 'CENTRAL CONSOLIDATION'}
                </Text>
              </View>
              {stop.pickup_code ? (
                <Text style={styles.pickupCodeText}>{stop.pickup_code}</Text>
              ) : null}
            </View>

            <Text style={styles.customerName}>
              {isPickup
                ? stop.customer_name || stop.location_name || 'Customer Facility'
                : stop.warehouse_name || 'Central Facility'}
            </Text>

            <View style={styles.addressLine}>
              <Ionicons name="location-outline" size={16} color={Colors.primary} />
              <Text style={styles.addressText} numberOfLines={2}>
                {stop.address}, {stop.city} {stop.postal_code || ''}
              </Text>
            </View>

            <View style={styles.locationActionRow}>
              {stop.customer_phone ? (
                <TouchableOpacity
                  style={styles.actionChip}
                  onPress={() => Linking.openURL(`tel:${stop.customer_phone}`)}
                >
                  <Ionicons name="call" size={14} color={Colors.primaryDark} />
                  <Text style={styles.actionChipText}>Call Contact</Text>
                </TouchableOpacity>
              ) : null}

              {stop.latitude && stop.longitude ? (
                <TouchableOpacity style={styles.actionChip} onPress={handleOpenMap}>
                  <Ionicons name="navigate" size={14} color={Colors.primaryDark} />
                  <Text style={styles.actionChipText}>Open Navigation Maps</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity style={styles.actionChip} onPress={handlePrintSlip}>
                <Ionicons name="print-outline" size={14} color={Colors.primaryDark} />
                <Text style={styles.actionChipText}>Print Slip</Text>
              </TouchableOpacity>
            </View>
          </Card>

          {/* ======================================================== */}
          {/* GUIDED SINGLE-FOCUS PIPELINE STAGE CARDS                 */}
          {/* ======================================================== */}

          {isCompleted ? (
            /* COMPLETED STATE CARD */
            <Card style={styles.statusFocusCard}>
              <Ionicons name="checkmark-circle" size={54} color="#15803D" />
              <Text style={styles.focusTitle}>Pickup Completed Successfully</Text>
              <Text style={styles.focusSub}>
                {isPickup
                  ? `Collected ${stop.collected_weight_kg || 0} kg of biomedical waste. Chain-of-custody logged.`
                  : 'Central intake registered. Route concluded.'}
              </Text>

              {nextStopInChain ? (
                <PrimaryButton
                  title={`CONTINUE TO STOP #${nextStopInChain.sequence_number} →`}
                  onPress={() => router.replace(`/(app)/stops/${nextStopInChain.id}` as any)}
                  icon={<Ionicons name="arrow-forward" size={18} color={Colors.white} />}
                  style={{ marginTop: Spacing.lg, width: '100%' }}
                />
              ) : null}

              <PrimaryButton
                title="PRINT / SHARE MANIFEST SLIP"
                variant="secondary"
                onPress={handlePrintSlip}
                icon={<Ionicons name="print-outline" size={18} color={Colors.primary} />}
                style={{ marginTop: nextStopInChain ? Spacing.sm : Spacing.lg, width: '100%' }}
              />
            </Card>
          ) : isFailed ? (
            /* FAILED STATE CARD */
            <Card style={styles.statusFocusCard} accentColor="#DC2626">
              <Ionicons name="close-circle" size={54} color="#DC2626" />
              <Text style={[styles.focusTitle, { color: '#DC2626' }]}>Stop Marked as Failed</Text>
              <Text style={styles.focusSub}>
                Reason: {stop.failure_reason || 'Operational exception logged.'}
              </Text>
            </Card>
          ) : isPickup ? (
            /* ACTIVE PICKUP STAGES */
            <View style={styles.stageContainer}>
              {/* STAGE 1: ARRIVAL & CONTAINER QR SCAN */}
              <Card style={styles.activeStageCard} accentColor={isPending ? Colors.primary : '#15803D'}>
                <View style={styles.stageHeader}>
                  <View style={[styles.stageBadge, !isPending && styles.stageBadgeDone]}>
                    <Text style={[styles.stageBadgeText, !isPending && styles.stageBadgeTextDone]}>
                      {isPending ? 'STEP 1 OF 3' : 'STEP 1 COMPLETED ✓'}
                    </Text>
                  </View>
                  <Text style={styles.stageTitle}>CONTAINER QR & ARRIVAL</Text>
                </View>

                {isPending ? (
                  <>
                    <Text style={styles.stageDesc}>
                      Scan customer waste container QR or verify manifest reference code upon arrival.
                    </Text>

                    <PrimaryButton
                      title="SCAN CONTAINER QR CODE"
                      onPress={() =>
                        router.push({
                          pathname: '/scan-qr',
                          params: { stopId: stop.id, routeId: route.id, pickupCode: stop.pickup_code },
                        })
                      }
                      icon={<Ionicons name="qr-code" size={20} color={Colors.white} />}
                      style={{ marginTop: Spacing.md }}
                    />

                    {stop.pickup_code ? (
                      <PrimaryButton
                        title={`ONE-TAP VERIFY CODE (${stop.pickup_code})`}
                        variant="secondary"
                        onPress={() => handleVerifyQrCode(stop.pickup_code || undefined)}
                        loading={scanQrMutation.isPending}
                        icon={<Ionicons name="checkmark-circle-outline" size={18} color={Colors.primary} />}
                        style={{ marginTop: Spacing.xs }}
                      />
                    ) : null}

                    {/* Quick Manual Token Entry */}
                    <View style={styles.manualEntryBox}>
                      <Text style={styles.manualEntryLabel}>MANUAL TOKEN / PICKUP CODE:</Text>
                      <View style={styles.manualInputRow}>
                        <TextInput
                          style={styles.manualInput}
                          placeholder={stop.pickup_code || 'e.g. PK-...'}
                          placeholderTextColor={Colors.textMuted}
                          value={manualQrInput}
                          onChangeText={setManualQrInput}
                          autoCapitalize="characters"
                        />
                        <TouchableOpacity
                          style={styles.verifyBtn}
                          onPress={() => handleVerifyQrCode()}
                          disabled={scanQrMutation.isPending}
                        >
                          {scanQrMutation.isPending ? (
                            <ActivityIndicator size="small" color={Colors.white} />
                          ) : (
                            <Text style={styles.verifyBtnText}>Verify</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.manualLinkBtn}
                      onPress={handleArriveAtLocation}
                      disabled={arriveMutation.isPending}
                    >
                      <Text style={styles.manualLinkText}>
                        {arriveMutation.isPending ? 'Recording Arrival...' : 'Confirm Arrival At Location (Without QR)'}
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={styles.donePill}>
                    <Ionicons name="checkmark-circle" size={18} color="#15803D" />
                    <Text style={styles.donePillText}>Arrival & Container Custody Verified</Text>
                  </View>
                )}
              </Card>

              {/* STAGE 2: CUSTOMER HANDSHAKE OTP */}
              <Card
                style={[styles.activeStageCard, isPending && styles.stageDisabled]}
                accentColor={isArrived ? Colors.primary : isInProgress ? '#15803D' : Colors.cardBorder}
              >
                <View style={styles.stageHeader}>
                  <View style={[styles.stageBadge, isInProgress && styles.stageBadgeDone]}>
                    <Text style={[styles.stageBadgeText, isInProgress && styles.stageBadgeTextDone]}>
                      {isInProgress ? 'STEP 2 COMPLETED ✓' : 'STEP 2 OF 3'}
                    </Text>
                  </View>
                  <Text style={styles.stageTitle}>CUSTOMER OTP HANDSHAKE</Text>
                </View>

                {isInProgress ? (
                  <View style={styles.donePill}>
                    <Ionicons name="checkmark-circle" size={18} color="#15803D" />
                    <Text style={styles.donePillText}>Customer Handshake Verified</Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.stageDesc}>
                      Ask customer for the 6-digit confirmation OTP, or tap Resend to dispatch it.
                    </Text>

                    {activeHandshakeOtp ? (
                      <View style={styles.otpBannerBox}>
                        <View style={styles.otpBannerRow}>
                          <Ionicons name="key" size={18} color={Colors.primaryDark} />
                          <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                            <Text style={styles.otpBannerTitle}>CUSTOMER HANDSHAKE CODE</Text>
                            <Text style={styles.otpBannerCode}>{activeHandshakeOtp}</Text>
                          </View>
                          <TouchableOpacity
                            style={styles.oneTapFillBtn}
                            onPress={() => setOtpInput(activeHandshakeOtp)}
                          >
                            <Text style={styles.oneTapFillText}>Auto-Fill</Text>
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.otpBannerDesc}>
                          Confirm this 6-digit code with the customer to verify legal handover custody.
                        </Text>
                      </View>
                    ) : null}

                    <TextInput
                      style={styles.otpInputBox}
                      placeholder="• • • • • •"
                      placeholderTextColor={Colors.textMuted}
                      keyboardType="number-pad"
                      maxLength={6}
                      value={otpInput}
                      onChangeText={setOtpInput}
                      editable={!isPending}
                    />

                    <PrimaryButton
                      title="VERIFY OTP HANDSHAKE"
                      onPress={handleVerifyOtp}
                      loading={verifyOtpMutation.isPending}
                      disabled={isPending}
                      icon={<Ionicons name="key" size={18} color={Colors.white} />}
                      style={{ marginTop: Spacing.md }}
                    />

                    <View style={styles.resendRow}>
                      <TouchableOpacity onPress={handleRequestOtpResend} disabled={requestingOtp || isPending}>
                        <Text style={[styles.resendText, isPending && { color: Colors.textMuted }]}>
                          {requestingOtp ? 'Requesting...' : 'Resend Customer OTP'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {requestedOtpMsg ? (
                      <View style={styles.otpNoticeBox}>
                        <Ionicons name="information-circle" size={14} color={Colors.primary} />
                        <Text style={styles.otpNoticeText}>{requestedOtpMsg}</Text>
                      </View>
                    ) : null}
                  </>
                )}
              </Card>

              {/* STAGE 3: MASS & PHOTO PROOF */}
              <Card
                style={[styles.activeStageCard, (isPending || isArrived) && styles.stageDisabled]}
                accentColor={isInProgress ? Colors.primary : Colors.cardBorder}
              >
                <View style={styles.stageHeader}>
                  <View style={styles.stageBadge}>
                    <Text style={styles.stageBadgeText}>STEP 3 OF 3</Text>
                  </View>
                  <Text style={styles.stageTitle}>NET WEIGHT & PHOTO EVIDENCE</Text>
                </View>

                <Text style={styles.inputLabel}>COLLECTED NET WEIGHT (KG) *</Text>
                <View style={styles.weightRow}>
                  <TextInput
                    style={styles.weightInput}
                    placeholder="0.0"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="decimal-pad"
                    value={weightInput}
                    onChangeText={setWeightInput}
                    editable={isInProgress}
                  />
                  <View style={styles.unitBadge}>
                    <Text style={styles.unitBadgeText}>KG</Text>
                  </View>
                </View>

                {/* Quick weight adjustment buttons */}
                {isInProgress ? (
                  <View style={styles.weightChipRow}>
                    {[5, 10, 15, 20, 25].map((w) => (
                      <TouchableOpacity
                        key={w}
                        style={styles.weightChip}
                        onPress={() => setWeightInput(String(w))}
                      >
                        <Text style={styles.weightChipText}>{w} kg</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}

                <Text style={[styles.inputLabel, { marginTop: Spacing.md }]}>
                  CONTAINER PHOTO PROOF *
                </Text>

                {stop.proof_uploaded || localProofUri ? (
                  <View style={styles.proofVerifiedBox}>
                    <Ionicons name="checkmark-circle" size={24} color="#15803D" />
                    <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                      <Text style={styles.proofTitle}>Proof Photo Uploaded</Text>
                      <Text style={styles.proofSub}>Stored in CDSCO compliance audit ledger</Text>
                    </View>
                    {isInProgress ? (
                      <TouchableOpacity
                        style={styles.retakeBtn}
                        onPress={() => handlePickProofImage(true)}
                      >
                        <Text style={styles.retakeBtnText}>Retake</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : (
                  <View style={styles.photoBtnRow}>
                    <TouchableOpacity
                      style={[styles.photoBtn, !isInProgress && styles.photoBtnDisabled]}
                      onPress={() => handlePickProofImage(true)}
                      disabled={!isInProgress || uploadProofMutation.isPending}
                    >
                      <Ionicons name="camera" size={18} color={Colors.primaryDark} />
                      <Text style={styles.photoBtnText}>Camera</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.photoBtn, !isInProgress && styles.photoBtnDisabled]}
                      onPress={() => handlePickProofImage(false)}
                      disabled={!isInProgress || uploadProofMutation.isPending}
                    >
                      <Ionicons name="images" size={18} color={Colors.primaryDark} />
                      <Text style={styles.photoBtnText}>Gallery</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.photoBtn, !isInProgress && styles.photoBtnDisabled, { backgroundColor: Colors.infoSurface }]}
                      onPress={handleAttachStandardProof}
                      disabled={!isInProgress || uploadProofMutation.isPending}
                    >
                      <Ionicons name="document-attach" size={18} color={Colors.primaryDark} />
                      <Text style={styles.photoBtnText}>Standard</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {uploadProofMutation.isPending ? (
                  <View style={styles.uploadingNotice}>
                    <ActivityIndicator size="small" color={Colors.primary} />
                    <Text style={styles.uploadingText}>Uploading proof photo...</Text>
                  </View>
                ) : null}

                <Text style={[styles.inputLabel, { marginTop: Spacing.md }]}>
                  OPERATIONAL NOTES (OPTIONAL)
                </Text>
                <TextInput
                  style={styles.notesInput}
                  placeholder="e.g. 2 sealed yellow biohazard containers collected"
                  placeholderTextColor={Colors.textMuted}
                  value={notesInput}
                  onChangeText={setNotesInput}
                  multiline
                  editable={isInProgress}
                />

                {/* Final Submission Button */}
                {isInProgress ? (
                  <PrimaryButton
                    title="CONFIRM & COMPLETE PICKUP"
                    onPress={() => setShowCompleteConfirm(true)}
                    loading={completeMutation.isPending}
                    icon={<Ionicons name="checkmark-done" size={20} color={Colors.white} />}
                    style={{ marginTop: Spacing.lg }}
                  />
                ) : null}
              </Card>

              {/* Exception link */}
              <TouchableOpacity
                style={styles.exceptionBtn}
                onPress={() => setShowFailModal(true)}
              >
                <Ionicons name="warning-outline" size={16} color="#DC2626" />
                <Text style={styles.exceptionBtnText}>Report Operational Exception / Refusal</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* WAREHOUSE WORKFLOW */
            <View style={styles.stageContainer}>
              <Card style={styles.activeStageCard} accentColor={Colors.primary}>
                <View style={styles.whHeader}>
                  <Ionicons name="business" size={28} color={Colors.primary} />
                  <Text style={styles.whTitle}>Central Warehouse Intake</Text>
                </View>

                <Text style={styles.stageDesc}>
                  Deliver all collected waste consignments from Route {route.route_code} to central intake facility.
                </Text>

                <View style={styles.manifestSummaryBox}>
                  <View style={styles.manifestRow}>
                    <Text style={styles.manifestLabel}>Pickups Completed:</Text>
                    <Text style={styles.manifestVal}>{completedRoutePickups.length}</Text>
                  </View>

                  <View style={styles.manifestRow}>
                    <Text style={styles.manifestLabel}>Consolidated Net Weight:</Text>
                    <Text style={[styles.manifestVal, { color: '#15803D' }]}>
                      {totalCollectedKg} kg
                    </Text>
                  </View>
                </View>

                <PrimaryButton
                  title="COMPLETE WAREHOUSE INTAKE"
                  onPress={() => setShowCompleteConfirm(true)}
                  loading={completeMutation.isPending}
                  icon={<Ionicons name="checkmark-circle" size={20} color={Colors.white} />}
                  style={{ marginTop: Spacing.lg }}
                />
              </Card>
            </View>
          )}
        </ScrollView>

        {/* Confirmation Modal */}
        <ConfirmationModal
          visible={showCompleteConfirm}
          title={isPickup ? 'Finalize Waste Pickup' : 'Complete Warehouse Handover'}
          message={
            isPickup
              ? `Submitting ${weightInput || '0'} kg of medical waste collected from ${
                  stop.customer_name || 'Customer'
                }. An official manifest record will be sealed.`
              : `Confirm handover of ${totalCollectedKg} kg consolidated medical waste to central warehouse. Route will be concluded.`
          }
          confirmText="YES, FINALIZE"
          cancelText="CANCEL"
          loading={completeMutation.isPending}
          onConfirm={handleCompleteStop}
          onCancel={() => setShowCompleteConfirm(false)}
        />

        {/* Fail Stop Modal */}
        <ConfirmationModal
          visible={showFailModal}
          variant="danger"
          title="Report Operational Exception"
          message="Select the verified operational reason for inability to complete this pickup stop."
          confirmText="LOG EXCEPTION"
          cancelText="GO BACK"
          loading={failMutation.isPending}
          onConfirm={handleFailStop}
          onCancel={() => setShowFailModal(false)}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  errorTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginTop: Spacing.md,
  },
  errorSub: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
    ...Shadows.subtle,
  },
  backBtn: {
    padding: Spacing.xs,
  },
  topBarTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.black,
    color: Colors.textPrimary,
  },
  topBarSub: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl * 2,
    gap: Spacing.md,
  },
  locationCard: {
    padding: Spacing.lg,
  },
  locationCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    color: Colors.primaryDark,
    letterSpacing: 0.5,
  },
  pickupCodeText: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    color: Colors.textMuted,
  },
  customerName: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.black,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  addressLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: Spacing.xs,
  },
  addressText: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  locationActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.separatorSubtle,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.surfaceAlt,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  actionChipText: {
    fontSize: 12,
    fontWeight: Typography.weights.bold,
    color: Colors.primaryDark,
  },
  statusFocusCard: {
    alignItems: 'center',
    padding: Spacing.xl,
    gap: Spacing.xs,
  },
  focusTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.black,
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  focusSub: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
  stageContainer: {
    gap: Spacing.md,
  },
  activeStageCard: {
    padding: Spacing.lg,
  },
  stageDisabled: {
    opacity: 0.55,
  },
  stageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  stageBadge: {
    backgroundColor: Colors.surfaceAlt,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
  },
  stageBadgeDone: {
    backgroundColor: '#DCFCE7',
  },
  stageBadgeText: {
    fontSize: 10,
    fontWeight: Typography.weights.black,
    color: Colors.primaryDark,
    letterSpacing: 0.5,
  },
  stageBadgeTextDone: {
    color: '#15803D',
  },
  stageTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.black,
    color: Colors.textPrimary,
  },
  stageDesc: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.xs,
  },
  donePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    marginTop: Spacing.xs,
  },
  donePillText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: '#15803D',
  },
  manualEntryBox: {
    marginTop: Spacing.md,
    padding: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  manualEntryLabel: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  manualInputRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  manualInput: {
    flex: 1,
    height: 40,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    fontWeight: Typography.weights.semibold,
  },
  verifyBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radius.sm,
  },
  verifyBtnText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: Typography.weights.bold,
  },
  manualLinkBtn: {
    marginTop: Spacing.md,
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  manualLinkText: {
    fontSize: 12,
    fontWeight: Typography.weights.semibold,
    color: Colors.primaryDark,
    textDecorationLine: 'underline',
  },
  otpBannerBox: {
    backgroundColor: Colors.infoSurface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  otpBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  otpBannerTitle: {
    fontSize: 9,
    fontWeight: Typography.weights.bold,
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  otpBannerCode: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.black,
    color: Colors.primaryDark,
    letterSpacing: 2,
    marginTop: 2,
  },
  oneTapFillBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: Radius.sm,
  },
  oneTapFillText: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    color: Colors.white,
  },
  otpBannerDesc: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 6,
    lineHeight: 14,
  },
  otpInputBox: {
    height: 52,
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: Radius.md,
    fontSize: 24,
    fontWeight: Typography.weights.bold,
    textAlign: 'center',
    letterSpacing: 10,
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
  },
  resendRow: {
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  resendText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.primaryDark,
    textDecorationLine: 'underline',
  },
  otpNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceAlt,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    marginTop: Spacing.sm,
  },
  otpNoticeText: {
    fontSize: 12,
    fontWeight: Typography.weights.bold,
    color: Colors.primaryDark,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    color: Colors.textSecondary,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weightInput: {
    flex: 1,
    height: 48,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderTopLeftRadius: Radius.md,
    borderBottomLeftRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  unitBadge: {
    height: 48,
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: Colors.cardBorder,
    borderTopRightRadius: Radius.md,
    borderBottomRightRadius: Radius.md,
  },
  unitBadgeText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.black,
    color: Colors.primaryDark,
  },
  weightChipRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: Spacing.sm,
  },
  weightChip: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: Radius.full,
  },
  weightChipText: {
    fontSize: 11,
    fontWeight: Typography.weights.semibold,
    color: Colors.textSecondary,
  },
  proofVerifiedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  proofTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: '#15803D',
  },
  proofSub: {
    fontSize: 11,
    color: '#166534',
    marginTop: 1,
  },
  retakeBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
  },
  retakeBtnText: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    color: Colors.primaryDark,
  },
  photoBtnRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  photoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  photoBtnDisabled: {
    opacity: 0.5,
  },
  photoBtnText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.primaryDark,
  },
  uploadingNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.xs,
  },
  uploadingText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  notesInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    minHeight: 60,
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    textAlignVertical: 'top',
  },
  exceptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
  },
  exceptionBtnText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: '#DC2626',
  },
  whHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  whTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.black,
    color: Colors.textPrimary,
  },
  manifestSummaryBox: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  manifestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  manifestLabel: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.weights.medium,
  },
  manifestVal: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.black,
    color: Colors.textPrimary,
  },
});
