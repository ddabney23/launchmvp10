/**
 * Optimix Brand Colors
 * Centralized color definitions for consistent branding
 */

export const brandColors = {
  // Primary: Vibrant coral-orange
  primary: {
    DEFAULT: 'hsl(14, 100%, 63%)', // #FF7A59
    50: 'hsl(14, 100%, 97%)',
    100: 'hsl(14, 100%, 92%)',
    200: 'hsl(14, 100%, 85%)',
    300: 'hsl(14, 100%, 75%)',
    400: 'hsl(14, 100%, 68%)',
    500: 'hsl(14, 100%, 63%)', // DEFAULT
    600: 'hsl(14, 90%, 55%)',
    700: 'hsl(14, 80%, 48%)',
    800: 'hsl(14, 75%, 40%)',
    900: 'hsl(14, 70%, 32%)',
  },

  // Secondary: Vibrant teal
  secondary: {
    DEFAULT: 'hsl(186, 100%, 50%)', // #00D9FF
    50: 'hsl(186, 100%, 97%)',
    100: 'hsl(186, 100%, 90%)',
    200: 'hsl(186, 100%, 80%)',
    300: 'hsl(186, 100%, 70%)',
    400: 'hsl(186, 100%, 60%)',
    500: 'hsl(186, 100%, 50%)', // DEFAULT
    600: 'hsl(186, 90%, 45%)',
    700: 'hsl(186, 80%, 38%)',
    800: 'hsl(186, 75%, 30%)',
    900: 'hsl(186, 70%, 22%)',
  },

  // Accent: Warm coral
  accent: {
    DEFAULT: 'hsl(11, 100%, 70%)', // #FF9980
    50: 'hsl(11, 100%, 97%)',
    100: 'hsl(11, 100%, 92%)',
    200: 'hsl(11, 100%, 85%)',
    300: 'hsl(11, 100%, 77%)',
    400: 'hsl(11, 100%, 73%)',
    500: 'hsl(11, 100%, 70%)', // DEFAULT
    600: 'hsl(11, 90%, 62%)',
    700: 'hsl(11, 80%, 54%)',
    800: 'hsl(11, 75%, 45%)',
    900: 'hsl(11, 70%, 36%)',
  },

  // Success: Green
  success: {
    DEFAULT: 'hsl(142, 76%, 36%)',
    50: 'hsl(142, 76%, 97%)',
    100: 'hsl(142, 76%, 92%)',
    200: 'hsl(142, 76%, 80%)',
    300: 'hsl(142, 76%, 65%)',
    400: 'hsl(142, 76%, 50%)',
    500: 'hsl(142, 76%, 36%)', // DEFAULT
    600: 'hsl(142, 76%, 30%)',
    700: 'hsl(142, 76%, 24%)',
    800: 'hsl(142, 76%, 18%)',
    900: 'hsl(142, 76%, 12%)',
  },

  // Warning: Amber
  warning: {
    DEFAULT: 'hsl(38, 92%, 50%)',
    50: 'hsl(38, 92%, 97%)',
    100: 'hsl(38, 92%, 92%)',
    200: 'hsl(38, 92%, 82%)',
    300: 'hsl(38, 92%, 70%)',
    400: 'hsl(38, 92%, 60%)',
    500: 'hsl(38, 92%, 50%)', // DEFAULT
    600: 'hsl(38, 92%, 42%)',
    700: 'hsl(38, 92%, 34%)',
    800: 'hsl(38, 92%, 26%)',
    900: 'hsl(38, 92%, 18%)',
  },

  // Destructive: Red
  destructive: {
    DEFAULT: 'hsl(0, 84.2%, 60.2%)',
    50: 'hsl(0, 84.2%, 97%)',
    100: 'hsl(0, 84.2%, 92%)',
    200: 'hsl(0, 84.2%, 82%)',
    300: 'hsl(0, 84.2%, 72%)',
    400: 'hsl(0, 84.2%, 66%)',
    500: 'hsl(0, 84.2%, 60.2%)', // DEFAULT
    600: 'hsl(0, 84.2%, 52%)',
    700: 'hsl(0, 72%, 44%)',
    800: 'hsl(0, 65%, 36%)',
    900: 'hsl(0, 60%, 28%)',
  },
} as const;

export const gradients = {
  primary: 'linear-gradient(135deg, hsl(11, 100%, 70%), hsl(14, 100%, 63%))',
  secondary: 'linear-gradient(135deg, hsl(186, 100%, 50%), hsl(200, 100%, 60%))',
  hero: 'linear-gradient(135deg, hsl(14, 100%, 63%) 0%, hsl(186, 100%, 50%) 100%)',
  sunset: 'linear-gradient(135deg, hsl(14, 100%, 63%), hsl(11, 100%, 70%), hsl(38, 92%, 50%))',
  ocean: 'linear-gradient(135deg, hsl(186, 100%, 50%), hsl(200, 100%, 60%), hsl(220, 90%, 56%))',
} as const;

/**
 * Get a color value with optional opacity
 */
export function getColor(color: string, opacity?: number): string {
  if (opacity !== undefined && opacity >= 0 && opacity <= 1) {
    // Convert HSL to HSLA with opacity
    return color.replace('hsl(', 'hsla(').replace(')', `, ${opacity})`);
  }
  return color;
}

/**
 * Generate color variants programmatically
 */
export function generateColorVariants(baseHue: number, baseSaturation: number = 100) {
  return {
    50: `hsl(${baseHue}, ${baseSaturation}%, 97%)`,
    100: `hsl(${baseHue}, ${baseSaturation}%, 92%)`,
    200: `hsl(${baseHue}, ${baseSaturation}%, 85%)`,
    300: `hsl(${baseHue}, ${baseSaturation}%, 75%)`,
    400: `hsl(${baseHue}, ${baseSaturation}%, 65%)`,
    500: `hsl(${baseHue}, ${baseSaturation}%, 55%)`,
    600: `hsl(${baseHue}, ${Math.max(baseSaturation - 10, 70)}%, 48%)`,
    700: `hsl(${baseHue}, ${Math.max(baseSaturation - 20, 60)}%, 40%)`,
    800: `hsl(${baseHue}, ${Math.max(baseSaturation - 25, 55)}%, 32%)`,
    900: `hsl(${baseHue}, ${Math.max(baseSaturation - 30, 50)}%, 24%)`,
  };
}

export default brandColors;

