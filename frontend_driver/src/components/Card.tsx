import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { Colors, Radius, Spacing, Shadows } from '@/constants/theme';

interface CardProps extends ViewProps {
  accentColor?: string;
  variant?: 'white' | 'info' | 'neutral';
}

export function Card({ style, children, accentColor, variant = 'white', ...props }: CardProps) {
  const variantBg =
    variant === 'info'
      ? Colors.infoSurface
      : variant === 'neutral'
      ? Colors.separatorSubtle
      : Colors.card;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: variantBg },
        accentColor ? { borderLeftWidth: 4, borderLeftColor: accentColor } : null,
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.lg,
    ...Shadows.card,
  },
});
