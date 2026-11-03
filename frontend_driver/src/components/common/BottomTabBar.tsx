import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radii } from '../../theme';

export type TabName = 'operations' | 'routes' | 'pickups' | 'profile';

interface BottomTabBarProps {
  currentTab: TabName;
  onTabChange: (tab: TabName) => void;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({ currentTab, onTabChange }) => {
  const insets = useSafeAreaInsets();

  const tabs: Array<{ id: TabName; label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }> = [
    { id: 'operations', label: 'Operations', icon: 'grid-outline', activeIcon: 'grid' },
    { id: 'routes', label: 'Routes', icon: 'map-outline', activeIcon: 'map' },
    { id: 'pickups', label: 'Pickups', icon: 'cube-outline', activeIcon: 'cube' },
    { id: 'profile', label: 'Profile', icon: 'person-circle-outline', activeIcon: 'person-circle' },
  ];

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 6) }]}>
      <View style={styles.content}>
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabBtn, isActive && styles.activeTabBtn]}
              onPress={() => onTabChange(tab.id)}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              <Ionicons
                name={isActive ? tab.activeIcon : tab.icon}
                size={20}
                color={isActive ? colors.primary : colors.textMuted}
              />
              <Text style={[styles.tabLabel, isActive && styles.activeTabLabel]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.secondary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 4,
  },
  content: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.sm,
  },
  tabBtn: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    marginHorizontal: 4,
    gap: 3,
  },
  activeTabBtn: {
    backgroundColor: colors.lightAccent,
  },
  tabLabel: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '500',
  },
  activeTabLabel: {
    color: colors.primary,
    fontWeight: '700',
  },
});

export default BottomTabBar;
