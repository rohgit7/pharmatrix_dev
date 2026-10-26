import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
} from 'react-native';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';

interface PrimaryButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  loading?: boolean;
  icon?: React.ReactNode;
  size?: 'md' | 'lg';
}

export function PrimaryButton({
  title,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  size = 'lg',
  style,
  ...props
}: PrimaryButtonProps) {
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const isDanger = variant === 'danger';
  const isOutline = variant === 'outline';

  const getBackgroundColor = () => {
    if (disabled) return Colors.charcoal[800];
    if (isPrimary) return Colors.primary;
    if (isSecondary) return Colors.charcoal[800];
    if (isDanger) return '#DC2626';
    if (isOutline) return 'transparent';
    return Colors.primary;
  };

  const getTextColor = () => {
    if (disabled) return Colors.charcoal[500];
    if (isPrimary) return Colors.charcoal[950];
    if (isDanger || isSecondary) return Colors.white;
    if (isOutline) return Colors.primary;
    return Colors.charcoal[950];
  };

  const getBorderColor = () => {
    if (disabled) return Colors.charcoal[700];
    if (isOutline) return Colors.primary;
    if (isSecondary) return Colors.cardBorder;
    if (isDanger) return '#EF4444';
    return 'transparent';
  };

  const height = size === 'lg' ? 54 : 44;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={disabled || loading}
      style={[
        styles.button,
        {
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
          height,
        },
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <View style={styles.content}>
          {icon ? <View style={styles.iconContainer}>{icon}</View> : null}
          <Text style={[styles.text, { color: getTextColor() }]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginRight: Spacing.sm,
  },
  text: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.3,
  },
});
