/**
 * Capacitor utilities for native mobile functionality
 */

import { Capacitor } from '@capacitor/core';

// Check if running as native app
export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform(); // 'ios', 'android', or 'web'

/**
 * Initialize Capacitor plugins and listeners
 */
export async function initializeCapacitor() {
  if (!isNative) return;

  // Dynamic imports for native-only plugins
  try {
    // Handle deep links for Supabase auth
    const { App } = await import('@capacitor/app');
    
    App.addListener('appUrlOpen', (event) => {
      // Handle Supabase auth redirects
      const url = new URL(event.url);
      
      // Check for auth callback
      if (url.pathname.includes('/auth/callback') || url.hash.includes('access_token')) {
        // Extract tokens from URL and handle auth
        window.location.href = event.url;
      }
      
      // Handle password reset
      if (url.pathname === '/reset-password' || url.searchParams.has('type') && url.searchParams.get('type') === 'recovery') {
        window.location.href = '/reset-password' + url.search + url.hash;
      }
      
      // Handle magic link login
      if (url.hash.includes('type=magiclink')) {
        window.location.href = '/' + url.hash;
      }
    });

    // Handle app state changes
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        // App came to foreground - check for pending syncs
        console.log('App is active');
      }
    });

    // Handle back button on Android
    App.addListener('backButton', ({ canGoBack }) => {
      if (!canGoBack) {
        App.exitApp();
      } else {
        window.history.back();
      }
    });

  } catch (error) {
    console.warn('Capacitor plugins not available:', error);
  }
}

/**
 * Initialize push notifications
 */
export async function initializePushNotifications() {
  if (!isNative) return null;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    // Request permission
    const permission = await PushNotifications.requestPermissions();
    
    if (permission.receive === 'granted') {
      // Register for push notifications
      await PushNotifications.register();

      // Handle registration success
      PushNotifications.addListener('registration', (token) => {
        console.log('Push registration success:', token.value);
        // Send token to your backend
        savePushToken(token.value);
      });

      // Handle registration errors
      PushNotifications.addListener('registrationError', (error) => {
        console.error('Push registration error:', error);
      });

      // Handle received push notification
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push notification received:', notification);
        // Handle foreground notification
      });

      // Handle notification tap
      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('Push notification action:', action);
        // Navigate based on notification data
        const data = action.notification.data;
        if (data?.url) {
          window.location.href = data.url;
        }
      });
    }

    return permission;
  } catch (error) {
    console.warn('Push notifications not available:', error);
    return null;
  }
}

/**
 * Save push token to backend
 */
async function savePushToken(token: string) {
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      // Store token in user profile or dedicated table
      await supabase.from('profiles').update({
        // Assuming you add a push_token column
        // push_token: token,
      }).eq('id', user.id);
    }
  } catch (error) {
    console.error('Failed to save push token:', error);
  }
}

/**
 * Get app info
 */
export async function getAppInfo() {
  if (!isNative) return null;

  try {
    const { App } = await import('@capacitor/app');
    return await App.getInfo();
  } catch {
    return null;
  }
}

/**
 * Open app settings
 */
export async function openAppSettings() {
  if (!isNative) return;

  try {
    const { App } = await import('@capacitor/app');
    // This is iOS/Android specific
    if (platform === 'ios' || platform === 'android') {
      // Open device settings for the app
    }
  } catch (error) {
    console.warn('Cannot open app settings:', error);
  }
}

/**
 * Share content using native share sheet
 */
export async function shareContent(title: string, text: string, url?: string) {
  if (!isNative) {
    // Fallback to Web Share API
    if (navigator.share) {
      await navigator.share({ title, text, url });
    }
    return;
  }

  try {
    const { Share } = await import('@capacitor/share');
    await Share.share({
      title,
      text,
      url,
      dialogTitle: 'Share',
    });
  } catch (error) {
    console.warn('Share failed:', error);
  }
}

/**
 * Haptic feedback
 */
export async function hapticFeedback(style: 'light' | 'medium' | 'heavy' = 'medium') {
  if (!isNative) return;

  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    
    const impactStyle = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy,
    }[style];

    await Haptics.impact({ style: impactStyle });
  } catch {
    // Haptics not available
  }
}

/**
 * Get safe area insets for notched devices
 */
export function getSafeAreaInsets() {
  const style = getComputedStyle(document.documentElement);
  return {
    top: parseInt(style.getPropertyValue('--safe-area-inset-top') || '0', 10),
    right: parseInt(style.getPropertyValue('--safe-area-inset-right') || '0', 10),
    bottom: parseInt(style.getPropertyValue('--safe-area-inset-bottom') || '0', 10),
    left: parseInt(style.getPropertyValue('--safe-area-inset-left') || '0', 10),
  };
}
