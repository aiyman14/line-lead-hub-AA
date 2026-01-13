import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor Configuration for Production Portal
 * 
 * BUILD MODES:
 * 
 * 1. BUNDLED MODE (Store Releases - Google Play / App Store):
 *    - Comment out the entire `server` block below
 *    - Run: npm run mobile:sync
 *    - The app will load from the bundled dist/ folder
 *    - This is required for app store submissions
 * 
 * 2. LIVE URL MODE (Development / Instant Updates):
 *    - Uncomment the `server.url` line and set your production URL
 *    - The app loads from the remote URL (instant updates without store release)
 *    - Useful for testing or internal distribution
 */

const config: CapacitorConfig = {
  // App identification - must match Google Play / App Store
  appId: 'com.woventex.productionportal',
  appName: 'Production Portal',
  
  // Web assets directory (output of `npm run build`)
  webDir: 'dist',
  
  // Server configuration
  server: {
    // === DEVELOPMENT MODE ===
    // Uncomment the URL below for live reload during development
    // url: 'https://12eae2b2-c622-4589-bd88-ae25411192d0.lovableproject.com?forceHideBadge=true',
    
    // === PRODUCTION MODE (default) ===
    // When `url` is commented out, the app loads from bundled assets in webDir
    
    // Use HTTPS scheme for Android (required for Supabase/secure APIs)
    androidScheme: 'https',
    
    // Allow cleartext (HTTP) only if needed for local development
    // Set to false for production to enforce HTTPS
    cleartext: false,
  },

  // iOS specific configuration
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'productionportal',
    // Required for Supabase auth deep links
    limitsNavigationsToAppBoundDomains: true,
    // Enable native iOS bounce scrolling
    scrollEnabled: true,
    allowsLinkPreview: true,
  },

  // Android specific configuration
  android: {
    // Disable mixed content for security (HTTPS only)
    allowMixedContent: false,
    // Capture input for proper keyboard handling
    captureInput: true,
    // Enable for debugging, disable for production releases
    webContentsDebuggingEnabled: false,
    // Enable overscroll bounce effect on Android 12+
    overScrollMode: 'always',
    // Custom URL scheme for deep links
    // This allows: productionportal://callback URLs
  },

  // Plugin configurations
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#f1f3f5', // Match app background (--background: 220 14% 96%)
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    
    StatusBar: {
      style: 'LIGHT', // Dark icons on light background
      backgroundColor: '#f1f3f5', // Match app background
      overlaysWebView: false, // Content does NOT render behind status bar
    },
    
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    
    // App plugin handles deep linking for Supabase auth
    App: {
      // Deep link URLs configured in AndroidManifest.xml and Info.plist
    },

    // Keyboard plugin for better keyboard handling
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
