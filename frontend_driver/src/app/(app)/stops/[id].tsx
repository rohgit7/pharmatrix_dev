import React, { useState } from 'react';
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
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import {
  useArriveStop,
  useCompleteStop,
  useFailStop,
  useTodayRoute,
  useUploadProof,
  useVerifyOtp,
} from '@/hooks/useDriverRoute';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { DriverRouteStopResponse } from '@/types/api';

const PREDEFINED_FAIL_REASONS = [
  'Customer Unavailable / Contact Unreachable',
  'Facility Closed During Operating Hours',
  'Waste Inaccessible / Locked Storage',
  'Safety / Biohazard Non-Compliance',
  'Customer Refused Handover',
  'Incorrect Waste Classification / Segregation Failed',
];

export default function StopDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const stopId = Number(id);

  const { data: route, refetch } = useTodayRoute();
  const stop = route?.stops?.find((s) => s.id === stopId);

  // Mutations
  const arriveMutation = useArriveStop();
  const verifyOtpMutation = useVerifyOtp();
  const uploadProofMutation = useUploadProof();
  const completeMutation = useCompleteStop();
  const failMutation = useFailStop();

  // State
  const [otpInput, setOtpInput] = useState('');
  const [weightInput, setWeightInput] = useState(
    stop?.estimated_weight_kg ? String(stop.estimated_weight_kg) : ''
  );
  const [notesInput, setNotesInput] = useState('');
  const [localProofUri, setLocalProofUri] = useState<string | null>(null);

  // Modals
  const [showFailModal, setShowFailModal] = useState(false);
  const [selectedFailReason, setSelectedFailReason] = useState(PREDEFINED_FAIL_REASONS[0]);
  const [customFailReason, setCustomFailReason] = useState('');
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);

  if (!stop || !route) {
    return (
      <View style={[styles.screen, styles.centered, { paddingTop: insets.top }]}>
        <Ionicons name="alert-circle" size={48} color="#EF4444" />
        <Text style={styles.errorTitle}>Stop Not Found</Text>
        <Text style={styles.errorSub}>Could not load details for stop #{id}.</Text>
        <PrimaryButton
          title="GO BACK"
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

  // ---------------------------------------------------------------------------
  // Action Handlers
  // ---------------------------------------------------------------------------

  const handleArrive = async () => {
    try {
      await arriveMutation.mutateAsync({
        routeId: route.id,
        stopId: stop.id!,
      });
      Alert.alert('Arrived', 'Driver arrival recorded at stop.');
    } catch (err: any) {
      Alert.alert('Arrival Failed', err.message || 'Unable to record arrival.');
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpInput.trim() || otpInput.trim().length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter a valid 6-digit customer OTP.');
      return;
    }

    try {
      await verifyOtpMutation.mutateAsync({
        routeId: route.id,
        stopId: stop.id!,
        otp: otpInput.trim(),
      });
      Alert.alert('Success', 'Customer OTP verified successfully!');
      setOtpInput('');
    } catch (err: any) {
      Alert.alert('OTP Failed', err.message || 'Invalid or expired OTP.');
    }
  };

  const handlePickProofImage = async (useCamera = false) => {
    try {
      let result;
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Camera permission is required to photograph collection proof.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Media gallery permission is required.');
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

        // Immediately upload
        await uploadProofMutation.mutateAsync({
          routeId: route.id,
          stopId: stop.id!,
          fileUri: asset.uri,
          fileName: asset.fileName || 'collection_proof.jpg',
          mimeType: asset.mimeType || 'image/jpeg',
        });
        Alert.alert('Proof Uploaded', 'Collection proof photo uploaded to secure storage.');
      }
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message || 'Could not upload proof.');
    }
  };

  const handleCompleteStop = async () => {
    const weightNum = parseFloat(weightInput);

    if (isPickup) {
      if (isNaN(weightNum) || weightNum <= 0) {
        Alert.alert('Weight Required', 'Please enter a valid collected weight greater than 0 kg.');
        return;
      }
      if (!stop.proof_uploaded && !localProofUri) {
        Alert.alert('Proof Photo Required', 'You must capture or upload collection proof before completing.');
        return;
      }
    }

    try {
      await completeMutation.mutateAsync({
        routeId: route.id,
        stopId: stop.id!,
        collectedWeightKg: isPickup ? weightNum : 0,
        notes: notesInput.trim() || null,
      });

      setShowCompleteConfirm(false);
      Alert.alert(
        isPickup ? 'Pickup Completed' : 'Warehouse Handover Complete',
        isPickup
          ? 'Waste collected and invoiced. Moving to next route stop.'
          : 'Warehouse intake registered and route marked as completed.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(app)/route'),
          },
        ]
      );
    } catch (err: any) {
      setShowCompleteConfirm(false);
      Alert.alert('Completion Failed', err.message || 'Could not complete stop.');
    }
  };

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
      Alert.alert('Stop Marked Failed', 'Operational exception logged with dispatch.', [
        {
          text: 'Return to Route',
          onPress: () => router.replace('/(app)/route'),
        },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not update stop status.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        {/* Header Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.white} />
          </TouchableOpacity>

          <View style={{ flex: 1, marginLeft: Spacing.sm }}>
            <Text style={styles.topBarTitle}>STOP #{stop.sequence_number}</Text>
            <Text style={styles.topBarSubtitle}>
              {isPickup ? 'BIOMEDICAL PICKUP' : 'WAREHOUSE HANDOVER'}
            </Text>
          </View>

          <StatusBadge status={stop.execution_status} size="sm" />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Main Info Card */}
          <Card style={styles.stopCard} accentColor={isPickup ? Colors.amber : Colors.primary}>
            <View style={styles.cardHeader}>
              <View style={styles.typeTag}>
                <Ionicons
                  name={isPickup ? 'medical' : 'business'}
                  size={14}
                  color={isPickup ? Colors.amber : Colors.ice}
                />
                <Text
                  style={[
                    styles.typeTagText,
                    { color: isPickup ? Colors.amber : Colors.ice },
                  ]}
                >
                  {isPickup ? 'PHARMACEUTICAL COLLECTION' : 'CENTRAL INTAKE'}
                </Text>
              </View>
              {stop.pickup_code ? (
                <Text style={styles.codeText}>{stop.pickup_code}</Text>
              ) : null}
            </View>

            <Text style={styles.locationTitle}>
              {isPickup
                ? stop.location_name || stop.customer_name || 'Customer Location'
                : stop.warehouse_name || 'Central Facility'}
            </Text>

            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={16} color={Colors.primary} />
              <Text style={styles.metaText}>
                {stop.address}, {stop.city} {stop.postal_code || ''}
              </Text>
            </View>

            {isPickup && stop.customer_phone ? (
              <View style={styles.metaRow}>
                <Ionicons name="call-outline" size={16} color={Colors.primary} />
                <TouchableOpacity onPress={() => Linking.openURL(`tel:${stop.customer_phone}`)}>
                  <Text style={[styles.metaText, styles.linkText]}>
                    {stop.customer_phone} ({stop.customer_name || 'Contact'})
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {isPickup && stop.estimated_weight_kg ? (
              <View style={styles.expectedWeightBanner}>
                <Ionicons name="scale-outline" size={18} color={Colors.primary} />
                <Text style={styles.expectedWeightText}>
                  Expected Collection Weight:{' '}
                  <Text style={{ color: Colors.white, fontWeight: 'bold' }}>
                    {stop.estimated_weight_kg} kg
                  </Text>
                </Text>
              </View>
            ) : null}
          </Card>

          {/* If stop is already Completed */}
          {isCompleted ? (
            <Card style={styles.completedNoticeCard}>
              <Ionicons name="checkmark-circle" size={40} color={Colors.forest[500]} />
              <Text style={styles.completedCardTitle}>Stop Completed Successfully</Text>
              <Text style={styles.completedCardSubtitle}>
                {isPickup
                  ? `Collected ${stop.collected_weight_kg || 0} kg of medical waste. Invoicing and proof recorded.`
                  : 'Warehouse intake registered. Route concluded.'}
              </Text>
              {stop.proof_uploaded ? (
                <View style={styles.proofVerifiedPill}>
                  <Ionicons name="shield-checkmark" size={16} color={Colors.forest[400]} />
                  <Text style={styles.proofVerifiedText}>Proof Photo Stored in Supabase</Text>
                </View>
              ) : null}
            </Card>
          ) : isFailed ? (
            /* If stop is Failed */
            <Card style={styles.failedNoticeCard} accentColor="#EF4444">
              <Ionicons name="close-circle" size={40} color="#EF4444" />
              <Text style={styles.failedCardTitle}>Stop Marked as Failed</Text>
              <Text style={styles.failedCardReason}>
                Reason: {stop.failure_reason || 'Operational exception logged.'}
              </Text>
            </Card>
          ) : (
            /* ACTIVE WORKFLOW EXECUTION */
            <>
              {isPickup ? (
                /* PICKUP WORKFLOW */
                <View style={styles.workflowSection}>
                  {/* STEP 1: ARRIVAL & QR VERIFICATION */}
                  <Card style={styles.stepCard}>
                    <View style={styles.stepHeader}>
                      <View style={styles.stepNumberBadge}>
                        <Text style={styles.stepNumberText}>1</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                        <Text style={styles.stepTitle}>QR VERIFICATION & ARRIVAL</Text>
                        <Text style={styles.stepSub}>
                          Scan the customer's pickup QR code to verify arrival.
                        </Text>
                      </View>
                      {isArrived || isInProgress ? (
                        <Ionicons name="checkmark-circle" size={24} color={Colors.forest[500]} />
                      ) : null}
                    </View>

                    {isPending ? (
                      <View style={styles.stepActionGroup}>
                        <PrimaryButton
                          title="SCAN PICKUP QR CODE"
                          onPress={() =>
                            router.push({
                              pathname: '/scan-qr',
                              params: { stopId: stop.id, routeId: route.id },
                            })
                          }
                          icon={<Ionicons name="qr-code" size={20} color={Colors.charcoal[950]} />}
                        />
                        <TouchableOpacity
                          style={styles.secondaryArrivalBtn}
                          onPress={handleArrive}
                          disabled={arriveMutation.isPending}
                        >
                          <Text style={styles.secondaryArrivalText}>
                            {arriveMutation.isPending ? 'Marking Arrival...' : 'Mark Arrived (No QR)'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.stepDoneBanner}>
                        <Ionicons name="shield-checkmark" size={18} color={Colors.forest[400]} />
                        <Text style={styles.stepDoneText}>Arrival & QR Verified</Text>
                      </View>
                    )}
                  </Card>

                  {/* STEP 2: CUSTOMER OTP */}
                  <Card
                    style={[
                      styles.stepCard,
                      isPending && styles.stepDisabled,
                    ]}
                  >
                    <View style={styles.stepHeader}>
                      <View style={styles.stepNumberBadge}>
                        <Text style={styles.stepNumberText}>2</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                        <Text style={styles.stepTitle}>CUSTOMER OTP</Text>
                        <Text style={styles.stepSub}>
                          Ask customer for their 6-digit verification code.
                        </Text>
                      </View>
                      {isInProgress ? (
                        <Ionicons name="checkmark-circle" size={24} color={Colors.forest[500]} />
                      ) : null}
                    </View>

                    {isInProgress ? (
                      <View style={styles.stepDoneBanner}>
                        <Ionicons name="key" size={18} color={Colors.forest[400]} />
                        <Text style={styles.stepDoneText}>Customer OTP Verified</Text>
                      </View>
                    ) : isArrived ? (
                      <View style={styles.otpInputSection}>
                        <TextInput
                          style={styles.otpInput}
                          placeholder="6-DIGIT CODE"
                          placeholderTextColor={Colors.textMuted}
                          keyboardType="number-pad"
                          maxLength={6}
                          value={otpInput}
                          onChangeText={setOtpInput}
                        />
                        <PrimaryButton
                          title="VERIFY OTP"
                          onPress={handleVerifyOtp}
                          loading={verifyOtpMutation.isPending}
                          size="md"
                          style={{ marginTop: Spacing.sm }}
                        />
                      </View>
                    ) : null}
                  </Card>

                  {/* STEP 3: WEIGHT & COLLECTION PROOF */}
                  <Card
                    style={[
                      styles.stepCard,
                      (isPending || isArrived) && styles.stepDisabled,
                    ]}
                  >
                    <View style={styles.stepHeader}>
                      <View style={styles.stepNumberBadge}>
                        <Text style={styles.stepNumberText}>3</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                        <Text style={styles.stepTitle}>RECORD WEIGHT & PROOF</Text>
                        <Text style={styles.stepSub}>
                          Weigh waste bags and photograph the collection proof.
                        </Text>
                      </View>
                    </View>

                    {isInProgress ? (
                      <View style={styles.weightForm}>
                        <Text style={styles.inputFieldLabel}>COLLECTED WEIGHT (KG) *</Text>
                        <View style={styles.weightInputRow}>
                          <TextInput
                            style={styles.weightTextInput}
                            placeholder="0.0"
                            placeholderTextColor={Colors.textMuted}
                            keyboardType="decimal-pad"
                            value={weightInput}
                            onChangeText={setWeightInput}
                          />
                          <View style={styles.weightUnitBadge}>
                            <Text style={styles.weightUnitText}>KG</Text>
                          </View>
                        </View>

                        {/* Proof Photo Attachment */}
                        <Text style={[styles.inputFieldLabel, { marginTop: Spacing.md }]}>
                          PROOF PHOTOGRAPH *
                        </Text>

                        {stop.proof_uploaded || localProofUri ? (
                          <View style={styles.proofPreviewBox}>
                            <Ionicons name="image" size={32} color={Colors.forest[400]} />
                            <Text style={styles.proofPreviewText}>Proof Photo Attached & Uploaded</Text>
                            <TouchableOpacity
                              style={styles.retakeBtn}
                              onPress={() => handlePickProofImage(true)}
                            >
                              <Text style={styles.retakeBtnText}>Retake Photo</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <View style={styles.photoButtonRow}>
                            <TouchableOpacity
                              style={styles.photoPickerBtn}
                              onPress={() => handlePickProofImage(true)}
                              disabled={uploadProofMutation.isPending}
                            >
                              <Ionicons name="camera" size={22} color={Colors.primary} />
                              <Text style={styles.photoPickerText}>Take Photo</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.photoPickerBtn}
                              onPress={() => handlePickProofImage(false)}
                              disabled={uploadProofMutation.isPending}
                            >
                              <Ionicons name="images" size={22} color={Colors.primary} />
                              <Text style={styles.photoPickerText}>Gallery</Text>
                            </TouchableOpacity>
                          </View>
                        )}

                        {uploadProofMutation.isPending ? (
                          <View style={styles.uploadingNotice}>
                            <ActivityIndicator size="small" color={Colors.primary} />
                            <Text style={styles.uploadingNoticeText}>
                              Uploading image to secure storage...
                            </Text>
                          </View>
                        ) : null}

                        {/* Optional Driver Notes */}
                        <Text style={[styles.inputFieldLabel, { marginTop: Spacing.md }]}>
                          DRIVER NOTES (OPTIONAL)
                        </Text>
                        <TextInput
                          style={styles.notesTextInput}
                          placeholder="Add any packaging, container, or access notes..."
                          placeholderTextColor={Colors.textMuted}
                          value={notesInput}
                          onChangeText={setNotesInput}
                          multiline
                        />
                      </View>
                    ) : null}
                  </Card>

                  {/* FINAL COMPLETION BUTTON */}
                  {isInProgress ? (
                    <PrimaryButton
                      title="COMPLETE PICKUP"
                      onPress={() => setShowCompleteConfirm(true)}
                      loading={completeMutation.isPending}
                      icon={<Ionicons name="checkmark-circle" size={22} color={Colors.charcoal[950]} />}
                      style={{ marginTop: Spacing.md }}
                    />
                  ) : null}

                  {/* Report Exception Button */}
                  <TouchableOpacity
                    style={styles.failStopTrigger}
                    onPress={() => setShowFailModal(true)}
                  >
                    <Ionicons name="alert-circle-outline" size={18} color="#EF4444" />
                    <Text style={styles.failStopTriggerText}>REPORT PICKUP EXCEPTION / FAILURE</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                /* WAREHOUSE HANDOVER WORKFLOW */
                <View style={styles.workflowSection}>
                  <Card style={styles.stepCard} accentColor={Colors.primary}>
                    <View style={styles.stepHeader}>
                      <Ionicons name="business" size={28} color={Colors.primary} />
                      <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                        <Text style={styles.stepTitle}>WAREHOUSE INTAKE HANDOVER</Text>
                        <Text style={styles.stepSub}>
                          Deliver collected route waste to central warehouse.
                        </Text>
                      </View>
                    </View>

                    {/* Summary of Route Pickups */}
                    <View style={styles.intakeSummaryBox}>
                      <Text style={styles.intakeSummaryHeader}>ROUTE RUN SUMMARY</Text>
                      <View style={styles.intakeSummaryRow}>
                        <Text style={styles.intakeLabel}>Completed Pickups:</Text>
                        <Text style={styles.intakeValue}>
                          {route.stops.filter((s) => s.stop_type === 'PICKUP' && s.execution_status === 'COMPLETED').length}
                        </Text>
                      </View>
                      <View style={styles.intakeSummaryRow}>
                        <Text style={styles.intakeLabel}>Total Collected Weight:</Text>
                        <Text style={[styles.intakeValue, { color: Colors.primary }]}>
                          {route.stops
                            .filter((s) => s.stop_type === 'PICKUP')
                            .reduce((acc, s) => acc + (s.collected_weight_kg || 0), 0)
                            .toFixed(2)}{' '}
                          kg
                        </Text>
                      </View>
                    </View>

                    {isPending ? (
                      <PrimaryButton
                        title="ARRIVE AT WAREHOUSE"
                        onPress={handleArrive}
                        loading={arriveMutation.isPending}
                        icon={<Ionicons name="location" size={20} color={Colors.charcoal[950]} />}
                        style={{ marginTop: Spacing.md }}
                      />
                    ) : (
                      <PrimaryButton
                        title="COMPLETE WAREHOUSE INTAKE"
                        onPress={() => setShowCompleteConfirm(true)}
                        loading={completeMutation.isPending}
                        icon={<Ionicons name="checkmark-done" size={20} color={Colors.charcoal[950]} />}
                        style={{ marginTop: Spacing.md }}
                      />
                    )}
                  </Card>
                </View>
              )}
            </>
          )}
        </ScrollView>

        {/* Confirmation Modal for Complete Stop */}
        <ConfirmationModal
          visible={showCompleteConfirm}
          title={isPickup ? 'Complete This Pickup?' : 'Complete Warehouse Handover?'}
          message={
            isPickup
              ? `You are confirming collection of ${weightInput || 0} kg of medical waste. This will generate a customer invoice and mark this stop as settled.`
              : 'You are submitting the warehouse intake. This completes today’s entire route.'
          }
          confirmText="Yes, Complete"
          loading={completeMutation.isPending}
          onConfirm={handleCompleteStop}
          onCancel={() => setShowCompleteConfirm(false)}
        />

        {/* Modal for Stop Failure / Exception */}
        <ConfirmationModal
          visible={showFailModal}
          title="Mark Stop as Failed"
          message="Select the operational exception reason. This will alert dispatch immediately."
          variant="danger"
          confirmText="Submit Failure"
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
    backgroundColor: Colors.navyDark,
  },
  screen: {
    flex: 1,
    backgroundColor: Colors.navyDark,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  errorTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.white,
    marginTop: Spacing.md,
  },
  errorSub: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.navy,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  backButton: {
    padding: Spacing.xs,
  },
  topBarTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.black,
    color: Colors.white,
    letterSpacing: 0.5,
  },
  topBarSubtitle: {
    fontSize: 10,
    color: Colors.primary,
    fontWeight: Typography.weights.bold,
    letterSpacing: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl * 2,
  },
  stopCard: {
    marginBottom: Spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  typeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  typeTagText: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    letterSpacing: 1,
  },
  codeText: {
    fontSize: 10,
    color: Colors.textMuted,
    backgroundColor: Colors.background,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  locationTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.black,
    color: Colors.white,
    marginTop: 2,
    marginBottom: Spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
    gap: Spacing.xs,
  },
  metaText: {
    flex: 1,
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  linkText: {
    color: Colors.primary,
    fontWeight: Typography.weights.bold,
  },
  expectedWeightBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  expectedWeightText: {
    fontSize: Typography.sizes.xs,
    color: Colors.primary,
  },
  completedNoticeCard: {
    alignItems: 'center',
    padding: Spacing.xl,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderColor: Colors.forest[500],
  },
  completedCardTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.forest[400],
    marginTop: Spacing.sm,
  },
  completedCardSubtitle: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: Spacing.xs,
  },
  proofVerifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    marginTop: Spacing.md,
    gap: 6,
  },
  proofVerifiedText: {
    color: Colors.forest[400],
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semibold,
  },
  failedNoticeCard: {
    alignItems: 'center',
    padding: Spacing.xl,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  failedCardTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: '#EF4444',
    marginTop: Spacing.sm,
  },
  failedCardReason: {
    fontSize: Typography.sizes.xs,
    color: '#FCA5A5',
    textAlign: 'center',
    marginTop: Spacing.xs,
    fontWeight: Typography.weights.semibold,
  },
  workflowSection: {
    gap: Spacing.md,
  },
  stepCard: {
    backgroundColor: Colors.surface,
  },
  stepDisabled: {
    opacity: 0.5,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    color: Colors.charcoal[950],
    fontWeight: Typography.weights.black,
    fontSize: Typography.sizes.xs,
  },
  stepTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.white,
    letterSpacing: 0.5,
  },
  stepSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  stepActionGroup: {
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  secondaryArrivalBtn: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  secondaryArrivalText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semibold,
  },
  stepDoneBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  stepDoneText: {
    color: Colors.forest[400],
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
  },
  otpInputSection: {
    marginTop: Spacing.md,
  },
  otpInput: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    color: Colors.white,
    textAlign: 'center',
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.black,
    letterSpacing: 8,
    height: 54,
  },
  weightForm: {
    marginTop: Spacing.md,
  },
  inputFieldLabel: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
    letterSpacing: 1,
    marginBottom: Spacing.xs,
  },
  weightInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    height: 52,
    paddingHorizontal: Spacing.md,
  },
  weightTextInput: {
    flex: 1,
    color: Colors.white,
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
  },
  weightUnitBadge: {
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  weightUnitText: {
    color: Colors.primary,
    fontWeight: Typography.weights.bold,
    fontSize: Typography.sizes.xs,
  },
  photoButtonRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  photoPickerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    height: 48,
    gap: Spacing.xs,
  },
  photoPickerText: {
    color: Colors.white,
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
  },
  proofPreviewBox: {
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  proofPreviewText: {
    color: Colors.forest[400],
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    marginTop: 4,
  },
  retakeBtn: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.sm,
  },
  retakeBtnText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: Typography.weights.bold,
  },
  uploadingNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
    gap: Spacing.xs,
  },
  uploadingNoticeText: {
    fontSize: 11,
    color: Colors.primary,
  },
  notesTextInput: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    color: Colors.white,
    padding: Spacing.md,
    minHeight: 60,
    fontSize: Typography.sizes.xs,
    textAlignVertical: 'top',
  },
  failStopTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    marginTop: Spacing.xs,
    gap: Spacing.xs,
  },
  failStopTriggerText: {
    color: '#EF4444',
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.5,
  },
  intakeSummaryBox: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  intakeSummaryHeader: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: Spacing.xs,
  },
  intakeSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  intakeLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
  },
  intakeValue: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    color: Colors.white,
  },
});
