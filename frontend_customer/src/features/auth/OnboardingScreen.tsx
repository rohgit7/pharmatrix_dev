import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Building2,
  Truck,
  Stethoscope,
  Activity,
  MapPin,
  LogOut,
  CheckCircle2,
  ArrowLeft,
  User as UserIcon,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  Edit3,
  ShieldCheck,
  AlertCircle,
  Navigation,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import {
  AuthUser,
  CustomerMeResponse,
  CustomerType,
  CustomerProfileData,
} from '../../services/api';
import { colors, spacing, borderRadius } from '../../theme';
import { PrimaryButton } from '../../components/common/PrimaryButton';
import {
  BusinessLocationFieldErrors,
  BusinessLocationFormValue,
  BusinessLocationPicker,
  validateBusinessLocationForm,
} from '../../components/location/BusinessLocationPicker';

const CUSTOMER_TYPES: {
  type: CustomerType;
  label: string;
  desc: string;
  icon: any;
}[] = [
  {
    type: 'PHARMACY',
    label: 'Pharmacy',
    desc: 'Retail or hospital-attached dispensary',
    icon: Building2,
  },
  {
    type: 'DISTRIBUTOR',
    label: 'Distributor',
    desc: 'Wholesale stockist & pharma warehouse',
    icon: Truck,
  },
  {
    type: 'HOSPITAL',
    label: 'Hospital',
    desc: 'Multi-department clinical institution',
    icon: Activity,
  },
  {
    type: 'CLINIC',
    label: 'Clinic',
    desc: 'Outpatient practice or specialty center',
    icon: Stethoscope,
  },
];

const HOSPITAL_CATEGORIES = [
  'Multi-Speciality',
  'General Hospital',
  'Super-Speciality',
  'Government / Trust',
];

const CLINIC_CATEGORIES = [
  'Outpatient Clinic',
  'Polyclinic',
  'Specialty Center',
  'Daycare Clinic',
];

interface OnboardingScreenProps {
  onBackToSignIn?: () => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onBackToSignIn }) => {
  const {
    user,
    logout,
    registerAccountTokenOnly,
    submitOnboardingPayload,
    finalizeOnboardingSession,
  } = useAuth();

  // Track if account was created during this session (for unauthenticated registration flow)
  const [createdAuthUser, setCreatedAuthUser] = useState<AuthUser | null>(null);
  const activeAccountUser = user || createdAuthUser;

  // Steps: 1 = Account, 2 = Business, 3 = Location, 4 = Review, 5 = Completed
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(user ? 2 : 1);

  // Step 1: Account Details
  const [fullName, setFullName] = useState(user?.name || '');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [step1Errors, setStep1Errors] = useState<{
    fullName?: string;
    mobileNumber?: string;
    email?: string;
    password?: string;
  }>({});

  // Step 2: Business Details
  const [customerType, setCustomerType] = useState<CustomerType>('PHARMACY');
  const [displayName, setDisplayName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [sameLegalAsDisplay, setSameLegalAsDisplay] = useState(true);
  const [businessPhone, setBusinessPhone] = useState('');
  const [gstNumber, setGstNumber] = useState('');

  // Dynamic Type-Specific Fields
  const [pharmacyLicense, setPharmacyLicense] = useState('');
  const [pharmacistName, setPharmacistName] = useState('');
  const [distLicense, setDistLicense] = useState('');
  const [warehouseCount, setWarehouseCount] = useState('1');
  const [coverageArea, setCoverageArea] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [hospitalType, setHospitalType] = useState('Multi-Speciality');
  const [deptCount, setDeptCount] = useState('5');
  const [clinicType, setClinicType] = useState('Outpatient Clinic');
  const [doctorName, setDoctorName] = useState('');
  const [speciality, setSpeciality] = useState('');

  const [step2Errors, setStep2Errors] = useState<{
    displayName?: string;
    legalName?: string;
    businessPhone?: string;
    gstNumber?: string;
  }>({});

  // Step 3: Business Location
  const [locationForm, setLocationForm] = useState<BusinessLocationFormValue>({
    name: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    contactName: user?.name || '',
    contactPhone: '',
    latitude: null,
    longitude: null,
    locationSource: 'MANUAL',
  });
  const [locationErrors, setLocationErrors] = useState<BusinessLocationFieldErrors>({});

  // Step 4 & 5: Submission & Completion
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [completedCustomer, setCompletedCustomer] = useState<CustomerMeResponse | null>(null);
  const [enteringDashboard, setEnteringDashboard] = useState(false);

  const validateStep1 = (): boolean => {
    const errs: typeof step1Errors = {};
    const trimmedName = (activeAccountUser ? activeAccountUser.name : fullName).trim();
    const trimmedEmail = (activeAccountUser ? activeAccountUser.email : email).trim();
    const cleanDigits = mobileNumber.replace(/\D/g, '');

    if (trimmedName.length < 2) {
      errs.fullName = 'Enter your full name (minimum 2 characters)';
    }
    if (cleanDigits.length < 10 || cleanDigits.length > 15) {
      errs.mobileNumber = 'Enter a valid 10-digit mobile number';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errs.email = 'Enter a valid business email address';
    }
    if (!activeAccountUser && password.length < 8) {
      errs.password = 'Password must be at least 8 characters';
    }

    setStep1Errors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNextFromStep1 = () => {
    setSubmitError(null);
    if (!validateStep1()) return;

    const effectiveName = (activeAccountUser ? activeAccountUser.name : fullName).trim();
    const effectivePhone = mobileNumber.trim();

    if (!businessPhone.trim() && effectivePhone) {
      setBusinessPhone(effectivePhone);
    }
    if (!pharmacistName.trim() && effectiveName) {
      setPharmacistName(effectiveName);
    }
    if (!doctorName.trim() && effectiveName) {
      setDoctorName(effectiveName);
    }
    setLocationForm((prev) => ({
      ...prev,
      contactName: prev.contactName.trim() || effectiveName,
      contactPhone: prev.contactPhone.trim() || effectivePhone,
    }));

    setStep(2);
  };

  const validateStep2 = (): boolean => {
    const errs: typeof step2Errors = {};
    const cleanDisplay = displayName.trim();
    const cleanLegal = (sameLegalAsDisplay ? cleanDisplay : legalName).trim();
    const phoneDigits = businessPhone.replace(/\D/g, '');

    if (cleanDisplay.length < 2) {
      errs.displayName = 'Enter your business or organization name';
    }
    if (cleanLegal.length < 2) {
      errs.legalName = 'Enter the registered legal entity name';
    }
    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      errs.businessPhone = 'Enter a valid 10-digit business phone number';
    }
    if (gstNumber.trim().length > 0 && gstNumber.trim().length < 15) {
      errs.gstNumber = 'GSTIN must be 15 characters (or leave blank if not applicable)';
    }

    setStep2Errors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNextFromStep2 = () => {
    setSubmitError(null);
    if (!validateStep2()) return;

    const cleanDisplay = displayName.trim();
    if (sameLegalAsDisplay) {
      setLegalName(cleanDisplay);
    }

    setLocationForm((prev) => ({
      ...prev,
      name: prev.name.trim() || `${cleanDisplay} - Main Branch`,
      contactName:
        prev.contactName.trim() ||
        (activeAccountUser ? activeAccountUser.name : fullName).trim(),
      contactPhone: prev.contactPhone.trim() || businessPhone.trim(),
    }));

    setStep(3);
  };

  const handleNextFromStep3 = () => {
    setSubmitError(null);
    const locErrs = validateBusinessLocationForm(locationForm);
    setLocationErrors(locErrs);
    if (Object.keys(locErrs).length > 0) return;

    setStep(4);
  };

  const handleCompleteRegistration = async () => {
    setSubmitError(null);

    if (!validateStep2()) {
      setStep(2);
      return;
    }
    const locErrs = validateBusinessLocationForm(locationForm);
    if (Object.keys(locErrs).length > 0) {
      setLocationErrors(locErrs);
      setStep(3);
      return;
    }

    setSubmitting(true);
    try {
      let currentAuth = activeAccountUser;
      if (!currentAuth) {
        currentAuth = await registerAccountTokenOnly(
          fullName.trim(),
          email.trim().toLowerCase(),
          password,
          mobileNumber.trim()
        );
        setCreatedAuthUser(currentAuth);
      }

      const profile: CustomerProfileData = {};
      if (customerType === 'PHARMACY') {
        profile.pharmacy_license_number = pharmacyLicense.trim() || null;
        profile.pharmacist_name =
          pharmacistName.trim() || currentAuth.name || fullName.trim() || null;
      } else if (customerType === 'DISTRIBUTOR') {
        profile.distribution_license_number = distLicense.trim() || null;
        profile.warehouse_count = parseInt(warehouseCount, 10) || 1;
        profile.coverage_area = coverageArea.trim() || null;
      } else if (customerType === 'HOSPITAL') {
        profile.registration_number = regNumber.trim() || null;
        profile.hospital_type = hospitalType.trim() || null;
        profile.department_count = parseInt(deptCount, 10) || 1;
      } else if (customerType === 'CLINIC') {
        profile.registration_number = regNumber.trim() || null;
        profile.clinic_type = clinicType.trim() || null;
        profile.doctor_name = doctorName.trim() || null;
        profile.speciality = speciality.trim() || null;
      }

      const finalDisplayName = displayName.trim();
      const finalLegalName = (sameLegalAsDisplay ? finalDisplayName : legalName).trim();

      const onboardRes = await submitOnboardingPayload({
        customer_type: customerType,
        legal_name: finalLegalName,
        display_name: finalDisplayName,
        phone: businessPhone.trim(),
        email: currentAuth.email || email.trim().toLowerCase(),
        gst_number: gstNumber.trim().toUpperCase() || undefined,
        profile,
        location: {
          location_code: 'LOC-001',
          name: locationForm.name.trim(),
          address_line_1: locationForm.addressLine1.trim(),
          address_line_2: locationForm.addressLine2.trim() || undefined,
          city: locationForm.city.trim(),
          state: locationForm.state.trim(),
          postal_code: locationForm.postalCode.trim(),
          latitude: locationForm.latitude,
          longitude: locationForm.longitude,
          contact_name: locationForm.contactName.trim(),
          contact_phone: locationForm.contactPhone.trim(),
          service_time_seconds: 300,
        },
      });

      setCompletedCustomer(onboardRes);
      setStep(5);
    } catch (err: any) {
      setSubmitError(
        err?.message || 'Unable to complete registration. Please review your details and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleContinueToDashboard = async () => {
    setEnteringDashboard(true);
    try {
      await finalizeOnboardingSession();
    } catch {
      setEnteringDashboard(false);
    }
  };

  // STEP 5: REGISTRATION COMPLETE CONFIRMATION SCREEN
  if (step === 5) {
    const hasCoords =
      typeof locationForm.latitude === 'number' && typeof locationForm.longitude === 'number';
    return (
      <View style={styles.completionRoot}>
        <ScrollView contentContainerStyle={styles.completionScroll}>
          <View style={styles.completionCard}>
            <View style={styles.completionIconBadge}>
              <CheckCircle2 size={36} color={colors.success} />
            </View>

            <Text style={styles.completionOverline}>ONBOARDING COMPLETE</Text>
            <Text style={styles.completionTitle}>Business Registered Successfully</Text>
            <Text style={styles.completionSubtitle}>
              Your customer account and pickup location are now active on the Pharmatrix network.
            </Text>

            <View style={styles.completionSummaryBox}>
              <View style={styles.completionRow}>
                <Text style={styles.completionLabel}>Business Name</Text>
                <Text style={styles.completionValue}>
                  {completedCustomer?.display_name || displayName}
                </Text>
              </View>
              <View style={styles.completionDivider} />
              <View style={styles.completionRow}>
                <Text style={styles.completionLabel}>Customer Code</Text>
                <View style={styles.codePill}>
                  <Text style={styles.codePillText}>
                    {completedCustomer?.customer_code || 'ASSIGNED'}
                  </Text>
                </View>
              </View>
              <View style={styles.completionDivider} />
              <View style={styles.completionRow}>
                <Text style={styles.completionLabel}>Customer Type</Text>
                <Text style={styles.completionValue}>{customerType}</Text>
              </View>
              <View style={styles.completionDivider} />
              <View style={styles.completionAddressBlock}>
                <View style={styles.completionAddressHeader}>
                  <Text style={styles.completionLabel}>Primary Pickup Address</Text>
                  <View
                    style={[
                      styles.verifyBadge,
                      hasCoords ? styles.verifyBadgeGps : styles.verifyBadgeManual,
                    ]}
                  >
                    <Text
                      style={[
                        styles.verifyBadgeText,
                        hasCoords ? { color: colors.success } : { color: colors.textSecondary },
                      ]}
                    >
                      {hasCoords ? 'GPS Confirmed' : 'Manual Address'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.completionAddressName}>{locationForm.name}</Text>
                <Text style={styles.completionAddressLines}>
                  {[
                    locationForm.addressLine1,
                    locationForm.addressLine2,
                    `${locationForm.city}, ${locationForm.state} - ${locationForm.postalCode}`,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </Text>
              </View>
            </View>

            <PrimaryButton
              title="Go to Customer Dashboard"
              onPress={handleContinueToDashboard}
              loading={enteringDashboard}
              style={{ marginTop: spacing.lg }}
            />
          </View>
        </ScrollView>
      </View>
    );
  }

  const stepTitles: Record<1 | 2 | 3 | 4, { title: string; subtitle: string }> = {
    1: {
      title: 'Account Details',
      subtitle: 'Create your administrator credentials and primary contact.',
    },
    2: {
      title: 'Business Profile',
      subtitle: 'Select your customer type and enter your organization details.',
    },
    3: {
      title: 'Pickup Location',
      subtitle: 'Set your business address using GPS, map pin, or manual entry.',
    },
    4: {
      title: 'Review & Complete',
      subtitle: 'Verify your account, business profile, and pickup location before submitting.',
    },
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Top Bar */}
      <View style={styles.topHeader}>
        <View style={styles.headerTitleCol}>
          <Text style={styles.stepIndicatorText}>STEP {step} OF 4</Text>
          <Text style={styles.headerTitle}>{stepTitles[step].title}</Text>
        </View>

        {user ? (
          <TouchableOpacity onPress={logout} style={styles.signOutBtn}>
            <LogOut size={15} color={colors.danger} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        ) : onBackToSignIn ? (
          <TouchableOpacity onPress={onBackToSignIn} style={styles.backToLoginBtn}>
            <ArrowLeft size={15} color={colors.textSecondary} />
            <Text style={styles.backToLoginText}>Sign In</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* 4-Step Segmented Progress Bar */}
      <View style={styles.progressContainer}>
        {[1, 2, 3, 4].map((idx) => (
          <View
            key={idx}
            style={[
              styles.progressSegment,
              step >= idx ? styles.progressSegmentActive : null,
            ]}
          />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.stepSubtitle}>{stepTitles[step].subtitle}</Text>

        {submitError ? (
          <View style={styles.errorBanner}>
            <AlertCircle size={18} color={colors.danger} />
            <Text style={styles.errorBannerText}>{submitError}</Text>
          </View>
        ) : null}

        {/* ==================== STEP 1: ACCOUNT DETAILS ==================== */}
        {step === 1 ? (
          <View style={styles.sectionCard}>
            {activeAccountUser ? (
              <View style={styles.verifiedAccountBanner}>
                <ShieldCheck size={18} color={colors.success} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.verifiedAccountTitle}>Account Authenticated</Text>
                  <Text style={styles.verifiedAccountSub}>
                    Signed in as {activeAccountUser.name} ({activeAccountUser.email})
                  </Text>
                </View>
              </View>
            ) : (
              <>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Full Name (Account Holder) *</Text>
                  <View style={[styles.inputRow, !!step1Errors.fullName && styles.inputError]}>
                    <UserIcon size={16} color={colors.textMuted} />
                    <TextInput
                      style={styles.inputWithIcon}
                      value={fullName}
                      onChangeText={(text) => {
                        setFullName(text);
                        if (step1Errors.fullName) {
                          setStep1Errors((prev) => ({ ...prev, fullName: undefined }));
                        }
                      }}
                      placeholder="e.g. Dr. Ramesh Sharma"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="words"
                    />
                  </View>
                  {step1Errors.fullName ? (
                    <Text style={styles.fieldError}>{step1Errors.fullName}</Text>
                  ) : null}
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Official Email Address *</Text>
                  <View style={[styles.inputRow, !!step1Errors.email && styles.inputError]}>
                    <Mail size={16} color={colors.textMuted} />
                    <TextInput
                      style={styles.inputWithIcon}
                      value={email}
                      onChangeText={(text) => {
                        setEmail(text);
                        if (step1Errors.email) {
                          setStep1Errors((prev) => ({ ...prev, email: undefined }));
                        }
                      }}
                      placeholder="name@business.com"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  {step1Errors.email ? (
                    <Text style={styles.fieldError}>{step1Errors.email}</Text>
                  ) : null}
                </View>
              </>
            )}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Mobile Number (10 Digits) *</Text>
              <View style={[styles.inputRow, !!step1Errors.mobileNumber && styles.inputError]}>
                <Phone size={16} color={colors.textMuted} />
                <TextInput
                  style={styles.inputWithIcon}
                  value={mobileNumber}
                  onChangeText={(text) => {
                    setMobileNumber(text.replace(/[^0-9+\s-]/g, ''));
                    if (step1Errors.mobileNumber) {
                      setStep1Errors((prev) => ({ ...prev, mobileNumber: undefined }));
                    }
                  }}
                  placeholder="e.g. 9876543210"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                  maxLength={15}
                />
              </View>
              {step1Errors.mobileNumber ? (
                <Text style={styles.fieldError}>{step1Errors.mobileNumber}</Text>
              ) : null}
            </View>

            {!activeAccountUser ? (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Password (Minimum 8 Characters) *</Text>
                <View style={[styles.inputRow, !!step1Errors.password && styles.inputError]}>
                  <Lock size={16} color={colors.textMuted} />
                  <TextInput
                    style={styles.inputWithIcon}
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      if (step1Errors.password) {
                        setStep1Errors((prev) => ({ ...prev, password: undefined }));
                      }
                    }}
                    placeholder="Create a secure password"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    {showPassword ? (
                      <EyeOff size={18} color={colors.textMuted} />
                    ) : (
                      <Eye size={18} color={colors.textMuted} />
                    )}
                  </TouchableOpacity>
                </View>
                {step1Errors.password ? (
                  <Text style={styles.fieldError}>{step1Errors.password}</Text>
                ) : null}
              </View>
            ) : null}

            <PrimaryButton
              title="Continue to Business Profile"
              onPress={handleNextFromStep1}
              style={{ marginTop: spacing.sm }}
            />
          </View>
        ) : null}

        {/* ==================== STEP 2: BUSINESS PROFILE ==================== */}
        {step === 2 ? (
          <>
            <Text style={styles.sectionHeading}>Select Customer Category</Text>
            <View style={styles.typeGrid}>
              {CUSTOMER_TYPES.map((item) => {
                const IconComp = item.icon;
                const isSelected = customerType === item.type;
                return (
                  <TouchableOpacity
                    key={item.type}
                    style={[styles.typeCard, isSelected && styles.typeCardActive]}
                    onPress={() => setCustomerType(item.type)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.typeCardTop}>
                      <View style={[styles.typeIconBox, isSelected && styles.typeIconBoxActive]}>
                        <IconComp
                          size={18}
                          color={isSelected ? colors.surface : colors.primary}
                        />
                      </View>
                      {isSelected ? <CheckCircle2 size={16} color={colors.accent} /> : null}
                    </View>
                    <Text style={[styles.typeLabel, isSelected && styles.typeLabelActive]}>
                      {item.label}
                    </Text>
                    <Text style={styles.typeDesc} numberOfLines={2}>
                      {item.desc}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.cardTitle}>Organization Details</Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Business / Organization Display Name *</Text>
                <TextInput
                  style={[styles.input, !!step2Errors.displayName && styles.inputError]}
                  value={displayName}
                  onChangeText={(text) => {
                    setDisplayName(text);
                    if (sameLegalAsDisplay) {
                      setLegalName(text);
                    }
                    if (step2Errors.displayName) {
                      setStep2Errors((prev) => ({ ...prev, displayName: undefined }));
                    }
                  }}
                  placeholder={
                    customerType === 'PHARMACY'
                      ? 'e.g. MedPlus Pharmacy - Indiranagar'
                      : customerType === 'DISTRIBUTOR'
                        ? 'e.g. Apex Pharma Distributors'
                        : customerType === 'HOSPITAL'
                          ? 'e.g. City Care Multi-Speciality Hospital'
                          : 'e.g. HealthFirst Polyclinic'
                  }
                  placeholderTextColor={colors.textMuted}
                />
                {step2Errors.displayName ? (
                  <Text style={styles.fieldError}>{step2Errors.displayName}</Text>
                ) : null}
              </View>

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => {
                  const nextVal = !sameLegalAsDisplay;
                  setSameLegalAsDisplay(nextVal);
                  if (nextVal) {
                    setLegalName(displayName);
                  }
                }}
                activeOpacity={0.7}
              >
                <View
                  style={[styles.checkboxBox, sameLegalAsDisplay && styles.checkboxBoxChecked]}
                >
                  {sameLegalAsDisplay ? (
                    <CheckCircle2 size={14} color={colors.surface} />
                  ) : null}
                </View>
                <Text style={styles.checkboxLabel}>
                  Registered legal entity name is the same as display name
                </Text>
              </TouchableOpacity>

              {!sameLegalAsDisplay ? (
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Registered Legal Entity Name *</Text>
                  <TextInput
                    style={[styles.input, !!step2Errors.legalName && styles.inputError]}
                    value={legalName}
                    onChangeText={(text) => {
                      setLegalName(text);
                      if (step2Errors.legalName) {
                        setStep2Errors((prev) => ({ ...prev, legalName: undefined }));
                      }
                    }}
                    placeholder="e.g. MedPlus Health Services Pvt Ltd"
                    placeholderTextColor={colors.textMuted}
                  />
                  {step2Errors.legalName ? (
                    <Text style={styles.fieldError}>{step2Errors.legalName}</Text>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.twoColRow}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Business Phone *</Text>
                  <TextInput
                    style={[styles.input, !!step2Errors.businessPhone && styles.inputError]}
                    value={businessPhone}
                    onChangeText={(text) => {
                      setBusinessPhone(text.replace(/[^0-9+\s-]/g, ''));
                      if (step2Errors.businessPhone) {
                        setStep2Errors((prev) => ({ ...prev, businessPhone: undefined }));
                      }
                    }}
                    placeholder="10-digit phone"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                    maxLength={15}
                  />
                  {step2Errors.businessPhone ? (
                    <Text style={styles.fieldError}>{step2Errors.businessPhone}</Text>
                  ) : null}
                </View>

                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.label}>GSTIN (Optional)</Text>
                  <TextInput
                    style={[styles.input, !!step2Errors.gstNumber && styles.inputError]}
                    value={gstNumber}
                    onChangeText={(text) => {
                      setGstNumber(text.toUpperCase());
                      if (step2Errors.gstNumber) {
                        setStep2Errors((prev) => ({ ...prev, gstNumber: undefined }));
                      }
                    }}
                    placeholder="29ABCDE1234F1Z5"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="characters"
                    maxLength={15}
                  />
                  {step2Errors.gstNumber ? (
                    <Text style={styles.fieldError}>{step2Errors.gstNumber}</Text>
                  ) : null}
                </View>
              </View>

              {/* Dynamic Customer Type Fields */}
              <View style={styles.divider} />
              <Text style={styles.subHeading}>{customerType} Credentials (Optional)</Text>

              {customerType === 'PHARMACY' ? (
                <View style={styles.twoColRow}>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Drug License Number</Text>
                    <TextInput
                      style={styles.input}
                      value={pharmacyLicense}
                      onChangeText={setPharmacyLicense}
                      placeholder="e.g. KA-BLR-12345"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Registered Pharmacist</Text>
                    <TextInput
                      style={styles.input}
                      value={pharmacistName}
                      onChangeText={setPharmacistName}
                      placeholder="Full name"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                </View>
              ) : null}

              {customerType === 'DISTRIBUTOR' ? (
                <>
                  <View style={styles.twoColRow}>
                    <View style={[styles.fieldGroup, { flex: 2 }]}>
                      <Text style={styles.label}>Wholesale License Number</Text>
                      <TextInput
                        style={styles.input}
                        value={distLicense}
                        onChangeText={setDistLicense}
                        placeholder="e.g. WL-KA-99887"
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>
                    <View style={[styles.fieldGroup, { flex: 1 }]}>
                      <Text style={styles.label}>Warehouses</Text>
                      <TextInput
                        style={styles.input}
                        value={warehouseCount}
                        onChangeText={setWarehouseCount}
                        keyboardType="numeric"
                        placeholder="1"
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>
                  </View>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Primary Coverage Region</Text>
                    <TextInput
                      style={styles.input}
                      value={coverageArea}
                      onChangeText={setCoverageArea}
                      placeholder="e.g. Bengaluru Urban & Rural"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                </>
              ) : null}

              {customerType === 'HOSPITAL' ? (
                <>
                  <View style={styles.twoColRow}>
                    <View style={[styles.fieldGroup, { flex: 2 }]}>
                      <Text style={styles.label}>Registration Number</Text>
                      <TextInput
                        style={styles.input}
                        value={regNumber}
                        onChangeText={setRegNumber}
                        placeholder="Clinical Est. Reg. No."
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>
                    <View style={[styles.fieldGroup, { flex: 1 }]}>
                      <Text style={styles.label}>Departments</Text>
                      <TextInput
                        style={styles.input}
                        value={deptCount}
                        onChangeText={setDeptCount}
                        keyboardType="numeric"
                        placeholder="5"
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>
                  </View>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Hospital Category</Text>
                    <View style={styles.chipRow}>
                      {HOSPITAL_CATEGORIES.map((cat) => (
                        <TouchableOpacity
                          key={cat}
                          style={[
                            styles.categoryChip,
                            hospitalType === cat && styles.categoryChipActive,
                          ]}
                          onPress={() => setHospitalType(cat)}
                        >
                          <Text
                            style={[
                              styles.categoryChipText,
                              hospitalType === cat && styles.categoryChipTextActive,
                            ]}
                          >
                            {cat}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </>
              ) : null}

              {customerType === 'CLINIC' ? (
                <>
                  <View style={styles.twoColRow}>
                    <View style={[styles.fieldGroup, { flex: 1 }]}>
                      <Text style={styles.label}>Registration Number</Text>
                      <TextInput
                        style={styles.input}
                        value={regNumber}
                        onChangeText={setRegNumber}
                        placeholder="Clinic Reg. No."
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>
                    <View style={[styles.fieldGroup, { flex: 1 }]}>
                      <Text style={styles.label}>Lead Doctor Name</Text>
                      <TextInput
                        style={styles.input}
                        value={doctorName}
                        onChangeText={setDoctorName}
                        placeholder="Dr. Name"
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>
                  </View>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Clinic Category</Text>
                    <View style={styles.chipRow}>
                      {CLINIC_CATEGORIES.map((cat) => (
                        <TouchableOpacity
                          key={cat}
                          style={[
                            styles.categoryChip,
                            clinicType === cat && styles.categoryChipActive,
                          ]}
                          onPress={() => setClinicType(cat)}
                        >
                          <Text
                            style={[
                              styles.categoryChipText,
                              clinicType === cat && styles.categoryChipTextActive,
                            ]}
                          >
                            {cat}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Medical Speciality</Text>
                    <TextInput
                      style={styles.input}
                      value={speciality}
                      onChangeText={setSpeciality}
                      placeholder="e.g. General Medicine, Pediatrics, Dental"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                </>
              ) : null}

              <View style={styles.stepActionsRow}>
                <TouchableOpacity style={styles.backStepBtn} onPress={() => setStep(1)}>
                  <ArrowLeft size={16} color={colors.textPrimary} />
                  <Text style={styles.backStepText}>Account</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    title="Continue to Location"
                    onPress={handleNextFromStep2}
                  />
                </View>
              </View>
            </View>
          </>
        ) : null}

        {/* ==================== STEP 3: BUSINESS LOCATION ==================== */}
        {step === 3 ? (
          <>
            <BusinessLocationPicker
              value={locationForm}
              onChange={setLocationForm}
              errors={locationErrors}
              onClearFieldError={(field) =>
                setLocationErrors((prev) => ({ ...prev, [field]: undefined }))
              }
              defaultBranchPlaceholder={`${displayName.trim() || 'Main Branch'} - Pickup Point`}
            />

            <View style={styles.stepActionsRow}>
              <TouchableOpacity style={styles.backStepBtn} onPress={() => setStep(2)}>
                <ArrowLeft size={16} color={colors.textPrimary} />
                <Text style={styles.backStepText}>Business</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <PrimaryButton title="Review Registration" onPress={handleNextFromStep3} />
              </View>
            </View>
          </>
        ) : null}

        {/* ==================== STEP 4: REVIEW & COMPLETE ==================== */}
        {step === 4 ? (
          <>
            {/* 1. Account Summary Card */}
            <View style={styles.reviewCard}>
              <View style={styles.reviewCardHeader}>
                <View style={styles.reviewHeaderLeft}>
                  <UserIcon size={16} color={colors.accent} />
                  <Text style={styles.reviewCardTitle}>Account Details</Text>
                </View>
                <TouchableOpacity style={styles.editLinkBtn} onPress={() => setStep(1)}>
                  <Edit3 size={13} color={colors.accent} />
                  <Text style={styles.editLinkText}>Edit</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.reviewGrid}>
                <View style={styles.reviewItem}>
                  <Text style={styles.reviewItemLabel}>Account Holder</Text>
                  <Text style={styles.reviewItemValue}>
                    {activeAccountUser ? activeAccountUser.name : fullName}
                  </Text>
                </View>
                <View style={styles.reviewItem}>
                  <Text style={styles.reviewItemLabel}>Email Address</Text>
                  <Text style={styles.reviewItemValue}>
                    {activeAccountUser ? activeAccountUser.email : email}
                  </Text>
                </View>
                {mobileNumber ? (
                  <View style={styles.reviewItem}>
                    <Text style={styles.reviewItemLabel}>Mobile Number</Text>
                    <Text style={styles.reviewItemValue}>{mobileNumber}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* 2. Business Profile Summary Card */}
            <View style={styles.reviewCard}>
              <View style={styles.reviewCardHeader}>
                <View style={styles.reviewHeaderLeft}>
                  <Building2 size={16} color={colors.accent} />
                  <Text style={styles.reviewCardTitle}>Business Profile</Text>
                </View>
                <TouchableOpacity style={styles.editLinkBtn} onPress={() => setStep(2)}>
                  <Edit3 size={13} color={colors.accent} />
                  <Text style={styles.editLinkText}>Edit</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.reviewTypePillRow}>
                <View style={styles.reviewTypePill}>
                  <Text style={styles.reviewTypePillText}>{customerType}</Text>
                </View>
                {gstNumber.trim() ? (
                  <Text style={styles.reviewGstText}>GSTIN: {gstNumber.trim()}</Text>
                ) : null}
              </View>

              <View style={styles.reviewGrid}>
                <View style={styles.reviewItem}>
                  <Text style={styles.reviewItemLabel}>Business Display Name</Text>
                  <Text style={styles.reviewItemValue}>{displayName}</Text>
                </View>
                <View style={styles.reviewItem}>
                  <Text style={styles.reviewItemLabel}>Registered Legal Name</Text>
                  <Text style={styles.reviewItemValue}>
                    {sameLegalAsDisplay ? displayName : legalName}
                  </Text>
                </View>
                <View style={styles.reviewItem}>
                  <Text style={styles.reviewItemLabel}>Business Phone</Text>
                  <Text style={styles.reviewItemValue}>{businessPhone}</Text>
                </View>
              </View>
            </View>

            {/* 3. Pickup Location Summary Card */}
            <View style={styles.reviewCard}>
              <View style={styles.reviewCardHeader}>
                <View style={styles.reviewHeaderLeft}>
                  <MapPin size={16} color={colors.accent} />
                  <Text style={styles.reviewCardTitle}>Registered Pickup Location</Text>
                </View>
                <TouchableOpacity style={styles.editLinkBtn} onPress={() => setStep(3)}>
                  <Edit3 size={13} color={colors.accent} />
                  <Text style={styles.editLinkText}>Edit</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.locationConfirmRow}>
                {typeof locationForm.latitude === 'number' &&
                typeof locationForm.longitude === 'number' ? (
                  <View style={styles.gpsConfirmedBadge}>
                    <Navigation size={12} color={colors.success} />
                    <Text style={styles.gpsConfirmedBadgeText}>
                      {locationForm.locationSource === 'MAP_PIN'
                        ? `Map Pin Confirmed (${locationForm.latitude.toFixed(4)}, ${locationForm.longitude.toFixed(4)})`
                        : `GPS Confirmed (${locationForm.latitude.toFixed(4)}, ${locationForm.longitude.toFixed(4)})`}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.manualConfirmedBadge}>
                    <MapPin size={12} color={colors.textSecondary} />
                    <Text style={styles.manualConfirmedBadgeText}>Manual Address Entry</Text>
                  </View>
                )}
              </View>

              <Text style={styles.reviewLocationName}>{locationForm.name}</Text>
              <Text style={styles.reviewLocationAddress}>
                {[
                  locationForm.addressLine1,
                  locationForm.addressLine2,
                  `${locationForm.city}, ${locationForm.state} - ${locationForm.postalCode}`,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </Text>

              <View style={styles.reviewContactFooter}>
                <Text style={styles.reviewContactText}>
                  Site Contact: {locationForm.contactName} ({locationForm.contactPhone})
                </Text>
              </View>
            </View>

            <View style={styles.stepActionsRow}>
              <TouchableOpacity
                style={styles.backStepBtn}
                onPress={() => setStep(3)}
                disabled={submitting}
              >
                <ArrowLeft size={16} color={colors.textPrimary} />
                <Text style={styles.backStepText}>Location</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  title="Complete Registration"
                  onPress={handleCompleteRegistration}
                  loading={submitting}
                />
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  headerTitleCol: {
    flex: 1,
  },
  stepIndicatorText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: 0.8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 2,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    backgroundColor: colors.dangerSoft,
  },
  signOutText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.danger,
  },
  backToLoginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    backgroundColor: colors.secondarySoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backToLoginText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  progressContainer: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.secondary,
  },
  progressSegmentActive: {
    backgroundColor: colors.primary,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  stepSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 19,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerSoft,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    color: colors.danger,
    fontWeight: '600',
    lineHeight: 18,
  },
  verifiedAccountBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.successSoft,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#BDE5D4',
  },
  verifiedAccountTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.success,
  },
  verifiedAccountSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
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
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  typeCardActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  typeCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  typeIconBox: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.secondarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeIconBoxActive: {
    backgroundColor: colors.primary,
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  typeLabelActive: {
    color: colors.primary,
  },
  typeDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 15,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  subHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  fieldGroup: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 46,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 48,
    backgroundColor: colors.background,
    gap: spacing.sm,
  },
  inputWithIcon: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    height: '100%',
  },
  inputError: {
    borderColor: colors.danger,
  },
  fieldError: {
    fontSize: 12,
    color: colors.danger,
    marginTop: 4,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  checkboxBoxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  twoColRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
    backgroundColor: colors.secondarySoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  categoryChipTextActive: {
    color: colors.surface,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: spacing.md,
  },
  stepActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  backStepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 50,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  backStepText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  reviewCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  reviewCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  reviewHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  reviewCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  editLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
  },
  editLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  reviewGrid: {
    gap: spacing.sm,
  },
  reviewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  reviewItemLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  reviewItemValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
  reviewTypePillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  reviewTypePill: {
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  reviewTypePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
  },
  reviewGstText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  locationConfirmRow: {
    marginBottom: spacing.sm,
  },
  gpsConfirmedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: colors.successSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  gpsConfirmedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.success,
  },
  manualConfirmedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: colors.secondarySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  manualConfirmedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  reviewLocationName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  reviewLocationAddress: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  reviewContactFooter: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  reviewContactText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  completionRoot: {
    flex: 1,
    backgroundColor: colors.background,
  },
  completionScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  completionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  completionIconBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  completionOverline: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.success,
    letterSpacing: 1,
    marginBottom: 4,
  },
  completionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  completionSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
    marginBottom: spacing.lg,
  },
  completionSummaryBox: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  completionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  completionLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  completionValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  codePill: {
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  codePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  completionDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: 6,
  },
  completionAddressBlock: {
    paddingTop: 4,
  },
  completionAddressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  verifyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  verifyBadgeGps: {
    backgroundColor: colors.successSoft,
  },
  verifyBadgeManual: {
    backgroundColor: colors.secondarySoft,
  },
  verifyBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  completionAddressName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  completionAddressLines: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 17,
  },
});
