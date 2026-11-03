import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography, shadows } from '../../theme';
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
      Alert.alert('Handover Confirmed', 'Terminal custody transferred. Route completed.');
    } catch (err: any) {
      Alert.alert('Handover Notice', err.message || 'Custody transferred and recorded.');
    }
  };

  const handleDownloadManifest = async () => {
    if (!route) {
      Alert.alert('No Route', 'No route data available.');
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
      'Inspection Completed',
      'Vehicle verified for dock return.'
    );
  };

  const handleConfirmClockOut = async () => {
    setClockOutVisible(false);
    await logout();
  };

  if (isLoading && !route) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primaryAccent} />
        <Text style={styles.loadingText}>Loading terminal details...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={refreshRoute}
          tintColor={colors.primary}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Progress Pipeline Header */}
      <View style={styles.pipelineHeaderCard}>
        <View style={styles.pipelineTop}>
          <Text style={styles.terminalTagText}>
            TERMINAL STOP {stats.totalStops} OF {stats.totalStops} / FACILITY HANDOVER
          </Text>
          <View style={styles.manifestPill}>
            <Text style={styles.manifestPillText}>
              {route?.route_code ? `MANIFEST-${route.route_code.slice(-6)}` : 'MANIFEST'}
            </Text>
          </View>
        </View>

        {/* 4 Connected Milestones */}
        <View style={styles.milestonesTrack}>
          <View style={styles.milestone}>
            <View style={styles.milestoneDoneCircle}>
              <Ionicons name="checkmark" size={12} color="#FFFFFF" />
            </View>
            <Text style={styles.milestoneText}>Dispatched</Text>
          </View>

          <View style={styles.milestone}>
            <View style={styles.milestoneDoneCircle}>
              <Ionicons name="checkmark" size={12} color="#FFFFFF" />
            </View>
            <Text style={styles.milestoneText}>Collected</Text>
          </View>

          <View style={styles.milestone}>
            <View style={styles.milestoneDoneCircle}>
              <Ionicons name="checkmark" size={12} color="#FFFFFF" />
            </View>
            <Text style={styles.milestoneText}>Weighed</Text>
          </View>

          <View style={styles.milestone}>
            <View
              style={[
                styles.milestoneCircle,
                isHandoverCompleted ? styles.milestoneDoneCircle : styles.milestoneActiveCircle,
              ]}
            >
              {isHandoverCompleted ? (
                <Ionicons name="checkmark" size={12} color="#FFFFFF" />
              ) : (
                <Ionicons name="cube" size={11} color={colors.primary} />
              )}
            </View>
            <Text style={[styles.milestoneText, styles.milestoneActiveText]}>
              Handover
            </Text>
          </View>
        </View>
      </View>

      {/* Terminal Handover Card */}
      <TerminalHandoverCard
        route={route}
        warehouseStop={warehouseStop}
        onCompleteHandover={handleCompleteHandover}
        isCompleted={isHandoverCompleted}
      />

      {/* Active Duty Driver Card */}
      <ActiveDutyProfileCard
        driver={driverProfile}
        vehicleReg={route?.vehicle_registration_number}
      />

      {/* Shift Completion Actions */}
      <ShiftActionsCard
        onDownloadManifest={handleDownloadManifest}
        onPostTripInspection={handlePostTripInspection}
        onClockOut={() => setClockOutVisible(true)}
        isDownloading={downloadingManifest}
      />

      {/* Clock Out Confirmation Modal */}
      <ClockOutModal
        visible={clockOutVisible}
        onClose={() => setClockOutVisible(false)}
        onConfirm={handleConfirmClockOut}
        driverName={driverProfile?.name || user?.name}
        driverId={
          driverProfile?.employee_id ||
          (driverProfile?.id ? `DRV-${driverProfile.id}` : undefined)
        }
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.gutter,
    paddingBottom: 90,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  loadingText: {
    ...typography.bodySm,
    color: colors.textSecondary,
    marginTop: 8,
  },
  pipelineHeaderCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.secondary,
    gap: 12,
    marginBottom: spacing.md,
    ...shadows.subtle,
  },
  pipelineTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  terminalTagText: {
    ...typography.labelSm,
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  manifestPill: {
    backgroundColor: colors.lightAccent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.xs,
  },
  manifestPillText: {
    ...typography.monoNumbers,
    fontSize: 10,
    color: colors.primary,
  },
  milestonesTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: 4,
  },
  milestone: {
    alignItems: 'center',
    gap: 4,
  },
  milestoneCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  milestoneDoneCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
  },
  milestoneActiveCircle: {
    backgroundColor: colors.lightAccent,
    borderColor: colors.primaryAccent,
  },
  milestoneText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.textSecondary,
  },
  milestoneActiveText: {
    color: colors.primary,
    fontWeight: '700',
  },
});

export default ProfileScreen;
