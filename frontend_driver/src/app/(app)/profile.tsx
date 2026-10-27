import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius, Spacing, Typography, Shadows } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useTodayRoute } from '@/hooks/useDriverRoute';
import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { TokenStorage } from '@/services/storage';
import { getDefaultApiBaseUrl, getEffectiveApiBaseUrl, ApiClient } from '@/services/api';

export default function DriverProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { driver, user, logout } = useAuth();
  const { data: route } = useTodayRoute();

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [customApiUrl, setCustomApiUrl] = useState('');
  const [testingHealth, setTestingHealth] = useState(false);
  const [healthStatus, setHealthStatus] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const current = await getEffectiveApiBaseUrl();
      setCustomApiUrl(current);
    })();
  }, []);

  const handleTestConnection = async () => {
    setTestingHealth(true);
    setHealthStatus(null);
    try {
      const url = customApiUrl.trim().replace(/\/+$/, '');
      const res = await ApiClient.checkHealth(url);
      if (res.ok) {
        setHealthStatus('Connected: 200 OK');
        await TokenStorage.setCustomApiBaseUrl(url);
      } else {
        setHealthStatus(`Error: ${res.error || 'Server error'}`);
      }
    } catch (err: any) {
      setHealthStatus(`Failed: ${err.message || 'Host unreachable'}`);
    } finally {
      setTestingHealth(false);
    }
  };

  const handleResetUrl = async () => {
    const defaultUrl = getDefaultApiBaseUrl();
    await TokenStorage.clearCustomApiBaseUrl();
    setCustomApiUrl(defaultUrl);
    setHealthStatus('Reset to default base URL.');
  };

  const handleSignOut = async () => {
    setShowLogoutConfirm(false);
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <Text style={styles.headerTitle}>DRIVER PROFILE</Text>
        <Text style={styles.headerSubtitle}>CREDENTIALS & FLEET ASSIGNMENT</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Identity Card */}
        <Card style={styles.profileCard} accentColor={Colors.primary}>
          <View style={styles.avatarRow}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={32} color={Colors.white} />
            </View>
            <View style={{ flex: 1, marginLeft: Spacing.md }}>
              <Text style={styles.driverName}>{driver?.name || user?.name || 'Driver'}</Text>
              <Text style={styles.driverIdBadge}>
                EMPLOYEE ID: {driver?.employee_id || 'EMP-DRV'}
              </Text>
            </View>
            <View style={styles.statusPill}>
              <View style={styles.statusDot} />
              <Text style={styles.statusPillText}>{driver?.status || 'ACTIVE'}</Text>
            </View>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.detailsGrid}>
            <View style={styles.detailRow}>
              <Ionicons name="mail-outline" size={16} color={Colors.primary} />
              <Text style={styles.detailLabel}>Email:</Text>
              <Text style={styles.detailValue}>{driver?.email || user?.email || 'N/A'}</Text>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="call-outline" size={16} color={Colors.primary} />
              <Text style={styles.detailLabel}>Phone:</Text>
              <Text style={styles.detailValue}>{driver?.phone || 'N/A'}</Text>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="card-outline" size={16} color={Colors.primary} />
              <Text style={styles.detailLabel}>License:</Text>
              <Text style={styles.detailValue}>{driver?.license_number || 'N/A'}</Text>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="calendar-outline" size={16} color={Colors.primary} />
              <Text style={styles.detailLabel}>License Expiry:</Text>
              <Text style={styles.detailValue}>{driver?.license_expiry || 'Active / Verified'}</Text>
            </View>
          </View>
        </Card>

        {/* Assigned Vehicle & Route Card */}
        <Card style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="car-outline" size={20} color={Colors.primary} />
            <Text style={styles.cardTitle}>Assigned Fleet Vehicle</Text>
          </View>

          <View style={styles.vehicleInfoBox}>
            <View style={styles.vehicleRow}>
              <Text style={styles.vehicleLabel}>Registration Number:</Text>
              <Text style={styles.vehicleVal}>
                {route?.vehicle_registration_number || 'No Vehicle Assigned'}
              </Text>
            </View>

            <View style={styles.vehicleRow}>
              <Text style={styles.vehicleLabel}>Duty Status:</Text>
              <Text style={[styles.vehicleVal, { color: driver?.is_available ? '#16A34A' : '#D97706' }]}>
                {driver?.is_available ? 'Available / Standby' : 'Active On Route'}
              </Text>
            </View>

            <View style={styles.vehicleRow}>
              <Text style={styles.vehicleLabel}>Active Route:</Text>
              <Text style={styles.vehicleVal}>{route?.route_code || 'None'}</Text>
            </View>
          </View>
        </Card>

        {/* Connection & Network Diagnostics */}
        <Card style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="server-outline" size={20} color={Colors.primary} />
            <Text style={styles.cardTitle}>Backend Server Configuration</Text>
          </View>

          <Text style={styles.serverDesc}>
            Current API Endpoint: {customApiUrl}
          </Text>

          <View style={styles.serverInputRow}>
            <TextInput
              style={styles.serverInput}
              value={customApiUrl}
              onChangeText={setCustomApiUrl}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="http://10.0.2.2:8000"
            />
          </View>

          <View style={styles.serverActionsRow}>
            <TouchableOpacity
              style={styles.testBtn}
              onPress={handleTestConnection}
              disabled={testingHealth}
            >
              {testingHealth ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <>
                  <Ionicons name="pulse" size={14} color={Colors.white} />
                  <Text style={styles.testBtnText}>Test Health</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.resetBtn} onPress={handleResetUrl}>
              <Text style={styles.resetBtnText}>Reset to Default</Text>
            </TouchableOpacity>
          </View>

          {healthStatus ? (
            <View
              style={[
                styles.healthBanner,
                {
                  backgroundColor: healthStatus.includes('Connected')
                    ? '#DCFCE7'
                    : '#FEE2E2',
                },
              ]}
            >
              <Text
                style={[
                  styles.healthBannerText,
                  {
                    color: healthStatus.includes('Connected')
                      ? '#15803D'
                      : '#B91C1C',
                  },
                ]}
              >
                {healthStatus}
              </Text>
            </View>
          ) : null}
        </Card>

        {/* Sign Out Button */}
        <PrimaryButton
          title="LOGOUT FROM OPERATIONS"
          variant="danger"
          onPress={() => setShowLogoutConfirm(true)}
          icon={<Ionicons name="log-out-outline" size={18} color={Colors.white} />}
          style={{ marginTop: Spacing.sm }}
        />

        {/* Compliance Footer */}
        <View style={styles.footer}>
          <Ionicons name="shield-checkmark" size={14} color={Colors.textMuted} />
          <Text style={styles.footerText}>
            Pharmatrix Fleet Operations &copy; 2026. CDSCO Compliant Waste Custody Protocol.
          </Text>
        </View>
      </ScrollView>

      {/* Logout Confirmation */}
      <ConfirmationModal
        visible={showLogoutConfirm}
        variant="danger"
        title="Sign Out of Operations"
        message="Are you sure you want to end your driver session? Any cached authentication tokens will be securely wiped."
        confirmText="SIGN OUT"
        cancelText="CANCEL"
        onConfirm={handleSignOut}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topHeader: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
    ...Shadows.subtle,
  },
  headerTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.black,
    color: Colors.textPrimary,
    letterSpacing: 1,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
    letterSpacing: 1,
    marginTop: 2,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl * 2,
  },
  profileCard: {
    marginBottom: Spacing.md,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.button,
  },
  driverName: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  driverIdBadge: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: Typography.weights.semibold,
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    color: '#15803D',
  },
  infoDivider: {
    height: 1,
    backgroundColor: Colors.cardBorderSubtle,
    marginVertical: Spacing.md,
  },
  detailsGrid: {
    gap: Spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: Typography.weights.semibold,
    color: Colors.textSecondary,
    width: 95,
  },
  detailValue: {
    flex: 1,
    fontSize: 12,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  sectionCard: {
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  cardTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  vehicleInfoBox: {
    backgroundColor: Colors.infoSurface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: Spacing.xs,
  },
  vehicleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vehicleLabel: {
    fontSize: 12,
    fontWeight: Typography.weights.semibold,
    color: Colors.textSecondary,
  },
  vehicleVal: {
    fontSize: 12,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  serverDesc: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  serverInputRow: {
    marginBottom: Spacing.sm,
  },
  serverInput: {
    height: 42,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.background,
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
  },
  serverActionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: Radius.sm,
  },
  testBtnText: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    color: Colors.white,
  },
  resetBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: Radius.sm,
    backgroundColor: '#F3ECE3',
  },
  resetBtnText: {
    fontSize: 11,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  healthBanner: {
    marginTop: Spacing.sm,
    padding: Spacing.xs,
    borderRadius: Radius.sm,
  },
  healthBannerText: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  footerText: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
    flex: 1,
  },
});
