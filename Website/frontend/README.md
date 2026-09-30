# SAMADHAN X Frontend
AI-assisted on-screen evaluation and proctoring interface built with Vite, React 19, TypeScript, TailwindCSS, and Lucide React.

## Deploy on Vercel

1. Import the repository in [Vercel](https://vercel.com).
2. Set **Root Directory** to `Website/frontend`.
3. Framework Preset will auto-detect as **Vite**.
4. Build command: `npm run build`
5. Output directory: `dist`
6. Add the following Environment Variables in the Vercel project settings:

| Variable | Description |
|---|---|
| `VITE_BACKEND_URL` | Base URL of deployed Render backend (e.g. `https://samadhan-backend.onrender.com`) |
| `VITE_USE_MOCK` | Set to `false` for live production Firebase & backend connectivity |
| `VITE_FIREBASE_API_KEY` | Firebase Web API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Authentication Domain (`samadhanexam.firebaseapp.com`) |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Project ID (`samadhanexam`) |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage Bucket (`samadhanexam.firebasestorage.app`) |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Cloud Messaging Sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase Web App ID |

### Features configured for Vercel:
- **SPA Deep Linking**: `vercel.json` rewrites all non-file routes to `/index.html` so direct navigation (e.g. `/examiner/mark/SX-0001`) works smoothly.
- **Asset Caching**: Long-term immutable caching (`Cache-Control: public, max-age=31536000, immutable`) for all `/assets/*` chunks.
- **face-api.js Models**: Loaded statically from `/models` directory in `public/models`.
- **Backend Cold Start Resilience**: Automatic 3-stage exponential backoff retry and friendly notification banner when Render free-tier instance wakes up.
