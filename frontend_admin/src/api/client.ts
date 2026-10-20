import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Base URL configured from environment variable
const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Session token storage key
export const TOKEN_STORAGE_KEY = 'pharmatrix_admin_token';
export const USER_STORAGE_KEY = 'pharmatrix_admin_user';

// Request interceptor to inject Bearer token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle session expiration and normalize API error messages
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ detail?: string | { msg?: string }[] }>) => {
    if (error.response?.status === 401) {
      // Clear token and broadcast session expiration
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      sessionStorage.removeItem(USER_STORAGE_KEY);
      if (window.location.pathname !== '/login') {
        window.location.href = '/login?expired=true';
      }
    }
    return Promise.reject(error);
  }
);

// Helper function to extract user-friendly error message
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string') {
      return detail;
    }
    if (Array.isArray(detail) && detail.length > 0 && detail[0].msg) {
      return detail[0].msg;
    }
    if (error.response?.status === 403) {
      return 'You do not have administrative permissions to perform this action.';
    }
    if (error.response?.status === 404) {
      return 'The requested resource was not found.';
    }
    if (error.response?.status === 409) {
      return 'Operation conflict. A record with similar attributes already exists.';
    }
    if (error.response?.status && error.response.status >= 500) {
      return 'Backend service error. Please try again or inspect server logs.';
    }
    if (error.code === 'ECONNABORTED') {
      return 'Request timed out. Please check your network connection.';
    }
    if (!error.response) {
      return 'Unable to connect to the Pharmatrix backend service. Ensure the server is running on port 8000.';
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred.';
}
