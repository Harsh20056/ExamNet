const { z } = require('zod');

const envSchema = z.object({
  PORT: z.string().default('5000').transform((v) => parseInt(v, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FIREBASE_SERVICE_ACCOUNT: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default('gpt-4o-mini'),
  USE_CACHED_AI: z.string().default('true').transform((v) => v === 'true'),
  CORS_ORIGIN: z.string().default('http://localhost:5173,http://localhost:3000'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  CALIBRATION_EVERY: z.string().default('15').transform((v) => parseInt(v, 10)),
  FAST_MARKING_RATIO: z.string().default('0.25').transform((v) => parseFloat(v)),
  SEED_DEMO_PASSWORD: z.string().default('Demo123!'),
}).refine(
  (data) => Boolean(data.FIREBASE_SERVICE_ACCOUNT || data.FIREBASE_SERVICE_ACCOUNT_JSON),
  {
    message: 'Either FIREBASE_SERVICE_ACCOUNT (file path) or FIREBASE_SERVICE_ACCOUNT_JSON (JSON string) must be provided.',
    path: ['FIREBASE_SERVICE_ACCOUNT'],
  }
);

function validateEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('\n❌ [FATAL] Environment variable validation failed:');
    result.error.issues.forEach((issue) => {
      const field = issue.path.join('.') || 'Environment';
      console.error(`  - ${field}: ${issue.message}`);
    });
    console.error('\nPlease check your backend/.env against backend/.env.example.\n');
    throw new Error(`Environment validation failed: ${result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')}`);
  }
  return result.data;
}

const env = validateEnv();

module.exports = {
  env,
  validateEnv,
};
