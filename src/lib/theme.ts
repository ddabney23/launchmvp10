/**
 * Theme Configuration
 * Centralized theme settings for Optimix
 */

import { brandColors, gradients } from './brand-colors';

export const themeConfig = {
  colors: {
    brand: brandColors,
    gradients,
  },

  fonts: {
    sans: 'Inter, system-ui, -apple-system, sans-serif',
    mono: 'Fira Code, Consolas, Monaco, monospace',
    display: 'Inter, system-ui, sans-serif',
  },

  borderRadius: {
    sm: '0.25rem',    // 4px
    DEFAULT: '0.5rem', // 8px
    md: '0.75rem',    // 12px
    lg: '1rem',       // 16px
    xl: '1.5rem',     // 24px
    '2xl': '2rem',    // 32px
    full: '9999px',
  },

  shadows: {
    card: '0 2px 8px hsl(240 10% 15% / 0.05)',
    cardHover: '0 4px 16px hsl(240 10% 15% / 0.1)',
    primary: '0 8px 24px hsl(14 100% 63% / 0.25)',
    secondary: '0 8px 24px hsl(186 100% 50% / 0.25)',
    xl: '0 20px 40px hsl(240 10% 15% / 0.15)',
  },

  spacing: {
    xs: '0.25rem',   // 4px
    sm: '0.5rem',    // 8px
    md: '1rem',      // 16px
    lg: '1.5rem',    // 24px
    xl: '2rem',      // 32px
    '2xl': '3rem',   // 48px
    '3xl': '4rem',   // 64px
    '4xl': '6rem',   // 96px
  },

  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },

  transitions: {
    fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    DEFAULT: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
    bounce: '500ms cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },

  zIndex: {
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modalBackdrop: 1040,
    modal: 1050,
    popover: 1060,
    tooltip: 1070,
  },
} as const;

/**
 * Dark mode color adjustments
 */
export const darkModeAdjustments = {
  background: 'hsl(240, 10%, 8%)',
  foreground: 'hsl(0, 0%, 98%)',
  card: 'hsl(240, 10%, 12%)',
  muted: 'hsl(240, 8%, 20%)',
  mutedForeground: 'hsl(240, 5%, 65%)',
  border: 'hsl(240, 8%, 20%)',
  input: 'hsl(240, 8%, 20%)',
  
  shadows: {
    card: '0 2px 8px hsl(0 0% 0% / 0.3)',
    cardHover: '0 4px 16px hsl(0 0% 0% / 0.5)',
    primary: '0 8px 24px hsl(14 100% 63% / 0.4)',
    secondary: '0 8px 24px hsl(186 100% 50% / 0.4)',
  },
} as const;

/**
 * Get theme value by path
 * Usage: getThemeValue('colors.brand.primary.500')
 */
export function getThemeValue(path: string): string | number | undefined {
  return path.split('.').reduce((obj: any, key) => obj?.[key], themeConfig);
}

/**
 * Apply theme to an element
 */
export function applyTheme(element: HTMLElement, isDark: boolean = false) {
  const root = element.style;
  
  // Apply color variables
  Object.entries(brandColors).forEach(([colorName, colorShades]) => {
    if (typeof colorShades === 'object') {
      Object.entries(colorShades).forEach(([shade, value]) => {
        const varName = shade === 'DEFAULT' 
          ? `--color-${colorName}` 
          : `--color-${colorName}-${shade}`;
        root.setProperty(varName, value);
      });
    }
  });

  // Apply dark mode adjustments
  if (isDark) {
    Object.entries(darkModeAdjustments).forEach(([key, value]) => {
      if (typeof value === 'string') {
        root.setProperty(`--${key}`, value);
      }
    });
  }
}

export default themeConfig;

