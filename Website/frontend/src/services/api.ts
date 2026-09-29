import { auth } from '../config/firebase';
import { mockSheets, mockAlerts, mockExam, mockExaminers } from '../mock/data';
import type { Sheet, Alert } from '../types';

export class ApiError extends Error {
  public status: number;
  public data?: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000').replace(/\/$/, '');
export const USE_MOCK: boolean = import.meta.env.VITE_USE_MOCK === 'true' || import.meta.env.VITE_USE_MOCK === undefined;

/**
 * Retrieves the current Firebase ID Token if user is logged in
 */
export async function getAuthToken(forceRefresh = false): Promise<string | null> {
  const currentUser = auth.currentUser;
  if (currentUser) {
    try {
      return await currentUser.getIdToken(forceRefresh);
    } catch (err) {
      console.warn('[API] Could not retrieve Firebase ID token:', err);
    }
  }
  return localStorage.getItem('auth_token') || null;
}

export interface RequestOptions extends RequestInit {
  requireAuth?: boolean;
}

/**
 * Universal fetch wrapper that:
 * 1. Reads VITE_BACKEND_URL
 * 2. Adds Authorization: Bearer <Firebase ID token>
 * 3. Throws typed ApiError instances
 * 4. Respects VITE_USE_MOCK fallback
 */
export async function apiFetch<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { requireAuth = true, headers = {}, ...restOptions } = options;

  const url = `${BACKEND_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  // If USE_MOCK is explicitly forced, route to mock directly
  if (USE_MOCK) {
    const mockRes = getMockFallback<T>(endpoint, restOptions.method);
    if (mockRes !== undefined) {
      return mockRes;
    }
  }

  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };

  if (requireAuth) {
    const token = await getAuthToken();
    if (token) {
      reqHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  try {
    const response = await fetch(url, {
      ...restOptions,
      headers: reqHeaders,
    });

    if (!response.ok) {
      let errorBody: any;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = await response.text();
      }
      throw new ApiError(
        typeof errorBody === 'object' && errorBody?.message ? errorBody.message : `API request failed with status ${response.status}`,
        response.status,
        errorBody
      );
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    return (await response.text()) as unknown as T;
  } catch (error: any) {
    if (error instanceof ApiError) {
      throw error;
    }

    // Backend network failure / unreachable: fallback to mock data
    console.warn(`[API] Network failure calling ${endpoint}. Falling back to mock dataset:`, error.message);
    const fallback = getMockFallback<T>(endpoint, restOptions.method);
    if (fallback !== undefined) {
      return fallback;
    }

    throw new ApiError(error?.message || 'Network unreachable', 0, null);
  }
}

/**
 * Local mock dataset fallback router
 */
function getMockFallback<T>(endpoint: string, method = 'GET'): T | undefined {
  const ep = endpoint.toLowerCase();

  // Sheets routes
  if (ep.includes('/sheets') || ep.includes('/api/sheets')) {
    return mockSheets as unknown as T;
  }

  // Alerts routes
  if (ep.includes('/alerts') || ep.includes('/api/alerts')) {
    return mockAlerts as unknown as T;
  }

  // Exams routes
  if (ep.includes('/exams') || ep.includes('/api/exams')) {
    return mockExam as unknown as T;
  }

  // Examiners routes
  if (ep.includes('/examiners') || ep.includes('/api/examiners')) {
    return mockExaminers as unknown as T;
  }

  // Telemetry stats
  if (ep.includes('/stats') || ep.includes('/api/stats')) {
    return {
      total: 1450,
      pending: 380,
      inProgress: 520,
      flagged: 42,
      final: 508,
      velocityPerHour: 28,
    } as unknown as T;
  }

  if (method === 'POST' || method === 'PUT') {
    return { success: true, timestamp: new Date().toISOString() } as unknown as T;
  }

  return undefined;
}

// Typed API helper services
export const SheetsApi = {
  getAll: () => apiFetch<Sheet[]>('/api/sheets'),
  getById: (sheetId: string) => apiFetch<Sheet>(`/api/sheets/${sheetId}`),
  updateScore: (sheetId: string, payload: any) =>
    apiFetch<Sheet>(`/api/sheets/${sheetId}/score`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
};

export const AlertsApi = {
  getAll: () => apiFetch<Alert[]>('/api/alerts'),
  resolve: (alertId: string, note: string) =>
    apiFetch<{ success: boolean }>(`/api/alerts/${alertId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),
};

export const StatsApi = {
  getLiveStats: () =>
    apiFetch<{
      total: number;
      pending: number;
      inProgress: number;
      flagged: number;
      final: number;
    }>('/api/stats/live'),
};
