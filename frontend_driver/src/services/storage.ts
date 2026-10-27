import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

class StorageService {
  private memoryStore: Map<string, string> = new Map();

  async setItem(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, value);
        } else {
          this.memoryStore.set(key, value);
        }
      } else {
        await SecureStore.setItemAsync(key, value);
      }
    } catch {
      this.memoryStore.set(key, value);
    }
  }

  async getItem(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage.getItem(key);
        }
        return this.memoryStore.get(key) || null;
      }
      return await SecureStore.getItemAsync(key);
    } catch {
      return this.memoryStore.get(key) || null;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
        }
        this.memoryStore.delete(key);
      } else {
        await SecureStore.deleteItemAsync(key);
      }
    } catch {
      this.memoryStore.delete(key);
    }
  }

  async clear(): Promise<void> {
    await this.removeItem('access_token');
    await this.removeItem('refresh_token');
    await this.removeItem('user_profile');
    await this.removeItem('driver_profile');
  }
}

export const storage = new StorageService();
export default storage;
