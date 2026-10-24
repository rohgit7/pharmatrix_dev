import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS_TOKEN_KEY = 'pharmatrix_access_token';
const REFRESH_TOKEN_KEY = 'pharmatrix_refresh_token';
const API_BASE_URL_KEY = 'pharmatrix_custom_api_url';

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, value);
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem(key);
    }
    return null;
  }
  return await SecureStore.getItemAsync(key);
}

async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(key);
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export const TokenStorage = {
  getAccessToken: async (): Promise<string | null> => {
    return getItem(ACCESS_TOKEN_KEY);
  },

  setAccessToken: async (token: string): Promise<void> => {
    await setItem(ACCESS_TOKEN_KEY, token);
  },

  getRefreshToken: async (): Promise<string | null> => {
    return getItem(REFRESH_TOKEN_KEY);
  },

  setRefreshToken: async (token: string): Promise<void> => {
    await setItem(REFRESH_TOKEN_KEY, token);
  },

  clearTokens: async (): Promise<void> => {
    await deleteItem(ACCESS_TOKEN_KEY);
    await deleteItem(REFRESH_TOKEN_KEY);
  },

  getCustomApiBaseUrl: async (): Promise<string | null> => {
    return getItem(API_BASE_URL_KEY);
  },

  setCustomApiBaseUrl: async (url: string): Promise<void> => {
    await setItem(API_BASE_URL_KEY, url);
  },

  clearCustomApiBaseUrl: async (): Promise<void> => {
    await deleteItem(API_BASE_URL_KEY);
  },
};
