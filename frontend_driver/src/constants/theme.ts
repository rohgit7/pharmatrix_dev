// Pharmatrix Brand Color Palette
// Source palette: #000000, #14213D, #FCA311, #E5E5E5, #FFFFFF

export const Colors = {
  // Core Brand Tokens
  black: '#000000',
  navy: '#14213D',         // Deep Primary Brand Navy
  navyDark: '#0E172B',     // Deepest backdrop
  navyCard: '#1C2E52',     // Elevated card background
  navyLight: '#263C68',    // Border / Hover / Card alt
  amber: '#FCA311',        // Vibrant Brand Accent / Safety Gold
  amberDark: '#D48606',    // Amber pressed / dark
  amberLight: 'rgba(252, 163, 17, 0.15)', // Amber subtle badge background
  platinum: '#E5E5E5',     // Surface Light / Neutral divider
  platinumMuted: '#9BA3AF',// Secondary label / muted text
  white: '#FFFFFF',        // High-contrast text / cards

  // Functional Semantic Tokens
  background: '#0B111E',   // Outdoor high-contrast dark theme
  surface: '#14213D',
  surfaceAlt: '#1B2C4D',
  card: '#182744',
  cardBorder: '#273D68',
  textPrimary: '#FFFFFF',
  textSecondary: '#D1D5DB',
  textMuted: '#9CA3AF',
  textInverse: '#14213D',

  // Status Indicators
  status: {
    pending: '#FCA311',      // Amber
    arrived: '#3B82F6',      // Blue
    inProgress: '#60A5FA',   // Light blue
    completed: '#10B981',    // Emerald Green
    failed: '#EF4444',       // Crimson Red
    cancelled: '#6B7280',    // Gray
  },

  // Priority Colors
  priority: {
    normal: '#10B981',
    high: '#F59E0B',
    urgent: '#EF4444',
  },

  // Stop Type Badges
  stopType: {
    pickup: '#FCA311',
    warehouse: '#3B82F6',
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
