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
  Server,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Building2,
  ArrowRight,
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
import { OnboardingScreen } from './OnboardingScreen';

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
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

  if (mode === 'register') {
    return <OnboardingScreen onBackToSignIn={() => setMode('login')} />;
  }

  const isEmailValid = email.trim().includes('@') && email.trim().includes('.');
  const isPasswordValid = password.length >= 6;
  const canSubmit = isEmailValid && isPasswordValid && !submitting;

  const handleSubmit = async () => {
    setErrorMsg(null);
    if (!isEmailValid) {
      setErrorMsg('Enter a valid email address.');
      return;
    }
    if (!isPasswordValid) {
      setErrorMsg('Enter your account password.');
      return;
    }

    setSubmitting(true);
    try {
      await login(email.trim(), password);
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
          <Text style={styles.title}>Sign in to your account</Text>
          <Text style={styles.subtitle}>
            Schedule pharmaceutical waste pickups, verify weigh-ins, and manage payments.
          </Text>
        </View>

        {/* Auth Card */}
        <Card variant="elevated" padding="xl" style={styles.authCard}>
          <View style={styles.modeTabs}>
            <TouchableOpacity
              style={[styles.modeTab, styles.modeTabActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: true }}
            >
              <Text style={[styles.modeTabText, styles.modeTabTextActive]}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modeTab}
              onPress={() => {
                setErrorMsg(null);
                setMode('register');
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: false }}
            >
              <Text style={styles.modeTabText}>Create Account</Text>
            </TouchableOpacity>
          </View>

          {errorMsg ? (
            <View style={styles.errorBanner}>
              <AlertCircle size={16} color={colors.error} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputWrap}>
              <Mail size={17} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="contact@business.com"
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
                placeholder="Enter password"
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
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
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
            title="Sign In"
            onPress={handleSubmit}
            loading={submitting}
            disabled={!canSubmit}
            size="lg"
            style={styles.submitBtn}
          />
        </Card>

        {/* Prominent New Customer Onboarding Callout */}
        <TouchableOpacity
          style={styles.registerCalloutCard}
          onPress={() => {
            setErrorMsg(null);
            setMode('register');
          }}
          activeOpacity={0.8}
        >
          <View style={styles.registerCalloutIcon}>
            <Building2 size={20} color={colors.accent} />
          </View>
          <View style={styles.registerCalloutTextCol}>
            <Text style={styles.registerCalloutTitle}>New to Pharmatrix?</Text>
            <Text style={styles.registerCalloutSub}>
              Register your Pharmacy, Distributor, Hospital, or Clinic in 4 guided steps.
            </Text>
          </View>
          <ArrowRight size={18} color={colors.primary} />
        </TouchableOpacity>
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
            <Text style={styles.modalDesc}>Pharmatrix API endpoint URL</Text>

            <View style={[styles.inputWrap, { marginVertical: spacing.md }]}>
              <Server size={17} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                value={customUrlInput}
                onChangeText={setCustomUrlInput}
                placeholder="https://api.pharmatrix.com"
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
                style={{ flex: 1 }}
              />
              <PrimaryButton
                title="Close"
                variant="outline"
                onPress={() => setServerModalVisible(false)}
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
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
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
    gap: 1,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  brandSub: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  serverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
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
    fontSize: 26,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  authCard: {
    width: '100%',
  },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: colors.secondarySoft,
    borderRadius: borderRadius.md,
    padding: 4,
    marginBottom: spacing.xl,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  modeTabActive: {
    backgroundColor: colors.surface,
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
    gap: spacing.sm,
    backgroundColor: colors.errorSoft,
    borderWidth: 1,
    borderColor: '#F5C2C7',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: colors.error,
    fontWeight: '500',
    lineHeight: 18,
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
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 48,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    height: '100%',
  },
  submitBtn: {
    marginTop: spacing.xs,
  },
  registerCalloutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  registerCalloutIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  registerCalloutTextCol: {
    flex: 1,
    gap: 2,
  },
  registerCalloutTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  registerCalloutSub: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    width: '100%',
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
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  probeOk: {
    backgroundColor: colors.successSoft,
  },
  probeErr: {
    backgroundColor: colors.errorSoft,
  },
  probeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
});
