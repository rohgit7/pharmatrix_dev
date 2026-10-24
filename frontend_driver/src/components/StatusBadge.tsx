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
          bg: 'rgba(16, 185, 129, 0.15)',
          border: '#10B981',
          text: '#34D399',
          label: 'Completed',
        };
      case 'IN_PROGRESS':
        return {
          bg: 'rgba(59, 130, 246, 0.15)',
          border: '#3B82F6',
          text: '#60A5FA',
          label: 'In Progress',
        };
      case 'ARRIVED':
        return {
          bg: 'rgba(99, 102, 241, 0.15)',
          border: '#6366F1',
          text: '#818CF8',
          label: 'Arrived',
        };
      case 'PENDING':
      case 'ASSIGNED':
      case 'READY':
        return {
          bg: 'rgba(252, 163, 17, 0.15)',
          border: '#FCA311',
          text: '#FBBF24',
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
          bg: 'rgba(156, 163, 175, 0.15)',
          border: '#6B7280',
          text: '#D1D5DB',
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
