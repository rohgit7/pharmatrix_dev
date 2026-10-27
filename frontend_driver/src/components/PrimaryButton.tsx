import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
} from 'react-native';
import { Colors, Radius, Spacing, Typography, Shadows } from '@/constants/theme';

interface PrimaryButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  loading?: boolean;
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
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
    if (disabled) return '#F5F5F4';
    if (isPrimary) return Colors.primary;
    if (isSecondary) return Colors.infoSurface;
    if (isDanger) return '#DC2626';
    if (isOutline) return 'transparent';
    return Colors.primary;
  };

  const getTextColor = () => {
    if (disabled) return '#A8A29E';
    if (isPrimary || isDanger) return '#FFFFFF';
    if (isSecondary || isOutline) return Colors.primaryDark;
    return '#FFFFFF';
  };

  const getBorderColor = () => {
    if (disabled) return '#E7DFD5';
    if (isOutline) return Colors.primary;
    if (isSecondary) return '#BFDBFE';
    if (isDanger) return '#DC2626';
    return Colors.primary;
  };

  const height = size === 'lg' ? 52 : size === 'md' ? 44 : 36;
  const fontSize = size === 'sm' ? Typography.sizes.sm : Typography.sizes.md;

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      disabled={disabled || loading}
      style={[
        styles.button,
        {
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
          height,
        },
        isPrimary && !disabled ? Shadows.button : null,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <View style={styles.content}>
          {icon ? <View style={styles.iconContainer}>{icon}</View> : null}
          <Text style={[styles.text, { color: getTextColor(), fontSize }]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: Radius.md,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
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
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.5,
  },
});
