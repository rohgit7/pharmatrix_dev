import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { RouteStatus, RouteStopStatus } from '@/types/api';

interface StatusBadgeProps {
  status: RouteStatus | RouteStopStatus | string;
  size?: 'sm' | 'md' | 'lg';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'COMPLETED':
      case 'COLLECTED':
        return {
          bg: 'rgba(34, 197, 94, 0.15)',
          border: Colors.forest[500],
          text: Colors.forest[400],
          label: 'Completed',
        };
      case 'IN_PROGRESS':
        return {
          bg: 'rgba(180, 199, 242, 0.15)',
          border: Colors.primary,
          text: Colors.ice,
          label: 'In Progress',
        };
      case 'ARRIVED':
        return {
          bg: 'rgba(118, 144, 239, 0.15)',
          border: Colors.primary,
          text: Colors.palette.periwinkle[200],
          label: 'Arrived',
        };
      case 'PENDING':
      case 'ASSIGNED':
      case 'READY':
        return {
          bg: 'rgba(244, 172, 69, 0.15)',
          border: Colors.amber,
          text: Colors.palette.amber[300],
          label: status === 'ASSIGNED' ? 'Assigned' : 'Pending',
        };
      case 'FAILED':
      case 'CANCELLED':
      case 'REJECTED':
        return {
          bg: 'rgba(239, 68, 68, 0.15)',
          border: '#EF4444',
          text: '#F87171',
          label: status === 'FAILED' ? 'Failed' : 'Cancelled',
        };
      default:
        return {
          bg: 'rgba(90, 84, 75, 0.15)',
          border: Colors.charcoal[600],
          text: Colors.charcoal[300],
          label: status,
        };
    }
  };

  const config = getStatusConfig();
  const isSmall = size === 'sm';
  const isLarge = size === 'lg';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: config.bg,
          borderColor: config.border,
          paddingVertical: isSmall ? 2 : isLarge ? 6 : 4,
          paddingHorizontal: isSmall ? 8 : isLarge ? 14 : 10,
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: config.border }]} />
      <Text
        style={[
          styles.text,
          {
            color: config.text,
            fontSize: isSmall ? Typography.sizes.xs : isLarge ? Typography.sizes.md : Typography.sizes.sm,
          },
        ]}
      >
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  text: {
    fontWeight: Typography.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
