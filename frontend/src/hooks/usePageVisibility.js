import { useState, useEffect, useCallback } from 'react';

/**
 * A custom hook to track page visibility and manage notification permissions.
 * @returns {object} An object containing a function to show a notification.
 */
export function usePageVisibility() {
  const [notificationPermission, setNotificationPermission] = useState(Notification.permission);

  // Effect to update permission state if user changes it in browser settings
  useEffect(() => {
    const checkPermission = () => setNotificationPermission(Notification.permission);
    // Browsers don't have a dedicated event for permission changes, so we check on visibility change.
    document.addEventListener('visibilitychange', checkPermission);
    return () => document.removeEventListener('visibilitychange', checkPermission);
  }, []);

  /**
   * Requests permission to show notifications.
   * This should be triggered by a user action, like a button click.
   */
  const requestNotificationPermission = useCallback(async () => {
    if (notificationPermission === 'default') {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    }
  }, [notificationPermission]);

  /**
   * Shows a notification if the tab is hidden and permission is granted.
   * @param {string} title - The title of the notification.
   * @param {object} options - The options for the notification (e.g., body, icon).
   */
  const showNotificationOnInactive = useCallback((title, options) => {
    // 1. Check if the tab is hidden
    // 2. Check if permission has been granted
    if (document.hidden && notificationPermission === 'granted') {
      // We can optionally use a service worker for more robust notifications,
      // but for simplicity, we'll use the Notification constructor directly.
      const notification = new Notification(title, options);
      return notification;
    }
    // Silently ignore if tab is active or permission is denied.
  }, [notificationPermission]);

  return { requestNotificationPermission, showNotificationOnInactive, notificationPermission };
}

