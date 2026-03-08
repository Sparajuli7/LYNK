import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.lynk.app',
  appName: 'LYNK',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  ios: {
    /* Edge-to-edge like Android so env(safe-area-inset-*) in CSS controls layout */
    contentInset: 'never',
    backgroundColor: '#0A0A0F',
  },
  android: {
    backgroundColor: '#0A0A0F',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#0A0A0F',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0A0A0F',
    },
  },
}

export default config
