/**
 * Service Worker Registration
 * Registers service worker for offline support
 */

import { logger } from './logger'

export function registerServiceWorker() {
  if ("serviceWorker" in navigator && process.env.NODE_ENV === 'production') {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          logger.info("Service Worker registered", { scope: registration.scope });
          
          // Check for updates
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  // New service worker available
                  if (confirm("A new version is available. Reload to update?")) {
                    window.location.reload();
                  }
                }
              });
            }
          });
        })
        .catch((error) => {
          logger.error("Service Worker registration failed", error);
        });
    });
  }
}

