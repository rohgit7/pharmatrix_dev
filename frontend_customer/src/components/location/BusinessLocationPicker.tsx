import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  GestureResponderEvent,
} from 'react-native';
import Svg, { Rect, Line, Circle, Path } from 'react-native-svg';
import {
  Navigation,
  MapPin,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  Settings,
  Compass,
  RefreshCw,
  Building2,
  Phone,
  User as UserIcon,
  X,
} from 'lucide-react-native';
import { colors, spacing, borderRadius } from '../../theme';
import {
  getQuietLocationPermissionState,
  LocationErrorCode,
  LocationPermissionInfo,
  openDeviceLocationSettings,
  requestLocationAndDetectAddress,
  reverseGeocodeCoordinates,
} from '../../utils/location';

export type LocationSelectionMethod = 'gps' | 'manual' | 'map';

export interface BusinessLocationFormValue {
  name: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  contactName: string;
  contactPhone: string;
  latitude: number | null;
  longitude: number | null;
  locationSource: 'GPS_VERIFIED' | 'MAP_PIN' | 'MANUAL';
  formattedDetectedAddress?: string;
}

export interface BusinessLocationFieldErrors {
  name?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  contactName?: string;
  contactPhone?: string;
}

interface BusinessLocationPickerProps {
  value: BusinessLocationFormValue;
  onChange: (updated: BusinessLocationFormValue) => void;
  errors?: BusinessLocationFieldErrors;
  onClearFieldError?: (field: keyof BusinessLocationFieldErrors) => void;
  defaultBranchPlaceholder?: string;
  compactHeader?: boolean;
}

const DEFAULT_MAP_CENTER = { lat: 12.9716, lng: 77.5946 };
const MAP_SPAN_DEG = 0.03; // ~3.3km viewport span

export const BusinessLocationPicker: React.FC<BusinessLocationPickerProps> = ({
  value,
  onChange,
  errors = {},
  onClearFieldError,
  defaultBranchPlaceholder = 'e.g. Main Pharmacy / Ground Floor Wing',
  compactHeader = false,
}) => {
  const [activeMethod, setActiveMethod] = useState<LocationSelectionMethod>(
    value.locationSource === 'MAP_PIN'
      ? 'map'
      : value.locationSource === 'GPS_VERIFIED'
        ? 'gps'
        : 'gps'
  );

  const [permissionInfo, setPermissionInfo] = useState<LocationPermissionInfo>({
    status: 'undetermined',
    canAskAgain: true,
    servicesEnabled: true,
  });

  const [detectingGps, setDetectingGps] = useState(false);
  const [gpsError, setGpsError] = useState<{
    code: LocationErrorCode;
    message: string;
  } | null>(null);
  const [geocodingWarning, setGeocodingWarning] = useState<string | null>(null);

  // Interactive Map Pin state
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({
    lat: value.latitude ?? DEFAULT_MAP_CENTER.lat,
    lng: value.longitude ?? DEFAULT_MAP_CENTER.lng,
  });
  const [pinCoords, setPinCoords] = useState<{ lat: number; lng: number }>({
    lat: value.latitude ?? DEFAULT_MAP_CENTER.lat,
    lng: value.longitude ?? DEFAULT_MAP_CENTER.lng,
  });
  const [mapCanvasSize, setMapCanvasSize] = useState({ width: 320, height: 210 });
  const [resolvingMapPin, setResolvingMapPin] = useState(false);

  // Quietly inspect permission status on mount (NEVER prompts the user)
  useEffect(() => {
    let mounted = true;
    getQuietLocationPermissionState().then((info) => {
      if (mounted) {
        setPermissionInfo(info);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const updateField = <K extends keyof BusinessLocationFormValue>(
    field: K,
    fieldVal: BusinessLocationFormValue[K],
    errorKey?: keyof BusinessLocationFieldErrors
  ) => {
    if (errorKey && onClearFieldError) {
      onClearFieldError(errorKey);
    }
    onChange({
      ...value,
      [field]: fieldVal,
    });
  };

  const handleUseCurrentLocation = async () => {
    setDetectingGps(true);
    setGpsError(null);
    setGeocodingWarning(null);

    const outcome = await requestLocationAndDetectAddress();
    setPermissionInfo(outcome.permission);

    if (!outcome.ok) {
      setDetectingGps(false);
      setGpsError({
        code: outcome.errorCode,
        message: outcome.message,
      });
      return;
    }

    const detected = outcome.data;
    setMapCenter({ lat: detected.latitude, lng: detected.longitude });
    setPinCoords({ lat: detected.latitude, lng: detected.longitude });

    if (detected.geocodingFailed) {
      setGeocodingWarning(
        'GPS coordinates captured accurately, but automatic street lookup was unavailable. Please complete the address fields below.'
      );
    }

    onChange({
      ...value,
      name: value.name.trim() || detected.buildingName || value.name,
      addressLine1: detected.addressLine1 || value.addressLine1,
      addressLine2: detected.addressLine2 || value.addressLine2,
      city: detected.city || value.city,
      state: detected.state || value.state,
      postalCode: detected.postalCode || value.postalCode,
      latitude: detected.latitude,
      longitude: detected.longitude,
      locationSource: 'GPS_VERIFIED',
      formattedDetectedAddress: detected.formattedAddress,
    });

    if (onClearFieldError) {
      if (detected.addressLine1) onClearFieldError('addressLine1');
      if (detected.city) onClearFieldError('city');
      if (detected.state) onClearFieldError('state');
      if (detected.postalCode) onClearFieldError('postalCode');
    }

    setDetectingGps(false);
  };

  const handleMapCanvasPress = (evt: GestureResponderEvent) => {
    const { locationX, locationY } = evt.nativeEvent;
    if (!mapCanvasSize.width || !mapCanvasSize.height) return;

    const normX = Math.max(0, Math.min(1, locationX / mapCanvasSize.width)) - 0.5;
    const normY = 0.5 - Math.max(0, Math.min(1, locationY / mapCanvasSize.height));

    const newLat = Number((mapCenter.lat + normY * MAP_SPAN_DEG).toFixed(6));
    const newLng = Number((mapCenter.lng + normX * MAP_SPAN_DEG).toFixed(6));
    setPinCoords({ lat: newLat, lng: newLng });
  };

  const handleNudgePin = (dLat: number, dLng: number) => {
    const newLat = Number(Math.max(-90, Math.min(90, pinCoords.lat + dLat)).toFixed(6));
    const newLng = Number(Math.max(-180, Math.min(180, pinCoords.lng + dLng)).toFixed(6));
    setPinCoords({ lat: newLat, lng: newLng });
    setMapCenter({ lat: newLat, lng: newLng });
  };

  const handleConfirmMapPin = async () => {
    setResolvingMapPin(true);
    setGeocodingWarning(null);
    const resolved = await reverseGeocodeCoordinates(pinCoords.lat, pinCoords.lng);

    if (resolved.geocodingFailed) {
      setGeocodingWarning(
        'Pin coordinates saved. Please verify and complete the street and PIN code fields below.'
      );
    }

    onChange({
      ...value,
      name: value.name.trim() || resolved.buildingName || value.name,
      addressLine1: resolved.addressLine1 || value.addressLine1,
      addressLine2: resolved.addressLine2 || value.addressLine2,
      city: resolved.city || value.city,
      state: resolved.state || value.state,
      postalCode: resolved.postalCode || value.postalCode,
      latitude: resolved.latitude,
      longitude: resolved.longitude,
      locationSource: 'MAP_PIN',
      formattedDetectedAddress: resolved.formattedAddress,
    });

    if (onClearFieldError) {
      if (resolved.addressLine1) onClearFieldError('addressLine1');
      if (resolved.city) onClearFieldError('city');
      if (resolved.state) onClearFieldError('state');
      if (resolved.postalCode) onClearFieldError('postalCode');
    }

    setResolvingMapPin(false);
  };

  const handleSwitchToManual = () => {
    setActiveMethod('manual');
    setGpsError(null);
  };

  const handleClearCoordinates = () => {
    onChange({
      ...value,
      latitude: null,
      longitude: null,
      locationSource: 'MANUAL',
      formattedDetectedAddress: undefined,
    });
  };

  // Compute pin pixel position on SVG canvas
  const pinPixelX =
    mapCanvasSize.width *
    Math.max(0.08, Math.min(0.92, 0.5 + (pinCoords.lng - mapCenter.lng) / MAP_SPAN_DEG));
  const pinPixelY =
    mapCanvasSize.height *
    Math.max(0.12, Math.min(0.88, 0.5 - (pinCoords.lat - mapCenter.lat) / MAP_SPAN_DEG));

  const hasVerifiedCoordinates =
    typeof value.latitude === 'number' && typeof value.longitude === 'number';

  return (
    <View style={styles.container}>
      {/* Why location is needed banner */}
      {!compactHeader ? (
        <View style={styles.purposeBanner}>
          <View style={styles.purposeIconWrap}>
            <MapPin size={18} color={colors.accent} />
          </View>
          <View style={styles.purposeTextCol}>
            <Text style={styles.purposeTitle}>Why we need your business location</Text>
            <Text style={styles.purposeBody}>
              Pharmatrix uses your pickup address and coordinates to assign nearby collection
              vehicles and navigate drivers directly to your business entrance.
            </Text>
          </View>
        </View>
      ) : null}

      {/* 3-Mode Location Selection Switcher */}
      <View style={styles.methodTabsRow}>
        <TouchableOpacity
          style={[styles.methodTab, activeMethod === 'gps' && styles.methodTabActive]}
          onPress={() => setActiveMethod('gps')}
          activeOpacity={0.75}
        >
          <Navigation
            size={15}
            color={activeMethod === 'gps' ? colors.surface : colors.textSecondary}
          />
          <Text
            style={[styles.methodTabText, activeMethod === 'gps' && styles.methodTabTextActive]}
          >
            Current GPS
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.methodTab, activeMethod === 'manual' && styles.methodTabActive]}
          onPress={() => setActiveMethod('manual')}
          activeOpacity={0.75}
        >
          <Edit3
            size={15}
            color={activeMethod === 'manual' ? colors.surface : colors.textSecondary}
          />
          <Text
            style={[styles.methodTabText, activeMethod === 'manual' && styles.methodTabTextActive]}
          >
            Manual Entry
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.methodTab, activeMethod === 'map' && styles.methodTabActive]}
          onPress={() => setActiveMethod('map')}
          activeOpacity={0.75}
        >
          <Compass
            size={15}
            color={activeMethod === 'map' ? colors.surface : colors.textSecondary}
          />
          <Text
            style={[styles.methodTabText, activeMethod === 'map' && styles.methodTabTextActive]}
          >
            Pin on Map
          </Text>
        </TouchableOpacity>
      </View>

      {/* OPTION A: USE CURRENT LOCATION (GPS) */}
      {activeMethod === 'gps' ? (
        <View style={styles.methodPanel}>
          <View style={styles.gpsHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.panelTitle}>Automatic GPS Detection</Text>
              <Text style={styles.panelSubtitle}>
                Detect your business coordinates and pre-fill your pickup address.
              </Text>
            </View>
            <View
              style={[
                styles.permissionPill,
                permissionInfo.status === 'granted'
                  ? styles.permissionPillGranted
                  : permissionInfo.status === 'denied' ||
                      permissionInfo.status === 'permanently_denied' ||
                      permissionInfo.status === 'services_disabled'
                    ? styles.permissionPillDenied
                    : styles.permissionPillNeutral,
              ]}
            >
              <Text
                style={[
                  styles.permissionPillText,
                  permissionInfo.status === 'granted'
                    ? { color: colors.success }
                    : permissionInfo.status === 'denied' ||
                        permissionInfo.status === 'permanently_denied' ||
                        permissionInfo.status === 'services_disabled'
                      ? { color: colors.warning }
                      : { color: colors.textSecondary },
                ]}
              >
                {permissionInfo.status === 'granted'
                  ? 'GPS Ready'
                  : permissionInfo.status === 'permanently_denied'
                    ? 'Blocked in Settings'
                    : permissionInfo.status === 'denied'
                      ? 'Permission Declined'
                      : permissionInfo.status === 'services_disabled'
                        ? 'GPS Off'
                        : 'Not Requested'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.gpsActionBtn, detectingGps && styles.gpsActionBtnDisabled]}
            onPress={handleUseCurrentLocation}
            disabled={detectingGps}
            activeOpacity={0.8}
          >
            {detectingGps ? (
              <>
                <ActivityIndicator size="small" color={colors.surface} />
                <Text style={styles.gpsActionBtnText}>
                  Detecting GPS Coordinates & Address...
                </Text>
              </>
            ) : (
              <>
                <Navigation size={18} color={colors.surface} />
                <Text style={styles.gpsActionBtnText}>
                  {hasVerifiedCoordinates && value.locationSource === 'GPS_VERIFIED'
                    ? 'Refresh Current Location'
                    : 'Use Current Location'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Permission / GPS Error State */}
          {gpsError ? (
            <View style={styles.errorCard}>
              <View style={styles.errorCardTop}>
                <AlertTriangle size={18} color={colors.warning} />
                <Text style={styles.errorCardTitle}>
                  {gpsError.code === 'PERMISSION_PERMANENTLY_DENIED'
                    ? 'Location Permission Disabled'
                    : gpsError.code === 'PERMISSION_DENIED'
                      ? 'Location Permission Declined'
                      : gpsError.code === 'SERVICES_DISABLED'
                        ? 'Device Location Services Disabled'
                        : 'Could Not Detect GPS Location'}
                </Text>
              </View>
              <Text style={styles.errorCardBody}>{gpsError.message}</Text>

              <View style={styles.errorActionsRow}>
                {gpsError.code === 'PERMISSION_PERMANENTLY_DENIED' ||
                gpsError.code === 'SERVICES_DISABLED' ? (
                  <TouchableOpacity
                    style={styles.errorSecondaryBtn}
                    onPress={openDeviceLocationSettings}
                  >
                    <Settings size={14} color={colors.primary} />
                    <Text style={styles.errorSecondaryBtnText}>Open Device Settings</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.errorSecondaryBtn}
                    onPress={handleUseCurrentLocation}
                  >
                    <RefreshCw size={14} color={colors.primary} />
                    <Text style={styles.errorSecondaryBtnText}>Try Again</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.errorPrimaryBtn} onPress={handleSwitchToManual}>
                  <Edit3 size={14} color={colors.surface} />
                  <Text style={styles.errorPrimaryBtnText}>Enter Address Manually</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* OPTION C: SELECT LOCATION ON MAP (INTERACTIVE PIN SELECTOR) */}
      {activeMethod === 'map' ? (
        <View style={styles.methodPanel}>
          <View style={styles.gpsHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.panelTitle}>Interactive Map Pin Selector</Text>
              <Text style={styles.panelSubtitle}>
                Tap anywhere on the map grid or nudge the pin to mark your exact pickup entrance.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.locateMeMiniBtn}
              onPress={handleUseCurrentLocation}
              disabled={detectingGps}
            >
              {detectingGps ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <>
                  <Navigation size={13} color={colors.accent} />
                  <Text style={styles.locateMeMiniText}>My GPS</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View
            style={styles.mapCanvasContainer}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout;
              if (width > 0 && height > 0) {
                setMapCanvasSize({ width, height });
              }
            }}
          >
            <TouchableOpacity
              activeOpacity={0.95}
              style={StyleSheet.absoluteFill}
              onPress={handleMapCanvasPress}
            >
              <Svg width={mapCanvasSize.width} height={mapCanvasSize.height}>
                <Rect
                  x="0"
                  y="0"
                  width={mapCanvasSize.width}
                  height={mapCanvasSize.height}
                  fill="#EEF2F6"
                />
                {/* Minor grid lines */}
                {[0.2, 0.4, 0.6, 0.8].map((ratio, idx) => (
                  <React.Fragment key={`grid-${idx}`}>
                    <Line
                      x1={mapCanvasSize.width * ratio}
                      y1="0"
                      x2={mapCanvasSize.width * ratio}
                      y2={mapCanvasSize.height}
                      stroke="#DCE3EC"
                      strokeWidth="1"
                    />
                    <Line
                      x1="0"
                      y1={mapCanvasSize.height * ratio}
                      x2={mapCanvasSize.width}
                      y2={mapCanvasSize.height * ratio}
                      stroke="#DCE3EC"
                      strokeWidth="1"
                    />
                  </React.Fragment>
                ))}
                {/* Stylized road arteries */}
                <Path
                  d={`M 0 ${mapCanvasSize.height * 0.52} Q ${mapCanvasSize.width * 0.45} ${
                    mapCanvasSize.height * 0.48
                  } ${mapCanvasSize.width} ${mapCanvasSize.height * 0.35}`}
                  stroke="#FFFFFF"
                  strokeWidth="8"
                  fill="none"
                />
                <Path
                  d={`M ${mapCanvasSize.width * 0.35} 0 L ${mapCanvasSize.width * 0.58} ${
                    mapCanvasSize.height
                  }`}
                  stroke="#FFFFFF"
                  strokeWidth="6"
                  fill="none"
                />
                {/* Accuracy halo */}
                <Circle
                  cx={pinPixelX}
                  cy={pinPixelY}
                  r="24"
                  fill="rgba(123, 145, 238, 0.18)"
                  stroke="rgba(123, 145, 238, 0.45)"
                  strokeWidth="1.5"
                />
                {/* Pin shadow & marker */}
                <Circle cx={pinPixelX} cy={pinPixelY} r="9" fill={colors.primary} />
                <Circle cx={pinPixelX} cy={pinPixelY} r="4" fill={colors.surface} />
              </Svg>
            </TouchableOpacity>

            <View style={styles.mapCoordOverlay}>
              <MapPin size={13} color={colors.accent} />
              <Text style={styles.mapCoordOverlayText}>
                {pinCoords.lat.toFixed(5)}° N, {pinCoords.lng.toFixed(5)}° E
              </Text>
            </View>
          </View>

          {/* Fine Nudge Controls */}
          <View style={styles.nudgeBar}>
            <Text style={styles.nudgeLabel}>Fine-tune pin:</Text>
            <View style={styles.nudgeButtonsGroup}>
              <TouchableOpacity
                style={styles.nudgeBtn}
                onPress={() => handleNudgePin(0.0005, 0)}
              >
                <Text style={styles.nudgeBtnText}>North</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.nudgeBtn}
                onPress={() => handleNudgePin(-0.0005, 0)}
              >
                <Text style={styles.nudgeBtnText}>South</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.nudgeBtn}
                onPress={() => handleNudgePin(0, -0.0005)}
              >
                <Text style={styles.nudgeBtnText}>West</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.nudgeBtn}
                onPress={() => handleNudgePin(0, 0.0005)}
              >
                <Text style={styles.nudgeBtnText}>East</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.confirmPinBtn, resolvingMapPin && styles.gpsActionBtnDisabled]}
            onPress={handleConfirmMapPin}
            disabled={resolvingMapPin}
            activeOpacity={0.8}
          >
            {resolvingMapPin ? (
              <>
                <ActivityIndicator size="small" color={colors.surface} />
                <Text style={styles.confirmPinBtnText}>Resolving Pin Address...</Text>
              </>
            ) : (
              <>
                <CheckCircle2 size={17} color={colors.surface} />
                <Text style={styles.confirmPinBtnText}>Confirm Pin & Fill Address</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Confirmed Coordinates Status Banner (when GPS or Map Pin has captured coordinates) */}
      {hasVerifiedCoordinates ? (
        <View style={styles.verifiedLocationCard}>
          <View style={styles.verifiedLocationHeader}>
            <View style={styles.verifiedBadgeRow}>
              <CheckCircle2 size={16} color={colors.success} />
              <Text style={styles.verifiedLocationTitle}>
                {value.locationSource === 'MAP_PIN'
                  ? 'Map Pin Coordinates Confirmed'
                  : 'GPS Location Confirmed'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleClearCoordinates}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.clearCoordsBtn}
            >
              <X size={14} color={colors.textSecondary} />
              <Text style={styles.clearCoordsText}>Clear GPS</Text>
            </TouchableOpacity>
          </View>

          {value.formattedDetectedAddress ? (
            <Text style={styles.detectedAddressPreview}>{value.formattedDetectedAddress}</Text>
          ) : null}

          <Text style={styles.coordsMetaText}>
            Coordinates: {value.latitude?.toFixed(5)}, {value.longitude?.toFixed(5)} — You can
            review and edit the address details below.
          </Text>
        </View>
      ) : null}

      {geocodingWarning ? (
        <View style={styles.warningNoteBox}>
          <AlertTriangle size={15} color={colors.warning} />
          <Text style={styles.warningNoteText}>{geocodingWarning}</Text>
        </View>
      ) : null}

      {/* Editable Structured Address Form (Always accessible for review or manual entry) */}
      <View style={styles.addressFormCard}>
        <View style={styles.addressFormHeader}>
          <Text style={styles.addressFormTitle}>
            {hasVerifiedCoordinates
              ? 'Review & Complete Pickup Address'
              : 'Business Pickup Address'}
          </Text>
          <View
            style={[
              styles.sourceBadge,
              hasVerifiedCoordinates ? styles.sourceBadgeVerified : styles.sourceBadgeManual,
            ]}
          >
            <Text
              style={[
                styles.sourceBadgeText,
                hasVerifiedCoordinates
                  ? { color: colors.success }
                  : { color: colors.textSecondary },
              ]}
            >
              {hasVerifiedCoordinates
                ? value.locationSource === 'MAP_PIN'
                  ? 'Map Pin Attached'
                  : 'GPS Verified'
                : 'Manual Entry'}
            </Text>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Building / Shop / Hospital Branch Name *</Text>
          <View style={[styles.inputRow, !!errors.name && styles.inputError]}>
            <Building2 size={16} color={colors.textMuted} />
            <TextInput
              style={styles.inputWithIcon}
              value={value.name}
              onChangeText={(text) => updateField('name', text, 'name')}
              placeholder={defaultBranchPlaceholder}
              placeholderTextColor={colors.textMuted}
            />
          </View>
          {errors.name ? <Text style={styles.fieldError}>{errors.name}</Text> : null}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Street & Area / Locality *</Text>
          <TextInput
            style={[styles.input, !!errors.addressLine1 && styles.inputError]}
            value={value.addressLine1}
            onChangeText={(text) => updateField('addressLine1', text, 'addressLine1')}
            placeholder="Street number, road name, area"
            placeholderTextColor={colors.textMuted}
          />
          {errors.addressLine1 ? (
            <Text style={styles.fieldError}>{errors.addressLine1}</Text>
          ) : null}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Floor / Unit / Nearby Landmark</Text>
          <TextInput
            style={styles.input}
            value={value.addressLine2}
            onChangeText={(text) => updateField('addressLine2', text)}
            placeholder="e.g. Ground Floor, Shop No. 4, Near Metro Station"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <View style={styles.twoColRow}>
          <View style={[styles.fieldGroup, { flex: 1 }]}>
            <Text style={styles.label}>City *</Text>
            <TextInput
              style={[styles.input, !!errors.city && styles.inputError]}
              value={value.city}
              onChangeText={(text) => updateField('city', text, 'city')}
              placeholder="City"
              placeholderTextColor={colors.textMuted}
            />
            {errors.city ? <Text style={styles.fieldError}>{errors.city}</Text> : null}
          </View>

          <View style={[styles.fieldGroup, { flex: 1 }]}>
            <Text style={styles.label}>State *</Text>
            <TextInput
              style={[styles.input, !!errors.state && styles.inputError]}
              value={value.state}
              onChangeText={(text) => updateField('state', text, 'state')}
              placeholder="State"
              placeholderTextColor={colors.textMuted}
            />
            {errors.state ? <Text style={styles.fieldError}>{errors.state}</Text> : null}
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>PIN Code (6 Digits) *</Text>
          <TextInput
            style={[styles.input, !!errors.postalCode && styles.inputError]}
            value={value.postalCode}
            onChangeText={(text) =>
              updateField('postalCode', text.replace(/[^0-9]/g, ''), 'postalCode')
            }
            placeholder="e.g. 560001"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            maxLength={6}
          />
          {errors.postalCode ? <Text style={styles.fieldError}>{errors.postalCode}</Text> : null}
        </View>

        <View style={styles.divider} />

        <Text style={styles.subSectionHeading}>On-Site Pickup Contact</Text>

        <View style={styles.twoColRow}>
          <View style={[styles.fieldGroup, { flex: 1 }]}>
            <Text style={styles.label}>Contact Person *</Text>
            <View style={[styles.inputRow, !!errors.contactName && styles.inputError]}>
              <UserIcon size={15} color={colors.textMuted} />
              <TextInput
                style={styles.inputWithIcon}
                value={value.contactName}
                onChangeText={(text) => updateField('contactName', text, 'contactName')}
                placeholder="Full name"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            {errors.contactName ? (
              <Text style={styles.fieldError}>{errors.contactName}</Text>
            ) : null}
          </View>

          <View style={[styles.fieldGroup, { flex: 1 }]}>
            <Text style={styles.label}>Contact Mobile *</Text>
            <View style={[styles.inputRow, !!errors.contactPhone && styles.inputError]}>
              <Phone size={15} color={colors.textMuted} />
              <TextInput
                style={styles.inputWithIcon}
                value={value.contactPhone}
                onChangeText={(text) => updateField('contactPhone', text, 'contactPhone')}
                placeholder="10-digit mobile"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                maxLength={15}
              />
            </View>
            {errors.contactPhone ? (
              <Text style={styles.fieldError}>{errors.contactPhone}</Text>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
};

export function validateBusinessLocationForm(
  loc: BusinessLocationFormValue
): BusinessLocationFieldErrors {
  const errs: BusinessLocationFieldErrors = {};

  if (!loc.name || loc.name.trim().length < 2) {
    errs.name = 'Enter the building, shop, or branch name';
  }
  if (!loc.addressLine1 || loc.addressLine1.trim().length < 3) {
    errs.addressLine1 = 'Enter the street and area address';
  }
  if (!loc.city || loc.city.trim().length < 2) {
    errs.city = 'Enter the city';
  }
  if (!loc.state || loc.state.trim().length < 2) {
    errs.state = 'Enter the state';
  }
  const cleanPin = (loc.postalCode || '').trim();
  if (!/^\d{6}$/.test(cleanPin)) {
    errs.postalCode = 'Enter a valid 6-digit PIN code';
  }
  if (!loc.contactName || loc.contactName.trim().length < 2) {
    errs.contactName = 'Enter the on-site contact name';
  }
  const phoneDigits = (loc.contactPhone || '').replace(/\D/g, '');
  if (phoneDigits.length < 10 || phoneDigits.length > 15) {
    errs.contactPhone = 'Enter a valid 10-digit mobile number';
  }

  return errs;
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  purposeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.accentSoft,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#CED8FA',
  },
  purposeIconWrap: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  purposeTextCol: {
    flex: 1,
    gap: 2,
  },
  purposeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  purposeBody: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  methodTabsRow: {
    flexDirection: 'row',
    backgroundColor: colors.secondarySoft,
    borderRadius: borderRadius.md,
    padding: 4,
    gap: 4,
  },
  methodTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: borderRadius.sm,
  },
  methodTabActive: {
    backgroundColor: colors.primary,
  },
  methodTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  methodTabTextActive: {
    color: colors.surface,
  },
  methodPanel: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  gpsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  panelTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  panelSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 17,
  },
  permissionPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  permissionPillGranted: {
    backgroundColor: colors.successSoft,
  },
  permissionPillDenied: {
    backgroundColor: colors.warningSoft,
  },
  permissionPillNeutral: {
    backgroundColor: colors.secondarySoft,
  },
  permissionPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  gpsActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
  },
  gpsActionBtnDisabled: {
    opacity: 0.7,
  },
  gpsActionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.surface,
  },
  errorCard: {
    backgroundColor: colors.warningSoft,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#F3D299',
    gap: spacing.sm,
  },
  errorCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  errorCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  errorCardBody: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  errorActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: 4,
  },
  errorSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: borderRadius.sm,
  },
  errorSecondaryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  errorPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: borderRadius.sm,
  },
  errorPrimaryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.surface,
  },
  locateMeMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  locateMeMiniText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  mapCanvasContainer: {
    height: 210,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    position: 'relative',
    backgroundColor: '#EEF2F6',
  },
  mapCoordOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mapCoordOverlayText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  nudgeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  nudgeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  nudgeButtonsGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  nudgeBtn: {
    backgroundColor: colors.secondarySoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nudgeBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  confirmPinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
  },
  confirmPinBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.surface,
  },
  verifiedLocationCard: {
    backgroundColor: colors.successSoft,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#BDE5D4',
    gap: 4,
  },
  verifiedLocationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  verifiedBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  verifiedLocationTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.success,
  },
  clearCoordsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  clearCoordsText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  detectedAddressPreview: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 2,
  },
  coordsMetaText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  warningNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.warningSoft,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  warningNoteText: {
    flex: 1,
    fontSize: 12,
    color: colors.warning,
    lineHeight: 16,
  },
  addressFormCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addressFormHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  addressFormTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  sourceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  sourceBadgeVerified: {
    backgroundColor: colors.successSoft,
  },
  sourceBadgeManual: {
    backgroundColor: colors.secondarySoft,
  },
  sourceBadgeText: {
    fontSize: 11,
    fontWeight: '700',
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
    height: 46,
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
  twoColRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: spacing.sm,
  },
  subSectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
});

