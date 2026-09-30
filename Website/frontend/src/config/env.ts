/**
 * Centralized, type-safe environment configuration.
 * All environment variables must be accessed through this file.
 */

const env = import.meta.env as Record<string, string | undefined>;

// Backend API URL (default: http://localhost:5000)
export const BACKEND_URL: string = (
  env.VITE_BACKEND_URL || 'http://localhost:5000'
).replace(/\/$/, '');

// Mock Mode toggle (default: false)
export const USE_MOCK: boolean = env.VITE_USE_MOCK === 'true';

// Firebase Configuration (supports both VITE_FIREBASE_* and legacy VITE_* prefixes)
export const FIREBASE_CONFIG = {
  apiKey: env.VITE_FIREBASE_API_KEY || env.VITE_API_KEY || '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || env.VITE_AUTH_DOMAIN || '',
  projectId: env.VITE_FIREBASE_PROJECT_ID || env.VITE_PROJECT_ID || '',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || env.VITE_STORAGE_BUCKET || '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || env.VITE_MESSAGING_SENDER_ID || '',
  appId: env.VITE_FIREBASE_APP_ID || env.VITE_APP_ID || '',
};

// Validation check
const missingFirebaseKeys: string[] = [];
if (!FIREBASE_CONFIG.apiKey) missingFirebaseKeys.push('VITE_FIREBASE_API_KEY');
if (!FIREBASE_CONFIG.authDomain) missingFirebaseKeys.push('VITE_FIREBASE_AUTH_DOMAIN');
if (!FIREBASE_CONFIG.projectId) missingFirebaseKeys.push('VITE_FIREBASE_PROJECT_ID');

if (missingFirebaseKeys.length > 0 && !USE_MOCK) {
  console.warn(
    `[Config Warning] Missing Firebase environment variables: ${missingFirebaseKeys.join(', ')}. Check frontend/.env.`
  );
}

export default {
  BACKEND_URL,
  USE_MOCK,
  FIREBASE_CONFIG,
};
