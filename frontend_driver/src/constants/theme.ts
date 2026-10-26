// Pharmatrix Brand Color Palette
// Synchronized with frontend_admin design system:
// Forest, Charcoal, Periwinkle, Ice, Ivory, Amber

export const Forest = {
  50: '#F0FDF4',
  100: '#DCFCE7',
  200: '#BBF7D0',
  300: '#86EFAC',
  400: '#4ADE80',
  500: '#22C55E',
  600: '#16A34A',
  700: '#15803D',
  800: '#166534',
  900: '#14532D',
  950: '#052E16',
};

export const Charcoal = {
  DEFAULT: '#292621',
  950: '#151411',
  900: '#1F1D1A',
  800: '#292621',
  700: '#3D3933',
  600: '#5A544B',
  500: '#7B7468',
  400: '#9E9688',
  300: '#C2BBB0',
  200: '#E4DFD7',
  100: '#F2EFEB',
  50: '#F9F8F6',
};

export const Periwinkle = {
  DEFAULT: '#7690EF',
  50: '#F3F6FE',
  100: '#E5ECFD',
  200: '#CDDCFC',
  300: '#B4C7F2',
  400: '#95AFF5',
  500: '#7690EF',
  600: '#5672D8',
  700: '#3F59BE',
  800: '#2E449D',
  900: '#23347C',
};

export const Ice = {
  DEFAULT: '#B4C7F2',
  50: '#F6F9FE',
  100: '#EDF3FD',
  200: '#DBE6FB',
  300: '#B4C7F2',
  400: '#8DA7E6',
};

export const Ivory = {
  DEFAULT: '#F5EDE2',
  50: '#FDFCF9',
  100: '#FAF5EE',
  200: '#F5EDE2',
  300: '#EAE0D2',
  400: '#D9CBB7',
  500: '#BFAD94',
};

export const Amber = {
  DEFAULT: '#F4AC45',
  50: '#FEF8EE',
  100: '#FDF0DA',
  200: '#FCE0B3',
  300: '#FACB81',
  400: '#F4AC45',
  500: '#E29323',
  600: '#C27613',
  700: '#9C5B11',
};

export const Colors = {
  // frontend_admin Palette Scales
  palette: {
    forest: Forest,
    charcoal: Charcoal,
    periwinkle: Periwinkle,
    ice: Ice,
    ivory: Ivory,
    amber: Amber,
  },
  forest: Forest,
  charcoal: Charcoal,
  periwinkle: '#7690EF',
  periwinkleScale: Periwinkle,
  ice: '#B4C7F2',
  iceScale: Ice,
  ivory: '#F5EDE2',
  ivoryScale: Ivory,
  amber: '#F4AC45',
  amberDark: '#C27613',
  amberLight: 'rgba(244, 172, 69, 0.15)',
  amberScale: Amber,

  // Core Brand Tokens (mapped to frontend_admin palette)
  black: '#000000',
  white: '#FFFFFF',
  primary: '#7690EF',          // periwinkle.DEFAULT
  primaryDark: '#5672D8',      // periwinkle.600
  primaryLight: 'rgba(118, 144, 239, 0.15)',

  // Legacy mappings aliased to frontend_admin Charcoal scale for seamless compatibility:
  navy: '#1F1D1A',             // charcoal.900 (Surface)
  navyDark: '#151411',         // charcoal.950 (Deep backdrop)
  navyCard: '#292621',         // charcoal.800 (Card elevation)
  navyLight: '#3D3933',        // charcoal.700 (Border / subtle alt)
  platinum: '#F5EDE2',         // ivory.200
  platinumMuted: '#9E9688',    // charcoal.400

  // Functional Semantic Tokens
  background: '#151411',       // charcoal.950 (warm dark theme)
  surface: '#1F1D1A',          // charcoal.900
  surfaceAlt: '#292621',       // charcoal.800
  card: '#1F1D1A',             // charcoal.900
  cardBorder: '#3D3933',       // charcoal.700
  cardBorderSubtle: '#292621', // charcoal.800
  inputBackground: '#151411',  // charcoal.950
  inputBorder: '#3D3933',      // charcoal.700
  textPrimary: '#FDFCF9',      // ivory.50
  textSecondary: '#C2BBB0',    // charcoal.300
  textMuted: '#9E9688',        // charcoal.400
  textInverse: '#151411',      // charcoal.950

  // Status Indicators
  status: {
    pending: '#F4AC45',        // Amber
    arrived: '#7690EF',        // Periwinkle
    inProgress: '#B4C7F2',     // Ice
    completed: '#22C55E',      // Forest 500
    failed: '#EF4444',         // Red
    cancelled: '#7B7468',      // Charcoal 500
  },

  // Priority Colors
  priority: {
    normal: '#22C55E',         // Forest 500
    high: '#F4AC45',           // Amber 400
    urgent: '#EF4444',
  },

  // Stop Type Badges
  stopType: {
    pickup: '#F4AC45',         // Amber
    warehouse: '#7690EF',      // Periwinkle
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
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
};
