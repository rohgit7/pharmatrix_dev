import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../../theme';
import { parsePickupQrPayload } from '../../utils/qr';

interface CameraScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScanned: (data: string) => void;
  expectedCode?: string;
}

export const CameraScannerModal: React.FC<CameraScannerModalProps> = ({
  visible,
  onClose,
  onScanned,
  expectedCode,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [manualCode, setManualCode] = useState<string>('');
  const [hasScanned, setHasScanned] = useState<boolean>(false);

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (hasScanned) return;
    setHasScanned(true);

    const parsed = parsePickupQrPayload(data);
    const codeToSend = parsed.pickupCode || parsed.pickupId || data;

    onScanned(codeToSend);
    setTimeout(() => {
      setHasScanned(false);
      onClose();
    }, 400);
  };

  const handleManualSubmit = () => {
    const raw = manualCode.trim() || expectedCode || '';
    if (raw) {
      const parsed = parsePickupQrPayload(raw);
      const codeToSend = parsed.pickupCode || parsed.pickupId || raw;
      onScanned(codeToSend);
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Scan Consignment QR</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Live Camera View if on Native & Permitted */}
        {Platform.OS !== 'web' && permission?.granted ? (
          <View style={styles.cameraBox}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ['qr', 'code128', 'code39'],
              }}
              onBarcodeScanned={handleBarcodeScanned}
            />
            <View style={styles.reticleOverlay}>
              <View style={styles.reticleCornerTL} />
              <View style={styles.reticleCornerTR} />
              <View style={styles.reticleCornerBL} />
              <View style={styles.reticleCornerBR} />
              <Text style={styles.reticlePrompt}>Align QR code inside frame</Text>
            </View>
          </View>
        ) : (
          <View style={styles.permissionPlaceholder}>
            <Ionicons name="qr-code-outline" size={56} color={colors.primaryAccent} />
            <Text style={styles.placeholderTitle}>Camera Access</Text>
            <Text style={styles.placeholderSub}>
              {Platform.OS === 'web'
                ? 'Web simulator: Enter or confirm pickup code below.'
                : 'Camera permission is required to scan pickup labels.'}
            </Text>
            {Platform.OS !== 'web' && !permission?.granted && (
              <TouchableOpacity style={styles.grantBtn} onPress={requestPermission}>
                <Text style={styles.grantBtnText}>Allow Camera Access</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Manual Code Fallback */}
        <View style={styles.manualEntryCard}>
          <Text style={styles.manualLabel}>Manual Code Entry</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder={expectedCode || 'Enter pickup barcode/QR'}
              placeholderTextColor={colors.textOutline}
              value={manualCode}
              onChangeText={setManualCode}
              autoCapitalize="characters"
            />
            <TouchableOpacity style={styles.submitBtn} onPress={handleManualSubmit}>
              <Text style={styles.submitBtnText}>Verify</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'space-between',
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: {
    ...typography.headlineSm,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  cameraBox: {
    flex: 1,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticleOverlay: {
    width: 220,
    height: 220,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticleCornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 24,
    height: 24,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: colors.primaryAccent,
  },
  reticleCornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 24,
    height: 24,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: colors.primaryAccent,
  },
  reticleCornerBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 24,
    height: 24,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: colors.primaryAccent,
  },
  reticleCornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: colors.primaryAccent,
  },
  reticlePrompt: {
    ...typography.bodySm,
    color: '#FFFFFF',
    fontSize: 12,
    position: 'absolute',
    bottom: -32,
    textAlign: 'center',
  },
  permissionPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  placeholderTitle: {
    ...typography.headlineSm,
    color: '#FFFFFF',
    fontSize: 18,
  },
  placeholderSub: {
    ...typography.bodySm,
    color: '#A89D91',
    textAlign: 'center',
    fontSize: 13,
  },
  grantBtn: {
    backgroundColor: colors.primaryAccent,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: radii.md,
    marginTop: 8,
  },
  grantBtnText: {
    ...typography.labelMd,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  manualEntryCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.md,
    paddingBottom: 32,
    gap: 8,
  },
  manualLabel: {
    ...typography.labelSm,
    fontSize: 11,
    color: colors.primary,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    height: 44,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.secondary,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    ...typography.bodyMd,
    color: colors.primary,
  },
  submitBtn: {
    backgroundColor: colors.primaryAccent,
    paddingHorizontal: 18,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    ...typography.labelMd,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});

export default CameraScannerModal;
