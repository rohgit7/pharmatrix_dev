import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View, ViewStyle, TextStyle } from 'react-native';
import { colors, radii, typography } from '../../theme';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  subtitle?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'authority';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  title,
  onPress,
  loading = false,
  disabled = false,
  icon,
  rightIcon,
  subtitle,
  variant = 'primary',
  style,
  textStyle,
}) => {
  const getContainerStyle = () => {
    switch (variant) {
      case 'secondary':
        return styles.secondaryContainer;
      case 'danger':
        return styles.dangerContainer;
      case 'authority':
        return styles.authorityContainer;
      case 'primary':
      default:
        return styles.primaryContainer;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'secondary':
        return styles.secondaryText;
      case 'danger':
        return styles.dangerText;
      case 'authority':
        return styles.authorityText;
      case 'primary':
      default:
        return styles.primaryText;
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.base,
        getContainerStyle(),
        (disabled || loading) && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'secondary' ? colors.primary : '#FFFFFF'}
          size="small"
        />
      ) : (
        <View style={styles.inner}>
          <View style={styles.titleRow}>
            {icon && <View style={styles.iconWrap}>{icon}</View>}
            <Text style={[styles.text, getTextStyle(), textStyle]}>{title}</Text>
            {rightIcon && <View style={styles.rightIconWrap}>{rightIcon}</View>}
          </View>
          {subtitle ? <Text style={styles.subtitleText}>{subtitle}</Text> : null}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: radii.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryContainer: {
    backgroundColor: colors.primaryAccent,
    shadowColor: colors.primaryAccent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  authorityContainer: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  secondaryContainer: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  dangerContainer: {
    backgroundColor: colors.errorContainer,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
  },
  disabled: {
    opacity: 0.5,
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  iconWrap: {
    marginRight: 2,
  },
  rightIconWrap: {
    marginLeft: 2,
  },
  text: {
    ...typography.labelLg,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  primaryText: {
    color: '#FFFFFF',
  },
  authorityText: {
    color: '#FFFFFF',
  },
  secondaryText: {
    color: colors.primary,
  },
  dangerText: {
    color: colors.onErrorContainer,
  },
  subtitleText: {
    ...typography.bodySm,
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
    textAlign: 'center',
  },
});

export default PrimaryButton;
