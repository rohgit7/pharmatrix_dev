import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, radii, typography } from '../../theme';

export type BadgeVariant =
  | 'active'
  | 'queued'
  | 'completed'
  | 'failed'
  | 'warning'
  | 'live'
  | 'neutral';

interface StatusBadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  variant = 'neutral',
  style,
}) => {
  const getBadgeStyles = () => {
    switch (variant) {
      case 'active':
        return {
          container: styles.activeContainer,
          text: styles.activeText,
        };
      case 'live':
        return {
          container: styles.liveContainer,
          text: styles.liveText,
        };
      case 'completed':
        return {
          container: styles.completedContainer,
          text: styles.completedText,
        };
      case 'failed':
        return {
          container: styles.failedContainer,
          text: styles.failedText,
        };
      case 'warning':
        return {
          container: styles.warningContainer,
          text: styles.warningText,
        };
      case 'queued':
        return {
          container: styles.queuedContainer,
          text: styles.queuedText,
        };
      case 'neutral':
      default:
        return {
          container: styles.neutralContainer,
          text: styles.neutralText,
        };
    }
  };

  const badgeStyle = getBadgeStyles();

  return (
    <View style={[styles.badge, badgeStyle.container, style]}>
      {variant === 'live' && <View style={styles.livePulseDot} />}
      <Text style={[styles.text, badgeStyle.text]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    height: 22,
    paddingHorizontal: 8,
    borderRadius: radii.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  text: {
    ...typography.labelSm,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  activeContainer: {
    backgroundColor: colors.lightAccent,
    borderColor: 'rgba(123, 145, 238, 0.3)',
  },
  activeText: {
    color: colors.primary,
  },
  liveContainer: {
    backgroundColor: colors.successContainer,
    borderColor: 'rgba(22, 163, 74, 0.2)',
    gap: 4,
  },
  liveText: {
    color: colors.success,
  },
  livePulseDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.success,
  },
  completedContainer: {
    backgroundColor: colors.successContainer,
    borderColor: 'rgba(22, 163, 74, 0.2)',
  },
  completedText: {
    color: colors.success,
  },
  failedContainer: {
    backgroundColor: colors.errorContainer,
    borderColor: 'rgba(220, 38, 38, 0.2)',
  },
  failedText: {
    color: colors.error,
  },
  warningContainer: {
    backgroundColor: colors.warningContainer,
    borderColor: 'rgba(217, 119, 6, 0.2)',
  },
  warningText: {
    color: colors.warning,
  },
  queuedContainer: {
    backgroundColor: colors.background,
    borderColor: colors.secondary,
  },
  queuedText: {
    color: colors.textSecondary,
  },
  neutralContainer: {
    backgroundColor: colors.background,
    borderColor: colors.secondary,
  },
  neutralText: {
    color: colors.textSecondary,
  },
});

export default StatusBadge;
