/**
 * Push Notification System
 * Handles browser push notifications with service worker
 */

import { useState, useEffect } from "react";
import { logger } from "./logger";

export interface PushNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  data?: Record<string, unknown>;
  requireInteraction?: boolean;
  silent?: boolean;
  vibrate?: number[];
  actions?: NotificationAction[];
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) {
    logger.warn("This browser does not support notifications");
    return "denied";
  }

  if (Notification.permission === "granted") {
    return "granted";
  }

  if (Notification.permission === "denied") {
    return "denied";
  }

  const permission = await Notification.requestPermission();
  return permission;
}

/**
 * Check if notifications are supported
 */
export function isNotificationSupported(): boolean {
  return "Notification" in window && "serviceWorker" in navigator;
}

/**
 * Check if notifications are permitted
 */
export function isNotificationPermitted(): boolean {
  return Notification.permission === "granted";
}

/**
 * Show a browser notification
 */
export async function showNotification(
  options: PushNotificationOptions
): Promise<Notification | null> {
  if (!isNotificationSupported()) {
    logger.warn("Notifications are not supported");
    return null;
  }

  const permission = await requestNotificationPermission();
  if (permission !== "granted") {
    logger.warn("Notification permission not granted");
    return null;
  }

  // Try to use service worker for better control
  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      
      await registration.showNotification(options.title, {
        body: options.body,
        icon: options.icon || "/favicon.ico",
        badge: options.badge || "/favicon.ico",
        image: options.image,
        tag: options.tag,
        data: options.data,
        requireInteraction: options.requireInteraction || false,
        silent: options.silent || false,
        vibrate: options.vibrate,
        actions: options.actions,
      });

      return null; // Service worker handles it
    } catch (error) {
      logger.error("Service worker notification failed, falling back", error);
    }
  }

  // Fallback to regular notification
  try {
    const notification = new Notification(options.title, {
      body: options.body,
      icon: options.icon || "/favicon.ico",
      badge: options.badge || "/favicon.ico",
      image: options.image,
      tag: options.tag,
      data: options.data,
      requireInteraction: options.requireInteraction || false,
      silent: options.silent || false,
      vibrate: options.vibrate,
    });

    // Auto-close after 5 seconds
    setTimeout(() => {
      notification.close();
    }, 5000);

    return notification;
  } catch (error) {
    logger.error("Failed to show notification", error);
    return null;
  }
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPushNotifications(
  vapidPublicKey: string
): Promise<PushSubscription | null> {
  if (!isNotificationSupported()) {
    logger.warn("Push notifications are not supported");
    return null;
  }

  const permission = await requestNotificationPermission();
  if (permission !== "granted") {
    logger.warn("Notification permission not granted");
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    return subscription;
  } catch (error) {
    logger.error("Failed to subscribe to push notifications", error);
    return null;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await subscription.unsubscribe();
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error("Failed to unsubscribe from push notifications", error);
    return false;
  }
}

/**
 * Get current push subscription
 */
export async function getPushSubscription(): Promise<PushSubscription | null> {
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch (error) {
    logger.error("Failed to get push subscription", error);
    return null;
  }
}

/**
 * Convert VAPID public key from URL-safe base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

/**
 * React hook for push notifications
 */
export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof window !== "undefined" ? Notification.permission : "default"
  );
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported(isNotificationSupported());
    
    if (isNotificationSupported()) {
      setPermission(Notification.permission);
      
      // Check for existing subscription
      getPushSubscription().then(setSubscription);
    }
  }, []);

  const requestPermission = async () => {
    const newPermission = await requestNotificationPermission();
    setPermission(newPermission);
    return newPermission;
  };

  const subscribe = async (vapidPublicKey: string) => {
    const sub = await subscribeToPushNotifications(vapidPublicKey);
    setSubscription(sub);
    return sub;
  };

  const unsubscribe = async () => {
    const success = await unsubscribeFromPushNotifications();
    if (success) {
      setSubscription(null);
    }
    return success;
  };

  const show = async (options: PushNotificationOptions) => {
    return await showNotification(options);
  };

  return {
    permission,
    subscription,
    isSupported,
    isPermitted: permission === "granted",
    requestPermission,
    subscribe,
    unsubscribe,
    show,
  };
}

