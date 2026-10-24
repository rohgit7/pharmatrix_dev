import { ApiClient, ApiError, getDefaultApiBaseUrl } from '../src/services/api';
import { TokenStorage } from '../src/services/storage';

describe('ApiClient & Endpoint Integrations', () => {
  beforeEach(async () => {
    await TokenStorage.clearTokens();
    await TokenStorage.clearCustomApiBaseUrl();
    (global as any).fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('resolves default API base URL correctly', () => {
    const url = getDefaultApiBaseUrl();
    expect(url).toBeDefined();
    expect(typeof url).toBe('string');
  });

  test('login sends credentials and returns tokens', async () => {
    const mockResponse = {
      access_token: 'fake-jwt-token',
      refresh_token: 'fake-refresh-token',
      token_type: 'bearer',
      user_id: 'user-uuid-123',
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const res = await ApiClient.login('driver@pharmatrix.local', 'password123');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/login'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          email: 'driver@pharmatrix.local',
          password: 'password123',
        }),
      })
    );
    expect(res.access_token).toBe('fake-jwt-token');
    expect(res.user_id).toBe('user-uuid-123');
  });

  test('attaches Authorization Bearer header when token is stored', async () => {
    await TokenStorage.setAccessToken('auth-token-xyz');

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 1, role: 'DRIVER', is_active: true }),
    });

    await ApiClient.getMe();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/me'),
      expect.objectContaining({
        headers: expect.any(Headers),
      })
    );

    const callArgs = (global.fetch as jest.Mock).mock.calls[0];
    const headers = callArgs[1].headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer auth-token-xyz');
  });

  test('parses FastAPI error detail string cleanly', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ detail: 'Route cannot be started from status DRAFT' }),
    });

    await expect(ApiClient.startRoute(10)).rejects.toThrow(
      'Route cannot be started from status DRAFT'
    );
  });

  test('parses FastAPI validation error array cleanly', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({
        detail: [
          { loc: ['body', 'otp'], msg: 'String should match pattern' },
        ],
      }),
    });

    await expect(ApiClient.verifyPickupOtp(10, 501, 'abc')).rejects.toThrow(
      'String should match pattern'
    );
  });

  test('clears token on 401 Unauthorized', async () => {
    await TokenStorage.setAccessToken('expired-token');

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ detail: 'Invalid or expired token' }),
    });

    await expect(ApiClient.getMe()).rejects.toThrow('Invalid or expired token');

    const tokenAfter = await TokenStorage.getAccessToken();
    expect(tokenAfter).toBeNull();
  });

  test('scanPickupQr dispatches correct payload', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        message: 'Pickup QR verified',
        stop_id: 501,
        status: 'ARRIVED',
        otp_required: true,
      }),
    });

    const res = await ApiClient.scanPickupQr(10, 501, 'qr-token-test-12345');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/driver/routes/10/stops/501/scan-qr'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ qr_token: 'qr-token-test-12345' }),
      })
    );
    expect(res.otp_required).toBe(true);
    expect(res.status).toBe('ARRIVED');
  });

  test('verifyPickupOtp dispatches correct 6-digit payload', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        message: 'Customer OTP verified',
        stop_id: 501,
        status: 'IN_PROGRESS',
        otp_verified: true,
      }),
    });

    const res = await ApiClient.verifyPickupOtp(10, 501, '123456');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/driver/routes/10/stops/501/verify-otp'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ otp: '123456' }),
      })
    );
    expect(res.otp_verified).toBe(true);
  });

  test('completeStop dispatches weight and optional notes', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        message: 'Stop completed',
        stop_id: 501,
        status: 'COMPLETED',
        completed_at: '2026-10-20T12:00:00Z',
      }),
    });

    const res = await ApiClient.completeStop(10, 501, 14.5, '2 boxes collected');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/driver/routes/10/stops/501/complete'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          collected_weight_kg: 14.5,
          notes: '2 boxes collected',
        }),
      })
    );
    expect(res.status).toBe('COMPLETED');
  });

  test('failStop dispatches reason to log operational exception', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        message: 'Stop marked as failed',
        stop_id: 501,
        status: 'FAILED',
        reason: 'Customer unavailable',
      }),
    });

    const res = await ApiClient.failStop(10, 501, 'Customer unavailable');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/driver/routes/10/stops/501/fail'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ reason: 'Customer unavailable' }),
      })
    );
    expect(res.status).toBe('FAILED');
    expect(res.reason).toBe('Customer unavailable');
  });
});
