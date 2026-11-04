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
  const [locName, setLocName] = useState('');
  const [locAddress, setLocAddress] = useState('');
  const [locCity, setLocCity] = useState(locations[0]?.city || '');
  const [locState, setLocState] = useState(locations[0]?.state || '');
  const [locPin, setLocPin] = useState('');
  const [locContactName, setLocContactName] = useState(user?.name || '');
  const [locContactPhone, setLocContactPhone] = useState(customer?.phone || '');
  const [savingLoc, setSavingLoc] = useState(false);

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
      setFeedback('Facility profile updated.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddLocation = async () => {
    if (
      !locName.trim() ||
      !locAddress.trim() ||
      !locCity.trim() ||
      !locState.trim() ||
      !locPin.trim() ||
      !locContactPhone.trim()
    ) {
      setErrorMsg('Please fill in all required address fields.');
      return;
    }
    setSavingLoc(true);
    setErrorMsg(null);
    try {
      await api.addLocation({
        location_code: `LOC-${String(locations.length + 1).padStart(3, '0')}`,
        name: locName.trim(),
        address_line_1: locAddress.trim(),
        city: locCity.trim(),
        state: locState.trim(),
        postal_code: locPin.trim(),
        latitude: 12.9716,
        longitude: 77.5946,
        contact_name: locContactName.trim() || 'Facility Contact',
        contact_phone: locContactPhone.trim(),
      });
      await refreshProfile();
      setAddingLocation(false);
      setLocName('');
      setLocAddress('');
      setLocPin('');
      setFeedback('Pickup address added.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to add location.');
    } finally {
      setSavingLoc(false);
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
              <Text style={styles.inputLabel}>Branch / Location Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Main Pharmacy / Annex B"
                placeholderTextColor={colors.textMuted}
                value={locName}
                onChangeText={setLocName}
              />
              <Text style={styles.inputLabel}>Street Address *</Text>
              <TextInput
                style={styles.input}
                placeholder="Street & building"
                placeholderTextColor={colors.textMuted}
                value={locAddress}
                onChangeText={setLocAddress}
              />
              <View style={styles.twoColRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>City *</Text>
                  <TextInput
                    style={styles.input}
                    value={locCity}
                    onChangeText={setLocCity}
                    placeholder="City"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>PIN Code *</Text>
                  <TextInput
                    style={styles.input}
                    value={locPin}
                    onChangeText={setLocPin}
                    keyboardType="number-pad"
                    maxLength={6}
                    placeholder="560001"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>
              <Text style={styles.inputLabel}>State *</Text>
              <TextInput
                style={styles.input}
                value={locState}
                onChangeText={setLocState}
                placeholder="State"
                placeholderTextColor={colors.textMuted}
              />
              <View style={styles.twoColRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Site Contact</Text>
                  <TextInput
                    style={styles.input}
                    value={locContactName}
                    onChangeText={setLocContactName}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Contact Phone *</Text>
                  <TextInput
                    style={styles.input}
                    value={locContactPhone}
                    onChangeText={setLocContactPhone}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>
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
            {locations.map((loc) => (
              <View key={loc.id} style={styles.locCard}>
                <View style={styles.locHeader}>
                  <Text style={styles.locTitle}>{loc.name}</Text>
                  <Text style={styles.locCode}>{loc.location_code}</Text>
                </View>
                <Text style={styles.locAddress}>
                  {loc.address_line_1}, {loc.city}, {loc.state} {loc.postal_code}
                </Text>
                <Text style={styles.locContact}>
                  {loc.contact_name} · {loc.contact_phone}
                </Text>
              </View>
            ))}
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
    marginTop: 2,
  },
});
