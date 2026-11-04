import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Home, Package, Clock, User } from 'lucide-react-native';
import { colors, spacing } from '../../theme';

export type CustomerTabKey = 'home' | 'pickups' | 'history' | 'profile';

interface BottomTabBarProps {
  activeTab: CustomerTabKey;
  onSelectTab: (tab: CustomerTabKey) => void;
  activePickupBadge?: number;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  activeTab,
  onSelectTab,
  activePickupBadge = 0,
}) => {
  const tabs: {
    key: CustomerTabKey;
    label: string;
    Icon: React.ComponentType<{ size?: number; color?: string }>;
    badge?: number;
  }[] = [
    { key: 'home', label: 'Home', Icon: Home },
    { key: 'pickups', label: 'My Pickups', Icon: Package, badge: activePickupBadge },
    { key: 'history', label: 'History', Icon: Clock },
    { key: 'profile', label: 'Profile', Icon: User },
  ];

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        const iconColor = isActive ? colors.primary : colors.textMuted;
        const TabIcon = tab.Icon;

        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tabItem}
            onPress={() => onSelectTab(tab.key)}
            activeOpacity={0.75}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
          >
            <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
              <TabIcon size={20} color={iconColor} />
              {tab.badge && tab.badge > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text
              style={[styles.label, isActive && styles.labelActive]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  iconWrap: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 16,
    position: 'relative',
  },
  iconWrapActive: {
    backgroundColor: colors.lightAccent,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textMuted,
    marginTop: 3,
  },
  labelActive: {
    fontWeight: '700',
    color: colors.primary,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: 4,
    backgroundColor: colors.accent,
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textInverse,
  },
});
