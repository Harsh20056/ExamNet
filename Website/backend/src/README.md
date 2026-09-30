# Backend Foundation Documentation

## Architecture Overview

This backend follows a modular architecture with clear separation of concerns:

```
src/
├── config/          # Configuration modules
├── middleware/      # Express middleware (auth, validation, errors)
├── routes/          # API route handlers
├── services/        # Business logic layer
├── sockets/         # Socket.io event handlers
└── seed/            # Mock data and seed scripts
```

## Key Features

### 1. Authentication & Authorization
- **Firebase Admin SDK** integration for JWT token verification
- **Role-based access control** (RBAC) with three roles:
  - `examiner` - Marks and grades exam papers
  - `moderator` - Reviews and moderates marked papers
  - `controller` - Administrative access, exam setup

### 2. Security Middleware
- **Helmet.js** - Security headers
- **CORS** - Configurable cross-origin resource sharing
- **Rate Limiting** - Protection against abuse (100 requests/15min per IP)
- **Zod Validation** - Strict request body validation with unknown field rejection

### 3. Error Handling
- Centralized error handler
- Async route wrapper to catch promise rejections
- Consistent error response format
- Development vs production error detail levels

## Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Server
PORT=5000
NODE_ENV=development

# Firebase Admin SDK
FIREBASE_SERVICE_ACCOUNT=/path/to/serviceAccountKey.json
# Or use JSON string for deployment:
# FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}

# CORS
CORS_ORIGIN=http://localhost:5173,http://localhost:3000,https://your-app.vercel.app

# SMTP (for OTP emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# AI Service
AI_API_KEY=your-api-key
AI_MODEL=gpt-4o-mini
USE_CACHED_AI=false
```

### Firebase Setup

1. Create a Firebase project at https://console.firebase.google.com
2. Go to Project Settings → Service Accounts
3. Click "Generate New Private Key"
4. Save the JSON file and reference it in `FIREBASE_SERVICE_ACCOUNT`

### Firestore User Schema

Users must exist in Firestore with this structure:

```
users/{uid}
  ├── role: "examiner" | "moderator" | "controller"
  ├── name: string
  ├── email: string
  └── createdAt: ISO timestamp
```

## Middleware Usage

### Authentication

Protect routes by requiring a valid Firebase ID token:

```javascript
const authenticate = require('./src/middleware/auth');

// Protected route
app.get('/api/protected', authenticate, (req, res) => {
  // req.user contains { uid, role, name, email }
  res.json({ message: `Hello ${req.user.name}` });
});
```

### Role-Based Authorization

Restrict access to specific roles:

```javascript
const authenticate = require('./src/middleware/auth');
const requireRole = require('./src/middleware/requireRole');

// Only examiners and moderators can access
app.get('/api/papers', 
  authenticate, 
  requireRole(['examiner', 'moderator']), 
  (req, res) => {
    res.json({ papers: [] });
  }
);
```

### Request Validation

Validate request bodies with Zod schemas:

```javascript
const { z } = require('zod');
const { validateRequest } = require('./src/middleware/validation');

const createStudentSchema = z.object({
  name: z.string().min(1).max(100),
  roll: z.string().min(1).max(20),
  seat: z.string().min(1).max(10)
}).strict(); // Rejects unknown fields

app.post('/api/students',
  validateRequest(createStudentSchema),
  (req, res) => {
    // req.body is validated and typed
    res.json({ success: true });
  }
);
```

### Async Error Handling

Wrap async route handlers to automatically catch errors:

```javascript
const { asyncHandler } = require('./src/middleware/errorHandler');

app.get('/api/data', asyncHandler(async (req, res) => {
  const data = await fetchDataFromDB();
  res.json(data);
  // No try-catch needed - errors are caught automatically
}));
```

## API Routes

### Health Check (No Auth)
```http
GET /api/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2026-09-29T12:00:00.000Z",
  "service": "SAMADHAN X Backend",
  "version": "1.0.0",
  "environment": "development"
}
```

### Existing Routes (Legacy)

All existing routes from the original `server.js` remain unchanged:

- `POST /api/send-otp` - Generate and send OTP
- `POST /api/verify-otp` - Verify OTP code
- `GET /api/active-center` - Get active center
- `POST /api/active-center` - Set active center
- `GET /api/students` - Get all students
- `POST /api/students` - Add student
- `PUT /api/students/:id/status` - Update student status
- `PUT /api/students/:id` - Update student
- `PUT /api/students/roll/:roll` - Update student by roll
- `DELETE /api/students/:id` - Delete student
- `POST /api/cheat` - Report cheating attempt
- `GET /api/active-exam-paper` - Get active exam paper
- `GET /api/broadcast-stats` - Get broadcast statistics
- `POST /api/publish-exam-paper` - Publish exam paper
- `POST /api/reset-exam-paper` - Reset exam paper
- `POST /api/submit-exam` - Submit exam answers

## Socket.io Events

### Server → Client
- `exam_paper_published` - Exam paper broadcast
- `broadcast_stats_updated` - PDF delivery statistics
- `student_added` - New student added
- `student_updated` - Student record updated
- `student_deleted` - Student deleted
- `active_center_changed` - Active center changed
- `cheating_attempt` - Cheating detected
- `exam_paper_reset` - Exam paper cleared

### Client → Server
- `connection` - Client connects
- `paper_received_ack` - Student acknowledges PDF receipt
- `student_intent_update` - Student updates intent status
- `disconnect` - Client disconnects

## Migration Path

The foundation is designed for incremental migration:

### Phase 1: Use New Middleware (Current)
- Security headers and rate limiting active
- New routes can use authentication
- Existing routes still work unchanged

### Phase 2: Migrate Routes (Future)
- Move route handlers to `src/routes/`
- Add authentication and validation
- Extract business logic to `src/services/`

### Phase 3: Migrate Socket Handlers (Future)
- Move Socket.io handlers to `src/sockets/`
- Add authentication for socket connections
- Implement room-based broadcasting

### Phase 4: Add Database (Future)
- Replace in-memory storage with PostgreSQL/MongoDB
- Implement data persistence
- Add database migrations

## Testing

### Manual Testing with curl

```bash
# Health check
curl http://localhost:5000/api/health

# Test authentication (requires valid Firebase token)
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:5000/api/protected

# Test validation
curl -X POST http://localhost:5000/api/students \
     -H "Content-Type: application/json" \
     -d '{"name":"John","roll":"001","seat":"A1"}'
```

### Testing Firebase Auth

1. Get a Firebase ID token from your frontend
2. Use it in the Authorization header: `Bearer <token>`
3. The middleware will verify and load user data

## Troubleshooting

### Firebase Admin Not Working
- Ensure `FIREBASE_SERVICE_ACCOUNT` points to valid JSON
- Check file permissions on the service account file
- Verify Firebase project is active

### CORS Errors
- Add your frontend URL to `CORS_ORIGIN` in `.env`
- Separate multiple origins with commas
- Restart server after changing `.env`

### Rate Limit Hit
- Default: 100 requests per 15 minutes per IP
- Adjust in `server.js` if needed for development
- Consider per-route limits for production

### Validation Errors
- Zod rejects unknown fields by default (strict mode)
- Check request payload matches schema exactly
- Review error details in response

## Best Practices

1. **Always use authentication** for sensitive routes
2. **Validate all inputs** with Zod schemas
3. **Use asyncHandler** for async route handlers
4. **Log errors** but don't expose stack traces in production
5. **Use ISO timestamps** (UTC) for all datetime fields
6. **Implement proper error messages** for users
7. **Test CORS configuration** before deploying
8. **Rotate API keys** regularly
9. **Monitor rate limits** in production
10. **Keep dependencies updated** for security patches

## Next Steps

1. Migrate existing routes to use authentication
2. Add Zod validation schemas for all endpoints
3. Extract business logic to service layer
4. Implement database persistence
5. Add comprehensive error logging
6. Set up automated testing
7. Configure production environment variables
8. Implement API documentation (Swagger/OpenAPI)
