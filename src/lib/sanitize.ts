/**
 * Input Sanitization Utilities
 * 
 * Provides functions to sanitize user input before storing in database
 * or displaying in the UI to prevent XSS attacks, injection, and other security issues.
 */

// Maximum input lengths for different types
const MAX_LENGTHS = {
  SHORT_TEXT: 255,
  MEDIUM_TEXT: 1000,
  LONG_TEXT: 10000,
  URL: 2048,
  EMAIL: 320,
};

/**
 * Remove null bytes and control characters that could be used for attacks
 */
function removeControlCharacters(input: string): string {
  // Remove null bytes
  let clean = input.replace(/\0/g, '');
  
  // Remove other control characters except newline, tab, and carriage return
  clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  return clean;
}

/**
 * Limit string length to prevent DoS attacks
 */
function limitLength(input: string, maxLength: number): string {
  if (input.length > maxLength) {
    return input.substring(0, maxLength);
  }
  return input;
}

/**
 * Sanitize a string by removing HTML tags and dangerous characters
 * For simple text sanitization (not full HTML)
 */
export function sanitizeString(
  input: string,
  options: { maxLength?: number; preserveNewlines?: boolean } = {}
): string {
  if (typeof input !== 'string') {
    return String(input);
  }

  const { maxLength = MAX_LENGTHS.MEDIUM_TEXT, preserveNewlines = false } = options;

  // Remove control characters and null bytes
  let sanitized = removeControlCharacters(input);

  // Remove HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  
  // Escape special characters that could be used for XSS
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');

  // Handle newlines
  if (!preserveNewlines) {
    sanitized = sanitized.replace(/\n/g, ' ').replace(/\r/g, '');
  }

  // Trim whitespace
  sanitized = sanitized.trim();

  // Limit length
  sanitized = limitLength(sanitized, maxLength);

  return sanitized;
}

/**
 * Sanitize HTML content while preserving safe tags
 * Removes dangerous tags and attributes but keeps basic formatting
 */
export function sanitizeHtml(
  html: string,
  options: { maxLength?: number } = {}
): string {
  if (typeof html !== 'string') {
    return String(html);
  }

  const { maxLength = MAX_LENGTHS.LONG_TEXT } = options;

  // Remove control characters
  let sanitized = removeControlCharacters(html);

  // Allowed safe tags
  const allowedTags = [
    'p', 'br', 'strong', 'em', 'u', 'b', 'i', 'span', 'div', 
    'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'blockquote', 'code', 'pre'
  ];
  
  // Remove script tags and their content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove event handlers (onclick, onerror, etc.)
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=\s*[^\s>]*/gi, '');
  
  // Remove dangerous protocols from links
  sanitized = sanitized.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
  sanitized = sanitized.replace(/href\s*=\s*["']data:[^"']*["']/gi, 'href="#"');
  sanitized = sanitized.replace(/href\s*=\s*["']vbscript:[^"']*["']/gi, 'href="#"');
  
  // Remove style tags and inline styles that could contain expressions
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  sanitized = sanitized.replace(/style\s*=\s*["'][^"']*["']/gi, '');
  
  // Remove iframe, object, embed, form tags
  sanitized = sanitized.replace(/<(iframe|object|embed|form|input|button)[^>]*>/gi, '');
  
  // Remove meta and link tags
  sanitized = sanitized.replace(/<(meta|link)[^>]*>/gi, '');

  // Limit length
  sanitized = limitLength(sanitized, maxLength);
  
  return sanitized.trim();
}

/**
 * Sanitize an object by sanitizing all string properties
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized = { ...obj };
  
  for (const key in sanitized) {
    if (typeof sanitized[key] === 'string') {
      sanitized[key] = sanitizeString(sanitized[key] as string) as T[Extract<keyof T, string>];
    } else if (Array.isArray(sanitized[key])) {
      // Recursively sanitize array items
      sanitized[key] = (sanitized[key] as unknown[]).map(item =>
        typeof item === 'string' ? sanitizeString(item) : item
      ) as T[Extract<keyof T, string>];
    } else if (sanitized[key] && typeof sanitized[key] === 'object') {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeObject(sanitized[key] as Record<string, unknown>) as T[Extract<keyof T, string>];
    }
  }
  
  return sanitized;
}

/**
 * Sanitize a URL to ensure it's safe
 */
export function sanitizeUrl(url: string): string | null {
  if (typeof url !== 'string') return null;

  // Remove control characters
  const clean = removeControlCharacters(url).trim();

  // Check length
  if (clean.length > MAX_LENGTHS.URL) return null;

  try {
    const parsed = new URL(clean);
    // Only allow http and https protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    // Invalid URL
    return null;
  }
}

/**
 * Sanitize an email address
 */
export function sanitizeEmail(email: string): string | null {
  if (typeof email !== 'string') return null;

  const sanitized = removeControlCharacters(email).trim().toLowerCase();
  
  // Check length
  if (sanitized.length > MAX_LENGTHS.EMAIL) return null;

  const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
  
  if (!emailRegex.test(sanitized)) {
    return null;
  }

  return sanitized;
}

/**
 * Validate file type based on allowed MIME types
 */
export function validateFileType(
  file: File,
  allowedTypes: string[]
): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`,
    };
  }

  return { valid: true };
}

/**
 * Validate file size
 */
export function validateFileSize(
  file: File,
  maxSizeInMB: number
): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  const maxSizeInBytes = maxSizeInMB * 1024 * 1024;

  if (file.size > maxSizeInBytes) {
    return {
      valid: false,
      error: `File size exceeds ${maxSizeInMB}MB limit. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB`,
    };
  }

  return { valid: true };
}

/**
 * Comprehensive file validation
 */
export function validateFile(
  file: File,
  options: {
    allowedTypes: string[];
    maxSizeInMB: number;
  }
): { valid: boolean; error?: string } {
  const typeValidation = validateFileType(file, options.allowedTypes);
  if (!typeValidation.valid) {
    return typeValidation;
  }

  const sizeValidation = validateFileSize(file, options.maxSizeInMB);
  if (!sizeValidation.valid) {
    return sizeValidation;
  }

  return { valid: true };
}

/**
 * Sanitize phone number
 */
export function sanitizePhoneNumber(phone: string): string | null {
  if (typeof phone !== 'string') return null;

  // Remove all non-digit and non-plus characters
  const cleaned = phone.replace(/[^\d+]/g, '');

  // Basic validation: must be at least 10 digits
  const digitsOnly = cleaned.replace(/\+/g, '');
  if (digitsOnly.length < 10 || digitsOnly.length > 15) {
    return null;
  }

  return cleaned;
}

/**
 * Sanitize SQL-like input to prevent SQL injection
 * NOTE: This is a backup - always use parameterized queries!
 */
export function sanitizeSqlInput(input: string): string {
  if (typeof input !== 'string') {
    return String(input);
  }

  // Remove common SQL injection patterns
  let sanitized = input
    .replace(/;/g, '') // Remove semicolons
    .replace(/--/g, '') // Remove SQL comments
    .replace(/\/\*/g, '') // Remove multi-line comment start
    .replace(/\*\//g, '') // Remove multi-line comment end
    .replace(/xp_/gi, '') // Remove extended stored procedures
    .replace(/exec\s/gi, '') // Remove exec commands
    .replace(/execute\s/gi, '') // Remove execute commands
    .replace(/union\s/gi, '') // Remove union statements
    .replace(/drop\s/gi, '') // Remove drop statements
    .replace(/insert\s/gi, '') // Remove insert statements
    .replace(/update\s/gi, '') // Remove update statements
    .replace(/delete\s/gi, ''); // Remove delete statements

  return sanitized.trim();
}

/**
 * Export max length constants for external use
 */
export { MAX_LENGTHS };
