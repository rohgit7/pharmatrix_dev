import { TokenStorage } from '../src/services/storage';

describe('TokenStorage & Persistence', () => {
  beforeEach(async () => {
    await TokenStorage.clearTokens();
    await TokenStorage.clearCustomApiBaseUrl();
  });

  test('stores, retrieves, and clears access tokens', async () => {
    expect(await TokenStorage.getAccessToken()).toBeNull();

    await TokenStorage.setAccessToken('sample-token-123');
    expect(await TokenStorage.getAccessToken()).toBe('sample-token-123');

    await TokenStorage.clearTokens();
    expect(await TokenStorage.getAccessToken()).toBeNull();
  });

  test('stores, retrieves, and clears refresh tokens', async () => {
    expect(await TokenStorage.getRefreshToken()).toBeNull();

    await TokenStorage.setRefreshToken('refresh-token-456');
    expect(await TokenStorage.getRefreshToken()).toBe('refresh-token-456');

    await TokenStorage.clearTokens();
    expect(await TokenStorage.getRefreshToken()).toBeNull();
  });

  test('custom API base URL is persisted and cleared', async () => {
    expect(await TokenStorage.getCustomApiBaseUrl()).toBeNull();

    await TokenStorage.setCustomApiBaseUrl('http://192.168.1.100:8000');
    expect(await TokenStorage.getCustomApiBaseUrl()).toBe('http://192.168.1.100:8000');

    await TokenStorage.clearCustomApiBaseUrl();
    expect(await TokenStorage.getCustomApiBaseUrl()).toBeNull();
  });
});
