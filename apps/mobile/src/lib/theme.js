import { Appearance } from 'react-native';

const lightColors = {
  bg: '#f6f1e8',
  panel: '#fffdf9',
  panelAlt: '#fff6ea',
  text: '#14171a',
  muted: '#5f5d58',
  line: 'rgba(20,23,26,0.12)',
  accent: '#33c7c4',
  accent2: '#f7b24c',
  accent3: '#f15b7a',
  success: '#16a34a',
  warning: '#d97706',
  danger: '#dc2626',
  card: '#ffffff',
  chip: '#fff6ea'
};

const darkColors = {
  bg: '#0f1117',
  panel: '#171a22',
  panelAlt: '#1f2430',
  text: '#f5f7ff',
  muted: '#9aa3b2',
  line: 'rgba(255,255,255,0.08)',
  accent: '#33c7c4',
  accent2: '#f7b24c',
  accent3: '#f15b7a',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  card: '#151823',
  chip: '#262b39'
};

const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999
};

const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 30
};

const shadow = {
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6
  }
};

const buildTheme = (colors) => ({
  colors,
  radius,
  spacing,
  shadow,
  textStyles: {
    h1: { fontSize: 28, fontWeight: '800', color: colors.text },
    h2: { fontSize: 20, fontWeight: '700', color: colors.text },
    body: { fontSize: 15, color: colors.text },
    muted: { fontSize: 13, color: colors.muted }
  }
});

export const themes = {
  light: buildTheme(lightColors),
  dark: buildTheme(darkColors)
};

const systemMode = Appearance.getColorScheme() === 'light' ? 'light' : 'dark';
const theme = themes[systemMode];

export const colors = theme.colors;
export { radius, spacing, shadow };
export const textStyles = theme.textStyles;
