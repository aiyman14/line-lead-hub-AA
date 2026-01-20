import type { CapacitorConfig } from '@capacitor/cli';

const devUrl = process.env.CAPACITOR_DEV_URL;

const config: CapacitorConfig = {
  appId: 'com.woventex.productionportal',
  appName: 'Production Portal',
  webDir: 'dist',
  server: devUrl
    ? {
        url: devUrl,
        cleartext: true,
        androidScheme: 'https',
      }
    : {
        androidScheme: 'https',
        cleartext: false,
      },

  ios: {
    contentInset: 'never',
    preferredContentMode: 'mobile',
    scheme: 'productionportal',
    limitsNavigationsToAppBoundDomains: true,
    scrollEnabled: true,
    allowsLinkPreview: true,
    backgroundColor: '#f1f3f5',
  },

  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#f1f3f5',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#f1f3f5',
      overlaysWebView: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
