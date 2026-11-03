import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, radii, spacing, shadows } from '../../theme';

interface CardProps {
  children: React.ReactNode;
  active?: boolean;
  style?: ViewStyle;
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, active, style, noPadding = false }) => {
  return (
    <View
      style={[
        styles.card,
        active && styles.activeCard,
        noPadding && { padding: 0 },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.secondary,
    padding: spacing.md,
    ...shadows.subtle,
    overflow: 'hidden',
  },
  activeCard: {
    borderColor: colors.primaryAccent,
    borderWidth: 1.5,
  },
});

export default Card;
