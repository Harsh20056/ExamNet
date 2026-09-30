#!/usr/bin/env node

/**
 * SAMADHAN X — End-to-End Smoke Test Script
 * 
 * Verifies backend deployment health, authentication security,
 * and examiner queue endpoints against any local or deployed URL.
 * 
 * Usage:
 *   node scripts/smoke-test.js [TARGET_URL] [FIREBASE_ID_TOKEN]
 * 
 * Examples:
 *   node scripts/smoke-test.js http://localhost:5000
 *   node scripts/smoke-test.js https://samadhan-backend.onrender.com eyJhbGci...
 */

const targetUrl = (process.argv[2] || process.env.TARGET_URL || process.env.VITE_BACKEND_URL || 'http://localhost:5000').replace(/\/+$/, '');
const token = process.argv[3] || process.env.TEST_TOKEN || process.env.FIREBASE_TOKEN || null;

console.log('====================================================');
console.log('  SAMADHAN X — API Smoke Test Runner');
console.log('====================================================');
console.log(`Target URL : ${targetUrl}`);
console.log(`Auth Token : ${token ? `${token.substring(0, 16)}...` : 'None provided (skipping authenticated checks)'}`);
console.log('----------------------------------------------------\n');

let passCount = 0;
let failCount = 0;

async function runCheck(name, fn) {
  process.stdout.write(`[TEST] ${name} ... `);
  const start = Date.now();
  try {
    await fn();
    const duration = Date.now() - start;
    console.log(`\x1b[32mPASS\x1b[0m (${duration}ms)`);
    passCount++;
  } catch (err) {
    const duration = Date.now() - start;
    console.log(`\x1b[31mFAIL\x1b[0m (${duration}ms)`);
    console.error(`       Error: ${err.message}\n`);
    failCount++;
  }
}

async function main() {
  // Test 1: Health Check Endpoint
  await runCheck('GET /api/health (Service Health & Uptime)', async () => {
    const res = await fetch(`${targetUrl}/api/health`);
    if (!res.ok) {
      throw new Error(`Expected HTTP 200, got ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    if (!data || data.status !== 'ok') {
      throw new Error(`Expected { status: "ok" }, got: ${JSON.stringify(data)}`);
    }
  });

  // Test 2: Unauthenticated Security Enforcement
  await runCheck('GET /api/sheets/mine without token (Expect 401 Unauthorized)', async () => {
    const res = await fetch(`${targetUrl}/api/sheets/mine`);
    if (res.status !== 401) {
      throw new Error(`Expected HTTP 401 for request without token, got ${res.status}`);
    }
    const body = await res.json().catch(() => ({}));
    if (!body.error && !body.message) {
      throw new Error('Expected error description in 401 JSON body');
    }
  });

  // Test 3: Invalid Token Security Enforcement
  await runCheck('GET /api/sheets/mine with invalid token (Expect 401 Unauthorized)', async () => {
    const res = await fetch(`${targetUrl}/api/sheets/mine`, {
      headers: {
        'Authorization': 'Bearer invalid.token.payload'
      }
    });
    if (res.status !== 401) {
      throw new Error(`Expected HTTP 401 for invalid token, got ${res.status}`);
    }
  });

  // Test 4: Authenticated Examiner Queue (if token provided)
  if (token) {
    await runCheck('GET /api/sheets/mine with valid token (Examiner Queue & Anonymization)', async () => {
      const res = await fetch(`${targetUrl}/api/sheets/mine`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Authenticated request failed with ${res.status}: ${text}`);
      }

      const json = await res.json();
      const sheets = json.data || json;

      if (!Array.isArray(sheets)) {
        throw new Error(`Expected array of sheets, got: ${typeof sheets}`);
      }

      // Security check: confirm NO identity fields leaked
      for (const sheet of sheets) {
        if ('rollNo' in sheet || 'studentName' in sheet || 'identityMap' in sheet) {
          throw new Error(`CRITICAL SECURITY FAILURE: Student identity leaked in sheet ${sheet.id}`);
        }
      }

      console.log(`\n       -> Retrieved ${sheets.length} assigned sheets for examiner`);
    });
  } else {
    console.log('\x1b[33m[INFO] Skipping authenticated /api/sheets/mine test (Pass token as argument to run).\x1b[0m\n');
  }

  console.log('----------------------------------------------------');
  console.log(`Results: ${passCount} Passed, ${failCount} Failed`);
  console.log('====================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Smoke test runner fatal error:', err);
  process.exit(1);
});
