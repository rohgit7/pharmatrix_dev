import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Keyboard,
  TouchableWithoutFeedback,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { getApiBaseUrl, setCustomApiUrl, testApiConnection } from '../../services/api';
import { colors, radii, typography, spacing } from '../../theme';

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState<string>('driver1@gmail.com');
  const [password, setPassword] = useState<string>('driver123');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Server diagnostics
  const [serverUrl, setServerUrl] = useState<string>(getApiBaseUrl());
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [showServerModal, setShowServerModal] = useState<boolean>(false);
  const [customUrlInput, setCustomUrlInput] = useState<string>(getApiBaseUrl());
  const [testingCustomUrl, setTestingCustomUrl] = useState<boolean>(false);

  // Keyboard and focus tracking
  const [keyboardVisible, setKeyboardVisible] = useState<boolean>(false);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);

  const isKeyboardActive = keyboardVisible || focusedField !== null;
  const scrollViewRef = useRef<any>(null);
  const passwordInputRef = useRef<any>(null);

  useEffect(() => {
    checkServerConnection();

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      setFocusedField(null);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const checkServerConnection = async (targetUrl?: string) => {
    setServerStatus('checking');
    const result = await testApiConnection(targetUrl || serverUrl);
    setServerStatus(result.ok ? 'online' : 'offline');
    setServerUrl(result.url);
  };

  const handleSaveCustomServer = async () => {
    if (!customUrlInput.trim()) {
      Alert.alert('Invalid URL', 'Please enter a valid backend URL.');
      return;
    }
    setTestingCustomUrl(true);
    const cleaned = customUrlInput.trim().replace(/\/+$/, '');
    const res = await testApiConnection(cleaned);
    setTestingCustomUrl(false);

    if (res.ok) {
      await setCustomApiUrl(cleaned);
      setServerUrl(cleaned);
      setServerStatus('online');
      setShowServerModal(false);
      Alert.alert('Connected', `Backend server reachable at ${cleaned}`);
    } else {
      Alert.alert(
        'Connection Failed',
        `Could not reach ${cleaned} (${res.message}). Save URL anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save Anyway',
            onPress: async () => {
              await setCustomApiUrl(cleaned);
              setServerUrl(cleaned);
              setServerStatus('offline');
              setShowServerModal(false);
            },
          },
        ]
      );
    }
  };

  const handleResetServerUrl = async () => {
    await setCustomApiUrl(null);
    const def = getApiBaseUrl();
    setCustomUrlInput(def);
    setServerUrl(def);
    checkServerConnection(def);
    setShowServerModal(false);
  };

  const handleLogin = async () => {
    Keyboard.dismiss();
    setFocusedField(null);

    if (!email.trim() || !password) {
      setErrorMessage('Please enter driver email and password.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      await login(email.trim(), password);
    } catch (err: any) {
      const msg = err?.message || 'Authentication failed. Please verify credentials.';
      setErrorMessage(msg);
      checkServerConnection();
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.alert(
      'Account Support',
      'Please contact your Pharmatrix Dispatcher to reset account credentials.'
    );
  };

  return (
    <View style={styles.outerStage}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.innerWrapper}>
            {/* Top Minimal Navigation Bar */}
            <View
              style={[
                styles.topBar,
                { paddingTop: Math.max(insets.top, 12), height: 56 + Math.max(insets.top, 12) },
              ]}
            >
              <View style={styles.topBarLeft}>
                <View style={styles.logoBadgeSmall}>
                  <Ionicons name="cube" size={18} color="#FFFFFF" />
                </View>
                <Text style={styles.topBarTitle}>Pharmatrix Logistics</Text>
              </View>

              <TouchableOpacity
                style={styles.serverGearBtn}
                onPress={() => {
                  setCustomUrlInput(serverUrl);
                  setShowServerModal(true);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel="Server connection settings"
              >
                <View
                  style={[
                    styles.serverDot,
                    serverStatus === 'online'
                      ? styles.dotGreen
                      : serverStatus === 'offline'
                      ? styles.dotRed
                      : styles.dotAmber,
                  ]}
                />
                <Ionicons name="wifi-outline" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              ref={scrollViewRef}
              contentContainerStyle={[
                styles.scrollContent,
                isKeyboardActive ? styles.scrollContentKeyboard : styles.scrollContentDefault,
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {/* Brand Header */}
              <View
                style={[
                  styles.brandSection,
                  isKeyboardActive && styles.brandSectionCompact,
                ]}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="shield-checkmark" size={32} color={colors.primaryAccent} />
                </View>
                <Text style={styles.headline}>Driver Sign In</Text>
                <Text style={styles.subheadline}>
                  Sign in to access route manifests and collection workflows
                </Text>
              </View>

              {/* Server Status Chip */}
              <TouchableOpacity
                style={styles.serverStatusPill}
                onPress={() => {
                  setCustomUrlInput(serverUrl);
                  setShowServerModal(true);
                }}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.statusIndicator,
                    serverStatus === 'online'
                      ? styles.statusOnline
                      : serverStatus === 'offline'
                      ? styles.statusOffline
                      : styles.statusChecking,
                  ]}
                />
                <Text style={styles.serverStatusText} numberOfLines={1}>
                  {serverStatus === 'online'
                    ? `Connected: ${serverUrl.replace(/^https?:\/\//, '')}`
                    : serverStatus === 'checking'
                    ? 'Connecting to server...'
                    : `Offline: ${serverUrl.replace(/^https?:\/\//, '')}`}
                </Text>
                <Ionicons name="settings-outline" size={13} color={colors.textMuted} />
              </TouchableOpacity>

              {/* Error Banner */}
              {errorMessage && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              )}

              {/* Form Card */}
              <View style={styles.cardContainer}>
                {/* Email Field */}
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>Driver Email</Text>
                  <View
                    style={[
                      styles.inputContainer,
                      focusedField === 'email' && styles.inputContainerFocused,
                    ]}
                  >
                    <Ionicons
                      name="mail-outline"
                      size={18}
                      color={focusedField === 'email' ? colors.primaryAccent : colors.textMuted}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.textInput}
                      value={email}
                      onChangeText={(text) => {
                        setEmail(text);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="driver@pharmatrix.com"
                      placeholderTextColor={colors.textOutline}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      autoCorrect={false}
                      returnKeyType="next"
                      onSubmitEditing={() => passwordInputRef.current?.focus()}
                      blurOnSubmit={false}
                    />
                  </View>
                </View>

                {/* Password Field */}
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>Password</Text>
                  <View
                    style={[
                      styles.inputContainer,
                      focusedField === 'password' && styles.inputContainerFocused,
                    ]}
                  >
                    <Ionicons
                      name="lock-closed-outline"
                      size={18}
                      color={focusedField === 'password' ? colors.primaryAccent : colors.textMuted}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      ref={passwordInputRef}
                      style={styles.textInput}
                      value={password}
                      onChangeText={(text) => {
                        setPassword(text);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="Enter password"
                      placeholderTextColor={colors.textOutline}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="go"
                      onSubmitEditing={handleLogin}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={18}
                        color={colors.textMuted}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Options Row */}
                <View style={styles.optionsRow}>
                  <TouchableOpacity
                    style={styles.rememberRow}
                    onPress={() => setRememberMe(!rememberMe)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        rememberMe && styles.checkboxActive,
                      ]}
                    >
                      {rememberMe && (
                        <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                      )}
                    </View>
                    <Text style={styles.rememberText}>Remember me</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleForgotPassword}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.forgotText}>Forgot password?</Text>
                  </TouchableOpacity>
                </View>

                {/* Sign In CTA Button */}
                <TouchableOpacity
                  style={[
                    styles.signInBtn,
                    loading && styles.signInBtnDisabled,
                  ]}
                  onPress={handleLogin}
                  disabled={loading}
                  activeOpacity={0.88}
                >
                  {loading ? (
                    <View style={styles.btnContent}>
                      <ActivityIndicator color="#FFFFFF" size="small" />
                      <Text style={styles.signInBtnText}>Connecting...</Text>
                    </View>
                  ) : (
                    <View style={styles.btnContent}>
                      <Text style={styles.signInBtnText}>Sign In</Text>
                      <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* Security Footnote */}
              {!isKeyboardActive && (
                <View style={styles.securityNote}>
                  <Ionicons name="shield-checkmark-outline" size={14} color={colors.textMuted} />
                  <Text style={styles.securityText}>
                    Authorized Biomedical Waste Courier Access Only
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* Server Configuration Modal */}
      <Modal
        visible={showServerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowServerModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowServerModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalCard}>
                <View style={styles.modalHeader}>
                  <View style={styles.modalTitleRow}>
                    <Ionicons name="server-outline" size={20} color={colors.primaryAccent} />
                    <Text style={styles.modalTitle}>Backend Server</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setShowServerModal(false)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={20} color={colors.primary} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.modalHelpText}>
                  Backend endpoint URL used by Expo Go to reach the FastAPI service.
                </Text>

                <View style={styles.serverInputRow}>
                  <TextInput
                    style={styles.serverTextInput}
                    value={customUrlInput}
                    onChangeText={setCustomUrlInput}
                    placeholder="http://192.168.1.100:8001"
                    placeholderTextColor={colors.textOutline}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.resetBtn}
                    onPress={handleResetServerUrl}
                  >
                    <Text style={styles.resetBtnText}>Auto-Detect</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.testSaveBtn, testingCustomUrl && { opacity: 0.7 }]}
                    onPress={handleSaveCustomServer}
                    disabled={testingCustomUrl}
                  >
                    {testingCustomUrl ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.testSaveBtnText}>Save & Connect</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  outerStage: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    backgroundColor: colors.background,
  },
  innerWrapper: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.gutter,
    borderBottomWidth: 1,
    borderBottomColor: colors.secondary,
    backgroundColor: colors.background,
    zIndex: 10,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoBadgeSmall: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    backgroundColor: colors.primaryAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: -0.2,
  },
  serverGearBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  serverDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  dotGreen: {
    backgroundColor: colors.success,
  },
  dotRed: {
    backgroundColor: colors.error,
  },
  dotAmber: {
    backgroundColor: colors.warning,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.gutter,
  },
  scrollContentDefault: {
    justifyContent: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  scrollContentKeyboard: {
    justifyContent: 'flex-start',
    paddingTop: spacing.sm,
    paddingBottom: 100,
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  brandSectionCompact: {
    marginBottom: spacing.sm,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.lightAccent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  headline: {
    ...typography.headlineMd,
    color: colors.primary,
    textAlign: 'center',
  },
  subheadline: {
    ...typography.bodySm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 280,
  },
  serverStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.surface,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.secondary,
    marginBottom: spacing.md,
    gap: 6,
    maxWidth: '90%',
  },
  statusIndicator: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusOnline: {
    backgroundColor: colors.success,
  },
  statusOffline: {
    backgroundColor: colors.error,
  },
  statusChecking: {
    backgroundColor: colors.warning,
  },
  serverStatusText: {
    ...typography.bodySm,
    fontSize: 11,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.errorContainer,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
    borderRadius: radii.md,
    padding: 10,
    marginBottom: spacing.md,
    gap: 8,
  },
  errorText: {
    ...typography.bodySm,
    color: colors.onErrorContainer,
    flex: 1,
    fontWeight: '500',
  },
  cardContainer: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.secondary,
    padding: spacing.lg,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  fieldBlock: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    ...typography.labelMd,
    color: colors.primary,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.secondary,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    height: 48,
  },
  inputContainerFocused: {
    borderColor: colors.primaryAccent,
    backgroundColor: colors.surface,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    ...typography.bodyMd,
    color: colors.primary,
    height: '100%',
    padding: 0,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    marginTop: 2,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkboxActive: {
    backgroundColor: colors.primaryAccent,
    borderColor: colors.primaryAccent,
  },
  rememberText: {
    ...typography.bodySm,
    color: colors.textSecondary,
  },
  forgotText: {
    ...typography.bodySm,
    color: colors.primaryAccent,
    fontWeight: '600',
  },
  signInBtn: {
    backgroundColor: colors.primaryAccent,
    height: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primaryAccent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  signInBtnDisabled: {
    opacity: 0.6,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  signInBtnText: {
    ...typography.labelLg,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
    gap: 6,
  },
  securityText: {
    ...typography.bodySm,
    fontSize: 11,
    color: colors.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.gutter,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.secondary,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 400,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    ...typography.headlineSm,
    color: colors.primary,
  },
  modalHelpText: {
    ...typography.bodySm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  serverInputRow: {
    marginBottom: spacing.md,
  },
  serverTextInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.secondary,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    height: 44,
    ...typography.bodyMd,
    color: colors.primary,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  resetBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  resetBtnText: {
    ...typography.labelMd,
    color: colors.primary,
  },
  testSaveBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radii.md,
    backgroundColor: colors.primaryAccent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  testSaveBtnText: {
    ...typography.labelMd,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});

export default LoginScreen;
