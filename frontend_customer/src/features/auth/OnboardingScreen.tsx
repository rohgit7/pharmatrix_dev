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
  CheckCircle2,
  AlertCircle,
  LogOut,
} from 'lucide-react-native';
import { colors, spacing, borderRadius } from '../../theme';
import { Card } from '../../components/common/Card';
import { PrimaryButton } from '../../components/common/PrimaryButton';
import { useAuth } from '../../context/AuthContext';
import { CustomerType } from '../../services/api';

const CUSTOMER_TYPES: {
  type: CustomerType;
  label: string;
  sub: string;
}[] = [
  { type: 'PHARMACY', label: 'Pharmacy', sub: 'Retail or compounding' },
  { type: 'DISTRIBUTOR', label: 'Distributor', sub: 'Wholesale stockist' },
  { type: 'HOSPITAL', label: 'Hospital', sub: 'Medical center' },
  { type: 'CLINIC', label: 'Clinic', sub: 'Outpatient practice' },
];

export const OnboardingScreen: React.FC = () => {
  const { user, completeOnboarding, logout } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1: Organization Details
  const [customerType, setCustomerType] = useState<CustomerType>('PHARMACY');
  const [displayName, setDisplayName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [phone, setPhone] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [pharmacistName, setPharmacistName] = useState('');
  const [warehouseCount, setWarehouseCount] = useState('1');
  const [coverageArea, setCoverageArea] = useState('');
  const [hospitalType, setHospitalType] = useState('Multi-Specialty');
  const [departmentCount, setDepartmentCount] = useState('8');
  const [doctorName, setDoctorName] = useState('');
  const [speciality, setSpeciality] = useState('General Medicine');

  // Step 2: Primary Pickup Location
  const [locationName, setLocationName] = useState('Main Branch');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [stateName, setStateName] = useState('Karnataka');
  const [postalCode, setPostalCode] = useState('560001');
  const [contactName, setContactName] = useState(user?.name || '');
  const [contactPhone, setContactPhone] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isStep1Valid =
    displayName.trim().length >= 2 &&
    legalName.trim().length >= 2 &&
    phone.trim().length >= 7;

  const isStep2Valid =
    locationName.trim().length >= 2 &&
    addressLine1.trim().length >= 3 &&
    city.trim().length >= 2 &&
    stateName.trim().length >= 2 &&
    postalCode.trim().length >= 4;

  const handleNextStep = () => {
    setErrorMsg(null);
    if (!isStep1Valid) {
      setErrorMsg('Enter Facility Name, Legal Name, and Phone Number.');
      return;
    }
    if (!contactPhone.trim()) {
      setContactPhone(phone.trim());
    }
    setStep(2);
  };

  const handleComplete = async () => {
    setErrorMsg(null);
    if (!isStep2Valid) {
      setErrorMsg('Complete all required pickup address fields.');
      return;
    }

    let profilePayload: Record<string, any> = {};
    if (customerType === 'PHARMACY') {
      profilePayload = {
        pharmacy_license_number: licenseNumber.trim() || undefined,
        pharmacist_name: pharmacistName.trim() || undefined,
      };
    } else if (customerType === 'DISTRIBUTOR') {
      profilePayload = {
        distribution_license_number: licenseNumber.trim() || undefined,
        warehouse_count: parseInt(warehouseCount, 10) || 1,
        coverage_area: coverageArea.trim() || undefined,
      };
    } else if (customerType === 'HOSPITAL') {
      profilePayload = {
        registration_number: licenseNumber.trim() || undefined,
        hospital_type: hospitalType.trim() || undefined,
        department_count: parseInt(departmentCount, 10) || 1,
      };
    } else if (customerType === 'CLINIC') {
      profilePayload = {
        registration_number: licenseNumber.trim() || undefined,
        clinic_type: 'Outpatient Clinic',
        doctor_name: doctorName.trim() || undefined,
        speciality: speciality.trim() || undefined,
      };
    }

    setSubmitting(true);
    try {
      await completeOnboarding({
        customer_type: customerType,
        legal_name: legalName.trim(),
        display_name: displayName.trim(),
        phone: phone.trim(),
        email: user?.email,
        gst_number: gstNumber.trim() || undefined,
        profile: profilePayload,
        location: {
          location_code: 'LOC-001',
          name: locationName.trim(),
          address_line_1: addressLine1.trim(),
          city: city.trim(),
          state: stateName.trim(),
          postal_code: postalCode.trim(),
          latitude: 12.9716,
          longitude: 77.5946,
          contact_name: contactName.trim() || displayName.trim(),
          contact_phone: contactPhone.trim() || phone.trim(),
          service_time_seconds: 300,
        },
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save facility setup.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.topBar}>
        <View style={styles.topBarTitleWrap}>
          <Text style={styles.topBarTitle}>Facility Setup</Text>
          <Text style={styles.topBarSub}>Step {step} of 2</Text>
        </View>
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={logout}
          accessibilityRole="button"
          accessibilityLabel="Sign Out"
        >
          <LogOut size={15} color={colors.textSecondary} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Step Indicator */}
        <View style={styles.stepStrip}>
          <TouchableOpacity
            style={[styles.stepPill, step === 1 && styles.stepPillActive]}
            onPress={() => setStep(1)}
          >
            <Building2
              size={15}
              color={step === 1 ? colors.textInverse : colors.textSecondary}
            />
            <Text
              style={[
                styles.stepPillText,
                step === 1 && styles.stepPillTextActive,
              ]}
            >
              1. Facility Profile
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.stepPill, step === 2 && styles.stepPillActive]}
            onPress={handleNextStep}
          >
            <MapPin
              size={15}
              color={step === 2 ? colors.textInverse : colors.textSecondary}
            />
            <Text
              style={[
                styles.stepPillText,
                step === 2 && styles.stepPillTextActive,
              ]}
            >
              2. Pickup Address
            </Text>
          </TouchableOpacity>
        </View>

        {errorMsg ? (
          <View style={styles.errorBanner}>
            <AlertCircle size={16} color={colors.error} />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        {step === 1 ? (
          <Card variant="elevated" padding="lg">
            <Text style={styles.sectionTitle}>Facility Type</Text>
            <View style={styles.typeGrid}>
              {CUSTOMER_TYPES.map((item) => {
                const selected = customerType === item.type;
                return (
                  <TouchableOpacity
                    key={item.type}
                    style={[
                      styles.typeCard,
                      selected && styles.typeCardSelected,
                    ]}
                    onPress={() => setCustomerType(item.type)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.typeCardHeader}>
                      <Text
                        style={[
                          styles.typeCardTitle,
                          selected && styles.typeCardTitleSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {item.label}
                      </Text>
                      {selected ? (
                        <CheckCircle2 size={16} color={colors.accent} />
                      ) : null}
                    </View>
                    <Text style={styles.typeCardSub} numberOfLines={1}>
                      {item.sub}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Facility Display Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Apex Medcare Central"
                placeholderTextColor={colors.textMuted}
                value={displayName}
                onChangeText={(v) => {
                  setDisplayName(v);
                  if (!legalName) setLegalName(v);
                }}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Registered Legal Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Apex Medcare Pvt Ltd"
                placeholderTextColor={colors.textMuted}
                value={legalName}
                onChangeText={setLegalName}
              />
            </View>

            <View style={styles.rowFields}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.label}>Phone Number *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="+91 9876543210"
                  placeholderTextColor={colors.textMuted}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.label}>GST Number</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Optional"
                  placeholderTextColor={colors.textMuted}
                  value={gstNumber}
                  onChangeText={setGstNumber}
                  autoCapitalize="characters"
                />
              </View>
            </View>

            {customerType === 'PHARMACY' ? (
              <View style={styles.rowFields}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.label}>License Number</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="DL-KA-001"
                    placeholderTextColor={colors.textMuted}
                    value={licenseNumber}
                    onChangeText={setLicenseNumber}
                  />
                </View>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Pharmacist Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Optional"
                    placeholderTextColor={colors.textMuted}
                    value={pharmacistName}
                    onChangeText={setPharmacistName}
                  />
                </View>
              </View>
            ) : null}

            {customerType === 'DISTRIBUTOR' ? (
              <View style={styles.rowFields}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Distribution License</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="WH-DIST-01"
                    placeholderTextColor={colors.textMuted}
                    value={licenseNumber}
                    onChangeText={setLicenseNumber}
                  />
                </View>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Warehouses</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="1"
                    placeholderTextColor={colors.textMuted}
                    value={warehouseCount}
                    onChangeText={setWarehouseCount}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            ) : null}

            {customerType === 'HOSPITAL' ? (
              <View style={styles.rowFields}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Registration No.</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="HOSP-001"
                    placeholderTextColor={colors.textMuted}
                    value={licenseNumber}
                    onChangeText={setLicenseNumber}
                  />
                </View>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Departments</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="8"
                    placeholderTextColor={colors.textMuted}
                    value={departmentCount}
                    onChangeText={setDepartmentCount}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            ) : null}

            {customerType === 'CLINIC' ? (
              <View style={styles.rowFields}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Lead Doctor</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Dr. A. Kumar"
                    placeholderTextColor={colors.textMuted}
                    value={doctorName}
                    onChangeText={setDoctorName}
                  />
                </View>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Speciality</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="General"
                    placeholderTextColor={colors.textMuted}
                    value={speciality}
                    onChangeText={setSpeciality}
                  />
                </View>
              </View>
            ) : null}

            <PrimaryButton
              title="Continue to Pickup Address"
              onPress={handleNextStep}
              disabled={!isStep1Valid}
              size="lg"
            />
          </Card>
        ) : (
          <Card variant="elevated" padding="lg">
            <Text style={styles.sectionTitle}>Primary Pickup Address</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Branch / Location Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Main Store / Dock A"
                placeholderTextColor={colors.textMuted}
                value={locationName}
                onChangeText={setLocationName}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Street Address *</Text>
              <TextInput
                style={styles.input}
                placeholder="Building, street, and area"
                placeholderTextColor={colors.textMuted}
                value={addressLine1}
                onChangeText={setAddressLine1}
              />
            </View>

            <View style={styles.rowFields}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.label}>City *</Text>
                <TextInput
                  style={styles.input}
                  value={city}
                  onChangeText={setCity}
                />
              </View>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.label}>PIN Code *</Text>
                <TextInput
                  style={styles.input}
                  value={postalCode}
                  onChangeText={setPostalCode}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>State *</Text>
              <TextInput
                style={styles.input}
                value={stateName}
                onChangeText={setStateName}
              />
            </View>

            <View style={styles.rowFields}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.label}>Site Contact Person</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Contact name"
                  placeholderTextColor={colors.textMuted}
                  value={contactName}
                  onChangeText={setContactName}
                />
              </View>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.label}>Contact Phone</Text>
                <TextInput
                  style={styles.input}
                  placeholder="+91 9876543210"
                  placeholderTextColor={colors.textMuted}
                  value={contactPhone}
                  onChangeText={setContactPhone}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <View style={styles.actionRow}>
              <PrimaryButton
                title="Back"
                onPress={() => setStep(1)}
                variant="outline"
                style={{ flex: 1 }}
              />
              <PrimaryButton
                title="Complete Setup"
                onPress={handleComplete}
                loading={submitting}
                disabled={!isStep2Valid}
                style={{ flex: 2 }}
              />
            </View>
          </Card>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBarTitleWrap: {
    flex: 1,
    flexShrink: 1,
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  topBarSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoutText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  stepStrip: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  stepPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  stepPillTextActive: {
    color: colors.textInverse,
    fontWeight: '700',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.errorBg,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: colors.error,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  typeCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  typeCardSelected: {
    backgroundColor: colors.lightAccent,
    borderColor: colors.accent,
  },
  typeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  typeCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  typeCardTitleSelected: {
    color: colors.primary,
  },
  typeCardSub: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  fieldGroup: {
    marginBottom: spacing.md,
  },
  rowFields: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 5,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    minHeight: 46,
    fontSize: 14,
    color: colors.textPrimary,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
});
