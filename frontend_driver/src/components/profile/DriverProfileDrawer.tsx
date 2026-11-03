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
import { colors, radii, spacing, typography, shadows } from '../../theme';
import { useAuth } from '../../context/AuthContext';

export const DriverProfileDrawer: React.FC = () => {
  const { isProfileDrawerOpen, closeProfileDrawer, driverProfile, user, logout } = useAuth();

  const [audioNav, setAudioNav] = useState<boolean>(true);
  const [breakActive, setBreakActive] = useState<boolean>(false);

  if (!isProfileDrawerOpen) return null;

  const driverName = driverProfile?.name || user?.name || 'Driver';
  const badgeId =
    driverProfile?.employee_id ||
    (driverProfile?.id ? `DRV-${driverProfile.id.toString().padStart(4, '0')}` : 'Active');

  const handleCallDispatcher = () => {
    Linking.openURL('tel:18005550199').catch(() => {});
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
        <TouchableOpacity
          style={styles.backdropTap}
          onPress={closeProfileDrawer}
          activeOpacity={1}
        />

        <View style={styles.drawer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.topBar}>
              <View style={styles.telemetryTag}>
                <View style={styles.pulseDot} />
                <Text style={styles.telemetryText}>DRIVER OPERATIONS</Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={closeProfileDrawer}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {/* Avatar & Driver Identity */}
            <View style={styles.identityRow}>
              <View style={styles.avatarFrame}>
                <Ionicons name="person" size={28} color={colors.primary} />
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
                  Badge #{badgeId} / {driverProfile?.license_number ? `Lic: ${driverProfile.license_number}` : 'Licensed Courier'}
                </Text>
                <View style={styles.ratingLine}>
                  <Ionicons name="shield-checkmark" size={12} color={colors.success} />
                  <Text style={styles.statusText}>{driverProfile?.status || 'Active'}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Scrollable Body */}
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Employment Status */}
            <View style={styles.sectionCard}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.headerTitleRow}>
                  <Ionicons name="id-card-outline" size={16} color={colors.primary} />
                  <Text style={styles.cardHeaderTitle}>Courier Profile</Text>
                </View>
                <View style={styles.certPill}>
                  <Text style={styles.certPillText}>
                    {driverProfile?.is_available ? 'Available' : 'Assigned'}
                  </Text>
                </View>
              </View>

              <View style={styles.twoColBox}>
                <View style={styles.miniCol}>
                  <Text style={styles.miniColLabel}>User Email</Text>
                  <Text style={styles.miniColVal} numberOfLines={1}>
                    {user?.email || 'driver@pharmatrix.com'}
                  </Text>
                </View>
                <View style={[styles.miniCol, styles.miniColBorder]}>
                  <Text style={styles.miniColLabel}>Account Type</Text>
                  <Text style={styles.miniColVal}>Authorized Driver</Text>
                </View>
              </View>
            </View>

            {/* Clearances */}
            <View style={styles.sectionGroup}>
              <Text style={styles.sectionTitle}>CLEARANCES & STATUS</Text>
              <View style={styles.listCard}>
                <View style={styles.licenseRow}>
                  <Ionicons name="document-text-outline" size={16} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>Commercial Driver License</Text>
                    <Text style={styles.itemSub}>
                      {driverProfile?.license_number
                        ? `Lic #${driverProfile.license_number}`
                        : 'Active Commercial License'}
                    </Text>
                  </View>
                  <View style={styles.activeTag}>
                    <Text style={styles.activeTagText}>Active</Text>
                  </View>
                </View>

                <View style={[styles.licenseRow, styles.borderTop]}>
                  <Ionicons name="shield-checkmark-outline" size={16} color={colors.success} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>Regulated Biohazard Transport</Text>
                    <Text style={styles.itemSub}>Compliance Verified</Text>
                  </View>
                  <View style={styles.activeTag}>
                    <Text style={styles.activeTagText}>Valid</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Tools */}
            <View style={styles.sectionGroup}>
              <Text style={styles.sectionTitle}>COMMUNICATIONS & TOOLS</Text>
              <View style={styles.listCard}>
                {/* Dispatcher Phone */}
                <TouchableOpacity
                  style={styles.toolRow}
                  onPress={handleCallDispatcher}
                  activeOpacity={0.7}
                >
                  <View style={styles.toolLeft}>
                    <Ionicons name="headset-outline" size={16} color={colors.primary} />
                    <Text style={styles.toolTitle}>Contact Dispatch</Text>
                  </View>
                  <Ionicons name="call-outline" size={16} color={colors.primary} />
                </TouchableOpacity>

                {/* Audio Navigation */}
                <View style={[styles.toolRow, styles.borderTop]}>
                  <View style={styles.toolLeft}>
                    <Ionicons name="volume-high-outline" size={16} color={colors.primary} />
                    <Text style={styles.toolTitle}>Audio Navigation Cues</Text>
                  </View>
                  <Switch
                    value={audioNav}
                    onValueChange={setAudioNav}
                    trackColor={{ false: colors.secondary, true: colors.primaryAccent }}
                  />
                </View>
              </View>
            </View>

            {/* Shift Actions */}
            <View style={styles.sectionGroup}>
              <Text style={styles.sectionTitle}>SHIFT CONTROLS</Text>
              <TouchableOpacity
                style={[styles.breakBtn, breakActive && styles.breakBtnActive]}
                onPress={handleMealBreak}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={breakActive ? 'cafe' : 'cafe-outline'}
                  size={16}
                  color={breakActive ? '#FFFFFF' : colors.primary}
                />
                <Text style={[styles.breakBtnText, breakActive && styles.breakBtnTextActive]}>
                  {breakActive ? 'Resume Shift (Break Active)' : 'Start 30-min Meal Break'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.logoutBtn}
                onPress={handleLogout}
                activeOpacity={0.88}
              >
                <Ionicons name="log-out-outline" size={16} color={colors.onErrorContainer} />
                <Text style={styles.logoutText}>Clock Out & Log Out</Text>
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Pharmatrix Driver Portal / ID #{badgeId}</Text>
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
    width: '85%',
    maxWidth: 400,
    backgroundColor: colors.surface,
    ...shadows.modal,
  },
  header: {
    paddingTop: 48,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.secondary,
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
    backgroundColor: colors.success,
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarFrame: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1.5,
    borderColor: colors.primaryAccent,
  },
  onDutyDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.surface,
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
    color: colors.primary,
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
    gap: 4,
    marginTop: 2,
  },
  statusText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.success,
    fontWeight: '600',
  },
  scrollContent: {
    padding: spacing.md,
    gap: 12,
    paddingBottom: 40,
  },
  sectionGroup: {
    gap: 6,
  },
  sectionTitle: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  sectionCard: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.secondary,
    padding: 10,
    gap: 8,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardHeaderTitle: {
    ...typography.labelMd,
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  certPill: {
    backgroundColor: colors.lightAccent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.xs,
  },
  certPillText: {
    ...typography.labelSm,
    fontSize: 9,
    color: colors.primary,
    fontWeight: '700',
  },
  twoColBox: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.secondary,
    paddingTop: 8,
  },
  miniCol: {
    flex: 1,
  },
  miniColBorder: {
    borderLeftWidth: 1,
    borderLeftColor: colors.secondary,
    paddingLeft: 8,
  },
  miniColLabel: {
    ...typography.labelSm,
    fontSize: 9,
    color: colors.textMuted,
  },
  miniColVal: {
    ...typography.bodySm,
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 1,
  },
  listCard: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.secondary,
    padding: 10,
    gap: 8,
  },
  licenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: colors.secondary,
    paddingTop: 8,
  },
  itemTitle: {
    ...typography.labelMd,
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  itemSub: {
    ...typography.bodySm,
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 1,
  },
  activeTag: {
    backgroundColor: colors.successContainer,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.xs,
  },
  activeTagText: {
    ...typography.labelSm,
    fontSize: 9,
    color: colors.success,
    fontWeight: '700',
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  toolLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toolTitle: {
    ...typography.labelMd,
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  breakBtn: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.secondary,
    borderRadius: radii.md,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  breakBtnActive: {
    backgroundColor: colors.primaryAccent,
    borderColor: colors.primaryAccent,
  },
  breakBtnText: {
    ...typography.labelMd,
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  breakBtnTextActive: {
    color: '#FFFFFF',
  },
  logoutBtn: {
    backgroundColor: colors.errorContainer,
    borderRadius: radii.md,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.2)',
  },
  logoutText: {
    ...typography.labelMd,
    fontSize: 12,
    fontWeight: '700',
    color: colors.onErrorContainer,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  footerText: {
    ...typography.bodySm,
    fontSize: 10,
    color: colors.textMuted,
  },
});

export default DriverProfileDrawer;
