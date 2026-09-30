# SAMADHAN Secure Marking Browser — Windows Verification Test Log

**Application Name**: SAMADHAN Secure Marking Browser  
**App ID**: `com.samadhan.securemarking`  
**Target Environment**: Windows 10 / 11 (64-bit)  
**Binary Tested**: NSIS Installer / Portable Executable (`dist/`)  
**Backend URL**: `https://samadhan-backend.onrender.com` (or local `http://localhost:5000`)  
**Frontend URL**: `https://samadhan-exam.vercel.app/examiner` (or local `http://localhost:5173/examiner`)  

---

## Test Execution Metadata
- **Tester Name**: __________________________
- **Test Date**: __________________________
- **Windows OS Build**: __________________________
- **Execution Mode**: [ ] Installed via NSIS [ ] Standalone Portable EXE

---

## Pre-Test Checklist
- [ ] Backend is running and reachable (`/api/health` returns `{ "status": "ok" }`).
- [ ] Frontend is deployed on Vercel or running locally via `npm run dev`.
- [ ] Logged in as an Examiner account (`examiner1@demo.com`) on the browser window.
- [ ] Controller Dashboard is open simultaneously in a standard Chrome window (`/controller/alerts`) to observe incoming realtime audit violations.

---

## Test Suite: Security & Kiosk Enforcement

| # | Test Case Name | Action / Steps to Perform | Expected System Behavior | Result (PASS / FAIL) | Notes / Observations |
|---|---|---|---|:---:|---|
| **1** | **Alt+Tab / Window Focus Loss** | 1. Enter an active evaluation script (`/examiner/mark/SX-0001`).<br>2. Confirm kiosk mode is active.<br>3. Press `Alt + Tab` or attempt to switch windows. | - Application catches `blur` event and blocks focus change where OS allows.<br>- A warning banner displays: *"Window lost focus - blur detected"*.<br>- Security violation `WINDOW_BLUR` is emitted via IPC and logged. | | |
| **2** | **Copy / Paste Shortcut Blocking** | 1. In Marking Workspace, select model rubric text or question content.<br>2. Press `Ctrl + C`, `Ctrl + V`, `Ctrl + X`, `Ctrl + A`, or `Escape`. | - Keystrokes are intercepted by global shortcuts.<br>- No text is copied to the system clipboard.<br>- Warning banner appears in the top-right toolbar: *"Blocked key sequence"*.<br>- Toast notification indicates restricted shortcut attempt. | | |
| **3** | **Screenshot with Content Protection** | 1. While inside the marking workspace, attempt a screenshot using:<br>   - `PrintScreen` key<br>   - `Win + Shift + S` (Windows Snipping Tool)<br>   - Third-party recording tool (OBS, Discord, ShareX). | - `PrintScreen` shortcut is intercepted and blocked.<br>- Windows Snipping Tool and screen capture utilities render the application window as completely **blacked-out / transparent** (`setContentProtection(true)`).<br>- No evaluation or student data is leaked into the capture buffer. | | |
| **4** | **Leaving Marking Mode** | 1. Click "Save Draft" or "Submit & Finalize", or navigate back to `/examiner` queue.<br>2. Observe window behavior. | - Kiosk mode disengages automatically (`setKiosk(false)`).<br>- `alwaysOnTop` is removed.<br>- Content protection is disabled (`setContentProtection(false)`).<br>- Blocked shortcuts are deregistered.<br>- Toolbar transitions from red (*"Secure marking mode"*) back to dark slate (*"Standby Mode"*). | | |
| **5** | **Violation Event Reaching Controller** | 1. Trigger a violation inside the marking workspace (e.g., press `Ctrl + C` or cause window blur).<br>2. Check Controller terminal or Controller alerts page (`/controller/alerts`). | - Violation is posted to `/api/alerts/violation`.<br>- Socket broadcast delivers `security_violation` payload to the Controller in real time.<br>- Controller alert bell rings and a new security alert card appears in the live audit feed with exact timestamp, sheet ID, and examiner ID. | | |

---

## Auxiliary Verification Checks

| Check Item | Action | Expected Behavior | Result (PASS / FAIL) |
|---|---|---|:---:|
| **Camera-Only Permissions** | Start biometric / identity check | Camera stream activates without OS popup; microphone access remains strictly blocked | |
| **Offline Page Recovery** | Disconnect Wi-Fi or enter offline state | Clear offline error page renders with "Retry Connection" & "Switch to Local" buttons instead of blank white window | |
| **Deep Link Preservation** | Open directly to `/examiner/mark/SX-0001` | Loads the specific answer script directly without redirecting to login or 404 | |

---

## Sign-off
- **Lead Evaluator Signature**: __________________________
- **Final Approval Status**: [ ] CERTIFIED SECURE [ ] REMEDIATION REQUIRED
