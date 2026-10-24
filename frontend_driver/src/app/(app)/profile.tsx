import React, { useState } from 'react';
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
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useTodayRoute } from '@/hooks/useDriverRoute';
import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { TokenStorage } from '@/services/storage';
import { getDefaultApiBaseUrl, getEffectiveApiBaseUrl } from '@/services/api';

export default function DriverProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { driver, user, logout } = useAuth();
  const { data: route } = useTodayRoute();

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [customApiUrl, setCustomApiUrl] = useState('');
  const [testingHealth, setTestingHealth] = useState(false);
  const [healthStatus, setHealthStatus] = useState<string | null>(null);

  React.useEffect(() => {
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
      const res = await fetch(`${url}/health`, { method: 'GET' });
      if (res.ok) {
        const json = await res.json();
        setHealthStatus(`Connected: ${json.service || 'Pharmatrix Backend'}`);
        await TokenStorage.setCustomApiBaseUrl(url);
      } else {
        setHealthStatus(`Server error: status ${res.status}`);
      }
    } catch (err: any) {
      setHealthStatus(`Connection failed: ${err.message || 'Host unreachable'}`);
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
      <View style={styles.topHeader}>
        <Text style={styles.headerTitle}>DRIVER PROFILE</Text>
        <Text style={styles.headerSubtitle}>ACCOUNT & SYSTEM STATUS</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Card */}
        <Card style={styles.profileCard} accentColor={Colors.amber}>
          <View style={styles.avatarRow}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={36} color="#000" />
            </View>
            <View style={{ flex: 1, marginLeft: Spacing.md }}>
              <Text style={styles.driverName}>{driver?.name || user?.name || 'Driver'}</Text>
              <Text style={styles.driverIdBadge}>
                EMPLOYEE ID: {driver?.employee_id || 'N/A'}
              </Text>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>{driver?.status || 'ACTIVE'}</Text>
            </View>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>EMAIL</Text>
            <Text style={styles.infoValue}>{driver?.email || user?.email || 'N/A'}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>PHONE</Text>
            <Text style={styles.infoValue}>{driver?.phone || 'N/A'}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>LICENSE NUMBER</Text>
            <Text style={styles.infoValue}>{driver?.license_number || 'N/A'}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>LICENSE EXPIRY</Text>
            <Text style={styles.infoValue}>
              {driver?.license_expiry ? String(driver.license_expiry) : 'N/A'}
            </Text>
          </View>
        </Card>

        {/* Assigned Vehicle Card */}
        <Card style={styles.vehicleCard}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="car" size={22} color={Colors.amber} />
            <Text style={styles.cardSectionTitle}>TODAY'S VEHICLE ASSIGNMENT</Text>
          </View>

          {route?.vehicle_registration_number ? (
            <View style={styles.vehicleDetailsBox}>
              <Text style={styles.regNumberLabel}>REGISTRATION NUMBER</Text>
              <Text style={styles.regNumberValue}>
                {route.vehicle_registration_number}
              </Text>
              <Text style={styles.vehicleMetaText}>
                Assigned on Route {route.route_code}
              </Text>
            </View>
          ) : (
            <View style={styles.noVehicleBox}>
              <Text style={styles.noVehicleText}>No vehicle assigned to today's run.</Text>
            </View>
          )}
        </Card>

        {/* Backend Endpoint Settings */}
        <Card style={styles.apiCard}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="server-outline" size={20} color={Colors.amber} />
            <Text style={styles.cardSectionTitle}>API SERVER CONFIGURATION</Text>
          </View>

          <Text style={styles.apiDesc}>
            For field testing on Android via Expo Go, ensure this points to your backend machine's LAN IP.
          </Text>

          <TextInput
            style={styles.apiInput}
            value={customApiUrl}
            onChangeText={setCustomApiUrl}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {healthStatus ? (
            <Text style={styles.healthStatusText}>{healthStatus}</Text>
          ) : null}

          <View style={styles.apiActionRow}>
            <TouchableOpacity
              style={styles.testBtn}
              onPress={handleTestConnection}
              disabled={testingHealth}
            >
              {testingHealth ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={styles.testBtnText}>TEST HEALTH</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.resetBtn} onPress={handleResetUrl}>
              <Text style={styles.resetBtnText}>RESET DEFAULT</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Sign Out Button */}
        <PrimaryButton
          title="SIGN OUT"
          variant="danger"
          icon={<Ionicons name="log-out-outline" size={20} color="#FFF" />}
          onPress={() => setShowLogoutConfirm(true)}
          style={{ marginTop: Spacing.xl }}
        />

        <View style={styles.appVersionSection}>
          <Text style={styles.versionText}>Pharmatrix Driver App v1.0.0</Text>
          <Text style={styles.securityNote}>End-to-End Encrypted Operational Session</Text>
        </View>
      </ScrollView>

      {/* Confirmation Modal */}
      <ConfirmationModal
        visible={showLogoutConfirm}
        title="Sign Out?"
        message="Are you sure you want to log out of your driver session? Any cached authentication tokens will be securely cleared."
        confirmText="Sign Out"
        variant="danger"
        onConfirm={handleSignOut}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.navyDark,
  },
  topHeader: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.navy,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  headerTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.black,
    color: Colors.white,
    letterSpacing: 1,
  },
  headerSubtitle: {
    fontSize: 10,
    color: Colors.amber,
    fontWeight: Typography.weights.bold,
    letterSpacing: 1,
    marginTop: 2,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl * 2,
  },
  profileCard: {
    marginBottom: Spacing.lg,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.amber,
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverName: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.black,
    color: Colors.white,
  },
  driverIdBadge: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    color: Colors.amber,
    marginTop: 2,
  },
  statusPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  statusPillText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: Typography.weights.bold,
  },
  infoDivider: {
    height: 1,
    backgroundColor: Colors.cardBorder,
    marginVertical: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: Typography.weights.bold,
  },
  infoValue: {
    fontSize: Typography.sizes.xs,
    color: Colors.white,
    fontWeight: Typography.weights.semibold,
  },
  vehicleCard: {
    marginBottom: Spacing.lg,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  cardSectionTitle: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    color: Colors.white,
    letterSpacing: 1,
  },
  vehicleDetailsBox: {
    backgroundColor: '#0F1A2F',
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  regNumberLabel: {
    fontSize: 9,
    color: Colors.amber,
    fontWeight: Typography.weights.bold,
  },
  regNumberValue: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.black,
    color: Colors.white,
    marginTop: 2,
  },
  vehicleMetaText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
  },
  noVehicleBox: {
    padding: Spacing.md,
    alignItems: 'center',
  },
  noVehicleText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.xs,
  },
  apiCard: {
    marginBottom: Spacing.lg,
  },
  apiDesc: {
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 16,
    marginBottom: Spacing.sm,
  },
  apiInput: {
    backgroundColor: '#0F1A2F',
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    color: Colors.white,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: Typography.sizes.sm,
  },
  healthStatusText: {
    fontSize: Typography.sizes.xs,
    color: Colors.amber,
    marginTop: Spacing.xs,
    fontWeight: Typography.weights.semibold,
  },
  apiActionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  testBtn: {
    flex: 1,
    backgroundColor: Colors.amber,
    borderRadius: Radius.sm,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  testBtnText: {
    color: '#000',
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
  },
  resetBtn: {
    flex: 1,
    backgroundColor: Colors.navyLight,
    borderRadius: Radius.sm,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  resetBtnText: {
    color: Colors.white,
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
  },
  appVersionSection: {
    marginTop: Spacing.xl,
    alignItems: 'center',
    gap: 4,
  },
  versionText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    fontWeight: Typography.weights.semibold,
  },
  securityNote: {
    fontSize: 10,
    color: '#64748B',
  },
});
