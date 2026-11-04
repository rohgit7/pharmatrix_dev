import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, borderRadius, formatStatusLabel } from '../../theme';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
}) => {
  const upper = (status || '').toUpperCase().trim();
  const label = formatStatusLabel(upper);

  let bg = colors.secondary;
  let text = colors.textPrimary;

  switch (upper) {
    case 'COLLECTED':
    case 'COMPLETED':
    case 'PAID':
    case 'VERIFIED':
      bg = colors.successBg;
      text = colors.success;
      break;
    case 'IN_PROGRESS':
    case 'ARRIVED':
    case 'ASSIGNED':
    case 'SCHEDULED':
    case 'ACTIVE':
      bg = colors.lightAccent;
      text = colors.info;
      break;
    case 'REQUESTED':
    case 'PENDING':
    case 'ISSUED':
    case 'PARTIALLY_PAID':
    case 'AWAITING_WEIGHING':
      bg = colors.warningBg;
      text = colors.warning;
      break;
    case 'FAILED':
    case 'CANCELLED':
    case 'OVERDUE':
      bg = colors.errorBg;
      text = colors.error;
      break;
    default:
      bg = colors.secondary;
      text = colors.textPrimary;
  }

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: bg },
        size === 'sm' && styles.badgeSm,
      ]}
      accessibilityRole="text"
      accessibilityLabel={`Status: ${label}`}
    >
      <View style={[styles.dot, { backgroundColor: text }]} />
      <Text
        style={[
          styles.text,
          { color: text },
          size === 'sm' && styles.textSm,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.pill,
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  badgeSm: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  textSm: {
    fontSize: 11,
  },
});
