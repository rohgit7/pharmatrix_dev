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
      Alert.alert('Server Connected', `Successfully connected to ${cleaned}`);
    } else {
      Alert.alert(
        'Connection Failed',
        `Could not connect to ${cleaned} (${res.message}). Do you still want to save this URL?`,
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

  const handleEmailFocus = () => {
    setFocusedField('email');
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 30, animated: true });
    }, 80);
  };

  const handlePasswordFocus = () => {
    setFocusedField('password');
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 110, animated: true });
    }, 80);
  };

  const handleInputBlur = () => {
    if (!keyboardVisible) {
      setFocusedField(null);
    }
  };

  const handleLogin = async () => {
    Keyboard.dismiss();
    setFocusedField(null);

    if (!email.trim() || !password) {
      setErrorMessage('Please enter both your driver email and password.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      const msg = err?.message || 'Authentication failed. Please check credentials or network.';
      setErrorMessage(msg);
      // Recheck server status on error
      checkServerConnection();
    } finally {
      setLoading(false);
    }
  };

  const fillTestCredentials = () => {
    setEmail('driver1@gmail.com');
    setPassword('driver123');
    setErrorMessage(null);
  };

  const handleForgotPassword = () => {
    Alert.alert(
      'Driver Password Reset',
      'Please contact your Pharmatrix Fleet Dispatcher or Terminal Manager to reset your courier account credentials.'
    );
  };

  return (
    <View style={styles.outerStage}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.innerWrapper}>
            {/* Top Header Bar */}
            <View
              style={[
                styles.topBar,
                { paddingTop: Math.max(insets.top, 10), height: 52 + Math.max(insets.top, 10) },
              ]}
            >
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => {
                  Keyboard.dismiss();
                  setFocusedField(null);
                  if (email || password) {
                    setEmail('');
                    setPassword('');
                    setErrorMessage(null);
                  }
                }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={24} color="#201E1C" />
              </TouchableOpacity>
              <Text style={styles.topBarTitle}>Driver Sign In</Text>
              <TouchableOpacity
                style={styles.serverGearBtn}
                onPress={() => {
                  setCustomUrlInput(serverUrl);
                  setShowServerModal(true);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <View style={[styles.serverDot, serverStatus === 'online' ? styles.dotGreen : serverStatus === 'offline' ? styles.dotRed : styles.dotAmber]} />
                <Ionicons name="server-outline" size={18} color="#201E1C" />
              </TouchableOpacity>
            </View>

            <ScrollView
              ref={scrollViewRef}
              contentContainerStyle={[
                styles.scrollContent,
                isKeyboardActive ? styles.scrollContentKeyboard : styles.scrollContentDefault,
              ]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
              bounces={false}
              automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            >
              {/* Logo Badge */}
              <View
                style={[
                  styles.logoBadgeContainer,
                  isKeyboardActive && styles.logoBadgeContainerKeyboard,
                ]}
              >
                <View
                  style={[
                    styles.logoBadge,
                    isKeyboardActive && styles.logoBadgeKeyboard,
                  ]}
                >
                  <Ionicons
                    name="shield-checkmark"
                    size={isKeyboardActive ? 22 : 32}
                    color="#FFFFFF"
                  />
                  <View
                    style={[
                      styles.logoBadgeDot,
                      isKeyboardActive && styles.logoBadgeDotKeyboard,
                    ]}
                  />
                </View>
              </View>

              {/* Heading Section */}
              <View
                style={[
                  styles.headingSection,
                  isKeyboardActive && styles.headingSectionKeyboard,
                ]}
              >
                <Text
                  style={[
                    styles.brandTitle,
                    isKeyboardActive && styles.brandTitleKeyboard,
                  ]}
                >
                  Pharmatrix
                </Text>
                <View style={styles.driverTagRow}>
                  <View style={styles.driverPill}>
                    <Ionicons name="car-outline" size={12} color="#3B52B6" />
                    <Text style={styles.driverPillText}>DRIVER OPERATIONS TERMINAL</Text>
                  </View>
                </View>
                {!isKeyboardActive && (
                  <Text style={styles.brandSubtitle}>
                    Sign in to sync today's route manifest & collections
                  </Text>
                )}
              </View>

              {/* Server Connection Status Pill */}
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
                    ? `Checking: ${serverUrl.replace(/^https?:\/\//, '')}...`
                    : `Server Unreachable: ${serverUrl.replace(/^https?:\/\//, '')}`}
                </Text>
                <Ionicons name="create-outline" size={13} color="#5C554E" />
              </TouchableOpacity>

              {/* Error Banner */}
              {errorMessage && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={18} color="#D94B38" />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              )}

              {/* Email Field */}
              <View
                style={[
                  styles.fieldBlock,
                  isKeyboardActive && styles.fieldBlockKeyboard,
                ]}
              >
                <Text style={styles.fieldLabel}>Driver Email ID</Text>
                <View
                  style={[
                    styles.inputContainer,
                    isKeyboardActive && styles.inputContainerKeyboard,
                    focusedField === 'email' && styles.inputContainerFocused,
                  ]}
                >
                  <Ionicons
                    name="mail-outline"
                    size={19}
                    color={focusedField === 'email' ? '#3B52B6' : '#5C554E'}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    onFocus={handleEmailFocus}
                    onBlur={handleInputBlur}
                    placeholder="driver1@gmail.com"
                    placeholderTextColor="#A89D91"
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
              <View
                style={[
                  styles.fieldBlock,
                  isKeyboardActive && styles.fieldBlockKeyboard,
                ]}
              >
                <Text style={styles.fieldLabel}>Password</Text>
                <View
                  style={[
                    styles.inputContainer,
                    isKeyboardActive && styles.inputContainerKeyboard,
                    focusedField === 'password' && styles.inputContainerFocused,
                  ]}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={19}
                    color={focusedField === 'password' ? '#3B52B6' : '#5C554E'}
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
                    onFocus={handlePasswordFocus}
                    onBlur={handleInputBlur}
                    placeholder="Enter password"
                    placeholderTextColor="#A89D91"
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
                      size={20}
                      color="#5C554E"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Options Row */}
              <View
                style={[
                  styles.optionsRow,
                  isKeyboardActive && styles.optionsRowKeyboard,
                ]}
              >
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
                      <Ionicons name="checkmark" size={13} color="#FFFFFF" />
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
                  isKeyboardActive && styles.signInBtnKeyboard,
                  loading && styles.signInBtnDisabled,
                ]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.88}
              >
                {loading ? (
                  <View style={styles.btnContent}>
                    <ActivityIndicator color="#FFFFFF" size="small" />
                    <Text style={styles.signInBtnText}>Connecting to Server...</Text>
                  </View>
                ) : (
                  <View style={styles.btnContent}>
                    <Text style={styles.signInBtnText}>Sign In to Terminal</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>

              {/* Demo Credential Button */}
              <TouchableOpacity
                style={[
                  styles.quickFillBtn,
                  isKeyboardActive && styles.quickFillBtnKeyboard,
                ]}
                onPress={fillTestCredentials}
                activeOpacity={0.75}
              >
                <Ionicons name="key-outline" size={14} color="#3B52B6" />
                <Text style={styles.quickFillText}>Auto-Fill Demo Credentials (driver1@gmail.com)</Text>
              </TouchableOpacity>

              {/* Security Footnote */}
              {!isKeyboardActive && (
                <View style={styles.securityNote}>
                  <Ionicons name="shield-outline" size={13} color="#8A8279" />
                  <Text style={styles.securityText}>
                    Pharmatrix Medical Waste Logistics • Authorized Driver Terminal
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
                    <Ionicons name="server" size={20} color="#3B52B6" />
                    <Text style={styles.modalTitle}>Backend Server Settings</Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowServerModal(false)}>
                    <Ionicons name="close" size={22} color="#201E1C" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.modalHelpText}>
                  Specify the IP address of your computer running the FastAPI backend.
                </Text>

                <View style={styles.serverInputRow}>
                  <TextInput
                    style={styles.serverTextInput}
                    value={customUrlInput}
                    onChangeText={setCustomUrlInput}
                    placeholder="http://10.235.154.167:8001"
                    placeholderTextColor="#A89D91"
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
                      <Text style={styles.testSaveBtnText}>Test & Connect</Text>
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
    backgroundColor: Platform.select({ web: '#F3ECE2', default: '#FDFBF8' }),
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FDFBF8',
    borderLeftWidth: Platform.select({ web: 1, default: 0 }),
    borderRightWidth: Platform.select({ web: 1, default: 0 }),
    borderColor: '#EADFD0',
  },
  innerWrapper: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(234, 223, 208, 0.4)',
    backgroundColor: '#FDFBF8',
    zIndex: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#201E1C',
  },
  serverGearBtn: {
    width: 36,
    height: 36,
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
    backgroundColor: '#1E8E5A',
  },
  dotRed: {
    backgroundColor: '#DC2626',
  },
  dotAmber: {
    backgroundColor: '#F59E0B',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  scrollContentDefault: {
    justifyContent: 'center',
    paddingTop: 16,
    paddingBottom: 36,
  },
  scrollContentKeyboard: {
    justifyContent: 'flex-start',
    paddingTop: 10,
    paddingBottom: 120,
  },
  logoBadgeContainer: {
    alignItems: 'center',
    marginBottom: 14,
  },
  logoBadgeContainerKeyboard: {
    marginBottom: 6,
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: '#3B52B6',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#3B52B6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 4,
  },
  logoBadgeKeyboard: {
    width: 44,
    height: 44,
    borderRadius: 14,
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  logoBadgeDot: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9FB5FF',
    borderWidth: 1.5,
    borderColor: '#3B52B6',
  },
  logoBadgeDotKeyboard: {
    bottom: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1,
  },
  headingSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  headingSectionKeyboard: {
    marginBottom: 8,
  },
  brandTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#201E1C',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  brandTitleKeyboard: {
    fontSize: 21,
    marginBottom: 3,
  },
  driverTagRow: {
    marginBottom: 6,
  },
  driverPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E8EDFF',
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(59, 82, 182, 0.25)',
  },
  driverPillText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#2B3F96',
    letterSpacing: 0.4,
  },
  brandSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#5C554E',
    textAlign: 'center',
    marginTop: 2,
  },
  serverStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F5EFE6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#EADFD0',
  },
  statusIndicator: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusOnline: {
    backgroundColor: '#1E8E5A',
  },
  statusOffline: {
    backgroundColor: '#DC2626',
  },
  statusChecking: {
    backgroundColor: '#F59E0B',
  },
  serverStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#363432',
    maxWidth: 260,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    fontSize: 12,
    color: '#B91C1C',
    fontWeight: '600',
    flex: 1,
  },
  fieldBlock: {
    marginBottom: 14,
  },
  fieldBlockKeyboard: {
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#201E1C',
    marginBottom: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FBF2E6',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    borderWidth: 1,
    borderColor: 'rgba(234, 223, 208, 0.8)',
  },
  inputContainerKeyboard: {
    height: 46,
    borderRadius: 13,
  },
  inputContainerFocused: {
    borderColor: '#3B52B6',
    backgroundColor: '#FFFFFF',
    shadowColor: '#3B52B6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#201E1C',
    fontWeight: '500',
    height: '100%',
    padding: 0,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 18,
    paddingHorizontal: 2,
  },
  optionsRowKeyboard: {
    marginBottom: 10,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#C5BCB2',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: '#3B52B6',
    borderColor: '#3B52B6',
  },
  rememberText: {
    fontSize: 13,
    color: '#363432',
    fontWeight: '600',
  },
  forgotText: {
    fontSize: 13,
    color: '#3B52B6',
    fontWeight: '700',
  },
  signInBtn: {
    backgroundColor: '#3B52B6',
    borderRadius: 18,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3B52B6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 3,
  },
  signInBtnKeyboard: {
    height: 46,
    borderRadius: 14,
  },
  signInBtnDisabled: {
    opacity: 0.7,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  signInBtnText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  quickFillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F5EFE6',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#EADFD0',
  },
  quickFillBtnKeyboard: {
    marginTop: 8,
    paddingVertical: 7,
  },
  quickFillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#3B52B6',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
  },
  securityText: {
    fontSize: 11,
    color: '#8A8279',
    fontWeight: '500',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EADFD0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#201E1C',
  },
  modalHelpText: {
    fontSize: 12,
    color: '#5C554E',
    marginBottom: 14,
    lineHeight: 17,
  },
  serverInputRow: {
    marginBottom: 16,
  },
  serverTextInput: {
    height: 48,
    backgroundColor: '#FBF2E6',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#201E1C',
    borderWidth: 1,
    borderColor: '#EADFD0',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  resetBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5EFE6',
    borderWidth: 1,
    borderColor: '#EADFD0',
  },
  resetBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5C554E',
  },
  testSaveBtn: {
    flex: 1.5,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3B52B6',
  },
  testSaveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default LoginScreen;
