import { Appearance } from 'react-native';

const lightColors = {
  bg: '#f6efe6',
  panel: '#fff8ef',
  panelAlt: '#f2e7d7',
  text: '#1f1a12',
  muted: '#6a6156',
  line: 'rgba(31,26,18,0.12)',
  accent: '#2f6b4f',
  accent2: '#f0a33a',
  accent3: '#d9623a',
  success: '#2e7d32',
  warning: '#c26b21',
  danger: '#c7362a',
  card: '#fff7ed',
  chip: '#f7ebdc'
};

const darkColors = {
  bg: '#0f0d0a',
  panel: '#19150f',
  panelAlt: '#221c14',
  text: '#f8f2e8',
  muted: '#b1a89d',
  line: 'rgba(248,242,232,0.08)',
  accent: '#4f8f66',
  accent2: '#f0a33a',
  accent3: '#e07448',
  success: '#5abf75',
  warning: '#f0a33a',
  danger: '#ef6a5b',
  card: '#17120d',
  chip: '#272018'
};

const radius = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 30,
  pill: 999
};

const spacing = {
  xs: 6,
  sm: 12,
  md: 18,
  lg: 24,
  xl: 32
};

const shadow = {
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 5
  }
};

const buildTheme = (colors) => ({
  colors,
  radius,
  spacing,
  shadow,
  textStyles: {
    h1: { fontSize: 30, fontWeight: '800', color: colors.text },
    h2: { fontSize: 22, fontWeight: '700', color: colors.text },
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
