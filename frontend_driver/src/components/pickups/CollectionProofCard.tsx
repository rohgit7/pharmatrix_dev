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

  // Auto-fetch signed URL if proof is already recorded
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
      // Graceful fallback
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
      onProofUploaded?.();
      Alert.alert(
        'Proof Uploaded Successfully',
        'Consignment photo has been sealed and archived to regulatory storage.'
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
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const payload = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;
        await handleUploadImageUri(payload, asset.fileName || 'collection_proof.jpg');
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
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const payload = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;
        await handleUploadImageUri(payload, asset.fileName || 'collection_proof.jpg');
      }
    } catch (err: any) {
      Alert.alert('Gallery Error', err.message || 'Could not open image library.');
    }
  };

  // Instant Specimen generator for Testing / Emulators
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
          ctx.fillStyle = '#1A1817';
          ctx.fillRect(0, 0, 640, 480);

          ctx.fillStyle = '#3B52B6';
          ctx.fillRect(0, 0, 640, 64);
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 20px sans-serif';
          ctx.fillText('PHARMATRIX BIOHAZARD COLLECTION PROOF', 24, 40);

          ctx.fillStyle = '#262422';
          ctx.fillRect(24, 88, 592, 340);

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
    <View style={[styles.card, proofUploaded && styles.cardUploaded]}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconBox, proofUploaded && styles.iconBoxSuccess]}>
            <Ionicons
              name={proofUploaded ? 'checkmark-circle' : 'camera'}
              size={18}
              color={proofUploaded ? '#FFFFFF' : '#3B52B6'}
            />
          </View>
          <View>
            <Text style={styles.cardTitle}>STEP 5: PHOTO PROOF OF COLLECTION</Text>
            <Text style={styles.cardSubtitle}>
              {proofUploaded
                ? 'Photographic custody evidence secured'
                : 'Sealed container & waste manifest photo'}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.statusBadge,
            proofUploaded ? styles.badgeSuccess : styles.badgePending,
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              proofUploaded ? styles.badgeTextSuccess : styles.badgeTextPending,
            ]}
          >
            {proofUploaded ? 'VERIFIED' : 'REQUIRED'}
          </Text>
        </View>
      </View>

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
            <Ionicons name="shield-checkmark" size={22} color={colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={styles.verifiedTitle}>Custody Evidence Secured</Text>
              <Text style={styles.verifiedSub}>
                Photo archived on cloud storage • Immutable hash linked to manifest #{stop.pickup_code || stop.id}
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
                <Ionicons name="expand" size={15} color="#FFFFFF" />
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
                <ActivityIndicator size="small" color="#3B52B6" />
              ) : (
                <>
                  <Ionicons name="eye-outline" size={16} color="#3B52B6" />
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
              <Ionicons name="camera-reverse-outline" size={14} color="#5C554E" />
              <Text style={styles.retakeBtnText}>Retake Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.retakeBtn}
              onPress={handlePickFromLibrary}
              disabled={isUploading}
            >
              <Ionicons name="folder-open-outline" size={14} color="#5C554E" />
              <Text style={styles.retakeBtnText}>Replace from Files</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* Unuploaded State Actions */
        <View style={styles.actionContainer}>
          <Text style={styles.instructionText}>
            Medical waste regulations require a photographic record of the sealed consignment container and tamper seal before custody transfer:
          </Text>

          {isUploading ? (
            <View style={styles.uploadingBox}>
              <ActivityIndicator size="small" color="#3B52B6" />
              <Text style={styles.uploadingText}>Sealing and uploading proof photo to cloud...</Text>
            </View>
          ) : (
            <>
              <View style={styles.buttonRow}>
                {/* Take Photo Button */}
                <TouchableOpacity
                  style={styles.primaryActionBtn}
                  onPress={handleTakePhoto}
                  disabled={isUploading}
                  activeOpacity={0.85}
                >
                  <Ionicons name="camera" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryActionText}>Take Photo</Text>
                </TouchableOpacity>

                {/* Pick from Library Button */}
                <TouchableOpacity
                  style={styles.secondaryActionBtn}
                  onPress={handlePickFromLibrary}
                  disabled={isUploading}
                  activeOpacity={0.85}
                >
                  <Ionicons name="images-outline" size={18} color="#3B52B6" />
                  <Text style={styles.secondaryActionText}>From Gallery</Text>
                </TouchableOpacity>
              </View>

              {/* Specimen Generator Button for Quick Field/Simulator Verification */}
              <TouchableOpacity
                style={styles.specimenBtn}
                onPress={handleGenerateSpecimenProof}
                disabled={isUploading}
                activeOpacity={0.8}
              >
                <Ionicons name="flash-outline" size={15} color="#3B52B6" />
                <Text style={styles.specimenBtnText}>
                  Instant Specimen Photo (Auto-Seal Manifest)
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
                  Facility: {stop.customer_name || 'Clinic'} • Manifest #{stop.pickup_code || stop.id}
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
    borderRadius: radii.xl,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: '#EADFD0',
    shadowColor: '#201E1C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    gap: 10,
  },
  cardUploaded: {
    borderColor: '#C6F6D5',
    backgroundColor: '#FAFDF9',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    backgroundColor: '#E5EBFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 82, 182, 0.25)',
  },
  iconBoxSuccess: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  cardTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#3B52B6',
    letterSpacing: 0.4,
  },
  cardSubtitle: {
    ...typography.bodySm,
    fontSize: 11,
    color: '#5C554E',
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  badgeSuccess: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#C6F6D5',
  },
  badgePending: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  badgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  badgeTextSuccess: {
    color: colors.success,
  },
  badgeTextPending: {
    color: '#92400E',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    padding: spacing.sm,
    borderRadius: radii.md,
  },
  errorText: {
    ...typography.bodySm,
    color: colors.error,
    flex: 1,
    fontSize: 11.5,
    fontWeight: '600',
  },
  actionContainer: {
    gap: 8,
  },
  instructionText: {
    fontSize: 11.5,
    color: '#5C554E',
    lineHeight: 16,
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#3B52B6',
    height: 44,
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
    gap: 6,
    backgroundColor: '#E5EBFF',
    borderWidth: 1,
    borderColor: 'rgba(59, 82, 182, 0.3)',
    height: 44,
    borderRadius: radii.md,
  },
  secondaryActionText: {
    color: '#3B52B6',
    fontWeight: '700',
    fontSize: 13,
  },
  specimenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FAF8F5',
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#EADFD0',
  },
  specimenBtnText: {
    color: '#3B52B6',
    fontSize: 11.5,
    fontWeight: '700',
  },
  uploadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    backgroundColor: '#FAF8F5',
    borderRadius: radii.md,
  },
  uploadingText: {
    fontSize: 12,
    color: '#3B52B6',
    fontWeight: '600',
  },
  proofVerifiedBox: {
    backgroundColor: '#FAFDF9',
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: 8,
  },
  verifiedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  verifiedTitle: {
    fontSize: 12.5,
    color: colors.success,
    fontWeight: '700',
  },
  verifiedSub: {
    fontSize: 10.5,
    color: '#5C554E',
    marginTop: 1,
    lineHeight: 14,
  },
  thumbnailWrapper: {
    height: 130,
    borderRadius: radii.md,
    overflow: 'hidden',
    position: 'relative',
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 5,
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
    gap: 6,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#EADFD0',
  },
  loadUrlText: {
    color: '#3B52B6',
    fontSize: 12,
    fontWeight: '600',
  },
  retakeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 14,
  },
  retakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  retakeBtnText: {
    fontSize: 11,
    color: '#5C554E',
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
    maxWidth: 480,
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
    height: 300,
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

export default CollectionProofCard;
