import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  MapPin,
  Package,
  Calendar,
  CheckCircle2,
  Phone,
  User as UserIcon,
  AlertCircle,
  Plus,
  Clock,
  Scale,
  FileText,
  Check,
  X,
} from 'lucide-react-native';
import {
  colors,
  spacing,
  borderRadius,
  formatWasteCategory,
  formatStatusLabel,
} from '../../theme';
import { Card } from '../../components/common/Card';
import { PrimaryButton } from '../../components/common/PrimaryButton';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/StateViews';
import {
  api,
  CustomerLocation,
  PickupPriority,
  PickupStatus,
  WasteCategoriesMetadata,
} from '../../services/api';

interface RequestPickupScreenProps {
  locations: CustomerLocation[];
  onRefreshLocations: () => Promise<void>;
  onSubmitted: (pickupPublicId: string) => void;
  onCancel: () => void;
}

const QUICK_WEIGHTS = ['5', '10', '25', '50'];

export const RequestPickupScreen: React.FC<RequestPickupScreenProps> = ({
  locations,
  onRefreshLocations,
  onSubmitted,
  onCancel,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [metadata, setMetadata] = useState<WasteCategoriesMetadata | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);

  // Step 1: Location
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(
    locations[0]?.id ?? null
  );
  const [addLocModal, setAddLocModal] = useState(false);
  const [newLocName, setNewLocName] = useState('');
  const [newLocCode, setNewLocCode] = useState('');
  const [newLocAddress, setNewLocAddress] = useState('');
  const [newLocCity, setNewLocCity] = useState('');
  const [newLocState, setNewLocState] = useState('');
  const [newLocPin, setNewLocPin] = useState('');
  const [newLocContactName, setNewLocContactName] = useState('');
  const [newLocContactPhone, setNewLocContactPhone] = useState('');
  const [savingLoc, setSavingLoc] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Step 2: Waste Details (no hardcoded operational weight)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    'EXPIRED_DISCARDED_MEDICINE',
  ]);
  const [estimatedWeight, setEstimatedWeight] = useState('');
  const [remarks, setRemarks] = useState('');

  // Step 3: Schedule
  const upcomingDates = useMemo(() => {
    const list: { isoDate: string; label: string; dayName: string; fullLabel: string }[] = [];
    const base = new Date();
    for (let i = 1; i <= 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      d.setHours(10, 0, 0, 0);
      list.push({
        isoDate: d.toISOString(),
        label: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        dayName: d.toLocaleDateString('en-IN', { weekday: 'short' }),
        fullLabel: d.toLocaleDateString('en-IN', {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
      });
    }
    return list;
  }, []);

  const [selectedDateIso, setSelectedDateIso] = useState<string>(
    upcomingDates[0]?.isoDate || new Date().toISOString()
  );
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>(
    '09:00 AM - 12:00 PM'
  );
  const [selectedPriority, setSelectedPriority] =
    useState<PickupPriority>('NORMAL');

  // Step 4: Submission state
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdPickup, setCreatedPickup] = useState<{
    public_id: string;
    pickup_code: string;
    status: PickupStatus;
  } | null>(null);

  useEffect(() => {
    if (!selectedLocationId && locations.length > 0) {
      setSelectedLocationId(locations[0].id);
    }
  }, [locations, selectedLocationId]);

  useEffect(() => {
    let mounted = true;
    api
      .getWasteCategories()
      .then((res) => {
        if (mounted) {
          setMetadata(res);
          if (res.time_slots?.[0]?.label) {
            setSelectedTimeSlot(res.time_slots[0].label);
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoadingMeta(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === selectedLocationId) || null,
    [locations, selectedLocationId]
  );

  const toggleCategory = (code: string) => {
    setErrorMsg(null);
    setSelectedCategories((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const maxAllowedWeight = metadata?.max_pickup_weight_kg || 500;
  const parsedWeight = parseFloat(estimatedWeight);
  const isStep2Valid =
    selectedCategories.length > 0 &&
    !isNaN(parsedWeight) &&
    parsedWeight > 0 &&
    parsedWeight <= maxAllowedWeight;

  const validateStep = (targetStep: number): boolean => {
    setErrorMsg(null);
    if (targetStep > 1 && !selectedLocation) {
      setErrorMsg('Please select a pickup location.');
      return false;
    }
    if (targetStep > 2) {
      if (selectedCategories.length === 0) {
        setErrorMsg('Select at least one waste category.');
        return false;
      }
      if (isNaN(parsedWeight) || parsedWeight <= 0) {
        setErrorMsg('Enter an estimated weight greater than 0 kg.');
        return false;
      }
      if (parsedWeight > maxAllowedWeight) {
        setErrorMsg(`Maximum single-pickup weight is ${maxAllowedWeight} kg.`);
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    const nextStep = (step + 1) as 1 | 2 | 3 | 4;
    if (validateStep(nextStep)) {
      setStep(nextStep);
    }
  };

  const openAddLocationModal = () => {
    const defaultCity = locations[0]?.city || '';
    const defaultState = locations[0]?.state || '';
    setNewLocCity(defaultCity);
    setNewLocState(defaultState);
    setModalError(null);
    setAddLocModal(true);
  };

  const handleAddLocation = async () => {
    if (
      !newLocName.trim() ||
      !newLocAddress.trim() ||
      !newLocCity.trim() ||
      !newLocState.trim() ||
      !newLocPin.trim() ||
      !newLocContactPhone.trim()
    ) {
      setModalError('Please complete all required location fields.');
      return;
    }
    setSavingLoc(true);
    setModalError(null);
    try {
      const created = await api.addLocation({
        location_code:
          newLocCode.trim() ||
          `LOC-${String(locations.length + 1).padStart(3, '0')}`,
        name: newLocName.trim(),
        address_line_1: newLocAddress.trim(),
        city: newLocCity.trim(),
        state: newLocState.trim(),
        postal_code: newLocPin.trim(),
        latitude: 12.9716,
        longitude: 77.5946,
        contact_name: newLocContactName.trim() || 'Facility Coordinator',
        contact_phone: newLocContactPhone.trim(),
      });
      await onRefreshLocations();
      setSelectedLocationId(created.id);
      setAddLocModal(false);
      setNewLocName('');
      setNewLocCode('');
      setNewLocAddress('');
      setNewLocPin('');
      setNewLocContactName('');
      setNewLocContactPhone('');
    } catch (err: any) {
      setModalError(err?.message || 'Failed to register location.');
    } finally {
      setSavingLoc(false);
    }
  };

  const handleSubmitPickup = async () => {
    if (!validateStep(4) || !selectedLocation) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await api.createPickup({
        location_id: selectedLocation.id,
        requested_date: selectedDateIso,
        priority: selectedPriority,
        estimated_weight_kg: parsedWeight,
        waste_categories: selectedCategories,
        time_slot: selectedTimeSlot,
        notes: remarks.trim() || undefined,
      });
      setCreatedPickup({
        public_id: res.public_id,
        pickup_code: res.pickup_code,
        status: res.status,
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to submit pickup request.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingMeta) {
    return <LoadingState message="Loading pickup form..." />;
  }

  // Success confirmation view after submission
  if (createdPickup) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <Card variant="elevated" padding="xl" style={styles.successCard}>
          <View style={styles.successIconWrap}>
            <CheckCircle2 size={34} color={colors.success} />
          </View>
          <Text style={styles.successTitle}>Pickup Scheduled</Text>
          <Text style={styles.successSubtitle}>
            Your collection request has been registered and queued for route dispatch.
          </Text>

          <View style={styles.generatedIdBox}>
            <Text style={styles.generatedIdLabel}>PICKUP ID</Text>
            <Text style={styles.generatedIdValue}>
              {createdPickup.pickup_code}
            </Text>
            <View style={{ marginTop: spacing.xs }}>
              <StatusBadge status={createdPickup.status} />
            </View>
          </View>

          <PrimaryButton
            title="Track Pickup"
            onPress={() => onSubmitted(createdPickup.public_id)}
            size="lg"
            style={{ width: '100%' }}
          />
        </Card>
      </ScrollView>
    );
  }

  const categoriesList = metadata?.waste_categories || [
    {
      code: 'EXPIRED_DISCARDED_MEDICINE',
      name: 'Expired & Discarded Medicines',
      bin_color: 'YELLOW',
      description: 'Outdated, contaminated, or discarded pharmaceutical products.',
    },
    {
      code: 'CHEMICAL',
      name: 'Chemical & Cytotoxic Waste',
      bin_color: 'YELLOW',
      description: 'Chemical, cytotoxic, and hazardous pharmaceutical compounds.',
    },
    {
      code: 'GLASSWARE',
      name: 'Contaminated Glassware & Vials',
      bin_color: 'BLUE',
      description: 'Glass ampoules, vials, bottles, and broken glass.',
    },
    {
      code: 'SHARPS',
      name: 'Pharmaceutical Sharps',
      bin_color: 'WHITE',
      description: 'Needles, syringes with fixed needles, and scalpels.',
    },
  ];

  const timeSlots = metadata?.time_slots || [
    { id: 'MORNING', label: '09:00 AM - 12:00 PM', window: 'Morning' },
    { id: 'AFTERNOON', label: '12:00 PM - 03:00 PM', window: 'Afternoon' },
    { id: 'EVENING', label: '03:00 PM - 06:00 PM', window: 'Evening' },
  ];

  const getBinBadgeStyle = (binColor: string) => {
    const upper = (binColor || '').toUpperCase();
    if (upper.includes('YELLOW')) {
      return { bg: colors.warningBg, text: colors.warning, border: colors.warningBorder };
    }
    if (upper.includes('BLUE')) {
      return { bg: colors.lightAccent, text: colors.accentDark, border: colors.accentMuted };
    }
    if (upper.includes('RED')) {
      return { bg: colors.errorBg, text: colors.error, border: colors.errorBorder };
    }
    return { bg: colors.secondaryLight, text: colors.textSecondary, border: colors.border };
  };

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
        {/* Stacked 4-Step Progress Bar (overflow-safe on all phone widths) */}
        <View style={styles.stepperBar}>
          {[
            { num: 1, label: 'Location' },
            { num: 2, label: 'Waste' },
            { num: 3, label: 'Schedule' },
            { num: 4, label: 'Review' },
          ].map((item, idx) => {
            const active = step === item.num;
            const done = step > item.num;
            return (
              <React.Fragment key={item.num}>
                {idx > 0 ? (
                  <View
                    style={[
                      styles.stepConnector,
                      (active || done) && styles.stepConnectorActive,
                    ]}
                  />
                ) : null}
                <TouchableOpacity
                  style={styles.stepItem}
                  activeOpacity={0.75}
                  onPress={() => {
                    if (item.num < step || validateStep(item.num)) {
                      setStep(item.num as 1 | 2 | 3 | 4);
                    }
                  }}
                >
                  <View
                    style={[
                      styles.stepCircle,
                      active && styles.stepCircleActive,
                      done && styles.stepCircleDone,
                    ]}
                  >
                    {done ? (
                      <Check size={13} color={colors.textInverse} />
                    ) : (
                      <Text
                        style={[
                          styles.stepNum,
                          active && styles.stepNumActive,
                        ]}
                      >
                        {item.num}
                      </Text>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.stepLabel,
                      active && styles.stepLabelActive,
                      done && styles.stepLabelDone,
                    ]}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              </React.Fragment>
            );
          })}
        </View>

        {errorMsg ? (
          <View style={styles.errorBanner}>
            <AlertCircle size={16} color={colors.error} />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        {/* STEP 1: PICKUP LOCATION */}
        {step === 1 && (
          <Card variant="elevated" padding="lg">
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <MapPin size={18} color={colors.primary} />
                <Text style={styles.cardTitle}>Pickup Location</Text>
              </View>
              <TouchableOpacity
                style={styles.addLocBtn}
                onPress={openAddLocationModal}
              >
                <Plus size={14} color={colors.accentDark} />
                <Text style={styles.addLocText}>New Address</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.locationsList}>
              {locations.map((loc) => {
                const isSelected = loc.id === selectedLocationId;
                return (
                  <TouchableOpacity
                    key={loc.id}
                    style={[
                      styles.locationOption,
                      isSelected && styles.locationOptionSelected,
                    ]}
                    onPress={() => {
                      setSelectedLocationId(loc.id);
                      setErrorMsg(null);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.locTopRow}>
                      <View style={styles.locTitleGroup}>
                        <Text style={styles.locName}>{loc.name}</Text>
                        {loc.location_code ? (
                          <View style={styles.locCodeChip}>
                            <Text style={styles.locCodeText}>
                              {loc.location_code}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <View
                        style={[
                          styles.radioOuter,
                          isSelected && styles.radioOuterSelected,
                        ]}
                      >
                        {isSelected ? <View style={styles.radioInner} /> : null}
                      </View>
                    </View>

                    <Text style={styles.locAddress}>
                      {loc.address_line_1}
                      {loc.address_line_2 ? `, ${loc.address_line_2}` : ''},{' '}
                      {loc.city}, {loc.state} {loc.postal_code}
                    </Text>

                    <View style={styles.locContactRow}>
                      <View style={styles.locContactItem}>
                        <UserIcon size={12} color={colors.textSecondary} />
                        <Text style={styles.locContactText} numberOfLines={1}>
                          {loc.contact_name}
                        </Text>
                      </View>
                      <View style={styles.locContactItem}>
                        <Phone size={12} color={colors.textSecondary} />
                        <Text style={styles.locContactText} numberOfLines={1}>
                          {loc.contact_phone}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.stepActions}>
              <PrimaryButton
                title="Cancel"
                onPress={onCancel}
                variant="outline"
                style={{ flex: 1 }}
              />
              <PrimaryButton
                title="Continue"
                onPress={handleNext}
                disabled={!selectedLocation}
                style={{ flex: 2 }}
              />
            </View>
          </Card>
        )}

        {/* STEP 2: WASTE DETAILS */}
        {step === 2 && (
          <Card variant="elevated" padding="lg">
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <Package size={18} color={colors.primary} />
                <Text style={styles.cardTitle}>Waste Details</Text>
              </View>
            </View>

            <Text style={styles.fieldLabel}>Waste Categories *</Text>
            <View style={styles.categoriesList}>
              {categoriesList.map((cat) => {
                const selected = selectedCategories.includes(cat.code);
                const binColors = getBinBadgeStyle(cat.bin_color);
                return (
                  <TouchableOpacity
                    key={cat.code}
                    style={[
                      styles.categoryCard,
                      selected && styles.categoryCardSelected,
                    ]}
                    onPress={() => toggleCategory(cat.code)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.catHeader}>
                      <View style={styles.catTitleGroup}>
                        <Text style={styles.catName}>{cat.name}</Text>
                        <View
                          style={[
                            styles.binChip,
                            {
                              backgroundColor: binColors.bg,
                              borderColor: binColors.border,
                            },
                          ]}
                        >
                          <Text
                            style={[styles.binChipText, { color: binColors.text }]}
                          >
                            {cat.bin_color} BIN
                          </Text>
                        </View>
                      </View>
                      <View
                        style={[
                          styles.checkboxOuter,
                          selected && styles.checkboxOuterSelected,
                        ]}
                      >
                        {selected ? (
                          <Check size={12} color={colors.textInverse} />
                        ) : null}
                      </View>
                    </View>
                    <Text style={styles.catDesc}>{cat.description}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>Estimated Weight (kg) *</Text>
                <Text style={styles.fieldHint}>Max {maxAllowedWeight} kg</Text>
              </View>

              {/* Quick Weight Preset Chips */}
              <View style={styles.quickWeightRow}>
                {QUICK_WEIGHTS.map((preset) => {
                  const isActive = estimatedWeight === preset;
                  return (
                    <TouchableOpacity
                      key={preset}
                      style={[
                        styles.weightPresetChip,
                        isActive && styles.weightPresetChipActive,
                      ]}
                      onPress={() => {
                        setEstimatedWeight(preset);
                        setErrorMsg(null);
                      }}
                    >
                      <Text
                        style={[
                          styles.weightPresetText,
                          isActive && styles.weightPresetTextActive,
                        ]}
                      >
                        {preset} kg
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.inputRow}>
                <Scale size={17} color={colors.textSecondary} />
                <TextInput
                  style={styles.input}
                  value={estimatedWeight}
                  onChangeText={(val) => {
                    setEstimatedWeight(val);
                    setErrorMsg(null);
                  }}
                  keyboardType="decimal-pad"
                  placeholder="Enter estimated weight (e.g. 12.5)"
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={styles.unitTag}>KG</Text>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Handling Instructions (Optional)</Text>
              <TextInput
                style={styles.textArea}
                value={remarks}
                onChangeText={setRemarks}
                placeholder="Batch notes, cold-chain items, or loading dock instructions"
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.stepActions}>
              <PrimaryButton
                title="Back"
                onPress={() => setStep(1)}
                variant="outline"
                style={{ flex: 1 }}
              />
              <PrimaryButton
                title="Continue"
                onPress={handleNext}
                disabled={!isStep2Valid}
                style={{ flex: 2 }}
              />
            </View>
          </Card>
        )}

        {/* STEP 3: PICKUP SCHEDULING */}
        {step === 3 && (
          <Card variant="elevated" padding="lg">
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <Calendar size={18} color={colors.primary} />
                <Text style={styles.cardTitle}>Collection Schedule</Text>
              </View>
            </View>

            <Text style={styles.fieldLabel}>Collection Date *</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dateScroll}
            >
              {upcomingDates.map((d) => {
                const selected =
                  d.isoDate.slice(0, 10) === selectedDateIso.slice(0, 10);
                return (
                  <TouchableOpacity
                    key={d.isoDate}
                    style={[styles.dateChip, selected && styles.dateChipSelected]}
                    onPress={() => setSelectedDateIso(d.isoDate)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.dateDayName,
                        selected && styles.dateTextSelected,
                      ]}
                    >
                      {d.dayName}
                    </Text>
                    <Text
                      style={[
                        styles.dateLabel,
                        selected && styles.dateTextSelected,
                      ]}
                    >
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>
              Preferred Time Slot *
            </Text>
            <View style={styles.slotsList}>
              {timeSlots.map((slot) => {
                const selected = selectedTimeSlot === slot.label;
                return (
                  <TouchableOpacity
                    key={slot.id}
                    style={[
                      styles.slotCard,
                      selected && styles.slotCardSelected,
                    ]}
                    onPress={() => setSelectedTimeSlot(slot.label)}
                    activeOpacity={0.8}
                  >
                    <Clock
                      size={16}
                      color={selected ? colors.accent : colors.textSecondary}
                    />
                    <View style={styles.slotTextCol}>
                      <Text style={styles.slotWindow}>{slot.window}</Text>
                      <Text style={styles.slotLabel}>{slot.label}</Text>
                    </View>
                    <View
                      style={[
                        styles.radioOuter,
                        selected && styles.radioOuterSelected,
                      ]}
                    >
                      {selected ? <View style={styles.radioInner} /> : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>
              Collection Priority
            </Text>
            <View style={styles.priorityRow}>
              {(['NORMAL', 'HIGH', 'URGENT'] as PickupPriority[]).map((prio) => {
                const selected = selectedPriority === prio;
                return (
                  <TouchableOpacity
                    key={prio}
                    style={[
                      styles.prioChip,
                      selected && styles.prioChipSelected,
                    ]}
                    onPress={() => setSelectedPriority(prio)}
                  >
                    <Text
                      style={[
                        styles.prioText,
                        selected && styles.prioTextSelected,
                      ]}
                    >
                      {formatStatusLabel(prio)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.stepActions}>
              <PrimaryButton
                title="Back"
                onPress={() => setStep(2)}
                variant="outline"
                style={{ flex: 1 }}
              />
              <PrimaryButton
                title="Review Request"
                onPress={handleNext}
                style={{ flex: 2 }}
              />
            </View>
          </Card>
        )}

        {/* STEP 4: REVIEW AND SUBMIT */}
        {step === 4 && (
          <Card variant="elevated" padding="lg">
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <FileText size={18} color={colors.primary} />
                <Text style={styles.cardTitle}>Review Pickup Request</Text>
              </View>
            </View>

            <View style={styles.reviewSection}>
              <View style={styles.reviewSectionTop}>
                <Text style={styles.reviewHeading}>PICKUP LOCATION</Text>
                <TouchableOpacity onPress={() => setStep(1)}>
                  <Text style={styles.editStepLink}>Change</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.reviewPrimary}>{selectedLocation?.name}</Text>
              <Text style={styles.reviewSecondary}>
                {selectedLocation?.address_line_1}, {selectedLocation?.city},{' '}
                {selectedLocation?.state} {selectedLocation?.postal_code}
              </Text>
              <Text style={styles.reviewSecondary}>
                {selectedLocation?.contact_name} · {selectedLocation?.contact_phone}
              </Text>
            </View>

            <View style={styles.reviewSection}>
              <View style={styles.reviewSectionTop}>
                <Text style={styles.reviewHeading}>WASTE DETAILS</Text>
                <TouchableOpacity onPress={() => setStep(2)}>
                  <Text style={styles.editStepLink}>Change</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.chipWrap}>
                {selectedCategories.map((code) => (
                  <View key={code} style={styles.reviewCatChip}>
                    <Text style={styles.reviewCatText}>
                      {formatWasteCategory(code)}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={[styles.reviewPrimary, { marginTop: 8 }]}>
                Estimated Weight: {parsedWeight.toFixed(1)} kg
              </Text>
              {remarks.trim() ? (
                <Text style={styles.reviewSecondary}>
                  Note: {remarks.trim()}
                </Text>
              ) : null}
            </View>

            <View style={styles.reviewSection}>
              <View style={styles.reviewSectionTop}>
                <Text style={styles.reviewHeading}>COLLECTION SCHEDULE</Text>
                <TouchableOpacity onPress={() => setStep(3)}>
                  <Text style={styles.editStepLink}>Change</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.reviewPrimary}>
                {new Date(selectedDateIso).toLocaleDateString('en-IN', {
                  weekday: 'short',
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
              <Text style={styles.reviewSecondary}>
                {selectedTimeSlot} · {formatStatusLabel(selectedPriority)} Priority
              </Text>
            </View>

            <View style={styles.stepActions}>
              <PrimaryButton
                title="Back"
                onPress={() => setStep(3)}
                variant="outline"
                style={{ flex: 1 }}
              />
              <PrimaryButton
                title="Submit Request"
                onPress={handleSubmitPickup}
                loading={submitting}
                variant="primary"
                style={{ flex: 2 }}
              />
            </View>
          </Card>
        )}
      </ScrollView>

      {/* Keyboard-Safe Scrollable Modal to Add New Registered Location */}
      <Modal
        visible={addLocModal}
        transparent
        animationType="fade"
        onRequestClose={() => setAddLocModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContainer}>
            <Card variant="elevated" padding="lg">
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Pickup Address</Text>
                <TouchableOpacity
                  onPress={() => setAddLocModal(false)}
                  style={styles.modalCloseBtn}
                >
                  <X size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalScroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {modalError ? (
                  <View style={styles.errorBanner}>
                    <AlertCircle size={15} color={colors.error} />
                    <Text style={styles.errorText}>{modalError}</Text>
                  </View>
                ) : null}

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Branch / Location Name *</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Main Pharmacy / Annex B"
                    placeholderTextColor={colors.textMuted}
                    value={newLocName}
                    onChangeText={setNewLocName}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Street Address *</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Building, street, and area"
                    placeholderTextColor={colors.textMuted}
                    value={newLocAddress}
                    onChangeText={setNewLocAddress}
                  />
                </View>

                <View style={styles.twoColRow}>
                  <View style={[styles.fieldGroup, styles.colHalf]}>
                    <Text style={styles.fieldLabel}>City *</Text>
                    <TextInput
                      style={styles.modalInput}
                      value={newLocCity}
                      onChangeText={setNewLocCity}
                      placeholder="City"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                  <View style={[styles.fieldGroup, styles.colHalf]}>
                    <Text style={styles.fieldLabel}>PIN Code *</Text>
                    <TextInput
                      style={styles.modalInput}
                      value={newLocPin}
                      onChangeText={setNewLocPin}
                      keyboardType="number-pad"
                      maxLength={6}
                      placeholder="560001"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>State *</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={newLocState}
                    onChangeText={setNewLocState}
                    placeholder="State"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                <View style={styles.twoColRow}>
                  <View style={[styles.fieldGroup, styles.colHalf]}>
                    <Text style={styles.fieldLabel}>Site Contact Name</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="Coordinator"
                      placeholderTextColor={colors.textMuted}
                      value={newLocContactName}
                      onChangeText={setNewLocContactName}
                    />
                  </View>
                  <View style={[styles.fieldGroup, styles.colHalf]}>
                    <Text style={styles.fieldLabel}>Contact Phone *</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="+91 9876543210"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="phone-pad"
                      value={newLocContactPhone}
                      onChangeText={setNewLocContactPhone}
                    />
                  </View>
                </View>
              </ScrollView>

              <View style={styles.modalActions}>
                <PrimaryButton
                  title="Cancel"
                  onPress={() => setAddLocModal(false)}
                  variant="outline"
                  style={{ flex: 1 }}
                />
                <PrimaryButton
                  title="Save Address"
                  onPress={handleAddLocation}
                  loading={savingLoc}
                  style={{ flex: 1 }}
                />
              </View>
            </Card>
          </View>
        </KeyboardAvoidingView>
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
  stepperBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepItem: {
    alignItems: 'center',
    gap: 4,
    minWidth: 54,
  },
  stepConnector: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
    marginBottom: 16,
    marginHorizontal: 2,
  },
  stepConnectorActive: {
    backgroundColor: colors.accent,
  },
  stepCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.secondaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: {
    backgroundColor: colors.primary,
  },
  stepCircleDone: {
    backgroundColor: colors.accent,
  },
  stepNum: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  stepNumActive: {
    color: colors.textInverse,
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  stepLabelActive: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  stepLabelDone: {
    color: colors.accentDark,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: colors.errorBorder,
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
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  cardHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  addLocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.lightAccent,
  },
  addLocText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accentDark,
  },
  locationsList: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  locationOption: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    backgroundColor: colors.background,
    gap: 6,
  },
  locationOptionSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.surface,
  },
  locTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  locTitleGroup: {
    flex: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  locName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  locCodeChip: {
    backgroundColor: colors.secondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
  },
  locCodeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: colors.accent,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  checkboxOuter: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkboxOuterSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  locAddress: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  locContactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: 2,
  },
  locContactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  locContactText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  fieldGroup: {
    marginBottom: spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  fieldHint: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
    marginBottom: 8,
  },
  categoriesList: {
    gap: spacing.sm + 2,
    marginBottom: spacing.lg,
  },
  categoryCard: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    backgroundColor: colors.background,
    gap: 6,
  },
  categoryCardSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.surface,
  },
  catHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  catTitleGroup: {
    flex: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  catName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  binChip: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
  },
  binChipText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  catDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  quickWeightRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  weightPresetChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  weightPresetChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.lightAccent,
  },
  weightPresetText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  weightPresetTextActive: {
    color: colors.accentDark,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 48,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    height: '100%',
  },
  unitTag: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  textArea: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 14,
    color: colors.textPrimary,
    minHeight: 76,
    textAlignVertical: 'top',
  },
  dateScroll: {
    gap: spacing.sm,
    paddingVertical: 2,
  },
  dateChip: {
    width: 72,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    gap: 2,
  },
  dateChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  dateDayName: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  dateLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  dateTextSelected: {
    color: colors.textInverse,
  },
  slotsList: {
    gap: spacing.sm,
  },
  slotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  slotCardSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.surface,
  },
  slotTextCol: {
    flex: 1,
    flexShrink: 1,
  },
  slotWindow: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  slotLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 2,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  prioChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  prioChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  prioText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  prioTextSelected: {
    color: colors.textInverse,
  },
  reviewSection: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 4,
  },
  reviewSectionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  reviewHeading: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.6,
  },
  editStepLink: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
  },
  reviewPrimary: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  reviewSecondary: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  reviewCatChip: {
    backgroundColor: colors.lightAccent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.xs,
  },
  reviewCatText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accentDark,
  },
  stepActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  successCard: {
    alignItems: 'center',
    gap: spacing.md,
  },
  successIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },
  generatedIdBox: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  generatedIdLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
  generatedIdValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  modalScroll: {
    maxHeight: 380,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  colHalf: {
    flex: 1,
  },
  modalInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 44,
    fontSize: 14,
    color: colors.textPrimary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
