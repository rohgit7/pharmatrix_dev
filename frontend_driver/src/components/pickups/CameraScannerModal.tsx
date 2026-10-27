import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../../theme';

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
    onScanned(data);
    setTimeout(() => {
      setHasScanned(false);
      onClose();
    }, 400);
  };

  const handleManualSubmit = () => {
    const code = manualCode.trim() || expectedCode || '';
    if (code) {
      onScanned(code);
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Scan Consignment Barcode / QR</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
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
              <Text style={styles.reticlePrompt}>Align pickup QR code within target area</Text>
            </View>
          </View>
        ) : (
          <View style={styles.permissionPlaceholder}>
            <Ionicons name="qr-code-outline" size={60} color={colors.primaryAction} />
            <Text style={styles.placeholderTitle}>Camera Scanning</Text>
            <Text style={styles.placeholderSub}>
              {Platform.OS === 'web'
                ? 'Web simulator active. Enter or confirm the pickup token below:'
                : 'Camera permission is required for hardware laser scanning.'}
            </Text>
            {Platform.OS !== 'web' && !permission?.granted && (
              <TouchableOpacity style={styles.grantBtn} onPress={requestPermission}>
                <Text style={styles.grantBtnText}>Grant Camera Permission</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Manual Code Fallback */}
        <View style={styles.manualEntryCard}>
          <Text style={styles.manualLabel}>Quick Code Verification:</Text>
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
              <Ionicons name="checkmark" size={18} color="#FFFFFF" />
              <Text style={styles.submitBtnText}>Verify</Text>
            </TouchableOpacity>
          </View>
          {expectedCode ? (
            <TouchableOpacity
              style={styles.autoFillBtn}
              onPress={() => {
                setManualCode(expectedCode);
              }}
            >
              <Text style={styles.autoFillText}>Use Expected Code: {expectedCode}</Text>
            </TouchableOpacity>
          ) : null}
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
    width: 240,
    height: 240,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticleCornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 32,
    height: 32,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: colors.primaryAction,
  },
  reticleCornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 32,
    height: 32,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: colors.primaryAction,
  },
  reticleCornerBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 32,
    height: 32,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: colors.primaryAction,
  },
  reticleCornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: colors.primaryAction,
  },
  reticlePrompt: {
    ...typography.bodySm,
    color: '#FFFFFF',
    fontSize: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
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
    ...typography.headlineMd,
    color: '#FFFFFF',
    marginTop: 8,
  },
  placeholderSub: {
    ...typography.bodyMd,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 20,
  },
  grantBtn: {
    backgroundColor: colors.primaryAction,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: radii.lg,
    marginTop: 8,
  },
  grantBtnText: {
    ...typography.labelMd,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  manualEntryCard: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.gutter,
    paddingBottom: 36,
    gap: 8,
  },
  manualLabel: {
    ...typography.labelSm,
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    height: 48,
    backgroundColor: colors.surfaceLow,
    borderRadius: radii.lg,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  submitBtn: {
    backgroundColor: colors.primaryDark,
    borderRadius: radii.lg,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  submitBtnText: {
    ...typography.labelMd,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  autoFillBtn: {
    paddingVertical: 4,
  },
  autoFillText: {
    ...typography.bodySm,
    fontSize: 11,
    color: colors.primaryDark,
    textDecorationLine: 'underline',
  },
});

export default CameraScannerModal;
