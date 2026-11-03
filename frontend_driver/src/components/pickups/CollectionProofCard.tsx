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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, radii, spacing, typography, shadows } from '../../theme';
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
    } catch (err: any) {
      const msg = err?.message || 'Failed to upload photo proof.';
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
          'Camera permission is required to capture collection proof.'
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
          'Photo library permission is required to select collection proof.'
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

  const previewImage = signedUrl || selectedImageUri;

  return (
    <View style={[styles.card, proofUploaded && styles.cardUploaded]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>STEP 5: PHOTO PROOF</Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            proofUploaded ? styles.badgeSuccess : styles.badgePending,
          ]}
        >
          <Ionicons
            name={proofUploaded ? 'checkmark-circle' : 'camera-outline'}
            size={12}
            color={proofUploaded ? colors.success : colors.warning}
          />
          <Text
            style={[
              styles.badgeText,
              proofUploaded ? styles.badgeTextSuccess : styles.badgeTextPending,
            ]}
          >
            {proofUploaded ? 'Uploaded' : 'Required'}
          </Text>
        </View>
      </View>

      {/* Error message */}
      {errorMessage && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={15} color={colors.error} />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      {/* Uploaded state with thumbnail */}
      {proofUploaded ? (
        <View style={styles.proofVerifiedBox}>
          {previewImage ? (
            <TouchableOpacity
              style={styles.thumbnailWrapper}
              onPress={() => setModalVisible(true)}
              activeOpacity={0.85}
            >
              <Image
                source={{ uri: previewImage }}
                style={styles.thumbnailImage}
                resizeMode="cover"
              />
              <View style={styles.thumbnailOverlay}>
                <Ionicons name="expand" size={14} color="#FFFFFF" />
                <Text style={styles.thumbnailOverlayText}>Tap to preview</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.loadUrlBtn}
              onPress={loadSignedProofUrl}
              disabled={loadingUrl}
            >
              {loadingUrl ? (
                <ActivityIndicator size="small" color={colors.primaryAccent} />
              ) : (
                <View style={styles.loadUrlContent}>
                  <Ionicons name="eye-outline" size={15} color={colors.primary} />
                  <Text style={styles.loadUrlText}>View Stored Photo</Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          <View style={styles.retakeRow}>
            <TouchableOpacity
              style={styles.retakeBtn}
              onPress={handleTakePhoto}
              disabled={isUploading}
            >
              <Ionicons name="camera-outline" size={14} color={colors.primary} />
              <Text style={styles.retakeBtnText}>Retake Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.retakeBtn}
              onPress={handlePickFromLibrary}
              disabled={isUploading}
            >
              <Ionicons name="images-outline" size={14} color={colors.primary} />
              <Text style={styles.retakeBtnText}>From Gallery</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* Action buttons */
        <View style={styles.actionContainer}>
          <Text style={styles.promptText}>
            Capture photo proof of sealed container:
          </Text>

          {isUploading ? (
            <View style={styles.uploadingBox}>
              <ActivityIndicator size="small" color={colors.primaryAccent} />
              <Text style={styles.uploadingText}>Uploading photo...</Text>
            </View>
          ) : (
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={handleTakePhoto}
                disabled={isUploading}
                activeOpacity={0.85}
              >
                <Ionicons name="camera" size={16} color="#FFFFFF" />
                <Text style={styles.primaryActionText}>Take Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryActionBtn}
                onPress={handlePickFromLibrary}
                disabled={isUploading}
                activeOpacity={0.85}
              >
                <Ionicons name="images-outline" size={16} color={colors.primary} />
                <Text style={styles.secondaryActionText}>From Gallery</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Modal Preview */}
      {previewImage && (
        <Modal
          visible={modalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Collection Photo Proof</Text>
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={20} color={colors.primary} />
                </TouchableOpacity>
              </View>

              <Image
                source={{ uri: previewImage }}
                style={styles.fullModalImage}
                resizeMode="contain"
              />

              <TouchableOpacity
                style={styles.closeModalBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.closeModalBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.secondary,
    gap: 10,
    marginBottom: spacing.md,
    ...shadows.subtle,
  },
  cardUploaded: {
    borderColor: colors.secondary,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepBadge: {
    backgroundColor: colors.lightAccent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.xs,
  },
  stepBadgeText: {
    ...typography.labelSm,
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  badgePending: {
    backgroundColor: colors.warningContainer,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.2)',
  },
  badgeSuccess: {
    backgroundColor: colors.successContainer,
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.2)',
  },
  badgeText: {
    ...typography.labelSm,
    fontSize: 10,
    fontWeight: '700',
  },
  badgeTextPending: {
    color: colors.warning,
  },
  badgeTextSuccess: {
    color: colors.success,
  },
  promptText: {
    ...typography.bodySm,
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.errorContainer,
    padding: 8,
    borderRadius: radii.xs,
  },
  errorText: {
    ...typography.bodySm,
    fontSize: 11,
    color: colors.error,
    flex: 1,
  },
  actionContainer: {
    gap: 6,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryActionBtn: {
    flex: 1,
    backgroundColor: colors.primaryAccent,
    height: 42,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryActionText: {
    ...typography.labelMd,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryActionBtn: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.secondary,
    height: 42,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryActionText: {
    ...typography.labelMd,
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  uploadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: colors.background,
    borderRadius: radii.md,
  },
  uploadingText: {
    ...typography.bodySm,
    fontSize: 12,
    color: colors.textSecondary,
  },
  proofVerifiedBox: {
    gap: 8,
  },
  thumbnailWrapper: {
    height: 120,
    borderRadius: radii.md,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(32, 30, 28, 0.6)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  thumbnailOverlayText: {
    ...typography.labelSm,
    fontSize: 10,
    color: '#FFFFFF',
  },
  loadUrlBtn: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.secondary,
    borderRadius: radii.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  loadUrlContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  loadUrlText: {
    ...typography.labelMd,
    fontSize: 12,
    color: colors.primary,
  },
  retakeRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  retakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: colors.background,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  retakeBtnText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.primary,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.gutter,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    ...typography.headlineSm,
    fontSize: 16,
    color: colors.primary,
  },
  fullModalImage: {
    width: '100%',
    height: 300,
    borderRadius: radii.md,
    backgroundColor: colors.background,
  },
  closeModalBtn: {
    backgroundColor: colors.primary,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeModalBtnText: {
    ...typography.labelMd,
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});

export default CollectionProofCard;
