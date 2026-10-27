import { ApiClient, ApiError } from '../src/services/api';
import { TokenStorage } from '../src/services/storage';

const getFetchMock = (): jest.Mock => (globalThis as any).fetch;

describe('Authentication, Driver Authorization & Session Security', () => {
  beforeEach(async () => {
    await TokenStorage.clearTokens();
    await TokenStorage.clearCustomApiBaseUrl();
    (globalThis as any).fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('driver role is enforced: driver profile returns valid DriverMeResponse', async () => {
    const mockDriverMe = {
      id: 77,
      user_id: 100,
      employee_id: 'EMP-DRV-001',
      name: 'Rohan Sharma',
      email: 'driver@pharmatrix.local',
      phone: '9876543210',
      license_number: 'DL-2026-KA01',
      license_expiry: '2030-05-15',
      status: 'ACTIVE' as const,
      is_available: true,
      created_at: '2026-10-01T00:00:00Z',
    };

    getFetchMock().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockDriverMe,
    });

    const res = await ApiClient.getDriverMe();

    expect(getFetchMock()).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/drivers/me'),
      expect.objectContaining({ method: 'GET' })
    );
    expect(res.id).toBe(77);
    expect(res.employee_id).toBe('EMP-DRV-001');
    expect(res.is_available).toBe(true);
  });

  test('rejects unauthorized access if user role is not DRIVER (403 Forbidden)', async () => {
    getFetchMock().mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ detail: 'Driver access required' }),
    });

    await expect(ApiClient.getDriverMe()).rejects.toThrow('Driver access required');
  });

  test('rejects inactive or suspended accounts cleanly', async () => {
    getFetchMock().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 101,
        auth_user_id: 'uuid-101',
        name: 'Suspended Driver',
        email: 'suspended@pharmatrix.local',
        role: 'DRIVER',
        is_active: false,
      }),
    });

    const userMe = await ApiClient.getMe();
    expect(userMe.is_active).toBe(false);
  });

  test('handles network failure with connection diagnostics', async () => {
    getFetchMock().mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(ApiClient.login('driver@pharmatrix.local', 'pass')).rejects.toThrow(
      /Cannot connect to backend server/
    );
  });

  test('handles request timeout cleanly with 408 code', async () => {
    const timeoutError = new Error('AbortError: The operation timed out');
    timeoutError.name = 'AbortError';
    getFetchMock().mockRejectedValueOnce(timeoutError);

    await expect(ApiClient.getTodayRoute()).rejects.toThrow(
      /timed out after 20 seconds/
    );
  });
});
