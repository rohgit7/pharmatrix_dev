import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { AlertCircle, Inbox } from 'lucide-react-native';
import { colors, spacing, borderRadius } from '../../theme';
import { PrimaryButton } from './PrimaryButton';

export const LoadingState: React.FC<{ message?: string }> = ({
  message = 'Loading...',
}) => (
  <View style={styles.loadingWrap}>
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonHeaderRow}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.loadingText}>{message}</Text>
      </View>
      <View style={styles.skeletonBarWide} />
      <View style={styles.skeletonBarMedium} />
    </View>
  </View>
);

export const EmptyState: React.FC<{
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ title, description, actionLabel, onAction }) => (
  <View style={styles.container}>
    <View style={styles.iconCircle}>
      <Inbox size={24} color={colors.textSecondary} />
    </View>
    <Text style={styles.title}>{title}</Text>
    {description ? <Text style={styles.subtitle}>{description}</Text> : null}
    {actionLabel && onAction ? (
      <PrimaryButton
        title={actionLabel}
        onPress={onAction}
        variant="primary"
        size="md"
        style={styles.actionBtn}
      />
    ) : null}
  </View>
);

export const ErrorState: React.FC<{
  message: string;
  onRetry?: () => void;
}> = ({ message, onRetry }) => (
  <View style={styles.container}>
    <View style={[styles.iconCircle, { backgroundColor: colors.errorBg }]}>
      <AlertCircle size={24} color={colors.error} />
    </View>
    <Text style={styles.title}>Could Not Load Data</Text>
    <Text style={styles.subtitle}>{message}</Text>
    {onRetry ? (
      <PrimaryButton
        title="Try Again"
        onPress={onRetry}
        variant="outline"
        size="sm"
        style={styles.actionBtn}
      />
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  loadingWrap: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skeletonCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.md,
  },
  skeletonHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  skeletonBarWide: {
    height: 12,
    width: '85%',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: borderRadius.xs,
  },
  skeletonBarMedium: {
    height: 12,
    width: '55%',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: borderRadius.xs,
  },
  container: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 300,
    lineHeight: 19,
  },
  actionBtn: {
    marginTop: spacing.lg,
  },
});
