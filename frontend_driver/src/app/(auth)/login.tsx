import React, { useState } from 'react';
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
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
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

  // Load saved custom base URL on mount
  React.useEffect(() => {
    (async () => {
      const effective = await getEffectiveApiBaseUrl();
      setServerUrl(effective);
    })();
  }, []);

  const handleTestConnection = async (urlToTest?: string) => {
    const target = (urlToTest || serverUrl).trim();
    if (!target) return;
    setTestingConnection(true);
    setConnectionStatus(null);
    try {
      const res = await ApiClient.checkHealth(target);
      if (res.ok) {
        setConnectionStatus({ ok: true, message: 'Connected (200 OK)' });
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
    if (!email.trim() || !password) {
      setErrorMessage('Please enter both email and password.');
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
        err.message || 'Login failed. Please check your credentials.'
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
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Ionicons name="medical" size={40} color={Colors.charcoal[950]} />
          </View>
          <Text style={styles.brandTitle}>PHARMATRIX</Text>
          <Text style={styles.brandSubtitle}>DRIVER OPERATIONS</Text>
          <Text style={styles.welcomeText}>
            Sign in with your driver credentials to access today's assigned
            routes.
          </Text>
        </View>

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={20} color="#EF4444" />
            <View style={{ flex: 1 }}>
              <Text style={styles.errorText}>{errorMessage}</Text>
              {(errorMessage.includes('connect') || errorMessage.includes('timed out')) && !showServerConfig ? (
                <TouchableOpacity
                  onPress={() => setShowServerConfig(true)}
                  style={{ marginTop: 6 }}
                >
                  <Text style={styles.errorActionText}>Configure Backend URL ➔</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>DRIVER EMAIL</Text>
            <View style={styles.inputContainer}>
              <Ionicons
                name="mail-outline"
                size={20}
                color={Colors.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="driver@pharmatrix.local"
                placeholderTextColor={Colors.charcoal[500]}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setErrorMessage(null);
                }}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>PASSWORD</Text>
            <View style={styles.inputContainer}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color={Colors.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="••••••••••••"
                placeholderTextColor={Colors.charcoal[500]}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setErrorMessage(null);
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={Colors.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>

          <PrimaryButton
            title="SIGN IN"
            onPress={handleLogin}
            loading={loading}
            style={styles.loginButton}
          />
        </View>

        {/* Server Config Toggle */}
        <View style={styles.serverSection}>
          <TouchableOpacity
            style={styles.serverToggle}
            onPress={() => setShowServerConfig(!showServerConfig)}
          >
            <Ionicons name="server-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.serverToggleText}>
              Backend: {serverUrl}
            </Text>
            <Ionicons
              name={showServerConfig ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={Colors.textMuted}
            />
          </TouchableOpacity>

          {showServerConfig ? (
            <View style={styles.serverInputBox}>
              <Text style={styles.serverInputLabel}>
                API BASE URL (Use host Wi-Fi IP for phone, 10.0.2.2 for emulator)
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

              {/* Quick Presets */}
              <View style={styles.presetRow}>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => {
                    const url = 'http://10.138.26.167:8000';
                    setServerUrl(url);
                    handleTestConnection(url);
                  }}
                >
                  <Text style={styles.presetChipText}>Wi-Fi (:8000)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => {
                    const url = 'http://10.138.26.167:8001';
                    setServerUrl(url);
                    handleTestConnection(url);
                  }}
                >
                  <Text style={styles.presetChipText}>Relay (:8001)</Text>
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
                          ? 'rgba(34, 197, 94, 0.15)'
                          : 'rgba(239, 68, 68, 0.15)',
                        borderColor: connectionStatus.ok ? '#22C55E' : '#EF4444',
                      },
                    ]}
                  >
                    <Ionicons
                      name={connectionStatus.ok ? 'checkmark-circle' : 'alert-circle'}
                      size={14}
                      color={connectionStatus.ok ? '#22C55E' : '#EF4444'}
                    />
                    <Text
                      style={[
                        styles.statusPillText,
                        { color: connectionStatus.ok ? '#4ADE80' : '#FCA5A5' },
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

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Pharmatrix Fleet &copy; 2026. Authorized Personnel Only.
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
    padding: Spacing.xl,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  brandTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.black,
    color: Colors.white,
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
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    color: '#FCA5A5',
  },
  form: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    color: Colors.ivory,
    letterSpacing: 1,
    marginBottom: Spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    height: 52,
    paddingHorizontal: Spacing.md,
  },
  inputIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    color: Colors.white,
    fontSize: Typography.sizes.md,
  },
  eyeButton: {
    padding: Spacing.xs,
  },
  loginButton: {
    marginTop: Spacing.sm,
  },
  serverSection: {
    marginTop: Spacing.xl,
    alignItems: 'center',
  },
  serverToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    padding: Spacing.sm,
  },
  serverToggleText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
  },
  serverInputBox: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  serverInputLabel: {
    fontSize: 10,
    color: Colors.primary,
    fontWeight: Typography.weights.bold,
    marginBottom: Spacing.xs,
  },
  serverInput: {
    backgroundColor: Colors.background,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    color: Colors.white,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    fontSize: Typography.sizes.sm,
  },
  errorActionText: {
    color: Colors.primary,
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  presetChip: {
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  presetChipText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: Typography.weights.medium,
  },
  testRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  testButtonText: {
    color: Colors.primary,
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
  },
  statusPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: Typography.weights.medium,
  },
  footer: {
    marginTop: Spacing.xl,
    alignItems: 'center',
  },
  footerText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
