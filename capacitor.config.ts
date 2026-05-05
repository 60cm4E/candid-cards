import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.stepbysteplabs.deepercards',
  appName: 'Candid Cards',
  webDir: 'www',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2500,
      launchFadeOutDuration: 500,
      backgroundColor: '#08090c',
      androidSplashResourceName: 'splash',
      showSpinner: false,
      splashImmersive: true,
      splashFullScreen: true
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#08090c'
    }
  }
};

export default config;
