// Pharmatrix Brand Color Palette - Modern Minimalist Design Tokens

export const Brand = {
  dark: '#201E1C',
  background: '#FDFBF8',
  surface: '#FFFFFF',
  primary: '#7B91EE',
  primaryLight: '#E5EBFF',
  primaryDark: '#201E1C',
  infoSurface: '#E5EBFF',
  separator: '#EADFD0',
  separatorSubtle: '#EADFD0',
};

export const Semantic = {
  success: '#15803D',
  successLight: '#DCFCE7',
  successBorder: '#86EFAC',
  warning: '#D97706',
  warningLight: '#FEF3C7',
  warningBorder: '#FCD34D',
  error: '#DC2626',
  errorLight: '#FEE2E2',
  errorBorder: '#FCA5A5',
  info: '#2563EB',
  infoLight: '#E5EBFF',
};

export const Colors = {
  black: '#000000',
  white: '#FFFFFF',
  brandDark: Brand.dark,
  background: Brand.background,
  surface: Brand.surface,
  card: Brand.surface,
  cardBorder: Brand.separator,
  cardBorderSubtle: Brand.separatorSubtle,
  primary: Brand.primary,
  primaryDark: Brand.primaryDark,
  primaryLight: Brand.primaryLight,
  infoSurface: Brand.infoSurface,
  surfaceAlt: Brand.infoSurface,
  separator: Brand.separator,
  separatorSubtle: Brand.separatorSubtle,

  textPrimary: Brand.dark,
  textSecondary: '#57534E',
  textMuted: '#A8A29E',
  textInverse: '#FFFFFF',

  status: {
    pending: Semantic.warning,
    arrived: Brand.primary,
    inProgress: '#2563EB',
    completed: Semantic.success,
    failed: Semantic.error,
    cancelled: '#78716C',
  },

  statusBg: {
    pending: Semantic.warningLight,
    arrived: Brand.infoSurface,
    inProgress: '#DBEAFE',
    completed: Semantic.successLight,
    failed: Semantic.errorLight,
    cancelled: '#F5F5F4',
  },
};

export const Typography = {
  fontFamily: 'System',
  sizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 18,
    xl: 22,
    xxl: 28,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    black: '800' as const,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const Shadows = {
  subtle: {
    shadowColor: '#201E1C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  card: {
    shadowColor: '#201E1C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  button: {
    shadowColor: Brand.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
};
