import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// In frontend (Vite) apps, use `import.meta.env` and VITE_ prefixed vars.
// For local development create a `.env` file at the project root with VITE_ variables.
// Example: VITE_API_KEY=your_api_key
const {
  VITE_API_KEY,
  VITE_AUTH_DOMAIN,
  VITE_PROJECT_ID,
  VITE_STORAGE_BUCKET,
  VITE_MESSAGING_SENDER_ID,
  VITE_APP_ID,
} = import.meta.env as Record<string, string | undefined>;

const missing: string[] = [];
if (!VITE_API_KEY) missing.push('VITE_API_KEY');
if (!VITE_AUTH_DOMAIN) missing.push('VITE_AUTH_DOMAIN');
if (!VITE_PROJECT_ID) missing.push('VITE_PROJECT_ID');
if (!VITE_STORAGE_BUCKET) missing.push('VITE_STORAGE_BUCKET');
if (!VITE_MESSAGING_SENDER_ID) missing.push('VITE_MESSAGING_SENDER_ID');
if (!VITE_APP_ID) missing.push('VITE_APP_ID');

if (missing.length) {
  console.error(`Missing Vite env vars: ${missing.join(', ')}. Add them to a .env file at the frontend root.`);
  throw new Error(`Missing Vite env vars: ${missing.join(', ')}`);
}

const firebaseConfig = {
  apiKey: VITE_API_KEY as string,
  authDomain: VITE_AUTH_DOMAIN as string,
  projectId: VITE_PROJECT_ID as string,
  storageBucket: VITE_STORAGE_BUCKET as string,
  messagingSenderId: VITE_MESSAGING_SENDER_ID as string,
  appId: VITE_APP_ID as string,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);