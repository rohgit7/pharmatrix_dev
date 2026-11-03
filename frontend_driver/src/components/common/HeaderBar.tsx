import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radii } from '../../theme';
import { useAuth } from '../../context/AuthContext';

interface HeaderBarProps {
  title: string;
  showPhoneCall?: boolean;
  onPhonePress?: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  title,
  showPhoneCall = false,
  onPhonePress,
}) => {
  const insets = useSafeAreaInsets();
  const { openProfileDrawer, user, driverProfile } = useAuth();

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 8) }]}>
      <View style={styles.content}>
        {/* Left: Brand Icon + Title */}
        <View style={styles.leftSection}>
          <View style={styles.logoBadge}>
            <Ionicons name="cube" size={17} color="#FFFFFF" />
          </View>
          <View style={styles.titleColumn}>
            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>ONLINE  GPS ACTIVE</Text>
            </View>
            <Text style={styles.titleText} numberOfLines={1}>
              {title}
            </Text>
          </View>
        </View>

        {/* Right: Actions */}
        <View style={styles.rightSection}>
          {showPhoneCall && onPhonePress && (
            <TouchableOpacity
              style={styles.phoneButton}
              activeOpacity={0.7}
              onPress={onPhonePress}
              accessibilityLabel="Call Dispatch"
            >
              <Ionicons name="call-outline" size={17} color={colors.primary} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.avatarButton}
            onPress={openProfileDrawer}
            activeOpacity={0.8}
            accessibilityLabel="Driver Profile Menu"
          >
            <View style={styles.avatarContainer}>
              <Ionicons name="person" size={17} color={colors.primary} />
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
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.secondary,
    zIndex: 50,
  },
  content: {
    height: 54,
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
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: colors.primaryAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleColumn: {
    justifyContent: 'center',
    flex: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  statusText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  titleText: {
    ...typography.headlineSm,
    color: colors.primary,
    fontSize: 17,
    fontWeight: '700',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  phoneButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarButton: {
    padding: 2,
  },
  avatarContainer: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarOnlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.success,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
});

export default HeaderBar;
