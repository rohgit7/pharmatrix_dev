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
  const params = useLocalSearchParams<{ stopId: string; routeId: string; pickupCode?: string }>();
  const stopId = Number(params.stopId);
  const routeId = Number(params.routeId);
  const pickupCode = params.pickupCode;

  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [manualCode, setManualCode] = useState(pickupCode || '');
  const [showManualInput, setShowManualInput] = useState(false);

  const scanQrMutation = useScanQr();

  const handleVerifyToken = async (token: string) => {
    if (!token.trim()) {
      Alert.alert('Required', 'Please enter the QR token string.');
      return;
    }

    try {
      const res = await scanQrMutation.mutateAsync({
        routeId,
        stopId,
        qrToken: token.trim(),
      });
      const otpMsg = res.otp ? `\n\nCustomer Handshake OTP: ${res.otp}` : '';
      Alert.alert(
        'QR Verified',
        `Customer Pickup QR verified successfully!${otpMsg}`,
        [
          {
            text: 'Continue to Customer Handshake',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Verification Failed', err.message || 'Invalid QR code or manifest reference.');
    }
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scanned || scanQrMutation.isPending) return;
    setScanned(true);
    await handleVerifyToken(data);
  };

  const handleManualSubmit = async () => {
    await handleVerifyToken(manualCode);
  };

  if (!permission) {
    return (
      <View style={styles.permissionScreen}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.permissionDesc}>Checking camera permissions...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionScreen}>
        <Ionicons name="camera-outline" size={56} color={Colors.primary} />
        <Text style={styles.permissionTitle}>Camera Permission Required</Text>
        <Text style={styles.permissionDesc}>
          Pharmatrix needs camera access to scan customer waste container QR codes.
        </Text>
        <PrimaryButton
          title="GRANT CAMERA ACCESS"
          onPress={requestPermission}
          style={{ marginTop: Spacing.xl, width: '100%', maxWidth: 300 }}
        />
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Text style={styles.closeBtnText}>Cancel & Go Back</Text>
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

      {/* Overlay */}
      <View style={styles.overlay}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.circleBtn}
            onPress={() => router.back()}
          >
            <Ionicons name="close" size={24} color={Colors.white} />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>SCAN PICKUP QR</Text>

          <TouchableOpacity
            style={styles.circleBtn}
            onPress={() => setTorch(!torch)}
          >
            <Ionicons
              name={torch ? 'flash' : 'flash-outline'}
              size={22}
              color={torch ? Colors.primary : Colors.white}
            />
          </TouchableOpacity>
        </View>

        {/* Viewfinder Frame */}
        <View style={styles.viewfinderBox}>
          <View style={styles.frame}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />

            {scanQrMutation.isPending ? (
              <ActivityIndicator size="large" color={Colors.primary} />
            ) : null}
          </View>
          <Text style={styles.instructionText}>Align container QR code inside frame</Text>
        </View>

        {/* Bottom Bar */}
        <View style={styles.bottomBar}>
          {showManualInput ? (
            <View style={styles.manualCard}>
              <Text style={styles.manualLabel}>ENTER QR VERIFICATION TOKEN</Text>
              <TextInput
                style={styles.manualInput}
                placeholder="Paste or type token string"
                placeholderTextColor={Colors.textMuted}
                value={manualCode}
                onChangeText={setManualCode}
                autoCapitalize="none"
              />
              <View style={styles.manualBtnRow}>
                <TouchableOpacity
                  style={styles.cancelManualBtn}
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
            <View style={styles.actionButtonGroup}>
              {pickupCode ? (
                <TouchableOpacity
                  style={styles.quickVerifyCodeBtn}
                  onPress={() => handleVerifyToken(pickupCode)}
                  disabled={scanQrMutation.isPending}
                >
                  <Ionicons name="checkmark-circle" size={18} color={Colors.white} />
                  <Text style={styles.quickVerifyCodeText}>
                    {scanQrMutation.isPending ? 'Verifying...' : `Verify Code: ${pickupCode}`}
                  </Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={styles.manualTriggerBtn}
                onPress={() => setShowManualInput(true)}
              >
                <Ionicons name="keypad-outline" size={18} color={Colors.primary} />
                <Text style={styles.manualTriggerText}>Enter QR Token Manually</Text>
              </TouchableOpacity>
            </View>
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
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  permissionTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginTop: Spacing.md,
  },
  permissionDesc: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
    maxWidth: 280,
  },
  closeBtn: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
  },
  closeBtnText: {
    color: Colors.textMuted,
    fontWeight: Typography.weights.bold,
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.35)',
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
  circleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewfinderBox: {
    alignItems: 'center',
  },
  frame: {
    width: 250,
    height: 250,
    borderRadius: Radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: Colors.primary,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 8,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 8,
  },
  instructionText: {
    color: Colors.white,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
    marginTop: Spacing.xl,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  bottomBar: {
    paddingHorizontal: Spacing.xl,
  },
  actionButtonGroup: {
    gap: Spacing.sm,
  },
  quickVerifyCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },
  quickVerifyCodeText: {
    color: Colors.white,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
  },
  manualTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  manualTriggerText: {
    color: Colors.primary,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
  },
  manualCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  manualLabel: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
    marginBottom: Spacing.xs,
  },
  manualInput: {
    backgroundColor: Colors.background,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    color: Colors.textPrimary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: Typography.sizes.sm,
    marginBottom: Spacing.md,
  },
  manualBtnRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  cancelManualBtn: {
    flex: 1,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.separatorSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelManualText: {
    color: Colors.textMuted,
    fontWeight: Typography.weights.semibold,
  },
});
