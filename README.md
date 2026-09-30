# SAMADHAN X — AI-Powered Secure On-Screen Evaluation Platform

> **MPOnline Hackathon 2026 Submission**  
> A tamper-evident, AI-assisted digital answer-sheet evaluation and anomaly-detection system built for large-scale examination authorities like MPOnline / MPPEB.

---

## 🌐 Live Prototype

**➡️ [https://exam-net-tawny.vercel.app/](https://exam-net-tawny.vercel.app/)**

> Experience the full evaluation system with pre-loaded demo data. No installation required!

---

## 🏆 The Problem We Solve

Traditional paper-based evaluation of board/university exams suffers from:
- **Subjective bias** — examiners award marks inconsistently
- **No audit trail** — impossible to trace who changed what, and when
- **Slow throughput** — evaluators must physically receive, mark, and return paper bundles
- **Zero anomaly detection** — rubber-stamping, speed-marking, or favouritism goes undetected

**SAMADHAN X** digitises this entire pipeline — from scanned sheet upload through AI-assisted evaluation, anomaly detection, moderation, and cryptographically chained audit — and packages it a[...]

---

## ✨ Core Features

### 🧑‍💼 Three Role Portals (one login page, automatic routing)

| Role | What they do |
|---|---|
| **Examiner** | Receives assigned scanned answer sheets, evaluates questions one-by-one using rubric + AI suggestions, submits marks |
| **Moderator** | Reviews statistically flagged evaluations, approves/adjusts/sends-back sheets to examiners with a written reason |
| **Controller** | System admin — uploads sheets, creates exams, monitors live dashboard, resolves anomaly alerts, exports final CSV |

---

### 🤖 AI Evaluation Engine
- Sends scanned page images to an LLM (OpenAI/compatible) with the **question text**, **model answer**, and **rubric criteria**
- Returns: suggested marks, reasoning, which rubric criteria were matched/missed, and a transcription of the handwritten answer
- Examiner can **Accept** (one click) or **Override** (manually adjust) the AI suggestion — every decision is logged
- `USE_CACHED_AI=true` mode for demo/offline — pre-generated evaluation results from `cachedAIResults.json`

### 🛡️ Anomaly Detection (9 Planted Test Cases in Demo Data)
| Code | Anomaly | Trigger |
|---|---|---|
| A1 | Unmarked question | A question has no mark at submission |
| A3 | Over-maximum mark | Mark awarded exceeds `maxMarks` for that question |
| A5 | Speed anomaly | Question marked in < 25 seconds |
| P1 | Peer deviation | Examiner's average is >20% above cohort mean |
| P2 | Repeated totals | Identical total score on ≥ 3 sheets |
| P4 | Calibration drift | >40% gap vs. gold-standard calibration marks |
| P5 | Speed drift | Marking speed trend degrading over time |

### 🔐 Security & Integrity
- **Firebase Auth** JWT verification on every API request
- **Role-based access control** — examiners can only read/write their own assigned sheets; 403 for everything else
- **Identity firewall** — student name/roll number never appears in any API response; only the anonymised `sheetId` is exposed
- **Cryptographic audit chain** — every significant action (submit, override, moderation decision) is appended to an append-only `audit` collection with SHA-256 hash chaining. The seed script ve[...]
- **Electron Secure Mode** — the desktop wrapper (`window.secure`) locks the system into kiosk mode (no Alt+Tab, no screenshots, no clipboard) during active marking. Violations are posted to the[...]

### 📡 Real-Time Socket Pipeline
- **`sheet_updated`** — broadcast to the assigned examiner room when a sheet status changes
- **`anomaly_alert`** — instant toast notification to the controller on detection
- **`dashboard_tick`** — live stats pushed every 5 seconds to the controller dashboard without polling

### 🔢 Calibration System
- Every N sheets (configurable via `CALIBRATION_EVERY`), one blind calibration sheet (with known gold-standard marks) is inserted into an examiner's queue
- Calibration sheets are **indistinguishable** from real sheets — examiners do not know which is calibration
- The system computes the delta between the examiner's marks and gold marks as `P4 Calibration Drift`

---

## 🗂️ Project Architecture

```
MPOnline2026/
├── Website/
│   ├── backend/                    ← Node.js + Express + Socket.IO API server
│   │   ├── server.js               ← Entry point, middleware stack, Socket.IO init
│   │   ├── src/
│   │   │   ├── config/             ← Firebase Admin init, Firestore collections, anomaly thresholds
│   │   │   ├── middleware/         ← auth.js (JWT verify + role load), rate limiting
│   │   │   ├── routes/             ← REST endpoints (sheets, ai, alerts, moderation, analytics, export, audit…)
│   │   │   ├── services/           ← aiEvaluator, auditLog (hash-chained), anomalyDetector
│   │   │   ├── sockets/            ← Real-time event emitters + DashboardTicker
│   │   │   ├── schemas/            ← Zod validation schemas for all request bodies
│   │   │   └── seed/               ← Idempotent demo data seeder with SHA-256 audit chain
│   │   ├── .env.example
│   │   └── package.json
│   │
│   └── frontend/                   ← React 18 + Vite + TypeScript SPA
│       ├── src/
│       │   ├── pages/
│       │   │   ├── examiner/       ← IdentityCheck → ExaminerHome → MarkingWorkspace
│       │   │   ├── moderator/      ← ModerationQueue → ReviewPanel
│       │   │   └── controller/     ← LiveDashboard, SheetsManager, ExamSetup,
│       │   │                          AlertsPage, ExaminerAnalytics, AuditLog, ExportPage
│       │   ├── components/         ← SheetViewer (pan/zoom), RubricPanel, MarkEntry, AIAssistPanel…
│       │   ├── services/api.ts     ← All HTTP + Socket calls (with retry + cold-start banner)
│       │   ├── contexts/           ← AuthContext (Firebase + role), SocketContext
│       │   └── config/firebase.ts  ← Firebase Web SDK config from VITE_ env vars
│       ├── public/
│       │   ├── samples/            ← 80 pre-generated dummy answer sheet PNGs (SX-0001 … SX-0020, 4 pages each)
│       │   └── models/             ← face-api.js model files for face verification
│       ├── vercel.json             ← SPA rewrites + asset caching headers
│       └── .env.example
```

---

## 🔄 End-to-End Flow

```
Student writes exam on paper
        │
        ▼
Controller uploads scanned sheets (PDF/images)
        │
        ▼
Backend anonymises → assigns sheetId (SX-XXXX) → stores pages[] in Firestore
        │
        ▼
Examiner logs in → Face ID verification → Sees queue (GET /api/sheets/mine)
        │
        ▼
Examiner opens sheet → SheetViewer (pan/zoom) + Rubric + AI Suggest
        │
        ▼
Examiner saves marks (PUT /api/sheets/:id/marks/:qNo) → Autosave every 15s
        │
        ▼
Anomaly Engine runs on submit → flags if A1/A3/A5/P1/P2/P4/P5
        │
        ├─ Flagged? → Moderator reviews → Approve / Adjust / Send Back
        │
        └─ Clean? → Status = "evaluated" → Audit chain entry appended
                          │
                          ▼
                   Controller exports CSV
                   (marks + examiner IDs, never student identities)
```

---

## 🚀 Quick Start (Local Dev)

### Prerequisites
- Node.js ≥ 18
- A Firebase project with **Firestore** and **Firebase Auth (Email/Password)** enabled
- A `serviceAccountKey.json` Firebase Admin SDK key placed inside `Website/backend/`

### 1. Backend
```bash
cd Website/backend
npm install
cp .env.example .env
# Edit .env: set FIREBASE_SERVICE_ACCOUNT=serviceAccountKey.json, CORS_ORIGIN, etc.

npm run seed        # Seeds 7 demo users, 1 exam, 20 sheets, marks, AI calls, alerts & audit trail
npm run dev         # Server starts at http://localhost:5000
```

### 2. Frontend
```bash
cd Website/frontend
npm install
cp .env.example .env
# Edit .env: set VITE_BACKEND_URL=http://localhost:5000 and Firebase web config keys

npm run dev         # App starts at http://localhost:5173
```

### 3. Enable Firebase Auth
In your [Firebase Console](https://console.firebase.google.com):
1. Go to **Authentication → Sign-in method**
2. Enable **Email/Password** provider

---

## 🔑 Demo Credentials

After running `npm run seed`, the following accounts are ready:

| Email | Password | Role |
|---|---|---|
| `examiner1@demo.com` | `Demo123!` | Examiner (normal baseline) |
| `examiner2@demo.com` | `Demo123!` | Examiner (generous — P1 peer deviation planted) |
| `examiner3@demo.com` | `Demo123!` | Examiner (rushed — A5/P5 anomaly planted) |
| `examiner4@demo.com` | `Demo123!` | Examiner (repeated totals — P2 planted) |
| `examiner5@demo.com` | `Demo123!` | Examiner (calibration drift — P4 planted) |
| `moderator@demo.com` | `Demo123!` | Moderator |
| `controller@demo.com` | `Demo123!` | Controller |

> 💡 The login page has **one-click demo preset buttons** — no manual typing needed.

---

## 🌐 Production Deployment

### Backend → [Render](https://render.com)

| Setting | Value |
|---|---|
| **Root Directory** | `Website/backend` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Health Check Path** | `/api/health` |

**Required environment variables on Render:**

| Variable | Description |
|---|---|
| `NODE_ENV` | `production` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Full raw JSON of Firebase service account key (newlines handled automatically) |
| `AI_API_KEY` | OpenAI (or compatible) API key |
| `AI_MODEL` | e.g. `gpt-4o-mini` |
| `USE_CACHED_AI` | `false` for live AI; `true` for demo/free tier |
| `CORS_ORIGIN` | Your Vercel frontend URL |
| `FRONTEND_URL` | Same Vercel URL (for sample image links) |
| `CALIBRATION_EVERY` | e.g. `15` (insert 1 calibration sheet per 15 normal sheets) |
| `FAST_MARKING_RATIO` | e.g. `0.25` (flag if speed < 25% of expected time) |

### Frontend → [Vercel](https://vercel.com)

| Setting | Value |
|---|---|
| **Root Directory** | `Website/frontend` |
| **Framework** | Vite |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |

**Required environment variables on Vercel:** All `VITE_FIREBASE_*` keys + `VITE_BACKEND_URL` pointing at your Render URL + `VITE_USE_MOCK=false`.

---

## 🔌 Key API Endpoints

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/api/health` | Public | Health check (used by Render) |
| `GET` | `/api/sheets/mine` | Examiner | Fetch assigned sheets queue |
| `POST` | `/api/sheets/:id/start` | Examiner | Begin marking session |
| `PUT` | `/api/sheets/:id/marks/:qNo` | Examiner | Save mark for one question |
| `POST` | `/api/sheets/:id/submit` | Examiner | Finalise evaluation, run anomaly checks |
| `GET` | `/api/sheets` | Moderator/Controller | All sheets with optional `?status=` filter |
| `POST` | `/api/sheets/:id/moderation/action` | Moderator | Approve / adjust / send-back |
| `GET` | `/api/alerts` | Controller | All anomaly alerts |
| `PATCH` | `/api/alerts/:id/resolve` | Controller | Resolve an alert |
| `POST` | `/api/exams` | Controller | Create exam with questions + rubric |
| `GET` | `/api/analytics/examiner` | Controller | Per-examiner stats (speed, deviation) |
| `GET` | `/api/audit` | Controller | Full tamper-evident audit log |
| `GET` | `/api/export/csv` | Controller | Final marks CSV export |
| `POST` | `/api/ai/evaluate` | Examiner | Trigger AI evaluation for a question |
| `POST` | `/api/alerts/violation` | Examiner | Report Electron secure-mode violation |

---

## 🧪 Demo Scenario to Show Judges

1. **Login as `controller@demo.com`** → View the **Live Dashboard** — see 20 sheets across all statuses, 6 anomaly alerts already raised, real-time socket tick
2. **Click Alerts** → See the P1 Peer Deviation alert on Examiner 2, A3 Over-Maximum on SX-0002, A1 Unmarked Question on SX-0003
3. **Login as `examiner1@demo.com`** → Face identity verification → See your 4 assigned sheets
4. **Open SX-0001** → The MarkingWorkspace loads: scanned page in center, rubric on the right. Click **AI Assist** — see the AI's suggested marks + reasoning
5. **Accept or Override** → Marks auto-save every 15 seconds → **Submit**
6. **Login as `moderator@demo.com`** → See SX-0001 is now flagged, click **Review**, approve or adjust the marks
7. **Back as controller** → Go to **Audit Log** — see the full hash-chained trail of every action

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, React Router 6, Framer Motion |
| **Styling** | Vanilla CSS with custom design tokens, Lucide icons |
| **Auth** | Firebase Authentication (Email/Password + Google) |
| **Database** | Cloud Firestore (NoSQL) |
| **Backend** | Node.js 20, Express 4, Socket.IO 4 |
| **Validation** | Zod (env vars + all request bodies) |
| **AI** | OpenAI GPT-4o-mini (or cached fallback) |
| **Face Verify** | face-api.js (models served from `/public/models`) |
| **Desktop Shell** | Electron (kiosk + content protection for exam centres) |
| **Deployment** | Vercel (frontend) + Render (backend) |
| **Audit** | SHA-256 cryptographic hash chain stored in Firestore |

---

## 📁 Notable Files

| File | Purpose |
|---|---|
| [`backend/server.js`](Website/backend/server.js) | Express app, Socket.IO, global error handlers, morgan logging |
| [`backend/src/seed/seed.js`](Website/backend/src/seed/seed.js) | Fully idempotent seeder — creates Auth users, resets passwords, generates sample PNGs, plants 9 anomaly test cases, verifies a[...] |
| [`backend/src/services/anomalyDetector.js`](Website/backend/src/services/anomalyDetector.js) | All 7 anomaly detection rules |
| [`backend/src/services/auditLog.js`](Website/backend/src/services/auditLog.js) | Append-only, hash-chained audit trail |
| [`frontend/src/services/api.ts`](Website/frontend/src/services/api.ts) | Centralised API client with retry + cold-start banner |
| [`frontend/src/pages/examiner/MarkingWorkspace.tsx`](Website/frontend/src/pages/examiner/MarkingWorkspace.tsx) | Core evaluation UI — pan/zoom viewer, rubric, AI assist, secure mode |
| [`frontend/src/pages/controller/LiveDashboard.tsx`](Website/frontend/src/pages/controller/LiveDashboard.tsx) | Real-time controller dashboard |
| [`frontend/vercel.json`](Website/frontend/vercel.json) | SPA rewrite rules + asset caching |
| [`backend/.env.example`](Website/backend/.env.example) | All required backend environment variables documented |
| [`frontend/.env.example`](Website/frontend/.env.example) | All required frontend environment variables documented |

---

## 👥 Team

Built for the **MPOnline Hackathon 2026** by Team **ExamNet**.

---

*For any setup issues, check `backend/DEMO_CREDENTIALS.md` for the full credential reference and troubleshooting guide.*
