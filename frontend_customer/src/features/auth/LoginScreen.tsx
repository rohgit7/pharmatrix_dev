import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Modal,
} from 'react-native';
import {
  ShieldCheck,
  Mail,
  Lock,
  User as UserIcon,
  Server,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react-native';
import { colors, spacing, borderRadius } from '../../theme';
import { PrimaryButton } from '../../components/common/PrimaryButton';
import { Card } from '../../components/common/Card';
import { useAuth } from '../../context/AuthContext';
import {
  getApiBaseUrl,
  setCustomApiBaseUrl,
  testApiConnection,
} from '../../services/api';

export const LoginScreen: React.FC = () => {
  const { login, registerAndLogin } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [serverModalVisible, setServerModalVisible] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState(getApiBaseUrl());
  const [probeStatus, setProbeStatus] = useState<{
    ok?: boolean;
    message?: string;
    testing?: boolean;
  }>({});

  useEffect(() => {
    let active = true;
    testApiConnection()
      .then((res) => {
        if (active) setServerOnline(res.ok);
      })
      .catch(() => {
        if (active) setServerOnline(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const isEmailValid = email.trim().includes('@') && email.trim().includes('.');
  const isPasswordValid =
    mode === 'register' ? password.length >= 8 : password.length >= 6;
  const isNameValid = mode === 'login' || name.trim().length >= 2;
  const canSubmit = isEmailValid && isPasswordValid && isNameValid && !submitting;

  const handleSubmit = async () => {
    setErrorMsg(null);
    if (!isEmailValid) {
      setErrorMsg('Enter a valid email address.');
      return;
    }
    if (!isPasswordValid) {
      setErrorMsg(
        mode === 'register'
          ? 'Password must be at least 8 characters.'
          : 'Enter your account password.'
      );
      return;
    }
    if (!isNameValid) {
      setErrorMsg('Enter your full name.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        await registerAndLogin(name.trim(), email.trim(), password);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Sign in failed. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTestServer = async () => {
    setProbeStatus({ testing: true });
    await setCustomApiBaseUrl(customUrlInput.trim() || null);
    const res = await testApiConnection(customUrlInput.trim() || undefined);
    setServerOnline(res.ok);
    setCustomUrlInput(res.url);
    setProbeStatus({ ok: res.ok, message: res.message, testing: false });
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand & Server Header */}
        <View style={styles.topRow}>
          <View style={styles.brandGroup}>
            <View style={styles.brandBadge}>
              <ShieldCheck size={22} color={colors.textInverse} />
            </View>
            <View style={styles.brandTextWrap}>
              <Text style={styles.brandTitle}>Pharmatrix</Text>
              <Text style={styles.brandSub}>Customer Portal</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.serverBtn}
            onPress={() => {
              setCustomUrlInput(getApiBaseUrl());
              setProbeStatus({});
              setServerModalVisible(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Configure backend server"
          >
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    serverOnline === true
                      ? colors.success
                      : serverOnline === false
                      ? colors.error
                      : colors.warning,
                },
              ]}
            />
            <Server size={13} color={colors.textSecondary} />
            <Text style={styles.serverBtnText}>Server</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.headerSection}>
          <Text style={styles.title}>
            {mode === 'login' ? 'Sign in to your facility' : 'Create customer account'}
          </Text>
          <Text style={styles.subtitle}>
            {mode === 'login'
              ? 'Manage waste pickups, weigh-in handovers, and payments.'
              : 'Register your pharmacy, distributor, hospital, or clinic.'}
          </Text>
        </View>

        {/* Auth Card */}
        <Card variant="elevated" padding="xl" style={styles.authCard}>
          <View style={styles.modeTabs}>
            <TouchableOpacity
              style={[styles.modeTab, mode === 'login' && styles.modeTabActive]}
              onPress={() => {
                setMode('login');
                setErrorMsg(null);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === 'login' }}
            >
              <Text
                style={[
                  styles.modeTabText,
                  mode === 'login' && styles.modeTabTextActive,
                ]}
              >
                Sign In
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modeTab,
                mode === 'register' && styles.modeTabActive,
              ]}
              onPress={() => {
                setMode('register');
                setErrorMsg(null);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === 'register' }}
            >
              <Text
                style={[
                  styles.modeTabText,
                  mode === 'register' && styles.modeTabTextActive,
                ]}
              >
                Create Account
              </Text>
            </TouchableOpacity>
          </View>

          {errorMsg ? (
            <View style={styles.errorBanner}>
              <AlertCircle size={16} color={colors.error} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          {mode === 'register' ? (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Representative Name</Text>
              <View style={styles.inputWrap}>
                <UserIcon size={17} color={colors.textSecondary} />
                <TextInput
                  style={styles.input}
                  placeholder="Full name"
                  placeholderTextColor={colors.textMuted}
                  value={name}
                  onChangeText={(v) => {
                    setName(v);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  autoCapitalize="words"
                />
              </View>
            </View>
          ) : null}

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputWrap}>
              <Mail size={17} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="facility@organization.com"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  if (errorMsg) setErrorMsg(null);
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrap}>
              <Lock size={17} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder={
                  mode === 'register' ? 'Minimum 8 characters' : 'Enter password'
                }
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  if (errorMsg) setErrorMsg(null);
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowPassword((prev) => !prev)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={
                  showPassword ? 'Hide password' : 'Show password'
                }
              >
                {showPassword ? (
                  <EyeOff size={18} color={colors.textSecondary} />
                ) : (
                  <Eye size={18} color={colors.textSecondary} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          <PrimaryButton
            title={mode === 'login' ? 'Sign In' : 'Create Account'}
            onPress={handleSubmit}
            loading={submitting}
            disabled={!canSubmit}
            size="lg"
            style={styles.submitBtn}
          />
        </Card>
      </ScrollView>

      {/* Server Config Modal */}
      <Modal
        visible={serverModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setServerModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Card variant="elevated" padding="xl" style={styles.modalCard}>
            <Text style={styles.modalTitle}>Backend Server</Text>
            <Text style={styles.modalDesc}>
              Pharmatrix API endpoint URL
            </Text>

            <View style={[styles.inputWrap, { marginVertical: spacing.md }]}>
              <Server size={17} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                value={customUrlInput}
                onChangeText={setCustomUrlInput}
                placeholder="http://10.235.154.167:8001"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {probeStatus.message ? (
              <View
                style={[
                  styles.probeBanner,
                  probeStatus.ok ? styles.probeOk : styles.probeErr,
                ]}
              >
                {probeStatus.ok ? (
                  <CheckCircle2 size={16} color={colors.success} />
                ) : (
                  <AlertCircle size={16} color={colors.error} />
                )}
                <Text
                  style={[
                    styles.probeText,
                    { color: probeStatus.ok ? colors.success : colors.error },
                  ]}
                >
                  {probeStatus.message}
                </Text>
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <PrimaryButton
                title="Test & Save"
                onPress={handleTestServer}
                loading={probeStatus.testing}
                variant="accent"
                size="md"
                style={{ flex: 1 }}
              />
              <PrimaryButton
                title="Close"
                onPress={() => setServerModalVisible(false)}
                variant="outline"
                size="md"
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    justifyContent: 'center',
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xxl,
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexShrink: 1,
  },
  brandBadge: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTextWrap: {
    flexShrink: 1,
  },
  brandTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  brandSub: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  serverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: borderRadius.pill,
    gap: 6,
    flexShrink: 0,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  serverBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  headerSection: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: 4,
  },
  authCard: {
    marginBottom: spacing.lg,
  },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: borderRadius.md,
    padding: 4,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  modeTabActive: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  modeTabTextActive: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.errorBg,
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
  fieldGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    paddingVertical: 10,
  },
  submitBtn: {
    marginTop: spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  probeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  probeOk: {
    backgroundColor: colors.successBg,
  },
  probeErr: {
    backgroundColor: colors.errorBg,
  },
  probeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
});
