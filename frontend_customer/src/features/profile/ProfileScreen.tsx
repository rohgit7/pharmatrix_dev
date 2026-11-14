import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  Building2,
  MapPin,
  Mail,
  Phone,
  ShieldCheck,
  LogOut,
  CheckCircle2,
  Edit3,
  Plus,
  AlertCircle,
  Navigation,
  FileText,
  Download,
  Trash2,
} from 'lucide-react-native';
import {
  colors,
  spacing,
  borderRadius,
  formatStatusLabel,
} from '../../theme';
import { Card } from '../../components/common/Card';
import { PrimaryButton } from '../../components/common/PrimaryButton';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import {
  BusinessLocationFieldErrors,
  BusinessLocationFormValue,
  BusinessLocationPicker,
  validateBusinessLocationForm,
} from '../../components/location/BusinessLocationPicker';
import { requestLocationAndDetectAddress } from '../../utils/location';

export const ProfileScreen: React.FC = () => {
  const { user, customer, locations, refreshProfile, logout } = useAuth();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(customer?.display_name || '');
  const [legalName, setLegalName] = useState(customer?.legal_name || '');
  const [phone, setPhone] = useState(customer?.phone || '');
  const [gstNumber, setGstNumber] = useState(customer?.gst_number || '');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Add Location Form
  const [addingLocation, setAddingLocation] = useState(false);
  const [newLocForm, setNewLocForm] = useState<BusinessLocationFormValue>({
    name: '',
    addressLine1: '',
    addressLine2: '',
    city: locations[0]?.city || '',
    state: locations[0]?.state || '',
    postalCode: '',
    contactName: user?.name || '',
    contactPhone: customer?.phone || '',
    latitude: null,
    longitude: null,
    locationSource: 'MANUAL',
  });
  const [newLocErrors, setNewLocErrors] = useState<BusinessLocationFieldErrors>({});
  const [savingLoc, setSavingLoc] = useState(false);
  const [verifyingLocId, setVerifyingLocId] = useState<number | null>(null);

  // Compliance, Data Rights & Legal
  const [legalModal, setLegalModal] = useState<{
    visible: boolean;
    title: string;
    loading: boolean;
    content: string;
  }>({
    visible: false,
    title: '',
    loading: false,
    content: '',
  });
  const [exportingData, setExportingData] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const openPrivacyModal = async () => {
    setLegalModal({ visible: true, title: 'Pharmatrix Privacy Policy', loading: true, content: '' });
    try {
      const data = await api.getPrivacyPolicy();
      setLegalModal({ visible: true, title: 'Pharmatrix Privacy Policy', loading: false, content: data.content_markdown });
    } catch {
      setLegalModal({
        visible: true,
        title: 'Pharmatrix Privacy Policy',
        loading: false,
        content: 'Pharmatrix Privacy Policy v1.0.0. Full document available at /legal/01_privacy_policy.md',
      });
    }
  };

  const openTermsModal = async () => {
    setLegalModal({ visible: true, title: 'Terms and Conditions', loading: true, content: '' });
    try {
      const data = await api.getTermsAndConditions();
      setLegalModal({ visible: true, title: 'Terms and Conditions', loading: false, content: data.content_markdown });
    } catch {
      setLegalModal({
        visible: true,
        title: 'Terms and Conditions',
        loading: false,
        content: 'Pharmatrix Terms and Conditions v1.0.0. Full document available at /legal/02_terms_and_conditions.md',
      });
    }
  };

  const handleExportData = async () => {
    setExportingData(true);
    try {
      const exportJson = await api.exportUserData();
      setLegalModal({
        visible: true,
        title: 'Your Account Data Export (JSON)',
        loading: false,
        content: JSON.stringify(exportJson, null, 2),
      });
    } catch (err: any) {
      Alert.alert('Export Failed', err.message || 'Unable to generate account export.');
    } finally {
      setExportingData(false);
    }
  };

  const handleRequestDeletion = () => {
    Alert.alert(
      'Request Account Erasure',
      'This will erase your personal profile and deactivate your account under Section 12 of the Digital Personal Data Protection Act, 2023. In accordance with Indian environmental and tax laws, statutory waste manifests and tax invoices will be retained in anonymized format for statutory periods.\n\nAre you sure you want to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase Account',
          style: 'destructive',
          onPress: async () => {
            setDeletingAccount(true);
            try {
              const res = await api.requestDataDeletion('User requested erasure from mobile app');
              Alert.alert('Account Erased', res.message, [
                {
                  text: 'OK',
                  onPress: () => logout(),
                },
              ]);
            } catch (err: any) {
              Alert.alert('Erasure Blocked', err.message || 'Unable to process deletion request.');
            } finally {
              setDeletingAccount(false);
            }
          },
        },
      ]
    );
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setFeedback(null);
    setErrorMsg(null);
    try {
      await api.updateCustomerMe({
        display_name: displayName.trim(),
        legal_name: legalName.trim(),
        phone: phone.trim(),
        gst_number: gstNumber.trim() || undefined,
      });
      await refreshProfile();
      setEditing(false);
      setFeedback('Business profile updated.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddLocation = async () => {
    const errs = validateBusinessLocationForm(newLocForm);
    setNewLocErrors(errs);
    if (Object.keys(errs).length > 0) {
      setErrorMsg('Please fill in all required address fields.');
      return;
    }
    setSavingLoc(true);
    setErrorMsg(null);
    try {
      await api.addLocation({
        location_code: `LOC-${String(locations.length + 1).padStart(3, '0')}`,
        name: newLocForm.name.trim(),
        address_line_1: newLocForm.addressLine1.trim(),
        address_line_2: newLocForm.addressLine2.trim() || undefined,
        city: newLocForm.city.trim(),
        state: newLocForm.state.trim(),
        postal_code: newLocForm.postalCode.trim(),
        latitude: newLocForm.latitude,
        longitude: newLocForm.longitude,
        contact_name: newLocForm.contactName.trim(),
        contact_phone: newLocForm.contactPhone.trim(),
      });
      await refreshProfile();
      setAddingLocation(false);
      setNewLocForm({
        name: '',
        addressLine1: '',
        addressLine2: '',
        city: locations[0]?.city || '',
        state: locations[0]?.state || '',
        postalCode: '',
        contactName: user?.name || '',
        contactPhone: customer?.phone || '',
        latitude: null,
        longitude: null,
        locationSource: 'MANUAL',
      });
      setFeedback('Pickup address added.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to add location.');
    } finally {
      setSavingLoc(false);
    }
  };

  const handleVerifyExistingLocationGps = async (locationId: number) => {
    setVerifyingLocId(locationId);
    setErrorMsg(null);
    setFeedback(null);
    try {
      const outcome = await requestLocationAndDetectAddress();
      if (!outcome.ok) {
        setErrorMsg(outcome.message);
        return;
      }
      await api.updateLocation(locationId, {
        latitude: outcome.data.latitude,
        longitude: outcome.data.longitude,
      });
      await refreshProfile();
      setFeedback('GPS coordinates attached to pickup address.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update location GPS coordinates.');
    } finally {
      setVerifyingLocId(null);
    }
  };

  const prof = customer?.profile;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Customer Organization Header */}
        <Card variant="elevated" padding="lg" style={styles.sectionCard}>
          <View style={styles.headerTop}>
            <View style={styles.avatarCircle}>
              <Building2 size={24} color={colors.textInverse} />
            </View>
            <View style={styles.headerTextCol}>
              <View style={styles.badgeRow}>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>
                    {formatStatusLabel(customer?.customer_type || 'CUSTOMER').toUpperCase()}
                  </Text>
                </View>
                {customer?.customer_code ? (
                  <Text style={styles.codeLabel}>{customer.customer_code}</Text>
                ) : null}
              </View>
              <Text style={styles.orgName} numberOfLines={2}>
                {customer?.display_name || user?.name}
              </Text>
              {customer?.legal_name &&
              customer.legal_name !== customer.display_name ? (
                <Text style={styles.legalName} numberOfLines={2}>
                  {customer.legal_name}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              style={styles.editIconBtn}
              onPress={() => {
                setEditing((prev) => !prev);
                setErrorMsg(null);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Edit3 size={15} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {feedback ? (
            <View style={styles.feedbackBanner}>
              <CheckCircle2 size={15} color={colors.success} />
              <Text style={styles.feedbackText}>{feedback}</Text>
            </View>
          ) : null}

          {errorMsg ? (
            <View style={styles.errorBanner}>
              <AlertCircle size={15} color={colors.error} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          {editing ? (
            <View style={styles.editForm}>
              <Text style={styles.inputLabel}>Display Name</Text>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
              />
              <Text style={styles.inputLabel}>Legal Name</Text>
              <TextInput
                style={styles.input}
                value={legalName}
                onChangeText={setLegalName}
              />
              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
              <Text style={styles.inputLabel}>GST Number</Text>
              <TextInput
                style={styles.input}
                value={gstNumber}
                onChangeText={setGstNumber}
                autoCapitalize="characters"
              />
              <View style={styles.editActions}>
                <PrimaryButton
                  title="Cancel"
                  onPress={() => setEditing(false)}
                  variant="outline"
                  size="sm"
                  style={{ flex: 1 }}
                />
                <PrimaryButton
                  title="Save Changes"
                  onPress={handleSaveProfile}
                  loading={saving}
                  size="sm"
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          ) : (
            <View style={styles.metaList}>
              <View style={styles.metaRow}>
                <Mail size={15} color={colors.textSecondary} />
                <Text style={styles.metaText} numberOfLines={1}>
                  {customer?.email || user?.email}
                </Text>
              </View>
              {customer?.phone ? (
                <View style={styles.metaRow}>
                  <Phone size={15} color={colors.textSecondary} />
                  <Text style={styles.metaText}>{customer.phone}</Text>
                </View>
              ) : null}
              {customer?.gst_number ? (
                <View style={styles.metaRow}>
                  <ShieldCheck size={15} color={colors.textSecondary} />
                  <Text style={styles.metaText}>GST: {customer.gst_number}</Text>
                </View>
              ) : null}
            </View>
          )}
        </Card>

        {/* Customer Type Specific Regulatory Details */}
        {prof ? (
          <Card variant="elevated" padding="lg" style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>
              {formatStatusLabel(customer?.customer_type)} Details
            </Text>
            {customer?.customer_type === 'PHARMACY' && (
              <View style={styles.kvGrid}>
                <View style={styles.kvRow}>
                  <Text style={styles.kvKey}>Pharmacy License</Text>
                  <Text style={styles.kvVal}>
                    {prof.pharmacy_license_number || 'Registered'}
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text style={styles.kvKey}>Chief Pharmacist</Text>
                  <Text style={styles.kvVal}>
                    {prof.pharmacist_name || 'On Record'}
                  </Text>
                </View>
              </View>
            )}
            {customer?.customer_type === 'DISTRIBUTOR' && (
              <View style={styles.kvGrid}>
                <View style={styles.kvRow}>
                  <Text style={styles.kvKey}>Distribution License</Text>
                  <Text style={styles.kvVal}>
                    {prof.distribution_license_number || 'Registered'}
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text style={styles.kvKey}>Warehouses</Text>
                  <Text style={styles.kvVal}>{prof.warehouse_count ?? 1}</Text>
                </View>
                <View style={styles.kvRow}>
                  <Text style={styles.kvKey}>Coverage Area</Text>
                  <Text style={styles.kvVal}>
                    {prof.coverage_area || 'Regional'}
                  </Text>
                </View>
              </View>
            )}
            {customer?.customer_type === 'HOSPITAL' && (
              <View style={styles.kvGrid}>
                <View style={styles.kvRow}>
                  <Text style={styles.kvKey}>Registration</Text>
                  <Text style={styles.kvVal}>
                    {prof.registration_number || 'Registered'}
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text style={styles.kvKey}>Hospital Type</Text>
                  <Text style={styles.kvVal}>
                    {prof.hospital_type || 'Multi-Specialty'}
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text style={styles.kvKey}>Departments</Text>
                  <Text style={styles.kvVal}>
                    {prof.department_count ?? '—'}
                  </Text>
                </View>
              </View>
            )}
            {customer?.customer_type === 'CLINIC' && (
              <View style={styles.kvGrid}>
                <View style={styles.kvRow}>
                  <Text style={styles.kvKey}>Registration</Text>
                  <Text style={styles.kvVal}>
                    {prof.registration_number || 'Registered'}
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text style={styles.kvKey}>Lead Doctor</Text>
                  <Text style={styles.kvVal}>
                    {prof.doctor_name || 'On Record'}
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text style={styles.kvKey}>Speciality</Text>
                  <Text style={styles.kvVal}>
                    {prof.speciality || 'General'}
                  </Text>
                </View>
              </View>
            )}
          </Card>
        ) : null}

        {/* Registered Pickup Locations */}
        <Card variant="elevated" padding="lg" style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.inline}>
              <MapPin size={17} color={colors.primary} />
              <Text style={styles.sectionTitle}>Pickup Addresses</Text>
            </View>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => {
                setAddingLocation((prev) => !prev);
                setErrorMsg(null);
              }}
            >
              <Plus size={14} color={colors.accentDark} />
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>

          {addingLocation ? (
            <View style={styles.addLocBox}>
              <BusinessLocationPicker
                value={newLocForm}
                onChange={setNewLocForm}
                errors={newLocErrors}
                onClearFieldError={(f) =>
                  setNewLocErrors((prev) => ({ ...prev, [f]: undefined }))
                }
                compactHeader
              />
              <View style={styles.editActions}>
                <PrimaryButton
                  title="Cancel"
                  onPress={() => setAddingLocation(false)}
                  variant="outline"
                  size="sm"
                  style={{ flex: 1 }}
                />
                <PrimaryButton
                  title="Save Address"
                  onPress={handleAddLocation}
                  loading={savingLoc}
                  size="sm"
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          ) : null}

          <View style={styles.locList}>
            {locations.map((loc) => {
              const hasCoords =
                typeof loc.latitude === 'number' && typeof loc.longitude === 'number';
              return (
                <View key={loc.id} style={styles.locCard}>
                  <View style={styles.locHeader}>
                    <Text style={styles.locTitle}>{loc.name}</Text>
                    <Text style={styles.locCode}>{loc.location_code}</Text>
                  </View>
                  <Text style={styles.locAddress}>
                    {[loc.address_line_1, loc.address_line_2].filter(Boolean).join(', ')},{' '}
                    {loc.city}, {loc.state} {loc.postal_code}
                  </Text>
                  <View style={styles.locFooterRow}>
                    <Text style={styles.locContact}>
                      {loc.contact_name} · {loc.contact_phone}
                    </Text>
                    {hasCoords ? (
                      <View style={styles.gpsTag}>
                        <Navigation size={11} color={colors.success} />
                        <Text style={styles.gpsTagText}>GPS Verified</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.attachGpsBtn}
                        onPress={() => handleVerifyExistingLocationGps(loc.id)}
                        disabled={verifyingLocId === loc.id}
                      >
                        <Navigation size={11} color={colors.accent} />
                        <Text style={styles.attachGpsBtnText}>
                          {verifyingLocId === loc.id ? 'Detecting...' : 'Attach GPS'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </Card>

        {/* ==================== PRIVACY, LEGAL & DATA RIGHTS (DPDPA 2023) ==================== */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.inline}>
              <ShieldCheck size={18} color={colors.accent} />
              <Text style={styles.sectionTitle}>Privacy & Data Protection</Text>
            </View>
          </View>

          <View style={styles.complianceActionsContainer}>
            <TouchableOpacity style={styles.complianceRow} onPress={openPrivacyModal}>
              <FileText size={16} color={colors.primary} />
              <View style={styles.complianceRowTextWrap}>
                <Text style={styles.complianceRowTitle}>Privacy Policy</Text>
                <Text style={styles.complianceRowDesc}>Version 1.0.0 (DPDPA 2023 / IT Act compliant)</Text>
              </View>
              <Text style={styles.complianceActionText}>View</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.complianceRow} onPress={openTermsModal}>
              <FileText size={16} color={colors.primary} />
              <View style={styles.complianceRowTextWrap}>
                <Text style={styles.complianceRowTitle}>Terms and Conditions</Text>
                <Text style={styles.complianceRowDesc}>Version 1.0.0 governing collection & disposal</Text>
              </View>
              <Text style={styles.complianceActionText}>View</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.complianceRow}
              onPress={handleExportData}
              disabled={exportingData}
            >
              <Download size={16} color={colors.primary} />
              <View style={styles.complianceRowTextWrap}>
                <Text style={styles.complianceRowTitle}>Export Personal Data</Text>
                <Text style={styles.complianceRowDesc}>Download complete account records in JSON format</Text>
              </View>
              <Text style={styles.complianceActionText}>
                {exportingData ? 'Exporting...' : 'Export'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.complianceRow, { borderBottomWidth: 0 }]}
              onPress={handleRequestDeletion}
              disabled={deletingAccount}
            >
              <Trash2 size={16} color={colors.danger} />
              <View style={styles.complianceRowTextWrap}>
                <Text style={[styles.complianceRowTitle, { color: colors.danger }]}>
                  Request Account Erasure
                </Text>
                <Text style={styles.complianceRowDesc}>
                  Exercise Right to Erasure under DPDPA Section 12
                </Text>
              </View>
              <Text style={[styles.complianceActionText, { color: colors.danger }]}>
                {deletingAccount ? 'Processing...' : 'Request'}
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        <PrimaryButton
          title="Sign Out"
          onPress={logout}
          variant="danger"
          size="lg"
          icon={<LogOut size={17} color={colors.textInverse} />}
        />
      </ScrollView>

      {/* Legal & Data Export Viewer Modal */}
      <Modal
        visible={legalModal.visible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setLegalModal((prev) => ({ ...prev, visible: false }))}
      >
        <View style={styles.legalModalContainer}>
          <View style={styles.legalModalHeader}>
            <Text style={styles.legalModalTitle}>{legalModal.title}</Text>
            <TouchableOpacity
              onPress={() => setLegalModal((prev) => ({ ...prev, visible: false }))}
              style={styles.legalModalCloseBtn}
            >
              <Text style={styles.legalModalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
          {legalModal.loading ? (
            <View style={styles.legalModalLoading}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <ScrollView style={styles.legalModalBody} contentContainerStyle={{ paddingBottom: 40 }}>
              <Text style={styles.legalModalMarkdown}>{legalModal.content}</Text>
            </ScrollView>
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  sectionCard: {
    marginBottom: spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextCol: {
    flex: 1,
    flexShrink: 1,
    gap: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 2,
  },
  typeBadge: {
    backgroundColor: colors.lightAccent,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accentDark,
    letterSpacing: 0.4,
  },
  codeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  orgName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 23,
  },
  legalName: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  editIconBtn: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.successBg,
    borderWidth: 1,
    borderColor: colors.successBorder,
    padding: spacing.sm + 2,
    borderRadius: borderRadius.sm,
    marginTop: spacing.md,
  },
  feedbackText: {
    flex: 1,
    fontSize: 12,
    color: colors.success,
    fontWeight: '600',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    padding: spacing.sm + 2,
    borderRadius: borderRadius.sm,
    marginTop: spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: colors.error,
    fontWeight: '600',
  },
  metaList: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    flex: 1,
    flexShrink: 1,
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  editForm: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 44,
    fontSize: 14,
    color: colors.textPrimary,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  editActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.lightAccent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accentDark,
  },
  addLocBox: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  kvGrid: {
    marginTop: spacing.md,
    gap: 8,
  },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 4,
    gap: spacing.md,
  },
  kvKey: {
    fontSize: 13,
    color: colors.textSecondary,
    flexShrink: 0,
  },
  kvVal: {
    flex: 1,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'right',
  },
  locList: {
    gap: spacing.sm,
  },
  locCard: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 3,
  },
  locHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  locTitle: {
    flex: 1,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  locCode: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accentDark,
  },
  locAddress: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  locContact: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  locFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    gap: spacing.sm,
  },
  gpsTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.successSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  gpsTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.success,
  },
  attachGpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  attachGpsBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accent,
  },
  complianceActionsContainer: {
    marginTop: spacing.xs,
  },
  complianceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border || '#e2e8f0',
  },
  complianceRowTextWrap: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  complianceRowTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  complianceRowDesc: {
    fontSize: 11,
    color: colors.textMuted || '#64748b',
    marginTop: 1,
  },
  complianceActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  legalModalContainer: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'ios' ? 44 : 20,
  },
  legalModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border || '#e2e8f0',
    backgroundColor: colors.surface,
  },
  legalModalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  legalModalCloseBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    backgroundColor: '#f1f5f9',
  },
  legalModalCloseText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  legalModalLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  legalModalBody: {
    flex: 1,
    padding: spacing.md,
  },
  legalModalMarkdown: {
    fontSize: 12,
    color: colors.textPrimary,
    lineHeight: 19,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
