import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
  StyleProp,
} from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../theme';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'accent' | 'secondary' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
}) => {
  const isDisabled = disabled || loading;

  const getBgColor = () => {
    if (isDisabled) {
      return variant === 'outline' ? 'transparent' : '#DED8CF';
    }
    switch (variant) {
      case 'primary':
        return colors.primary;
      case 'accent':
        return colors.accent;
      case 'secondary':
        return colors.secondary;
      case 'danger':
        return colors.error;
      case 'outline':
        return colors.surface;
    }
  };

  const getTextColor = () => {
    if (isDisabled) return '#8C857E';
    switch (variant) {
      case 'primary':
      case 'accent':
      case 'danger':
        return colors.textInverse;
      case 'secondary':
      case 'outline':
        return colors.textPrimary;
    }
  };

  const getMinHeight = () => {
    if (size === 'sm') return 40;
    if (size === 'lg') return 52;
    return 46;
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        styles.button,
        {
          backgroundColor: getBgColor(),
          minHeight: getMinHeight(),
          paddingVertical: size === 'sm' ? 8 : size === 'lg' ? 14 : 11,
          borderWidth: variant === 'outline' ? 1 : 0,
          borderColor:
            variant === 'outline'
              ? isDisabled
                ? colors.border
                : colors.primary
              : 'transparent',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={getTextColor()} />
      ) : (
        <View style={styles.content}>
          {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
          <Text
            style={[
              typography.button,
              styles.text,
              {
                color: getTextColor(),
                fontSize: size === 'sm' ? 13 : size === 'lg' ? 15 : 14,
              },
              textStyle,
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 1,
  },
  iconWrap: {
    marginRight: spacing.sm,
    flexShrink: 0,
  },
  text: {
    flexShrink: 1,
    textAlign: 'center',
  },
});
