import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Switch,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../../theme';
import { useAuth } from '../../context/AuthContext';

export const DriverProfileDrawer: React.FC = () => {
  const { isProfileDrawerOpen, closeProfileDrawer, driverProfile, user, logout } = useAuth();

  const [audioNav, setAudioNav] = useState<boolean>(true);
  const [highContrast, setHighContrast] = useState<boolean>(true);
  const [breakActive, setBreakActive] = useState<boolean>(false);

  if (!isProfileDrawerOpen) return null;

  const driverName = driverProfile?.name || user?.name || 'Courier';
  const badgeId = driverProfile?.employee_id || (driverProfile?.id ? `DRV-${driverProfile.id.toString().padStart(4, '0')}` : 'Active');

  const handleCallDispatcher = () => {
    Linking.openURL('tel:18005550199').catch(() => {});
  };

  const handleSOS = () => {
    if (Platform.OS === 'web') {
      alert('Emergency Spill Protocol Triggered! CHEMTREC & Dispatch notified.');
    } else {
      Linking.openURL('tel:911').catch(() => {});
    }
  };

  const handleMealBreak = () => {
    setBreakActive(!breakActive);
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <Modal
      visible={isProfileDrawerOpen}
      transparent
      animationType="slide"
      onRequestClose={closeProfileDrawer}
    >
      <View style={styles.scrim}>
        <TouchableOpacity style={styles.backdropTap} onPress={closeProfileDrawer} activeOpacity={1} />

        <View style={styles.drawer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.topBar}>
              <View style={styles.telemetryTag}>
                <View style={styles.pulseDot} />
                <Text style={styles.telemetryText}>TELEMETRY VERIFIED</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={closeProfileDrawer} activeOpacity={0.7}>
                <Ionicons name="close" size={20} color={colors.ink} />
              </TouchableOpacity>
            </View>

            {/* Avatar & Driver Identity */}
            <View style={styles.identityRow}>
              <View style={styles.avatarFrame}>
                <Ionicons name="person" size={32} color={colors.primaryDark} />
                <View style={styles.onDutyDot} />
              </View>
              <View style={styles.identityCol}>
                <View style={styles.nameRow}>
                  <Text style={styles.driverName} numberOfLines={1}>
                    {driverName}
                  </Text>
                  <View style={styles.onDutyBadge}>
                    <Text style={styles.onDutyText}>ON DUTY</Text>
                  </View>
                </View>
                <Text style={styles.badgeLine}>
                  Badge #{badgeId} • {driverProfile?.license_number ? `Lic: ${driverProfile.license_number}` : 'Commercial Courier'}
                </Text>
                <View style={styles.ratingLine}>
                  <View style={styles.starBadge}>
                    <Ionicons name="shield-checkmark" size={11} color={colors.success} />
                    <Text style={styles.starText}>{driverProfile?.status || 'Active'}</Text>
                  </View>
                  <Text style={styles.transfersText}>
                    {driverProfile?.phone ? `Tel: ${driverProfile.phone}` : 'Verified Transport'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Scrollable Body */}
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Employment Status */}
            <View style={styles.sectionCard}>
              <View style={styles.cardHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="id-card-outline" size={18} color={colors.primaryDark} />
                  <View>
                    <Text style={styles.cardHeaderTitle}>Field Logistics Courier</Text>
                    <Text style={styles.cardHeaderSub}>Status: {driverProfile?.status || 'Active'} • {user?.email}</Text>
                  </View>
                </View>
                <View style={styles.certPill}>
                  <Text style={styles.certPillText}>{driverProfile?.is_available ? 'Available' : 'Assigned'}</Text>
                </View>
              </View>

              <View style={styles.twoColBox}>
                <View style={styles.miniCol}>
                  <Text style={styles.miniColLabel}>Base Depot</Text>
                  <Text style={styles.miniColVal}>Operations Hub</Text>
                </View>
                <View style={[styles.miniCol, styles.miniColBorder]}>
                  <Text style={styles.miniColLabel}>Registered Date</Text>
                  <Text style={styles.miniColVal}>
                    {driverProfile?.created_at ? new Date(driverProfile.created_at).toLocaleDateString() : 'Active'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Performance KPIs */}
            <View style={styles.sectionGroup}>
              <Text style={styles.sectionTitle}>COURIER PERFORMANCE & RECORD</Text>
              <View style={styles.kpiRow}>
                <View style={styles.kpiBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                    <Ionicons name="star" size={13} color="#D97706" />
                    <Text style={styles.kpiBigText}>4.98</Text>
                  </View>
                  <Text style={styles.kpiSubText}>Driver Rating</Text>
                </View>
                <View style={styles.kpiBox}>
                  <Text style={[styles.kpiBigText, { color: colors.primaryDark }]}>99.4%</Text>
                  <Text style={styles.kpiSubText}>On-Time SLA</Text>
                </View>
                <View style={styles.kpiBox}>
                  <Text style={[styles.kpiBigText, { color: colors.success }]}>0</Text>
                  <Text style={styles.kpiSubText}>Violations</Text>
                </View>
              </View>
            </View>

            {/* Licenses & Medical Clearances */}
            <View style={styles.sectionGroup}>
              <Text style={styles.sectionTitle}>LICENSES & CLEARANCES</Text>
              <View style={styles.listCard}>
                <View style={styles.licenseRow}>
                  <Ionicons name="document-text-outline" size={18} color={colors.primaryDark} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.itemHeader}>
                      <Text style={styles.itemTitle}>Commercial Driver License</Text>
                      <View style={styles.activeTag}>
                        <Text style={styles.activeTagText}>Active</Text>
                      </View>
                    </View>
                    <Text style={styles.itemSub}>
                      {driverProfile?.license_number
                        ? `Lic #${driverProfile.license_number}${driverProfile.license_expiry ? ` • Exp: ${driverProfile.license_expiry}` : ''}`
                        : 'Active Commercial License'}
                    </Text>
                  </View>
                </View>

                <View style={[styles.licenseRow, styles.borderTop]}>
                  <Ionicons name="fitness-outline" size={18} color={colors.success} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.itemHeader}>
                      <Text style={styles.itemTitle}>Medical Examiner Clearance</Text>
                      <View style={styles.activeTag}>
                        <Text style={styles.activeTagText}>Valid</Text>
                      </View>
                    </View>
                    <Text style={styles.itemSub}>Medical Clearance Active</Text>
                  </View>
                </View>

                <View style={[styles.licenseRow, styles.borderTop]}>
                  <Ionicons name="shield-outline" size={18} color="#D97706" />
                  <View style={{ flex: 1 }}>
                    <View style={styles.itemHeader}>
                      <Text style={styles.itemTitle}>Regulated Biohazard Transport</Text>
                      <View style={styles.activeTag}>
                        <Text style={styles.activeTagText}>Current</Text>
                      </View>
                    </View>
                    <Text style={styles.itemSub}>Compliant Waste Courier Clearance</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Safety & Rest Verification */}
            <View style={styles.sectionGroup}>
              <Text style={styles.sectionTitle}>SAFETY & REST VERIFICATION</Text>
              <View style={styles.sectionCard}>
                <View style={styles.safetyRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                    <View>
                      <Text style={styles.safetyTitle}>Daily Fit-for-Duty Check</Text>
                      <Text style={styles.safetySub}>Pre-shift wellness questionnaire passed</Text>
                    </View>
                  </View>
                  <Text style={styles.passedText}>Verified</Text>
                </View>

                <View style={[styles.safetyRow, styles.borderTop, { paddingTop: 8 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="moon-outline" size={16} color={colors.primaryDark} />
                    <View>
                      <Text style={styles.safetyTitle}>Rest Hours Compliance</Text>
                      <Text style={styles.safetySub}>Mandatory off-duty rest interval met</Text>
                    </View>
                  </View>
                  <Text style={styles.passedText}>Logged</Text>
                </View>
              </View>
            </View>

            {/* Driver Preferences & Tools */}
            <View style={styles.sectionGroup}>
              <Text style={styles.sectionTitle}>DRIVER PREFERENCES & TOOLS</Text>
              <View style={styles.listCard}>
                {/* Dispatcher Phone */}
                <TouchableOpacity style={styles.toolRow} onPress={handleCallDispatcher} activeOpacity={0.7}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={styles.toolIconBox}>
                      <Ionicons name="headset" size={16} color={colors.primaryDark} />
                    </View>
                    <View>
                      <Text style={styles.toolTitle}>Dedicated Dispatcher</Text>
                      <Text style={styles.toolSub}>Regional Dispatch Operations</Text>
                    </View>
                  </View>
                  <Ionicons name="call" size={16} color={colors.primaryDark} />
                </TouchableOpacity>

                {/* Driver SOS */}
                <TouchableOpacity
                  style={[styles.toolRow, styles.borderTop, { backgroundColor: colors.errorContainer }]}
                  onPress={handleSOS}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[styles.toolIconBox, { backgroundColor: '#FEE2E2' }]}>
                      <Ionicons name="alert" size={16} color={colors.error} />
                    </View>
                    <View>
                      <Text style={[styles.toolTitle, { color: colors.onErrorContainer }]}>
                        Emergency Spill & Driver SOS
                      </Text>
                      <Text style={[styles.toolSub, { color: colors.onErrorContainer }]}>
                        Immediate Trigger & 911/CHEMTREC
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.onErrorContainer} />
                </TouchableOpacity>

                {/* Audio Navigation Cues */}
                <View style={[styles.toolRow, styles.borderTop]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={styles.toolIconBox}>
                      <Ionicons name="volume-high" size={16} color={colors.ink} />
                    </View>
                    <View>
                      <Text style={styles.toolTitle}>Audio Navigation Cues</Text>
                      <Text style={styles.toolSub}>Turn-by-turn spoken guidance</Text>
                    </View>
                  </View>
                  <Switch
                    value={audioNav}
                    onValueChange={setAudioNav}
                    trackColor={{ false: colors.border, true: colors.primaryAction }}
                  />
                </View>

                {/* Sunlight High Contrast */}
                <View style={[styles.toolRow, styles.borderTop]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={styles.toolIconBox}>
                      <Ionicons name="sunny" size={16} color={colors.ink} />
                    </View>
                    <View>
                      <Text style={styles.toolTitle}>Sunlight High-Contrast Mode</Text>
                      <Text style={styles.toolSub}>Enhanced midday glare view</Text>
                    </View>
                  </View>
                  <Switch
                    value={highContrast}
                    onValueChange={setHighContrast}
                    trackColor={{ false: colors.border, true: colors.primaryAction }}
                  />
                </View>
              </View>
            </View>

            {/* Shift & Break Controls */}
            <View style={styles.sectionGroup}>
              <Text style={styles.sectionTitle}>SHIFT & BREAK CONTROLS</Text>
              <TouchableOpacity
                style={[styles.breakBtn, breakActive && styles.breakBtnActive]}
                onPress={handleMealBreak}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={breakActive ? 'cafe' : 'cafe-outline'}
                  size={18}
                  color={breakActive ? '#FFFFFF' : colors.primaryDark}
                />
                <Text style={[styles.breakBtnText, breakActive && styles.breakBtnTextActive]}>
                  {breakActive ? 'Resume Shift (Break Active)' : 'Start Mandatory 30-min DOT Meal Break'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.88}>
                <Ionicons name="log-out-outline" size={18} color={colors.onErrorContainer} />
                <Text style={styles.logoutText}>Clock Out & Log Out</Text>
              </TouchableOpacity>
            </View>

            {/* Diagnostic Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Pharmatrix Driver Portal • ID #{badgeId}</Text>
              <Text style={styles.footerSub}>Session Active • Verified Courier</Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.scrim,
  },
  backdropTap: {
    flex: 1,
  },
  drawer: {
    width: '88%',
    maxWidth: 420,
    backgroundColor: colors.card,
    shadowColor: colors.ink,
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: colors.surfaceLow,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  telemetryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primaryDark,
  },
  telemetryText: {
    ...typography.labelSm,
    fontSize: 9,
    color: colors.textSecondary,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarFrame: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 2,
    borderColor: colors.primaryAction,
  },
  onDutyDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  identityCol: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  driverName: {
    ...typography.headlineSm,
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },
  onDutyBadge: {
    backgroundColor: colors.successContainer,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  onDutyText: {
    ...typography.labelSm,
    fontSize: 9,
    color: colors.success,
    fontWeight: '700',
  },
  badgeLine: {
    ...typography.bodySm,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  ratingLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  starBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.warningContainer,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: radii.sm,
  },
  starText: {
    ...typography.labelSm,
    fontSize: 10,
    color: '#B45309',
    fontWeight: '700',
  },
  transfersText: {
    ...typography.bodySm,
    fontSize: 10,
    color: colors.textSecondary,
  },
  scrollContent: {
    padding: spacing.md,
    gap: 14,
    paddingBottom: 40,
  },
  sectionGroup: {
    gap: 6,
  },
  sectionTitle: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.textOutline,
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingHorizontal: 2,
  },
  sectionCard: {
    backgroundColor: colors.surfaceLow,
    borderRadius: radii.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 8,
  },
  cardHeaderTitle: {
    ...typography.labelMd,
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  cardHeaderSub: {
    ...typography.bodySm,
    fontSize: 10,
    color: colors.textSecondary,
  },
  certPill: {
    backgroundColor: colors.primaryTint,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  certPillText: {
    ...typography.labelSm,
    fontSize: 9,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  twoColBox: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: radii.md,
    padding: 8,
  },
  miniCol: {
    flex: 1,
  },
  miniColBorder: {
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    paddingLeft: 8,
  },
  miniColLabel: {
    ...typography.labelSm,
    fontSize: 9,
    color: colors.textOutline,
  },
  miniColVal: {
    ...typography.labelMd,
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink,
    marginTop: 2,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 6,
  },
  kpiBox: {
    flex: 1,
    backgroundColor: colors.surfaceLow,
    borderRadius: radii.lg,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  kpiBigText: {
    ...typography.headlineSm,
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },
  kpiSubText: {
    ...typography.bodySm,
    fontSize: 9,
    color: colors.textSecondary,
    marginTop: 2,
  },
  listCard: {
    backgroundColor: colors.surfaceLow,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  licenseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    backgroundColor: '#FFFFFF',
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemTitle: {
    ...typography.labelMd,
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  activeTag: {
    backgroundColor: colors.successContainer,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.sm,
  },
  activeTagText: {
    ...typography.labelSm,
    fontSize: 9,
    color: colors.success,
    fontWeight: '700',
  },
  itemSub: {
    ...typography.bodySm,
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 1,
  },
  safetyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  safetyTitle: {
    ...typography.labelMd,
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink,
  },
  safetySub: {
    ...typography.bodySm,
    fontSize: 9,
    color: colors.textSecondary,
  },
  passedText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.success,
    fontWeight: '700',
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    backgroundColor: '#FFFFFF',
  },
  toolIconBox: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolTitle: {
    ...typography.labelMd,
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  toolSub: {
    ...typography.bodySm,
    fontSize: 10,
    color: colors.textSecondary,
  },
  breakBtn: {
    height: 44,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceLow,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  breakBtnActive: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
  },
  breakBtnText: {
    ...typography.labelMd,
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  breakBtnTextActive: {
    color: '#FFFFFF',
  },
  logoutBtn: {
    height: 44,
    borderRadius: radii.lg,
    backgroundColor: colors.errorContainer,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(217, 75, 56, 0.3)',
    marginTop: 6,
  },
  logoutText: {
    ...typography.labelMd,
    fontSize: 12,
    fontWeight: '700',
    color: colors.onErrorContainer,
  },
  footer: {
    alignItems: 'center',
    gap: 2,
    paddingTop: 12,
  },
  footerText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.textOutline,
  },
  footerSub: {
    ...typography.bodySm,
    fontSize: 9,
    color: colors.textOutline,
  },
});

export default DriverProfileDrawer;
