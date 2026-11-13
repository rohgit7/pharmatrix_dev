// Polyfill and native module fallbacks for unlinked Android environments (Expo Go, bare builds)
if (typeof globalThis !== 'undefined') {
  const g = globalThis as any;
  if (!g.expo) {
    g.expo = {};
  }
  if (!g.expo.modules) {
    g.expo.modules = {};
  }
  if (!g.expo.modules.ExpoApplication) {
    g.expo.modules.ExpoApplication = {
      applicationId: 'com.pharmatrix.driver',
      applicationName: 'Pharmatrix Driver',
      nativeApplicationVersion: '1.0.0',
      nativeBuildVersion: '1',
      androidId: 'driver-device',
      getInstallationTimeAsync: async () => Date.now(),
      getLastUpdateTimeAsync: async () => Date.now(),
      getIosPushNotificationServiceEnvironmentAsync: async () => 'development',
    };
  }
}

export {};

