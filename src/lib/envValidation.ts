/**
 * Environment Variable Validation
 * Validates required environment variables and provides helpful error messages
 */

import { logger } from './logger'

interface EnvConfig {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  NEXT_PUBLIC_STRIPE_PUBLIC_KEY?: string;
  NEXT_PUBLIC_VAPID_PUBLIC_KEY?: string;
  NEXT_PUBLIC_ERROR_TRACKING_SERVICE?: string;
  NEXT_PUBLIC_SENTRY_DSN?: string;
  NEXT_PUBLIC_APP_NAME?: string;
}

interface ValidationResult {
  isValid: boolean;
  missing: string[];
  warnings: string[];
}

/**
 * Validate required environment variables
 */
export function validateEnvVars(): ValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Required variables
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ];

  // Optional but recommended
  const recommended = [
    "NEXT_PUBLIC_STRIPE_PUBLIC_KEY",
    "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  ];

  // Check required
  for (const key of required) {
    const value = process.env[key];
    if (!value || value.trim() === "") {
      missing.push(key);
    }
  }

  // Check recommended
  for (const key of recommended) {
    const value = process.env[key];
    if (!value || value.trim() === "") {
      warnings.push(key);
    }
  }

  return {
    isValid: missing.length === 0,
    missing,
    warnings,
  };
}

/**
 * Get environment variable with fallback
 */
export function getEnvVar(key: string, fallback?: string): string {
  const value = process.env[key];
  if (!value || value.trim() === "") {
    if (fallback !== undefined) {
      return fallback;
    }
    return "";
  }
  return value;
}

/**
 * Log environment variable validation results
 */
export function logEnvValidation(): void {
  const result = validateEnvVars();
  
  if (!result.isValid) {
    logger.error(
      "Missing required environment variables",
      undefined,
      {
        missing: result.missing,
        message: "Please create a .env.local file with these variables. See env.example for reference."
      }
    );
  }

  if (result.warnings.length > 0) {
    logger.warn(
      "Missing recommended environment variables",
      {
        warnings: result.warnings,
        message: "Some features may not work without these variables."
      }
    );
  }

  if (result.isValid && result.warnings.length === 0) {
    logger.info("All environment variables are configured");
  }
}

/**
 * Initialize environment validation
 * Call this in app/layout.tsx or app/providers.tsx
 */
export function initEnvValidation(): void {
  logEnvValidation();
}

