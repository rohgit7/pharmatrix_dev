import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography, Shadows } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TokenStorage } from '@/services/storage';
import {
  ApiClient,
  getDefaultApiBaseUrl,
  getEffectiveApiBaseUrl,
  getAutoDetectedHostIp,
} from '@/services/api';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Field touch validation
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  // Server URL settings
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverUrl, setServerUrl] = useState(getDefaultApiBaseUrl());
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    ok?: boolean;
    message?: string;
  } | null>(null);

  const { login } = useAuth();
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const effective = await getEffectiveApiBaseUrl();
      setServerUrl(effective);
    })();
  }, []);

  const emailError =
    emailTouched && !email.trim()
      ? 'Driver email is required'
      : emailTouched && !/\S+@\S+\.\S+/.test(email.trim())
      ? 'Please enter a valid email address'
      : null;

  const passwordError =
    passwordTouched && !password
      ? 'Password is required'
      : null;

  const handleTestConnection = async (urlToTest?: string) => {
    const target = (urlToTest || serverUrl).trim();
    if (!target) return;
    setTestingConnection(true);
    setConnectionStatus(null);
    try {
      const res = await ApiClient.checkHealth(target);
      if (res.ok) {
        if (res.workingUrl && res.workingUrl !== target) {
          setServerUrl(res.workingUrl);
          await TokenStorage.setCustomApiBaseUrl(res.workingUrl);
          setConnectionStatus({
            ok: true,
            message: `Connected via ${res.workingUrl.includes(':8001') ? 'Wi-Fi Relay (:8001)' : 'Direct (:8000)'}`,
          });
        } else {
          setConnectionStatus({ ok: true, message: 'Connected (200 OK)' });
        }
      } else {
        setConnectionStatus({
          ok: false,
          message: res.error || 'Server responded with an error',
        });
      }
    } catch (e: any) {
      setConnectionStatus({
        ok: false,
        message: e.message || 'Cannot reach server',
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleLogin = async () => {
    if (loading) return; // Prevent duplicate concurrent submissions

    setEmailTouched(true);
    setPasswordTouched(true);

    if (!email.trim() || !password) {
      setErrorMessage('Please enter both driver email and password.');
      return;
    }

    setErrorMessage(null);
    setLoading(true);

    try {
      if (serverUrl.trim()) {
        await TokenStorage.setCustomApiBaseUrl(serverUrl.trim());
      }
      await login(email.trim(), password);
      router.replace('/(app)');
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Login failed. Please check your driver credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Brand Header */}
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Ionicons name="medical" size={38} color={Colors.white} />
          </View>
          <Text style={styles.brandTitle}>PHARMATRIX</Text>
          <Text style={styles.brandSubtitle}>DRIVER OPERATIONS</Text>
          <Text style={styles.welcomeText}>
            Secure driver sign-in. Access today's assigned routes, pickups, and facility handovers.
          </Text>
        </View>

        {/* Global Error Banner */}
        {errorMessage ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={20} color="#DC2626" style={{ marginTop: 2 }} />
            <View style={{ flex: 1, marginLeft: Spacing.sm }}>
              <Text style={styles.errorText}>{errorMessage}</Text>
              {(errorMessage.includes('connect') || errorMessage.includes('timed out')) && !showServerConfig ? (
                <TouchableOpacity
                  onPress={() => setShowServerConfig(true)}
                  style={{ marginTop: 6 }}
                >
                  <Text style={styles.errorActionText}>Configure Backend URL & Server &rarr;</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Form Card */}
        <View style={styles.formCard}>
          {/* Email Field */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>DRIVER EMAIL</Text>
            <View
              style={[
                styles.inputContainer,
                emailError ? styles.inputContainerError : null,
              ]}
            >
              <Ionicons
                name="mail-outline"
                size={20}
                color={emailError ? '#DC2626' : Colors.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="driver@pharmatrix.local"
                placeholderTextColor={Colors.textMuted}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setErrorMessage(null);
                }}
                onBlur={() => setEmailTouched(true)}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                editable={!loading}
              />
            </View>
            {emailError ? (
              <Text style={styles.fieldErrorText}>{emailError}</Text>
            ) : null}
          </View>

          {/* Password Field */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>PASSWORD</Text>
            <View
              style={[
                styles.inputContainer,
                passwordError ? styles.inputContainerError : null,
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color={passwordError ? '#DC2626' : Colors.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="••••••••••••"
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setErrorMessage(null);
                }}
                onBlur={() => setPasswordTouched(true)}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                editable={!loading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={Colors.textMuted}
                />
              </TouchableOpacity>
            </View>
            {passwordError ? (
              <Text style={styles.fieldErrorText}>{passwordError}</Text>
            ) : null}
          </View>

          <PrimaryButton
            title="SIGN IN TO OPERATIONS"
            onPress={handleLogin}
            loading={loading}
            style={styles.loginButton}
          />
        </View>

        {/* Server Config Accordion for Emulators / Physical Devices */}
        <View style={styles.serverSection}>
          <TouchableOpacity
            style={styles.serverToggle}
            onPress={() => setShowServerConfig(!showServerConfig)}
          >
            <Ionicons name="server-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.serverToggleText} numberOfLines={1}>
              API Target: {serverUrl}
            </Text>
            <Ionicons
              name={showServerConfig ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>

          {showServerConfig ? (
            <View style={styles.serverInputBox}>
              <Text style={styles.serverInputLabel}>
                API BASE URL (Auto-detected per platform)
              </Text>
              <TextInput
                style={styles.serverInput}
                value={serverUrl}
                onChangeText={(text) => {
                  setServerUrl(text);
                  setConnectionStatus(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />

              {/* Quick Preset Buttons */}
              <View style={styles.presetRow}>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => {
                    const host = getAutoDetectedHostIp();
                    const url = host ? `http://${host}:8001` : 'http://10.138.26.167:8001';
                    setServerUrl(url);
                    handleTestConnection(url);
                  }}
                >
                  <Text style={styles.presetChipText}>Wi-Fi Relay (:8001)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => {
                    const host = getAutoDetectedHostIp();
                    const url = host ? `http://${host}:8000` : 'http://10.138.26.167:8000';
                    setServerUrl(url);
                    handleTestConnection(url);
                  }}
                >
                  <Text style={styles.presetChipText}>Direct (:8000)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => {
                    const url = 'http://10.0.2.2:8000';
                    setServerUrl(url);
                    handleTestConnection(url);
                  }}
                >
                  <Text style={styles.presetChipText}>Emulator (10.0.2.2)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => {
                    const url = 'http://localhost:8000';
                    setServerUrl(url);
                    handleTestConnection(url);
                  }}
                >
                  <Text style={styles.presetChipText}>Localhost</Text>
                </TouchableOpacity>
              </View>

              {/* Test Connection Button */}
              <View style={styles.testRow}>
                <TouchableOpacity
                  style={styles.testButton}
                  onPress={() => handleTestConnection()}
                  disabled={testingConnection}
                >
                  {testingConnection ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <>
                      <Ionicons name="pulse" size={14} color={Colors.primary} />
                      <Text style={styles.testButtonText}>Test Connection</Text>
                    </>
                  )}
                </TouchableOpacity>

                {connectionStatus ? (
                  <View
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor: connectionStatus.ok
                          ? '#DCFCE7'
                          : '#FEE2E2',
                        borderColor: connectionStatus.ok ? '#16A34A' : '#DC2626',
                      },
                    ]}
                  >
                    <Ionicons
                      name={connectionStatus.ok ? 'checkmark-circle' : 'alert-circle'}
                      size={14}
                      color={connectionStatus.ok ? '#16A34A' : '#DC2626'}
                    />
                    <Text
                      style={[
                        styles.statusPillText,
                        { color: connectionStatus.ok ? '#15803D' : '#B91C1C' },
                      ]}
                      numberOfLines={1}
                    >
                      {connectionStatus.message}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>

        {/* Security & Access Notice */}
        <View style={styles.footer}>
          <Ionicons name="shield-checkmark-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.footerText}>
            Authorized driver operations only. Session auditable under CDSCO compliance rules.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    ...Shadows.button,
  },
  brandTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.black,
    color: Colors.textPrimary,
    letterSpacing: 2,
  },
  brandSubtitle: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
    letterSpacing: 3,
    marginTop: 4,
  },
  welcomeText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.md,
    lineHeight: 20,
    maxWidth: 320,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  errorText: {
    fontSize: Typography.sizes.sm,
    color: '#B91C1C',
    lineHeight: 18,
    fontWeight: Typography.weights.medium,
  },
  errorActionText: {
    fontSize: Typography.sizes.xs,
    color: Colors.primaryDark,
    fontWeight: Typography.weights.bold,
    textDecorationLine: 'underline',
  },
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.xl,
    ...Shadows.card,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    borderRadius: Radius.md,
    height: 50,
    paddingHorizontal: Spacing.md,
  },
  inputContainerError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  inputIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
  },
  eyeButton: {
    padding: Spacing.xs,
  },
  fieldErrorText: {
    fontSize: 11,
    color: '#DC2626',
    marginTop: 4,
    fontWeight: Typography.weights.medium,
  },
  loginButton: {
    marginTop: Spacing.sm,
  },
  serverSection: {
    marginTop: Spacing.xl,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  serverToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.separatorSubtle,
    gap: Spacing.sm,
  },
  serverToggleText: {
    flex: 1,
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    fontWeight: Typography.weights.semibold,
  },
  serverInputBox: {
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  serverInputLabel: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  serverInput: {
    height: 40,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    backgroundColor: Colors.background,
    marginBottom: Spacing.sm,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  presetChip: {
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: Radius.sm,
    backgroundColor: Colors.infoSurface,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  presetChipText: {
    fontSize: 11,
    color: Colors.primaryDark,
    fontWeight: Typography.weights.semibold,
  },
  testRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  testButtonText: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
  },
  statusPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  footerText: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
    flex: 1,
  },
});
