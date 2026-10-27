import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '../../theme';
import { useAuth } from '../../context/AuthContext';

interface HeaderBarProps {
  title: string;
  showPhoneCall?: boolean;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({ title, showPhoneCall = false }) => {
  const insets = useSafeAreaInsets();
  const { openProfileDrawer, driverProfile } = useAuth();

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 8) }]}>
      <View style={styles.content}>
        {/* Left: Brand Icon + Status & Title */}
        <View style={styles.leftSection}>
          <View style={styles.logoBadge}>
            <Ionicons name="compass" size={20} color="#FFFFFF" />
          </View>
          <View style={styles.titleColumn}>
            <View style={styles.statusRow}>
              <View style={styles.pulseDot} />
              <Text style={styles.statusText}>ONLINE • GPS ACTIVE</Text>
            </View>
            <Text style={styles.titleText} numberOfLines={1}>
              {title}
            </Text>
          </View>
        </View>

        {/* Right: Phone & Avatar Profile Trigger */}
        <View style={styles.rightSection}>
          {showPhoneCall && (
            <TouchableOpacity
              style={styles.phoneButton}
              activeOpacity={0.7}
              onPress={() => {
                if (Platform.OS === 'web') {
                  window.location.href = 'tel:5550198273';
                }
              }}
            >
              <Ionicons name="call" size={17} color={colors.primaryDark} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.avatarButton}
            onPress={openProfileDrawer}
            activeOpacity={0.8}
            accessibilityLabel="Open Driver Profile Menu"
          >
            <View style={styles.avatarContainer}>
              <Ionicons name="person" size={18} color={colors.primaryDark} />
              <View style={styles.avatarOnlineDot} />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(253, 251, 248, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    zIndex: 50,
  },
  content: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.gutter,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  logoBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.primaryAction,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  titleColumn: {
    justifyContent: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primaryAction,
  },
  statusText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.ink,
    letterSpacing: 0.8,
  },
  titleText: {
    ...typography.headlineSm,
    color: colors.ink,
    fontSize: 18,
    fontWeight: '700',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  phoneButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarButton: {
    padding: 2,
  },
  avatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryTint,
    borderWidth: 1.5,
    borderColor: colors.primaryAction,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarOnlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.success,
    borderWidth: 1.5,
    borderColor: colors.card,
  },
});

export default HeaderBar;
