import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Image,
} from 'react-native';
import {
  X,
  MapPin,
  Phone,
  User,
  Scale,
  QrCode,
  ShieldCheck,
  Calendar,
  Clock,
  AlertTriangle,
  Building2,
  Truck,
  FileText,
  Camera,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronRight,
  ExternalLink,
} from 'lucide-react-native';
import { colors, radii, spacing, typography, shadows } from '../../theme';
import api from '../../services/api';
import { DriverPickupDetailResponse, TimelineEvent } from '../../types/history';

interface PickupDetailModalProps {
  visible: boolean;
  pickupId: number | string | null;
  onClose: () => void;
}

export const PickupDetailModal: React.FC<PickupDetailModalProps> = ({
  visible,
  pickupId,
  onClose,
}) => {
  const [detail, setDetail] = useState<DriverPickupDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isPhotoExpanded, setIsPhotoExpanded] = useState<boolean>(false);

  useEffect(() => {
    if (!visible || !pickupId) {
      setDetail(null);
      setError(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    api
      .getWorkHistoryPickupDetail(pickupId)
      .then((data) => {
        if (isMounted) {
          setDetail(data);
          setIsLoading(false);
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          setError(err?.message || 'Failed to load historical pickup details');
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [visible, pickupId]);

  const formatDateTime = (dateStr?: string | null): string => {
    if (!dateStr) return 'Not recorded';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateOnly = (dateStr?: string | null): string => {
    if (!dateStr) return 'Not specified';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const handlePhoneCall = (phoneNumber?: string | null) => {
    if (!phoneNumber) return;
    const cleanNumber = phoneNumber.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${cleanNumber}`);
  };

  const getStatusBadgeStyle = (status: string) => {
    const s = status.toUpperCase();
    if (s === 'COMPLETED' || s === 'COLLECTED') {
      return { bg: '#DCFCE7', text: '#15803D', border: '#86EFAC' };
    }
    if (s === 'CANCELLED') {
      return { bg: '#FEE2E2', text: '#B91C1C', border: '#FCA5A5' };
    }
    if (s === 'FAILED') {
      return { bg: '#FEF3C7', text: '#B45309', border: '#FCD34D' };
    }
    if (s === 'IN_PROGRESS' || s === 'ARRIVED') {
      return { bg: colors.lightAccent, text: colors.primaryAccent, border: '#C7D2FE' };
    }
    return { bg: '#F3F4F6', text: '#4B5563', border: '#E5E7EB' };
  };

  const renderTimelineIcon = (stage: string, status: string) => {
    if (status === 'failed') {
      return <XCircle size={16} color="#DC2626" />;
    }
    switch (stage) {
      case 'requested':
      case 'scheduled':
        return <Calendar size={16} color={colors.primaryAccent} />;
      case 'assigned':
      case 'route_started':
        return <Truck size={16} color={colors.primaryAccent} />;
      case 'arrived':
        return <MapPin size={16} color={colors.primaryAccent} />;
      case 'weighed':
        return <Scale size={16} color={colors.primaryAccent} />;
      case 'qr_verified':
        return <QrCode size={16} color="#16A34A" />;
      case 'otp_verified':
        return <ShieldCheck size={16} color="#16A34A" />;
      case 'proof_uploaded':
        return <Camera size={16} color={colors.primaryAccent} />;
      case 'completed':
        return <CheckCircle2 size={16} color="#16A34A" />;
      default:
        return <CheckCircle2 size={16} color={colors.primaryAccent} />;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerSubtitle}>HISTORICAL CONSIGNMENT</Text>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {detail ? detail.pickup_code : 'Pickup Details'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityLabel="Close Details"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <X size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Body */}
          {isLoading ? (
            <View style={styles.stateContainer}>
              <ActivityIndicator size="large" color={colors.primaryAccent} />
              <Text style={styles.loadingText}>Fetching complete pickup history...</Text>
            </View>
          ) : error ? (
            <View style={styles.stateContainer}>
              <AlertCircle size={36} color="#DC2626" />
              <Text style={styles.errorTitle}>Unable to Load Details</Text>
              <Text style={styles.errorDesc}>{error}</Text>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => {
                  if (pickupId) {
                    setIsLoading(true);
                    setError(null);
                    api.getWorkHistoryPickupDetail(pickupId)
                      .then((data) => {
                        setDetail(data);
                        setIsLoading(false);
                      })
                      .catch((err) => {
                        setError(err?.message || 'Failed to load details');
                        setIsLoading(false);
                      });
                  }
                }}
              >
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : detail ? (
            <ScrollView
              style={styles.scrollBody}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* SECTION A: Pickup Information */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <FileText size={16} color={colors.primaryAccent} />
                  <Text style={styles.sectionTitle}>SECTION A: PICKUP INFORMATION</Text>
                </View>

                <View style={styles.infoRowBetween}>
                  <View>
                    <Text style={styles.metaLabel}>Pickup Code</Text>
                    <Text style={styles.metaValueHighlight}>{detail.pickup_code}</Text>
                  </View>
                  {(() => {
                    const badge = getStatusBadgeStyle(detail.status);
                    return (
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor: badge.bg,
                            borderColor: badge.border,
                          },
                        ]}
                      >
                        <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                          {detail.status}
                        </Text>
                      </View>
                    );
                  })()}
                </View>

                <View style={styles.divider} />

                <View style={styles.gridTwoCol}>
                  <View style={styles.gridItem}>
                    <Text style={styles.metaLabel}>Customer / Facility</Text>
                    <Text style={styles.metaValue}>{detail.customer_name}</Text>
                    <View style={styles.tagPill}>
                      <Text style={styles.tagPillText}>{detail.customer_type}</Text>
                    </View>
                  </View>

                  <View style={styles.gridItem}>
                    <Text style={styles.metaLabel}>Priority</Text>
                    <Text style={styles.metaValue}>{detail.priority}</Text>
                  </View>
                </View>

                <View style={styles.gridTwoCol}>
                  <View style={styles.gridItem}>
                    <Text style={styles.metaLabel}>Scheduled Date</Text>
                    <Text style={styles.metaValue}>{formatDateOnly(detail.scheduled_date)}</Text>
                  </View>
                  <View style={styles.gridItem}>
                    <Text style={styles.metaLabel}>Actual Completed Time</Text>
                    <Text style={styles.metaValue}>{formatDateTime(detail.completed_at)}</Text>
                  </View>
                </View>

                {detail.route_code ? (
                  <View style={styles.routeBanner}>
                    <Truck size={14} color={colors.primary} />
                    <Text style={styles.routeBannerText}>
                      Route: {detail.route_code} • {formatDateOnly(detail.route_date)}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* SECTION B: Location Details */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <MapPin size={16} color={colors.primaryAccent} />
                  <Text style={styles.sectionTitle}>SECTION B: LOCATION DETAILS</Text>
                </View>

                <Text style={styles.locationTitle}>{detail.location_name}</Text>
                <Text style={styles.locationAddress}>
                  {detail.address_line_1}
                  {detail.address_line_2 ? `, ${detail.address_line_2}` : ''}
                </Text>
                <Text style={styles.locationSub}>
                  {detail.city}
                  {detail.state ? `, ${detail.state}` : ''} {detail.postal_code}
                </Text>

                {detail.contact_name || detail.contact_phone ? (
                  <View style={styles.contactCard}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <User size={14} color={colors.textSecondary} />
                        <Text style={styles.contactName}>
                          {detail.contact_name || 'Facility Representative'}
                        </Text>
                      </View>
                      {detail.contact_phone ? (
                        <Text style={styles.contactPhone}>{detail.contact_phone}</Text>
                      ) : null}
                    </View>
                    {detail.contact_phone ? (
                      <TouchableOpacity
                        style={styles.callButton}
                        onPress={() => handlePhoneCall(detail.contact_phone)}
                        accessibilityLabel="Call Contact"
                      >
                        <Phone size={14} color="#FFFFFF" />
                        <Text style={styles.callButtonText}>Call</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}

                {detail.latitude && detail.longitude ? (
                  <View style={styles.coordinatesStrip}>
                    <Text style={styles.coordinatesText}>
                      GPS Coordinates: {Number(detail.latitude).toFixed(4)},{' '}
                      {Number(detail.longitude).toFixed(4)}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* SECTION C: Collection Details */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Scale size={16} color={colors.primaryAccent} />
                  <Text style={styles.sectionTitle}>SECTION C: COLLECTION DETAILS</Text>
                </View>

                <View style={styles.weightComparisonBox}>
                  <View style={styles.weightCol}>
                    <Text style={styles.weightLabel}>Estimated Weight</Text>
                    <Text style={styles.weightValue}>
                      {detail.estimated_weight_kg !== null && detail.estimated_weight_kg !== undefined
                        ? `${detail.estimated_weight_kg.toFixed(2)} kg`
                        : 'Not estimated'}
                    </Text>
                  </View>
                  <View style={styles.weightDivider} />
                  <View style={styles.weightCol}>
                    <Text style={styles.weightLabel}>Actual Collected</Text>
                    <Text style={[styles.weightValue, { color: colors.primary }]}>
                      {detail.collected_weight_kg !== null && detail.collected_weight_kg !== undefined
                        ? `${detail.collected_weight_kg.toFixed(2)} kg`
                        : 'Pending weighing'}
                    </Text>
                  </View>
                </View>

                {detail.weight_discrepancy_kg !== null && detail.weight_discrepancy_kg !== undefined ? (
                  <View
                    style={[
                      styles.discrepancyBanner,
                      Math.abs(detail.weight_discrepancy_kg) > 2
                        ? styles.discrepancyAlert
                        : styles.discrepancyNormal,
                    ]}
                  >
                    <AlertTriangle
                      size={14}
                      color={Math.abs(detail.weight_discrepancy_kg) > 2 ? '#D97706' : '#16A34A'}
                    />
                    <Text
                      style={[
                        styles.discrepancyText,
                        {
                          color:
                            Math.abs(detail.weight_discrepancy_kg) > 2 ? '#B45309' : '#15803D',
                        },
                      ]}
                    >
                      Variance: {detail.weight_discrepancy_kg > 0 ? '+' : ''}
                      {detail.weight_discrepancy_kg.toFixed(2)} kg from estimate
                    </Text>
                  </View>
                ) : null}

                {/* Classification Notice */}
                <View style={styles.noticeBox}>
                  <Text style={styles.noticeText}>
                    Note: Drivers log aggregate consignment weight at pickup. Segregation into Yellow, Red, White, and Blue biomedical categories occurs during central warehouse intake verification.
                  </Text>
                </View>

                {detail.notes ? (
                  <View style={styles.remarksBox}>
                    <Text style={styles.remarksLabel}>Driver / Customer Remarks</Text>
                    <Text style={styles.remarksContent}>{detail.notes}</Text>
                  </View>
                ) : null}

                {detail.failure_reason ? (
                  <View style={styles.failureBox}>
                    <AlertTriangle size={14} color="#DC2626" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.failureLabel}>Failure / Exception Cause</Text>
                      <Text style={styles.failureContent}>{detail.failure_reason}</Text>
                    </View>
                  </View>
                ) : null}
              </View>

              {/* SECTION D: Verification Details */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <ShieldCheck size={16} color={colors.primaryAccent} />
                  <Text style={styles.sectionTitle}>SECTION D: VERIFICATION DETAILS</Text>
                </View>

                {/* QR Code Verification */}
                <View style={styles.verifyRow}>
                  <View style={styles.verifyIconBox}>
                    <QrCode size={18} color={detail.qr_verified ? '#16A34A' : colors.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.verifyTitle}>Consignment QR Tag Verification</Text>
                    <Text style={styles.verifySub}>
                      {detail.qr_verified
                        ? `Scanned and tamper seal validated at ${formatDateTime(detail.qr_verified_at)}`
                        : 'Tamper seal QR scan was not completed'}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.verifyIndicator,
                      { backgroundColor: detail.qr_verified ? '#DCFCE7' : '#F3F4F6' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.verifyIndicatorText,
                        { color: detail.qr_verified ? '#15803D' : colors.textMuted },
                      ]}
                    >
                      {detail.qr_verified ? 'VERIFIED' : 'UNVERIFIED'}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                {/* Customer OTP Verification */}
                <View style={styles.verifyRow}>
                  <View style={styles.verifyIconBox}>
                    <ShieldCheck size={18} color={detail.otp_verified ? '#16A34A' : colors.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.verifyTitle}>Customer Custody Transfer OTP</Text>
                    <Text style={styles.verifySub}>
                      {detail.otp_verified
                        ? `6-digit OTP authenticated at ${formatDateTime(detail.otp_verified_at)}`
                        : 'Customer OTP authorization pending or bypassed'}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.verifyIndicator,
                      { backgroundColor: detail.otp_verified ? '#DCFCE7' : '#F3F4F6' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.verifyIndicatorText,
                        { color: detail.otp_verified ? '#15803D' : colors.textMuted },
                      ]}
                    >
                      {detail.otp_verified ? 'AUTHORIZED' : 'PENDING'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* SECTION E: Collection Evidence */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Camera size={16} color={colors.primaryAccent} />
                  <Text style={styles.sectionTitle}>SECTION E: COLLECTION EVIDENCE</Text>
                </View>

                {detail.proof_signed_url ? (
                  <View style={styles.evidenceContainer}>
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => setIsPhotoExpanded(!isPhotoExpanded)}
                      style={styles.evidenceImageWrapper}
                    >
                      <Image
                        source={{ uri: detail.proof_signed_url }}
                        style={isPhotoExpanded ? styles.evidenceImageExpanded : styles.evidenceImage}
                        resizeMode="cover"
                      />
                      <View style={styles.expandPill}>
                        <ExternalLink size={12} color="#FFFFFF" />
                        <Text style={styles.expandPillText}>
                          {isPhotoExpanded ? 'Tap to collapse' : 'Tap to expand'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <View style={styles.evidenceMeta}>
                      <Clock size={12} color={colors.textMuted} />
                      <Text style={styles.evidenceMetaText}>
                        Proof captured: {formatDateTime(detail.proof_uploaded_at)}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.noEvidenceBox}>
                    <Camera size={24} color={colors.textOutline} />
                    <Text style={styles.noEvidenceTitle}>No Photographic Evidence Captured</Text>
                    <Text style={styles.noEvidenceSub}>
                      No photo was attached during collection for this historical stop.
                    </Text>
                  </View>
                )}
              </View>

              {/* SECTION F: Chronological Timeline */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Clock size={16} color={colors.primaryAccent} />
                  <Text style={styles.sectionTitle}>SECTION F: LIFECYCLE TIMELINE</Text>
                </View>
                <Text style={styles.timelineDesc}>
                  Chronological audit events recorded directly in Pharmatrix backend:
                </Text>

                <View style={styles.timelineList}>
                  {detail.timeline && detail.timeline.length > 0 ? (
                    detail.timeline.map((event: TimelineEvent, idx: number) => {
                      const isLast = idx === detail.timeline.length - 1;
                      return (
                        <View key={`${event.stage}-${idx}`} style={styles.timelineItem}>
                          {/* Left icon & stem */}
                          <View style={styles.timelineStemContainer}>
                            <View style={styles.timelineIconBubble}>
                              {renderTimelineIcon(event.stage, event.status)}
                            </View>
                            {!isLast ? <View style={styles.timelineStem} /> : null}
                          </View>

                          {/* Content */}
                          <View style={styles.timelineContent}>
                            <View style={styles.timelineHeaderRow}>
                              <Text style={styles.timelineLabel}>{event.label}</Text>
                              <Text style={styles.timelineTime}>
                                {formatDateTime(event.timestamp)}
                              </Text>
                            </View>
                            {event.description ? (
                              <Text style={styles.timelineDetail}>{event.description}</Text>
                            ) : null}
                          </View>
                        </View>
                      );
                    })
                  ) : (
                    <Text style={styles.noTimelineText}>No lifecycle timestamps recorded</Text>
                  )}
                </View>
              </View>
            </ScrollView>
          ) : null}

          {/* Footer */}
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.dismissBtn} onPress={onClose}>
              <Text style={styles.dismissBtnText}>Close History</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(32, 30, 28, 0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    maxHeight: '92%',
    minHeight: '60%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  modalHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primaryAccent,
    letterSpacing: 1,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateContainer: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 260,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  errorTitle: {
    marginTop: spacing.sm,
    fontSize: 15,
    fontWeight: '700',
    color: '#DC2626',
  },
  errorDesc: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  retryBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.secondary,
    padding: spacing.md,
    ...shadows.subtle,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: colors.primaryAccent,
  },
  infoRowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  metaLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 2,
  },
  metaValueHighlight: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: colors.secondary,
    marginVertical: spacing.sm,
  },
  gridTwoCol: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  gridItem: {
    flex: 1,
  },
  tagPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.lightAccent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
    marginTop: 4,
  },
  tagPillText: {
    fontSize: 10,
    color: colors.primaryAccent,
    fontWeight: '700',
  },
  routeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceLow,
    padding: spacing.xs,
    borderRadius: radii.sm,
    marginTop: spacing.xs,
  },
  routeBannerText: {
    fontSize: 11,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 2,
  },
  locationAddress: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  locationSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceLow,
    padding: spacing.sm,
    borderRadius: radii.md,
    marginTop: spacing.sm,
  },
  contactName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  contactPhone: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryAccent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.md,
  },
  callButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  coordinatesStrip: {
    marginTop: spacing.xs,
  },
  coordinatesText: {
    fontSize: 10,
    color: colors.textMuted,
  },
  weightComparisonBox: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceLow,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  weightCol: {
    flex: 1,
    alignItems: 'center',
  },
  weightDivider: {
    width: 1,
    backgroundColor: colors.secondary,
  },
  weightLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginBottom: 2,
  },
  weightValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  discrepancyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.md,
    marginTop: spacing.xs,
  },
  discrepancyAlert: {
    backgroundColor: '#FEF3C7',
  },
  discrepancyNormal: {
    backgroundColor: '#DCFCE7',
  },
  discrepancyText: {
    fontSize: 11,
    fontWeight: '600',
  },
  noticeBox: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.md,
    padding: spacing.xs,
    marginTop: spacing.xs,
  },
  noticeText: {
    fontSize: 10,
    color: colors.textSecondary,
    lineHeight: 14,
  },
  remarksBox: {
    marginTop: spacing.xs,
    backgroundColor: colors.surfaceLow,
    padding: spacing.xs,
    borderRadius: radii.sm,
  },
  remarksLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '600',
  },
  remarksContent: {
    fontSize: 11,
    color: colors.primary,
    marginTop: 2,
  },
  failureBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#FEE2E2',
    padding: spacing.xs,
    borderRadius: radii.sm,
    marginTop: spacing.xs,
    alignItems: 'flex-start',
  },
  failureLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B91C1C',
  },
  failureContent: {
    fontSize: 11,
    color: '#991B1B',
    marginTop: 1,
  },
  verifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 4,
  },
  verifyIconBox: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  verifySub: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 1,
  },
  verifyIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  verifyIndicatorText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  evidenceContainer: {
    marginTop: spacing.xs,
  },
  evidenceImageWrapper: {
    position: 'relative',
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  evidenceImage: {
    width: '100%',
    height: 180,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceContainer,
  },
  evidenceImageExpanded: {
    width: '100%',
    height: 320,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceContainer,
  },
  expandPill: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(32, 30, 28, 0.75)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  expandPillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '600',
  },
  evidenceMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  evidenceMetaText: {
    fontSize: 10,
    color: colors.textMuted,
  },
  noEvidenceBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    backgroundColor: colors.surfaceLow,
    borderRadius: radii.md,
    gap: 4,
  },
  noEvidenceTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 4,
  },
  noEvidenceSub: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
  },
  timelineDesc: {
    fontSize: 10,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  timelineList: {
    marginTop: 4,
  },
  timelineItem: {
    flexDirection: 'row',
    minHeight: 48,
  },
  timelineStemContainer: {
    width: 24,
    alignItems: 'center',
  },
  timelineIconBubble: {
    width: 24,
    height: 24,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceLow,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  timelineStem: {
    flex: 1,
    width: 2,
    backgroundColor: colors.secondary,
    marginVertical: 2,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: spacing.sm,
    paddingBottom: spacing.sm,
  },
  timelineHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  timelineLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  timelineTime: {
    fontSize: 10,
    color: colors.textMuted,
  },
  timelineDetail: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  noTimelineText: {
    fontSize: 11,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  modalFooter: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.secondary,
  },
  dismissBtn: {
    backgroundColor: colors.primary,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default PickupDetailModal;

