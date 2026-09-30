// ui.js runs in index.html inside BrowserWindow
// Communicates with main process via window.browserBridge / window.secure exposed by preload

const webview = document.getElementById('webview');
const urlbar = document.getElementById('urlbar');
const reloadBtn = document.getElementById('reload-btn');
const toggleModeBtn = document.getElementById('toggle-mode-btn');
const toolbar = document.getElementById('toolbar');
const statusLabel = document.getElementById('status-label');
const violationBanner = document.getElementById('violation-banner');

// Offline View Elements
const offlineView = document.getElementById('offline-view');
const offlineTargetUrl = document.getElementById('offline-target-url');
const offlineErrorInfo = document.getElementById('offline-error-info');
const offlineRetryBtn = document.getElementById('offline-retry-btn');
const offlineLocalBtn = document.getElementById('offline-local-btn');

let isSecureMode = false;
let violationTimeout = null;
let currentTargetUrl = 'https://samadhan-exam.vercel.app/examiner';

function showViolation(text) {
  if (!violationBanner) return;
  violationBanner.textContent = `⚠️ Security Event: ${text}`;
  violationBanner.style.display = 'block';
  clearTimeout(violationTimeout);
  violationTimeout = setTimeout(() => {
    violationBanner.style.display = 'none';
  }, 4000);
}

// Show clear offline page when target APP_URL fails to load
function showOfflineView(failedUrl, errorDescription, errorCode) {
  if (!offlineView) return;
  if (offlineTargetUrl) offlineTargetUrl.textContent = failedUrl || currentTargetUrl;
  if (offlineErrorInfo) {
    offlineErrorInfo.textContent = `${errorDescription || 'Connection Failed'} (${errorCode || 'ERR_UNREACHABLE'})`;
  }
  offlineView.style.display = 'flex';
}

function hideOfflineView() {
  if (offlineView) {
    offlineView.style.display = 'none';
  }
}

// Update UI based on secure marking mode
function updateModeUI(active) {
  isSecureMode = Boolean(active);
  if (isSecureMode) {
    // Toolbar is red with label "Secure marking mode" while active
    toolbar.classList.add('secure-active');
    statusLabel.textContent = 'Secure marking mode';
    toggleModeBtn.textContent = 'Exit Secure Mode';
    reloadBtn.disabled = true;
    reloadBtn.style.opacity = '0.5';
  } else {
    toolbar.classList.remove('secure-active');
    statusLabel.textContent = 'Standby Mode';
    toggleModeBtn.textContent = 'Enter Secure Mode';
    reloadBtn.disabled = false;
    reloadBtn.style.opacity = '1';
  }
}

// Initialize config and webview
async function init() {
  if (window.browserBridge && window.browserBridge.getConfig) {
    try {
      const config = await window.browserBridge.getConfig();
      if (config.APP_URL) {
        currentTargetUrl = config.APP_URL;
      }
      if (config.preloadPath) {
        // Ensure webview receives context isolation preload
        const normalizedPreload = config.preloadPath.replace(/\\/g, '/');
        webview.setAttribute('preload', `file://${normalizedPreload}`);
      }
      updateModeUI(config.isMarkingModeActive);
    } catch (e) {
      console.warn('Failed to get app config:', e);
    }
  }

  urlbar.value = currentTargetUrl;
  webview.src = currentTargetUrl;

  // Listen for mode changes from main process
  if (window.browserBridge && window.browserBridge.onMarkingModeChange) {
    window.browserBridge.onMarkingModeChange((active) => {
      updateModeUI(active);
    });
  }

  // Listen for violations sent to renderer
  if (window.browserBridge && window.browserBridge.onSecureViolation) {
    window.browserBridge.onSecureViolation((violation) => {
      if (violation.type === 'window_blur') {
        showViolation('Window lost focus - blur logged');
      } else if (violation.type === 'blocked_shortcut') {
        showViolation(`Blocked key sequence: ${violation.shortcut}`);
      }
    });
  }
}

// Webview lifecycle and failure detection
webview.addEventListener('did-fail-load', (e) => {
  // Ignore code -3 (ERR_ABORTED) caused by normal redirects or user cancelling navigation
  if (e.errorCode === -3) return;
  showOfflineView(e.validatedURL || currentTargetUrl, e.errorDescription, e.errorCode);
});

webview.addEventListener('did-finish-load', () => {
  hideOfflineView();
});

// Reload button
reloadBtn.addEventListener('click', () => {
  if (!isSecureMode) {
    hideOfflineView();
    webview.reload();
  }
});

// Toggle button
toggleModeBtn.addEventListener('click', () => {
  if (window.secure && window.secure.setMarkingMode) {
    window.secure.setMarkingMode(!isSecureMode);
  }
});

// Offline page actions
if (offlineRetryBtn) {
  offlineRetryBtn.addEventListener('click', () => {
    hideOfflineView();
    webview.loadURL(currentTargetUrl);
  });
}

if (offlineLocalBtn) {
  offlineLocalBtn.addEventListener('click', () => {
    currentTargetUrl = 'http://localhost:5173/examiner';
    urlbar.value = currentTargetUrl;
    hideOfflineView();
    webview.loadURL(currentTargetUrl);
  });
}

// Track URL updates
webview.addEventListener('did-navigate', (e) => {
  urlbar.value = e.url;
});

webview.addEventListener('did-navigate-in-page', (e) => {
  urlbar.value = e.url;
});

window.addEventListener('DOMContentLoaded', () => {
  init();
});
