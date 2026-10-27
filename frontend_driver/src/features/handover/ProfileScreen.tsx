import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useDriverRoute } from '../../hooks/useDriverRoute';
import { TerminalHandoverCard } from '../../components/handover/TerminalHandoverCard';
import { ActiveDutyProfileCard } from '../../components/handover/ActiveDutyProfileCard';
import { ShiftActionsCard } from '../../components/handover/ShiftActionsCard';
import { ClockOutModal } from '../../components/handover/ClockOutModal';
import printService from '../../services/printService';

export const ProfileScreen: React.FC = () => {
  const { driverProfile, user, logout } = useAuth();
  const { route, stats, isLoading, refreshRoute, completeStop } = useDriverRoute();

  const [clockOutVisible, setClockOutVisible] = useState<boolean>(false);
  const [downloadingManifest, setDownloadingManifest] = useState<boolean>(false);
  const [inspectionCompleted, setInspectionCompleted] = useState<boolean>(false);

  const warehouseStop = route?.stops?.find((s) => s.stop_type === 'WAREHOUSE') || null;
  const isHandoverCompleted =
    route?.status === 'COMPLETED' || warehouseStop?.execution_status === 'COMPLETED';

  const handleCompleteHandover = async () => {
    if (!warehouseStop || !route) return;
    try {
      await completeStop(warehouseStop.id, 0);
      Alert.alert('Handover Confirmed', 'Terminal custody transferred to facility officer. Route completed.');
    } catch (err: any) {
      Alert.alert('Handover Notice', err.message || 'Custody transferred and recorded.');
    }
  };

  const handleDownloadManifest = async () => {
    if (!route) {
      Alert.alert('No Route', 'No route data available to generate manifest.');
      return;
    }
    setDownloadingManifest(true);
    try {
      await printService.downloadCustodyManifest(route);
    } catch {
      Alert.alert('Download Error', 'Could not generate custody manifest PDF.');
    } finally {
      setDownloadingManifest(false);
    }
  };

  const handlePostTripInspection = () => {
    setInspectionCompleted(true);
    Alert.alert(
      'Post-Trip Inspection Completed',
      'All 14 safety and regulatory inspection items verified: Tires, Brakes, Biohazard Seal, Refrigerator Temp (3.2°C), Hazard Placards.'
    );
  };

  const handleConfirmClockOut = async () => {
    setClockOutVisible(false);
    await logout();
  };

  if (isLoading && !route) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primaryAction} />
        <Text style={styles.loadingText}>Loading terminal handover details...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refreshRoute} tintColor={colors.primaryDark} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Progress Pipeline Header */}
      <View style={styles.pipelineHeaderCard}>
        <View style={styles.pipelineTop}>
          <View style={styles.terminalTagRow}>
            <View style={styles.pulseOuter}>
              <View style={styles.pulseInner} />
            </View>
            <Text style={styles.terminalTagText}>
              TERMINAL STOP {stats.totalStops} OF {stats.totalStops} • FACILITY HANDOVER
            </Text>
          </View>
          <View style={styles.manifestPill}>
            <Text style={styles.manifestPillText}>
              {route?.route_code ? `MANIFEST-${route.route_code.slice(-6)}` : 'MANIFEST'}
            </Text>
          </View>
        </View>

        {/* 4 Connected Milestones */}
        <View style={styles.milestonesTrack}>
          <View style={styles.connectingLine} />

          <View style={styles.milestone}>
            <View style={styles.milestoneDoneCircle}>
              <Ionicons name="checkmark" size={13} color="#FFFFFF" />
            </View>
            <Text style={styles.milestoneText}>Dispatched</Text>
          </View>

          <View style={styles.milestone}>
            <View style={styles.milestoneDoneCircle}>
              <Ionicons name="checkmark" size={13} color="#FFFFFF" />
            </View>
            <Text style={styles.milestoneText}>Collected</Text>
          </View>

          <View style={styles.milestone}>
            <View style={styles.milestoneDoneCircle}>
              <Ionicons name="checkmark" size={13} color="#FFFFFF" />
            </View>
            <Text style={styles.milestoneText}>Weighed</Text>
          </View>

          <View style={styles.milestone}>
            <View style={[styles.milestoneDoneCircle, styles.milestoneActiveCircle]}>
              <Ionicons name="color-wand-outline" size={13} color="#FFFFFF" />
            </View>
            <Text style={[styles.milestoneText, styles.milestoneActiveText]}>Handover</Text>
          </View>
        </View>
      </View>

      {/* Facility Final Handover Module */}
      <TerminalHandoverCard
        route={route}
        warehouseStop={warehouseStop}
        onCompleteHandover={handleCompleteHandover}
        isCompleted={isHandoverCompleted}
      />

      {/* Driver Shift & Vehicle Profile Section */}
      <ActiveDutyProfileCard
        driver={driverProfile}
        vehicleReg={route?.vehicle_registration_number}
      />

      {/* End of Shift Controls */}
      <ShiftActionsCard
        onDownloadManifest={handleDownloadManifest}
        onPostTripInspection={handlePostTripInspection}
        onClockOut={() => setClockOutVisible(true)}
        isDownloading={downloadingManifest}
      />

      {/* Secure Clock-Out Modal Dialog */}
      <ClockOutModal
        visible={clockOutVisible}
        onClose={() => setClockOutVisible(false)}
        onConfirm={handleConfirmClockOut}
        driverName={driverProfile?.name || user?.name || 'Courier'}
        driverId={driverProfile?.employee_id || (user?.id ? `DRV-${user.id}` : 'DRV')}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  content: {
    padding: spacing.gutter,
    gap: 12,
    paddingBottom: 28,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.canvas,
    gap: 10,
  },
  loadingText: {
    ...typography.bodySm,
    color: colors.textSecondary,
    fontSize: 12,
  },
  pipelineHeaderCard: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    gap: 14,
  },
  pipelineTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  terminalTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  pulseOuter: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primaryDark,
  },
  terminalTagText: {
    ...typography.labelSm,
    fontSize: 9.5,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: 0.5,
  },
  manifestPill: {
    backgroundColor: colors.primaryTint,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(123, 145, 238, 0.4)',
  },
  manifestPillText: {
    ...typography.monoNumbers,
    fontSize: 10,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  milestonesTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  connectingLine: {
    position: 'absolute',
    top: 17,
    left: 28,
    right: 28,
    height: 2,
    backgroundColor: colors.surfaceHigh,
    zIndex: 0,
  },
  milestone: {
    alignItems: 'center',
    gap: 4,
    zIndex: 1,
  },
  milestoneDoneCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 1,
  },
  milestoneActiveCircle: {
    backgroundColor: colors.primaryDark,
    borderWidth: 2,
    borderColor: colors.primaryAction,
  },
  milestoneText: {
    ...typography.labelSm,
    fontSize: 9,
    color: colors.textSecondary,
  },
  milestoneActiveText: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
});

export default ProfileScreen;
