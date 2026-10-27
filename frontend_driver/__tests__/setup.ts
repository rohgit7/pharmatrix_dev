// Jest global setup for frontend_driver tests

// Mock in-memory storage for expo-secure-store
const secureStoreMock = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(async (key: string, value: string) => {
    secureStoreMock.set(key, String(value));
  }),
  getItemAsync: jest.fn(async (key: string) => {
    return secureStoreMock.has(key) ? secureStoreMock.get(key)! : null;
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    secureStoreMock.delete(key);
  }),
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
  expoConfig: {
    hostUri: '10.138.26.167:8081',
  },
}));

// Mock expo-device
jest.mock('expo-device', () => ({
  isDevice: false,
}));

// Mock react-native Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    select: (obj: any) => obj.android ?? obj.default,
  },
}));

// Mock globalThis.fetch
if (typeof (globalThis as any).fetch === 'undefined') {
  (globalThis as any).fetch = jest.fn();
}

