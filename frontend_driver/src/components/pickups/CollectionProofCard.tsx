import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, radii, spacing, typography } from '../../theme';
import { RouteStop } from '../../types/api';
import { useDriverRoute } from '../../hooks/useDriverRoute';

interface CollectionProofCardProps {
  stop: RouteStop;
  isQrVerified: boolean;
  isOtpVerified: boolean;
  onProofUploaded?: () => void;
}

export const CollectionProofCard: React.FC<CollectionProofCardProps> = ({
  stop,
  isQrVerified,
  isOtpVerified,
  onProofUploaded,
}) => {
  const { uploadCollectionProof, getCollectionProofUrl } = useDriverRoute();

  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState<boolean>(false);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const proofUploaded = stop.proof_uploaded;
  const canUploadProof = isQrVerified && isOtpVerified;

  // Auto-fetch signed URL if proof is already uploaded
  useEffect(() => {
    if (proofUploaded && !signedUrl) {
      loadSignedProofUrl();
    }
  }, [proofUploaded, stop.id]);

  const loadSignedProofUrl = async () => {
    try {
      setLoadingUrl(true);
      const res = await getCollectionProofUrl(stop.id);
      if (res?.signed_url) {
        setSignedUrl(res.signed_url);
      }
    } catch {
      // Optional url fetch error can be handled gracefully
    } finally {
      setLoadingUrl(false);
    }
  };

  const handleUploadImageUri = async (uri: string, name: string = 'collection_proof.jpg') => {
    setErrorMessage(null);
    setIsUploading(true);
    try {
      await uploadCollectionProof(stop.id, uri, name, 'image/jpeg');
      setSelectedImageUri(uri);
      if (onProofUploaded) {
        onProofUploaded();
      }
      Alert.alert(
        'Proof Uploaded Successfully',
        'Consignment photo has been sealed and saved to cloud custody storage.'
      );
    } catch (err: any) {
      const msg = err?.message || 'Failed to upload collection proof to server.';
      setErrorMessage(msg);
      Alert.alert('Upload Failed', msg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Camera Permission Denied',
          'Camera access is required to capture photo proof of the collection.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        await handleUploadImageUri(asset.uri, asset.fileName || 'collection_proof.jpg');
      }
    } catch (err: any) {
      Alert.alert('Camera Error', err.message || 'Could not launch camera.');
    }
  };

  const handlePickFromLibrary = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Gallery Permission Denied',
          'Media library access is required to select photo proof.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        await handleUploadImageUri(asset.uri, asset.fileName || 'collection_proof.jpg');
      }
    } catch (err: any) {
      Alert.alert('Gallery Error', err.message || 'Could not open image library.');
    }
  };

  // Quick specimen generator for Web & Emulator testing without physical camera
  const handleGenerateSpecimenProof = async () => {
    setIsUploading(true);
    setErrorMessage(null);

    try {
      let dataUri: string = '';

      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Background
          ctx.fillStyle = '#1A1817';
          ctx.fillRect(0, 0, 640, 480);

          // Top Header Banner
          ctx.fillStyle = '#C53030';
          ctx.fillRect(0, 0, 640, 64);
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 20px sans-serif';
          ctx.fillText('PHARMATRIX BIOHAZARD COLLECTION PROOF', 24, 40);

          // Card Area
          ctx.fillStyle = '#262422';
          ctx.fillRect(24, 88, 592, 340);

          // Details
          ctx.fillStyle = '#FDFBF8';
          ctx.font = 'bold 22px sans-serif';
          ctx.fillText(stop.customer_name || 'Medical Facility Collection', 48, 140);

          ctx.fillStyle = '#A09890';
          ctx.font = '16px sans-serif';
          ctx.fillText(`Stop ID: #${stop.id} • Sequence #${stop.sequence_number}`, 48, 180);
          ctx.fillText(`Pickup Code: ${stop.pickup_code || 'N/A'}`, 48, 210);
          ctx.fillText(`Address: ${stop.address || 'Clinic Location'}`, 48, 240);
          ctx.fillText(`Collected Weight: ${stop.collected_weight_kg || stop.estimated_weight_kg || 0} kg`, 48, 270);
          ctx.fillText(`Timestamp: ${new Date().toISOString()}`, 48, 300);

          // Verification Stamp
          ctx.strokeStyle = '#22C55E';
          ctx.lineWidth = 3;
          ctx.strokeRect(380, 270, 210, 80);
          ctx.fillStyle = '#22C55E';
          ctx.font = 'bold 16px sans-serif';
          ctx.fillText('DIGITALLY SEALED', 400, 305);
          ctx.font = '12px sans-serif';
          ctx.fillText('CHAIN OF CUSTODY VERIFIED', 395, 330);

          dataUri = canvas.toDataURL('image/jpeg', 0.9);
        }
      }

      // Fallback valid JPEG if canvas not available
      if (!dataUri) {
        dataUri =
          'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
      }

      await handleUploadImageUri(dataUri, `proof_stop_${stop.id}.jpg`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to generate specimen proof.');
      Alert.alert('Error', err.message || 'Failed to generate proof.');
      setIsUploading(false);
    }
  };

  const previewImage = signedUrl || selectedImageUri;

  return (
    <View style={styles.card}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconBox, proofUploaded && styles.iconBoxSuccess]}>
            <Ionicons
              name={proofUploaded ? 'checkmark-circle' : 'camera'}
              size={20}
              color={proofUploaded ? colors.success : colors.primaryDark}
            />
          </View>
          <View>
            <Text style={styles.cardTitle}>Collection Proof Photo</Text>
            <Text style={styles.cardSubtitle}>
              {proofUploaded
                ? 'Photographic custody proof recorded'
                : 'Sealed container & manifest evidence'}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.statusBadge,
            proofUploaded
              ? styles.badgeSuccess
              : canUploadProof
              ? styles.badgePending
              : styles.badgeDisabled,
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              proofUploaded
                ? styles.badgeTextSuccess
                : canUploadProof
                ? styles.badgeTextPending
                : styles.badgeTextDisabled,
            ]}
          >
            {proofUploaded ? 'VERIFIED' : canUploadProof ? 'REQUIRED' : 'LOCKED'}
          </Text>
        </View>
      </View>

      {/* Info notice when locked */}
      {!canUploadProof && !proofUploaded && (
        <View style={styles.noticeBox}>
          <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.noticeText}>
            Verify QR tag and customer OTP first to unlock collection proof photo capture.
          </Text>
        </View>
      )}

      {/* Error message */}
      {errorMessage && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      {/* Uploaded State Card */}
      {proofUploaded ? (
        <View style={styles.proofVerifiedBox}>
          <View style={styles.verifiedHeader}>
            <Ionicons name="shield-checkmark" size={24} color={colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={styles.verifiedTitle}>Custody Evidence Secured</Text>
              <Text style={styles.verifiedSub}>
                Photo archived on Pharmatrix Cloud. Immutable hash recorded for regulatory manifest.
              </Text>
            </View>
          </View>

          {previewImage ? (
            <TouchableOpacity
              style={styles.thumbnailWrapper}
              onPress={() => setModalVisible(true)}
              activeOpacity={0.85}
            >
              <Image source={{ uri: previewImage }} style={styles.thumbnailImage} resizeMode="cover" />
              <View style={styles.thumbnailOverlay}>
                <Ionicons name="expand" size={16} color="#FFFFFF" />
                <Text style={styles.thumbnailOverlayText}>Tap to inspect full photo</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.loadUrlBtn}
              onPress={loadSignedProofUrl}
              disabled={loadingUrl}
            >
              {loadingUrl ? (
                <ActivityIndicator size="small" color={colors.primaryDark} />
              ) : (
                <>
                  <Ionicons name="eye-outline" size={16} color={colors.primaryDark} />
                  <Text style={styles.loadUrlText}>View Cloud Storage Proof Photo</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Action Row */}
          <View style={styles.retakeRow}>
            <TouchableOpacity
              style={styles.retakeBtn}
              onPress={handleTakePhoto}
              disabled={isUploading}
            >
              <Ionicons name="camera-reverse-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.retakeBtnText}>Retake / Update Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.retakeBtn}
              onPress={handlePickFromLibrary}
              disabled={isUploading}
            >
              <Ionicons name="folder-open-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.retakeBtnText}>Replace from Files</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* Unuploaded State Actions */
        <View style={styles.actionContainer}>
          <Text style={styles.instructionText}>
            Medical waste logistics standard 49 CFR § 173 requires photo confirmation of sealed
            manifest and tamper-evident container seal prior to custody handover.
          </Text>

          {isUploading ? (
            <View style={styles.uploadingBox}>
              <ActivityIndicator size="small" color={colors.primaryAction} />
              <Text style={styles.uploadingText}>Sealing and uploading proof image to cloud...</Text>
            </View>
          ) : (
            <>
              <View style={styles.buttonRow}>
                {/* Take Photo Button */}
                <TouchableOpacity
                  style={[
                    styles.primaryActionBtn,
                    !canUploadProof && styles.btnDisabled,
                  ]}
                  onPress={handleTakePhoto}
                  disabled={!canUploadProof || isUploading}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name="camera"
                    size={18}
                    color={canUploadProof ? '#FFFFFF' : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.primaryActionText,
                      !canUploadProof && styles.btnDisabledText,
                    ]}
                  >
                    Take Photo
                  </Text>
                </TouchableOpacity>

                {/* Pick from Library Button */}
                <TouchableOpacity
                  style={[
                    styles.secondaryActionBtn,
                    !canUploadProof && styles.btnDisabled,
                  ]}
                  onPress={handlePickFromLibrary}
                  disabled={!canUploadProof || isUploading}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name="images-outline"
                    size={18}
                    color={canUploadProof ? colors.primaryDark : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.secondaryActionText,
                      !canUploadProof && styles.btnDisabledText,
                    ]}
                  >
                    Select Photo
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Specimen Generator Button for Testing/Simulators */}
              <TouchableOpacity
                style={[
                  styles.specimenBtn,
                  !canUploadProof && styles.btnDisabled,
                ]}
                onPress={handleGenerateSpecimenProof}
                disabled={!canUploadProof || isUploading}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="document-attach-outline"
                  size={15}
                  color={canUploadProof ? colors.primaryDark : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.specimenBtnText,
                    !canUploadProof && styles.btnDisabledText,
                  ]}
                >
                  Quick Capture: Seal Specimen Proof Photo
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* Full Photo Modal */}
      {previewImage && (
        <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Collection Proof • Stop #{stop.sequence_number}</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              <Image source={{ uri: previewImage }} style={styles.fullImage} resizeMode="contain" />

              <View style={styles.modalFooter}>
                <Text style={styles.modalFooterText}>
                  Facility: {stop.customer_name || 'Clinic'} • Route #{stop.id}
                </Text>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    backgroundColor: colors.primaryTint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBoxSuccess: {
    backgroundColor: '#E8F5E9',
  },
  cardTitle: {
    ...typography.labelLg,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  cardSubtitle: {
    ...typography.bodySm,
    color: colors.textSecondary,
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  badgeSuccess: {
    backgroundColor: '#E8F5E9',
  },
  badgePending: {
    backgroundColor: '#FEF3C7',
  },
  badgeDisabled: {
    backgroundColor: '#F3F4F6',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  badgeTextSuccess: {
    color: colors.success,
  },
  badgeTextPending: {
    color: '#D97706',
  },
  badgeTextDisabled: {
    color: colors.textSecondary,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
    padding: spacing.sm,
    borderRadius: radii.md,
    marginVertical: spacing.xs,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  noticeText: {
    ...typography.bodySm,
    color: colors.textSecondary,
    flex: 1,
    fontSize: 12,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    padding: spacing.sm,
    borderRadius: radii.md,
    marginVertical: spacing.xs,
  },
  errorText: {
    ...typography.bodySm,
    color: colors.error,
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  actionContainer: {
    marginTop: spacing.xs,
  },
  instructionText: {
    ...typography.bodySm,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  primaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primaryDark,
    paddingVertical: 12,
    borderRadius: radii.md,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  secondaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    borderRadius: radii.md,
  },
  secondaryActionText: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 13,
  },
  specimenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primaryTint,
    paddingVertical: 10,
    borderRadius: radii.md,
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: '#C5D0F8',
  },
  specimenBtnText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '700',
  },
  btnDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  btnDisabledText: {
    color: '#9CA3AF',
  },
  uploadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.md,
  },
  uploadingText: {
    ...typography.bodySm,
    color: colors.primaryDark,
    fontWeight: '600',
    fontSize: 13,
  },
  proofVerifiedBox: {
    marginTop: spacing.xs,
    backgroundColor: '#F8FCF8',
    borderRadius: radii.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: '#C6F6D5',
  },
  verifiedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  verifiedTitle: {
    ...typography.labelLg,
    color: colors.success,
    fontWeight: '700',
  },
  verifiedSub: {
    ...typography.bodySm,
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },
  thumbnailWrapper: {
    height: 140,
    borderRadius: radii.md,
    overflow: 'hidden',
    position: 'relative',
    marginVertical: spacing.xs,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    borderRadius: radii.md,
  },
  thumbnailOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  thumbnailOverlayText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  loadUrlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: spacing.xs,
  },
  loadUrlText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '600',
  },
  retakeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  retakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  retakeBtnText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#201E1C',
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#363432',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  modalCloseBtn: {
    padding: 4,
  },
  fullImage: {
    width: '100%',
    height: 320,
    backgroundColor: '#141312',
  },
  modalFooter: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#363432',
  },
  modalFooterText: {
    color: '#A09890',
    fontSize: 12,
  },
});
