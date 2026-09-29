// This directory contains all the mock API calls for SAMADHAN X frontend.

export const fetchMockData = async () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ status: 'success', data: [] });
    }, 1000);
  });
};

export interface IdentityFailureReport {
  examinerEmail?: string;
  reason: string;
  distance?: number;
  timestamp: string;
}

/**
 * Placeholder function to report biometric identity verification failure
 */
export async function reportIdentityFailure(report: IdentityFailureReport): Promise<{ success: boolean; alertId: string }> {
  console.warn('[SECURITY] Identity verification failed:', report);
  
  // Persist locally for audit
  try {
    const existing = JSON.parse(localStorage.getItem('identity_failure_reports') || '[]');
    existing.push(report);
    localStorage.setItem('identity_failure_reports', JSON.stringify(existing));
  } catch (err) {
    console.error('Failed to log identity failure to localStorage', err);
  }

  return { success: true, alertId: `alert-${Date.now()}` };
}

