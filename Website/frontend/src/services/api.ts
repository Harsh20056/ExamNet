import { auth } from '../config/firebase';
import { mockSheets, mockAlerts, mockExam, mockExaminers } from '../mock/data';
import type { 
  Sheet, 
  Alert, 
  AuditEntry, 
  ExaminerProfile 
} from '../types';

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

import { BACKEND_URL, USE_MOCK } from '../config/env';
export { USE_MOCK };

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

// Server waking listener callbacks for Render cold starts
type WakingListener = (isWaking: boolean) => void;
const wakingListeners = new Set<WakingListener>();
let activeWakingCount = 0;

function notifyWaking(isWaking: boolean) {
  wakingListeners.forEach(listener => {
    try {
      listener(isWaking);
    } catch {
      // ignore
    }
  });
}

export function subscribeServerWaking(listener: WakingListener): () => void {
  wakingListeners.add(listener);
  listener(activeWakingCount > 0);
  return () => {
    wakingListeners.delete(listener);
  };
}

/**
 * Universal fetch wrapper that:
 * 1. Reads VITE_BACKEND_URL
 * 2. Adds Authorization: Bearer <Firebase ID token>
 * 3. Handles Render cold starts: retries failed network requests up to 3 times with backoff
 * 4. Displays server waking banner if a request takes longer than 4 seconds
 * 5. Unwraps backend standard envelope { success: true, data: ... }
 * 6. Throws typed ApiError instances
 * 7. Falls back to mock data ONLY when VITE_USE_MOCK=true
 */
export async function apiFetch<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { requireAuth = true, headers = {}, ...restOptions } = options;
  const url = `${BACKEND_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  // If USE_MOCK is explicitly true, route to mock directly
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

  // Cold start detection timer (triggers after 4 seconds of waiting)
  let wakeTimer: any = null;
  let isTimerTriggered = false;

  const startWakeTimer = () => {
    if (!isTimerTriggered) {
      wakeTimer = setTimeout(() => {
        isTimerTriggered = true;
        activeWakingCount++;
        notifyWaking(true);
      }, 4000);
    }
  };

  const clearWakeTimer = () => {
    if (wakeTimer) {
      clearTimeout(wakeTimer);
      wakeTimer = null;
    }
    if (isTimerTriggered) {
      activeWakingCount = Math.max(0, activeWakingCount - 1);
      if (activeWakingCount === 0) {
        notifyWaking(false);
      }
      isTimerTriggered = false;
    }
  };

  const maxRetries = 3;
  let lastError: any = null;

  startWakeTimer();

  try {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
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
          const json = await response.json();
          // Unwrap standard backend response envelope { success: true, data: ... }
          if (json && typeof json === 'object' && 'data' in json && json.success === true) {
            return json.data as T;
          }
          return json as T;
        }
        return (await response.text()) as unknown as T;
      } catch (err: any) {
        // If ApiError with 4xx status (e.g. 400, 401, 403, 404), do not retry
        if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
          throw err;
        }

        lastError = err;

        // If we haven't reached max retries, wait with backoff (1s, 2s, 4s)
        if (attempt < maxRetries) {
          const backoffMs = Math.pow(2, attempt - 1) * 1000;
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      }
    }

    if (lastError instanceof ApiError) {
      throw lastError;
    }

    // Network failure after all retries: fallback to mock ONLY if USE_MOCK=true
    if (USE_MOCK) {
      const fallback = getMockFallback<T>(endpoint, restOptions.method);
      if (fallback !== undefined) {
        return fallback;
      }
    }

    throw new ApiError(lastError?.message || 'Server unreachable after retries', 0, null);
  } finally {
    clearWakeTimer();
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

// -------------------------------------------------------------
// Typed API Services for all system domains
// -------------------------------------------------------------

export const SheetsApi = {
  // Controller / Admin list
  getAll: (params?: { status?: string; examId?: string; assignedTo?: string }) => {
    const qs = params ? new URLSearchParams(params as any).toString() : '';
    return apiFetch<Sheet[]>(`/api/sheets${qs ? `?${qs}` : ''}`);
  },
  // Assigned to logged-in examiner
  getMine: () => apiFetch<Sheet[]>('/api/sheets/mine'),
  // Get sheet details with exam & marks
  getById: (sheetId: string) => apiFetch<Sheet>(`/api/sheets/${sheetId}`),
  // Start marking
  startMarking: (sheetId: string) =>
    apiFetch<{ success: boolean; sheetId: string }>(`/api/sheets/${sheetId}/start`, {
      method: 'POST',
    }),
  // Save question marks
  saveMarks: (sheetId: string, payload: {
    marks: Array<{
      qNo: number;
      marks: number;
      comment?: string;
      timeSpentSec?: number;
    }>;
  }) =>
    apiFetch<Sheet>(`/api/sheets/${sheetId}/marks`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  // Submit evaluation
  submit: (sheetId: string) =>
    apiFetch<Sheet>(`/api/sheets/${sheetId}/submit`, {
      method: 'POST',
    }),
  // Update score
  updateScore: (sheetId: string, payload: any) =>
    apiFetch<Sheet>(`/api/sheets/${sheetId}/score`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
};

export const AlertsApi = {
  getAll: (filters?: { type?: string; severity?: string; status?: string; sheetId?: string }) => {
    const qs = filters ? new URLSearchParams(filters as any).toString() : '';
    return apiFetch<Alert[]>(`/api/alerts${qs ? `?${qs}` : ''}`);
  },
  // Post violation from secure browser (window.secure)
  postViolation: (payload: {
    sheetId: string;
    type: 'WINDOW_BLUR' | 'SUSPICIOUS_PATTERN';
    message: string;
    metadata?: Record<string, any>;
  }) =>
    apiFetch<{ id: string; success: boolean }>('/api/alerts/violation', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  // Resolve alert
  resolve: (alertId: string, note: string) =>
    apiFetch<{ success: boolean }>(`/api/alerts/${alertId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),
};

export const AIApi = {
  evaluate: (payload: { sheetId: string; qNo: number }) =>
    apiFetch<{
      callId: string;
      suggestedMarks: number;
      confidence: number;
      transcription: string;
      matched: string[];
      missed: string[];
      reason: string;
      source?: string;
    }>('/api/ai/evaluate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  decision: (payload: {
    aiCallId: string;
    decision: 'accepted' | 'overridden';
    overrideMarks?: number;
    note: string;
  }) =>
    apiFetch<{ success: boolean; aiCallId: string }>('/api/ai/decision', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export const ModerationApi = {
  getQueue: () => apiFetch<Array<{
    sheet: Sheet;
    alerts: Alert[];
    exam: any;
    marks: any[];
  }>>('/api/moderation/queue'),
  takeAction: (sheetId: string, payload: {
    action: 'approve' | 'adjust' | 'sendback';
    reason: string;
    adjustedMarks?: Array<{
      qNo: number;
      marks: number;
      comment?: string;
    }>;
  }) =>
    apiFetch<{ success: boolean; sheetId: string; action: string }>(`/api/moderation/${sheetId}/action`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export const AnalyticsApi = {
  getMyStats: () => apiFetch<any>('/api/analytics/me'),
  getAllExaminers: () => apiFetch<ExaminerProfile[]>('/api/analytics/examiners'),
  getExamStats: (examId: string) => apiFetch<any>(`/api/analytics/exam/${examId}`),
};

export const AuditApi = {
  search: (filters?: {
    actor?: string;
    action?: string;
    sheetId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }) => {
    const qs = filters ? new URLSearchParams(filters as any).toString() : '';
    return apiFetch<{ entries: AuditEntry[]; count: number }>(`/api/audit${qs ? `?${qs}` : ''}`);
  },
  verify: () => apiFetch<{ valid: boolean; totalEntries: number; brokenAt?: number }>('/api/audit/verify'),
  getStatistics: () => apiFetch<any>('/api/audit/statistics'),
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
