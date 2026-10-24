import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useScanQr } from '@/hooks/useDriverRoute';
import { PrimaryButton } from '@/components/PrimaryButton';

export default function ScanQrModal() {
  const router = useRouter();
  const params = useLocalSearchParams<{ stopId: string; routeId: string }>();
  const stopId = Number(params.stopId);
  const routeId = Number(params.routeId);

  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  const scanQrMutation = useScanQr();

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scanned || scanQrMutation.isPending) return;
    setScanned(true);

    try {
      await scanQrMutation.mutateAsync({
        routeId,
        stopId,
        qrToken: data.trim(),
      });
      Alert.alert('Verified', 'Customer Pickup QR verified successfully!', [
        {
          text: 'Continue to OTP',
          onPress: () => router.back(),
        },
      ]);
    } catch (err: any) {
      Alert.alert('Verification Failed', err.message || 'Invalid QR code.', [
        {
          text: 'Scan Again',
          onPress: () => setScanned(false),
        },
      ]);
    }
  };

  const handleManualSubmit = async () => {
    if (!manualCode.trim()) {
      Alert.alert('Required', 'Please enter the QR token string.');
      return;
    }

    try {
      await scanQrMutation.mutateAsync({
        routeId,
        stopId,
        qrToken: manualCode.trim(),
      });
      Alert.alert('Verified', 'Customer Pickup QR verified successfully!', [
        {
          text: 'Continue',
          onPress: () => router.back(),
        },
      ]);
    } catch (err: any) {
      Alert.alert('Failed', err.message || 'Invalid token.');
    }
  };

  if (!permission) {
    return (
      <View style={styles.permissionScreen}>
        <ActivityIndicator size="large" color={Colors.amber} />
        <Text style={styles.permissionDesc}>Checking camera permissions...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionScreen}>
        <Ionicons name="camera-outline" size={56} color={Colors.amber} />
        <Text style={styles.permissionTitle}>Camera Permission Required</Text>
        <Text style={styles.permissionDesc}>
          Pharmatrix needs camera access to scan customer biomedical waste pickup QR codes.
        </Text>
        <PrimaryButton
          title="GRANT CAMERA ACCESS"
          onPress={requestPermission}
          style={{ marginTop: Spacing.xl, width: '100%', maxWidth: 300 }}
        />
        <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
          <Text style={styles.closeButtonText}>Cancel & Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        enableTorch={torch}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />

      {/* Camera Overlay */}
      <View style={styles.overlay}>
        {/* Top Controls */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.circleButton}
            onPress={() => router.back()}
          >
            <Ionicons name="close" size={24} color={Colors.white} />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>SCAN PICKUP QR</Text>

          <TouchableOpacity
            style={styles.circleButton}
            onPress={() => setTorch(!torch)}
          >
            <Ionicons
              name={torch ? 'flash' : 'flash-outline'}
              size={22}
              color={torch ? Colors.amber : Colors.white}
            />
          </TouchableOpacity>
        </View>

        {/* Viewfinder Frame */}
        <View style={styles.viewfinderContainer}>
          <View style={styles.viewfinderFrame}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />

            {scanQrMutation.isPending ? (
              <ActivityIndicator size="large" color={Colors.amber} />
            ) : null}
          </View>
          <Text style={styles.instructionText}>
            Align the customer's QR code within the frame
          </Text>
        </View>

        {/* Bottom Options */}
        <View style={styles.bottomBar}>
          {showManualInput ? (
            <View style={styles.manualInputCard}>
              <Text style={styles.manualInputLabel}>ENTER QR VERIFICATION TOKEN</Text>
              <TextInput
                style={styles.manualTextInput}
                placeholder="Paste or type token string"
                placeholderTextColor={Colors.textMuted}
                value={manualCode}
                onChangeText={setManualCode}
                autoCapitalize="none"
              />
              <View style={styles.manualButtonRow}>
                <TouchableOpacity
                  style={styles.cancelManualButton}
                  onPress={() => setShowManualInput(false)}
                >
                  <Text style={styles.cancelManualText}>Cancel</Text>
                </TouchableOpacity>
                <PrimaryButton
                  title="VERIFY"
                  size="md"
                  loading={scanQrMutation.isPending}
                  onPress={handleManualSubmit}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.manualTriggerButton}
              onPress={() => setShowManualInput(true)}
            >
              <Ionicons name="keypad-outline" size={18} color={Colors.amber} />
              <Text style={styles.manualTriggerText}>Trouble scanning? Enter token manually</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionScreen: {
    flex: 1,
    backgroundColor: Colors.navyDark,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  permissionTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.white,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  permissionDesc: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: Spacing.sm,
    maxWidth: 300,
  },
  closeButton: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
  },
  closeButtonText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingVertical: Spacing.xl,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  headerTitle: {
    color: Colors.white,
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.black,
    letterSpacing: 1.5,
  },
  circleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(20, 33, 61, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  viewfinderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewfinderFrame: {
    width: 260,
    height: 260,
    borderRadius: Radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: Colors.amber,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 10,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 10,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 10,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 10,
  },
  instructionText: {
    color: Colors.white,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
    marginTop: Spacing.xl,
    textAlign: 'center',
    backgroundColor: 'rgba(20, 33, 61, 0.7)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  bottomBar: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  manualTriggerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20, 33, 61, 0.9)',
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  manualTriggerText: {
    color: Colors.amber,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
  },
  manualInputCard: {
    backgroundColor: Colors.navy,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  manualInputLabel: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    color: Colors.amber,
    marginBottom: Spacing.xs,
  },
  manualTextInput: {
    backgroundColor: '#0F1A2F',
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    color: Colors.white,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: Typography.sizes.sm,
    marginBottom: Spacing.md,
  },
  manualButtonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  cancelManualButton: {
    flex: 1,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelManualText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
  },
});
