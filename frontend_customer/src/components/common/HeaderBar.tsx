import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ArrowLeft, ShieldCheck, Plus } from 'lucide-react-native';
import { colors, spacing, borderRadius } from '../../theme';

interface HeaderBarProps {
  title: string;
  subtitle?: string;
  customerCode?: string;
  customerType?: string;
  onBack?: () => void;
  onRequestPickup?: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  title,
  subtitle,
  customerCode,
  onBack,
  onRequestPickup,
}) => {
  return (
    <View style={styles.header}>
      <View style={styles.leftRow}>
        {onBack ? (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onBack}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.brandMark}>
            <ShieldCheck size={19} color={colors.textInverse} />
          </View>
        )}
        <View style={styles.titleBlock}>
          <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1} ellipsizeMode="tail">
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      {onRequestPickup ? (
        <TouchableOpacity
          style={styles.quickActionBtn}
          onPress={onRequestPickup}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Request new pickup"
        >
          <Plus size={15} color={colors.textInverse} />
          <Text style={styles.quickActionText} numberOfLines={1}>
            Request
          </Text>
        </TouchableOpacity>
      ) : customerCode && !onBack ? (
        <View style={styles.codePill}>
          <Text style={styles.codeText} numberOfLines={1}>
            {customerCode}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 60,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexShrink: 1,
    marginRight: spacing.sm,
  },
  brandMark: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    flexShrink: 0,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    flexShrink: 0,
  },
  titleBlock: {
    flex: 1,
    flexShrink: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  codePill: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.pill,
    flexShrink: 0,
  },
  codeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.4,
  },
  quickActionBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
    gap: 5,
    flexShrink: 0,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textInverse,
  },
});
