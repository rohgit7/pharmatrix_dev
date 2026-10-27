import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Typography } from '@/constants/theme';
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
          bg: '#DCFCE7',
          border: '#16A34A',
          text: '#15803D',
          label: 'Completed',
        };
      case 'IN_PROGRESS':
        return {
          bg: '#DBEAFE',
          border: '#2563EB',
          text: '#1D4ED8',
          label: 'In Progress',
        };
      case 'ARRIVED':
        return {
          bg: '#E5EBFF',
          border: Colors.primary,
          text: Colors.brandDark,
          label: 'Arrived',
        };
      case 'PENDING':
      case 'ASSIGNED':
      case 'READY':
        return {
          bg: '#EADFD0',
          border: '#BBAE9D',
          text: Colors.brandDark,
          label: status === 'ASSIGNED' ? 'Assigned' : 'Pending',
        };
      case 'FAILED':
      case 'CANCELLED':
      case 'REJECTED':
        return {
          bg: '#FEE2E2',
          border: '#DC2626',
          text: '#B91C1C',
          label: status === 'FAILED' ? 'Failed' : 'Cancelled',
        };
      default:
        return {
          bg: '#EADFD0',
          border: '#BBAE9D',
          text: Colors.brandDark,
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
          paddingVertical: isSmall ? 2 : isLarge ? 5 : 3,
          paddingHorizontal: isSmall ? 8 : isLarge ? 12 : 10,
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: config.border }]} />
      <Text
        style={[
          styles.text,
          {
            color: config.text,
            fontSize: isSmall ? 10 : isLarge ? Typography.sizes.sm : 12,
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
    fontWeight: Typography.weights.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
