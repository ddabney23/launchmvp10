/**
 * Accessibility Utilities
 * 
 * Helper functions and constants for improving accessibility
 */

/**
 * Keyboard event handlers for common interactions
 */
export const keyboardHandlers = {
  /**
   * Handle Enter/Space key press (for clickable elements)
   */
  onKeyDown: (callback: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      callback();
    }
  },

  /**
   * Handle Escape key press
   */
  onEscape: (callback: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      callback();
    }
  },

  /**
   * Handle arrow key navigation
   */
  onArrowKeys: (
    onUp?: () => void,
    onDown?: () => void,
    onLeft?: () => void,
    onRight?: () => void
  ) => (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowUp':
        onUp?.();
        e.preventDefault();
        break;
      case 'ArrowDown':
        onDown?.();
        e.preventDefault();
        break;
      case 'ArrowLeft':
        onLeft?.();
        e.preventDefault();
        break;
      case 'ArrowRight':
        onRight?.();
        e.preventDefault();
        break;
    }
  },
};

/**
 * ARIA labels for common UI elements
 */
export const ariaLabels = {
  navigation: 'Main navigation',
  closeButton: 'Close',
  openMenu: 'Open menu',
  closeMenu: 'Close menu',
  search: 'Search',
  notifications: 'Notifications',
  messages: 'Messages',
  cart: 'Shopping cart',
  profile: 'User profile',
  settings: 'Settings',
  logout: 'Log out',
  admin: 'Admin dashboard',
  loading: 'Loading',
};

/**
 * Generate accessible image alt text
 */
export function generateImageAlt(
  context: string,
  description?: string
): string {
  if (description) {
    return `${context}: ${description}`;
  }
  return context;
}

/**
 * Announce to screen readers (for dynamic content)
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite') {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Focus management utilities
 */
export const focusManagement = {
  /**
   * Trap focus within an element
   */
  trapFocus: (element: HTMLElement) => {
    const focusableElements = element.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement?.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement?.focus();
          e.preventDefault();
        }
      }
    };

    element.addEventListener('keydown', handleTabKey);
    
    return () => {
      element.removeEventListener('keydown', handleTabKey);
    };
  },

  /**
   * Focus first focusable element in container
   */
  focusFirst: (container: HTMLElement) => {
    const focusable = container.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusable?.focus();
  },

  /**
   * Restore focus to previous element
   */
  restoreFocus: (previousElement: HTMLElement | null) => {
    previousElement?.focus();
  },
};

