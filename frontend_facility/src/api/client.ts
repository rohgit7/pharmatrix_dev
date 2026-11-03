import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Base URL configured from environment variable (empty string uses Vite dev proxy to http://localhost:8000)
const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 20000,
});

export const TOKEN_STORAGE_KEY = 'pharmatrix_facility_token';
export const USER_STORAGE_KEY = 'pharmatrix_facility_user';
export const FACILITY_STORAGE_KEY = 'pharmatrix_facility_profile';

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

// Response interceptor to handle 401 and 403 responses
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ detail?: string | { msg?: string }[] }>) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      sessionStorage.removeItem(USER_STORAGE_KEY);
      sessionStorage.removeItem(FACILITY_STORAGE_KEY);
      if (window.location.pathname !== '/login') {
        window.location.href = '/login?expired=true';
      }
    }
    return Promise.reject(error);
  }
);

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as any;
    const detail = data?.detail;

    if (typeof detail === 'string') {
      return detail;
    }
    if (Array.isArray(detail) && detail.length > 0 && detail[0]?.msg) {
      return detail[0].msg;
    }
    if (typeof detail === 'object' && detail !== null) {
      if (typeof detail.message === 'string') return detail.message;
      if (typeof detail.error === 'string') return detail.error;
      if (typeof detail.reason === 'string') return detail.reason;
    }
    if (typeof data?.message === 'string') {
      return data.message;
    }
    if (error.response?.status === 401) {
      return 'Invalid credentials or session expired. Please sign in again.';
    }
    if (error.response?.status === 403) {
      return 'Access forbidden: You do not have disposal facility authorization for this resource.';
    }
    if (error.response?.status === 404) {
      return 'The requested shipment or facility resource was not found.';
    }
    if (error.response?.status === 409) {
      return 'State conflict: This shipment is not in the required lifecycle state for this action.';
    }
    if (error.response?.status && error.response.status >= 500) {
      return 'Backend service error. Please try again or inspect server logs.';
    }
    if (error.code === 'ECONNABORTED') {
      return 'Request timed out. Please check your network connection.';
    }
    if (!error.response) {
      return 'Unable to connect to the Pharmatrix backend service at http://localhost:8000.';
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred.';
}

