/**
 * CORS Configuration
 * Reads from CORS_ORIGIN env (comma-separated list)
 * Example: http://localhost:3000,https://myapp.vercel.app
 */

function getCorsOrigins() {
  const corsOrigin = process.env.CORS_ORIGIN;
  
  if (!corsOrigin || corsOrigin === '*') {
    console.warn('[CORS] Using wildcard origin (*) - not recommended for production');
    return '*';
  }

  // Parse comma-separated origins
  const origins = corsOrigin
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0);

  console.log('[CORS] Allowed origins:', origins);
  return origins;
}

const allowedOrigins = getCorsOrigins();

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins === '*') {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn('[CORS] Blocked request from origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

const socketCorsOptions = {
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT'],
  credentials: true
};

module.exports = {
  corsOptions,
  socketCorsOptions
};
