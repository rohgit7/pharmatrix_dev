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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState<string>('driver1@gmail.com');
  const [password, setPassword] = useState<string>('driver123');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Keyboard and focus tracking
  const [keyboardVisible, setKeyboardVisible] = useState<boolean>(false);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);

  const isKeyboardActive = keyboardVisible || focusedField !== null;

  const scrollViewRef = useRef<any>(null);
  const passwordInputRef = useRef<any>(null);

  useEffect(() => {
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

  const handleEmailFocus = () => {
    setFocusedField('email');
    // Scroll slightly so the email field and title stay comfortably in view
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 30, animated: true });
    }, 80);
  };

  const handlePasswordFocus = () => {
    setFocusedField('password');
    // Scroll down so the password field and the Sign In button are clearly in view
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 110, animated: true });
    }, 80);
  };

  const handleInputBlur = () => {
    // If keyboard is not visible, clear focus
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
      setErrorMessage(
        err?.message || 'Authentication failed. Please verify your driver email and password.'
      );
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
            {/* Top Header Bar with Safe Area Inset Support */}
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
              <Text style={styles.topBarTitle}>Sign In</Text>
              <View style={styles.topBarRightSpacer} />
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
              {/* Logo Badge - Resizes dynamically when keypad opens */}
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

              {/* Heading Section - Automatically compacts */}
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
                    <Text style={styles.driverPillText}>DRIVER OPERATIONS LOGIN</Text>
                  </View>
                </View>
                {!isKeyboardActive && (
                  <Text style={styles.brandSubtitle}>
                    Sign in with your driver email to continue
                  </Text>
                )}
              </View>

              {/* Error Banner */}
              {errorMessage && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={18} color="#D94B38" />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              )}

              {/* Email ID Field */}
              <View
                style={[
                  styles.fieldBlock,
                  isKeyboardActive && styles.fieldBlockKeyboard,
                ]}
              >
                <Text style={styles.fieldLabel}>Email ID</Text>
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
                    placeholder="driver@pharmatrix.com"
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
                    placeholder="Enter your password"
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

              {/* Options Row: Remember me & Forgot password? */}
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
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <View style={styles.btnContent}>
                    <Text style={styles.signInBtnText}>Sign In</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>

              {/* Quick Demo Credential Helper - Accessible inside scrollable area */}
              <TouchableOpacity
                style={[
                  styles.quickFillBtn,
                  isKeyboardActive && styles.quickFillBtnKeyboard,
                ]}
                onPress={fillTestCredentials}
                activeOpacity={0.75}
              >
                <Ionicons name="key-outline" size={14} color="#3B52B6" />
                <Text style={styles.quickFillText}>
                  Auto-fill Driver #1 (driver1@gmail.com / driver123)
                </Text>
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
  topBarRightSpacer: {
    width: 36,
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
    paddingBottom: 120, // Generous bottom padding to allow full scrolling above keypad
  },
  logoBadgeContainer: {
    alignItems: 'center',
    marginBottom: 16,
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
    marginBottom: 24,
  },
  headingSectionKeyboard: {
    marginBottom: 10,
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
    fontSize: 13.5,
    fontWeight: '500',
    color: '#5C554E',
    textAlign: 'center',
    marginTop: 2,
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
    marginBottom: 16,
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
    marginBottom: 20,
    paddingHorizontal: 2,
  },
  optionsRowKeyboard: {
    marginBottom: 12,
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
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#EADFD0',
  },
  quickFillBtnKeyboard: {
    marginTop: 10,
    paddingVertical: 8,
  },
  quickFillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3B52B6',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 22,
  },
  securityText: {
    fontSize: 11,
    color: '#8A8279',
    fontWeight: '500',
    textAlign: 'center',
  },
});
