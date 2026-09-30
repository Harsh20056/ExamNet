const { app, BrowserWindow, globalShortcut, ipcMain, session, webContents } = require('electron');
const path = require('path');
const fs = require('fs');

// Set application user model ID for Windows notifications & taskbar
app.setAppUserModelId('com.samadhan.securemarking');

// Load config.json next to executable or in __dirname
let fileConfig = {};
try {
  const exeConfigPath = path.join(path.dirname(process.execPath), 'config.json');
  const localConfigPath = path.join(__dirname, 'config.json');
  const targetConfig = fs.existsSync(exeConfigPath) ? exeConfigPath : (fs.existsSync(localConfigPath) ? localConfigPath : null);

  if (targetConfig) {
    fileConfig = JSON.parse(fs.readFileSync(targetConfig, 'utf-8'));
    console.log('[Browser] Loaded configuration from:', targetConfig);
  }
} catch (err) {
  console.warn('Failed to parse config.json:', err.message);
}

// 1. Read APP_URL from env or config.json next to executable (default: deployed frontend + /examiner)
const defaultProductionUrl = 'https://samadhan-exam.vercel.app/examiner';
let APP_URL = process.env.APP_URL || fileConfig.APP_URL || defaultProductionUrl;

// Normalize URL to ensure /examiner is loaded if pointing to domain root
try {
  const parsed = new URL(APP_URL);
  if (!parsed.pathname || parsed.pathname === '/' || parsed.pathname === '') {
    parsed.pathname = '/examiner';
    APP_URL = parsed.toString();
  }
} catch {
  // If not valid absolute URL string, leave as is
}

const BACKEND_URL = process.env.BACKEND_URL || fileConfig.BACKEND_URL || 'https://samadhan-backend.onrender.com';

let mainWindow = null;
let isMarkingModeActive = false;
let isQuitting = false;

// Shortcuts to block during secure marking mode
const BLOCKED_SHORTCUTS = [
  'CommandOrControl+C',
  'CommandOrControl+V',
  'CommandOrControl+X',
  'CommandOrControl+A',
  'Escape',
  'Alt+Tab',
  'CommandOrControl+Tab',
  'CommandOrControl+P',
  'PrintScreen',
  'F11',
  'F12'
];

// Broadcast a security violation event to both mainWindow and all child webContents (e.g. webview)
function broadcastViolation(violation) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('secure-violation', violation);
  }

  try {
    const allContents = webContents.getAllWebContents();
    allContents.forEach((wc) => {
      try {
        if (!wc.isDestroyed()) {
          wc.send('secure-violation', violation);
        }
      } catch {
        // Ignore destroyed or unreachable webContents
      }
    });
  } catch {
    // Ignore
  }
}

function registerBlockedShortcuts() {
  BLOCKED_SHORTCUTS.forEach((shortcut) => {
    try {
      globalShortcut.register(shortcut, () => {
        if (isMarkingModeActive && mainWindow && !mainWindow.isDestroyed()) {
          // Send event to renderer via IPC (main process never handles credentials)
          broadcastViolation({
            type: 'blocked_shortcut',
            shortcut,
            timestamp: new Date().toISOString()
          });
        }
      });
    } catch (e) {
      console.warn(`Could not register shortcut ${shortcut}:`, e.message);
    }
  });
}

function unregisterBlockedShortcuts() {
  BLOCKED_SHORTCUTS.forEach((shortcut) => {
    try {
      globalShortcut.unregister(shortcut);
    } catch {
      // Ignore
    }
  });
}

function setMarkingMode(on) {
  isMarkingModeActive = Boolean(on);

  if (!mainWindow || mainWindow.isDestroyed()) return;

  if (isMarkingModeActive) {
    // Requirement 3: setKiosk(true), setAlwaysOnTop(true), setContentProtection(true), register blocked shortcuts
    mainWindow.setKiosk(true);
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.setContentProtection(true);
    registerBlockedShortcuts();

    // Inform renderer UI to turn toolbar red with "Secure marking mode"
    mainWindow.webContents.send('marking-mode-changed', true);
  } else {
    // false undoes all of it; kiosk is off outside the marking workspace
    mainWindow.setContentProtection(false);
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setKiosk(false);
    unregisterBlockedShortcuts();

    // Inform renderer UI to reset toolbar
    mainWindow.webContents.send('marking-mode-changed', false);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    title: 'SAMADHAN Secure Marking Browser',
    kiosk: false, // Kiosk is OFF by default
    alwaysOnTop: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,  // Turn contextIsolation ON
      nodeIntegration: false,  // Turn nodeIntegration OFF
      sandbox: false,
      webviewTag: true
    }
  });

  mainWindow.loadFile('index.html');

  // On window blur while in secure marking mode, broadcast violation event
  mainWindow.on('blur', () => {
    if (isMarkingModeActive && mainWindow && !mainWindow.isDestroyed()) {
      broadcastViolation({
        type: 'window_blur',
        message: 'Window lost focus while secure marking mode was active',
        timestamp: new Date().toISOString()
      });
    }
  });

  mainWindow.on('close', (e) => {
    if (isMarkingModeActive && !isQuitting) {
      e.preventDefault();
    }
  });
}

// 4. Grant camera permission ONLY (no microphone) across main session & any webview guests
function setupPermissions(targetSession) {
  targetSession.setPermissionRequestHandler((wc, permission, callback, details) => {
    if (permission === 'camera' || permission === 'videoCapture') {
      return callback(true);
    }
    if (permission === 'media') {
      if (details && details.mediaTypes && details.mediaTypes.includes('audio') && !details.mediaTypes.includes('video')) {
        return callback(false); // Disallow audio-only requests
      }
      return callback(true); // Allow camera/video
    }
    // Block microphone and other sensitive permissions
    if (permission === 'microphone' || permission === 'audioCapture') {
      return callback(false);
    }
    if (permission === 'display-capture' || permission === 'geolocation') {
      return callback(false);
    }
    if (permission === 'fullscreen') {
      return callback(true);
    }
    return callback(false);
  });

  targetSession.setPermissionCheckHandler((wc, permission) => {
    if (permission === 'camera' || permission === 'videoCapture') {
      return true;
    }
    if (permission === 'microphone' || permission === 'audioCapture') {
      return false;
    }
    return false;
  });
}

app.whenReady().then(() => {
  setupPermissions(session.defaultSession);

  // Hook into any child web-contents created (e.g. webview)
  app.on('web-contents-created', (event, contents) => {
    if (contents.session && contents.session !== session.defaultSession) {
      setupPermissions(contents.session);
    }
  });

  createWindow();
});

// IPC handler: setMarkingMode(on)
ipcMain.on('set-marking-mode', (event, on) => {
  setMarkingMode(on);
});

// Provide initial app configuration to renderer (APP_URL, BACKEND_URL, preloadPath)
ipcMain.handle('get-app-config', () => {
  return {
    APP_URL,
    BACKEND_URL,
    isMarkingModeActive,
    preloadPath: path.join(__dirname, 'preload.js')
  };
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
