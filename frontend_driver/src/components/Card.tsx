import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';

interface CardProps extends ViewProps {
  accentColor?: string;
}

export function Card({ style, children, accentColor, ...props }: CardProps) {
  return (
    <View
      style={[
        styles.card,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
});
