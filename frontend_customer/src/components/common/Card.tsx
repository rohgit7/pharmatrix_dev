import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { colors, spacing, borderRadius, shadows } from '../../theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'elevated' | 'accent' | 'secondary' | 'dark' | 'muted';
  padding?: keyof typeof spacing | number;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  variant = 'default',
  padding = 'lg',
}) => {
  const padValue = typeof padding === 'number' ? padding : spacing[padding];

  return (
    <View
      style={[
        styles.base,
        variant === 'elevated' && styles.elevated,
        variant === 'accent' && styles.accent,
        variant === 'secondary' && styles.secondary,
        variant === 'muted' && styles.muted,
        variant === 'dark' && styles.dark,
        { padding: padValue },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  elevated: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    ...shadows.card,
  },
  accent: {
    backgroundColor: colors.lightAccent,
    borderColor: '#C5D1FA',
  },
  secondary: {
    backgroundColor: colors.secondary,
    borderColor: '#DFD1BE',
  },
  muted: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.borderLight,
  },
  dark: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    ...shadows.card,
  },
});
