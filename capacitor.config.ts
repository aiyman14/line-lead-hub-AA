import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.12eae2b2c6224589bd88ae25411192d0',
  appName: 'line-lead-hub',
  webDir: 'dist',
  
  // Development server configuration for hot reload
  server: {
    // For development, point to your local/preview URL
    // Comment this out for production builds
    url: 'https://12eae2b2-c622-4589-bd88-ae25411192d0.lovableproject.com?forceHideBadge=true',
    cleartext: true,
    androidScheme: 'https',
  },

  // iOS specific configuration
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'productionportal',
    // Deep link configuration
    limitsNavigationsToAppBoundDomains: true,
  },

  // Android specific configuration
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false, // Set to false for production
  },

  // Plugin configurations
  plugins: {
    // Deep links for Supabase auth
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0a0a0a',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    
    // App deep linking
    App: {
      // For Supabase auth redirects
    },
  },
};

export default config;
