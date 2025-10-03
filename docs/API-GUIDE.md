# ServiceLink API Usage Guide

**Version**: 1.0
**Last Updated**: 2025-10-03
**API Base URL**: `https://api.servicelink.com` (prod) | `http://localhost:3001` (dev)

## Quick Start

**Interactive API Documentation**: https://api.servicelink.com/docs (Swagger UI)

### Authentication

All endpoints except public search require JWT authentication:

```bash
# 1. Sign up
curl -X POST https://api.servicelink.com/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "name": "John Doe",
    "role": "customer"
  }'

# 2. Login (get JWT token)
curl -X POST https://api.servicelink.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'

# Response:
# {
#   "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "user": { "id": "...", "email": "...", "role": "customer" }
# }

# 3. Use token in subsequent requests
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
curl -H "Authorization: Bearer $TOKEN" \
  https://api.servicelink.com/jobs/mine
```

---

## Core Workflows

### 1. Customer Journey: Request a Service

```bash
# Step 1: Search for providers
curl "https://api.servicelink.com/providers/search?q=plumbing&lat=37.7749&lng=-122.4194&radiusKm=10"

# Step 2: Create a job
curl -X POST https://api.servicelink.com/jobs \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Fix kitchen sink leak",
    "description": "Sink is leaking under the cabinet"
  }'
# Response: { "id": "job_abc123", "title": "...", "status": "pending_quotes" }

# Step 3: View quotes from providers
curl -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  https://api.servicelink.com/jobs/job_abc123/quotes

# Step 4: Accept a quote
curl -X POST https://api.servicelink.com/jobs/job_abc123/quotes/quote_xyz456/accept \
  -H "Authorization: Bearer $CUSTOMER_TOKEN"

# Step 5: View assignment details
curl -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  https://api.servicelink.com/jobs/job_abc123

# Step 6: Verify completion after service
curl -X POST https://api.servicelink.com/assignments/assign_789/verify-complete \
  -H "Authorization: Bearer $CUSTOMER_TOKEN"

# Step 7: Leave a review
curl -X POST https://api.servicelink.com/reviews \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "job_abc123",
    "rateeUserId": "provider_user_id",
    "stars": 5,
    "comment": "Excellent service!"
  }'
```

### 2. Provider Journey: Fulfill Requests

```bash
# Step 1: Set location for nearby job matching
curl -X POST https://api.servicelink.com/providers/location \
  -H "Authorization: Bearer $PROVIDER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "lat": 37.7749,
    "lng": -122.4194
  }'

# Step 2: Browse available jobs
curl -H "Authorization: Bearer $PROVIDER_TOKEN" \
  https://api.servicelink.com/jobs?status=pending_quotes

# Step 3: Submit a quote
curl -X POST https://api.servicelink.com/jobs/job_abc123/quotes \
  -H "Authorization: Bearer $PROVIDER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "total": 15000,
    "lineItems": [
      { "description": "Labor (2 hours)", "amount": 10000 },
      { "description": "Parts", "amount": 5000 }
    ]
  }'

# Step 4: View accepted assignments
curl -H "Authorization: Bearer $PROVIDER_TOKEN" \
  https://api.servicelink.com/assignments/mine

# Step 5: Propose schedule
curl -X POST https://api.servicelink.com/assignments/assign_789/schedule/propose \
  -H "Authorization: Bearer $PROVIDER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "start": "2025-10-05T14:00:00Z",
    "end": "2025-10-05T16:00:00Z",
    "notes": "Will arrive between 2-4pm"
  }'

# Step 6: Mark job complete
curl -X POST https://api.servicelink.com/assignments/assign_789/provider-complete \
  -H "Authorization: Bearer $PROVIDER_TOKEN"
```

---

## API Reference

### Authentication

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/auth/signup` | POST | None | Create new user account |
| `/auth/login` | POST | None | Login and get JWT token |

### Jobs

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/jobs` | POST | Customer | Create new job request |
| `/jobs` | GET | Provider | List available jobs |
| `/jobs/mine` | GET | Customer | Get my jobs |
| `/jobs/:id` | GET | Any | Get job details |
| `/jobs/:id/quotes` | GET | Customer | List quotes for job |
| `/jobs/:id/quotes` | POST | Provider | Submit quote |
| `/jobs/:id/quotes/:quoteId/accept` | POST | Customer | Accept quote |
| `/jobs/:id/quotes/:quoteId/revoke` | POST | Customer | Revoke acceptance |

### Providers

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/providers/search` | GET | None | Search providers by service/location |
| `/providers/near` | GET | None | Find providers near lat/lng |
| `/providers/me` | GET | Provider | Get my provider profile |
| `/providers/location` | POST | Provider | Update my location |
| `/providers/onboarding` | POST | Provider | Get Stripe onboarding link |
| `/providers/categories` | GET | None | List all categories |
| `/providers/services` | GET | None | List all services |

### Assignments

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/assignments/mine` | GET | Provider | Get my assignments |
| `/assignments/:id/schedule/propose` | POST | Customer/Provider | Propose schedule |
| `/assignments/:id/schedule/confirm` | POST | Provider | Confirm schedule |
| `/assignments/:id/provider-complete` | POST | Provider | Mark complete |
| `/assignments/:id/verify-complete` | POST | Customer | Verify completion |
| `/assignments/:id/reject` | POST | Provider | Reject assignment |

### Reviews

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/reviews` | POST | Any | Create review |
| `/reviews` | GET | Any | List reviews (by rateeUserId) |
| `/reviews/average/:userId` | GET | Any | Get average rating |

### AI Features

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/ai/job-intake/structure` | POST | Customer | AI-powered job intake |
| `/ai/quote/draft` | POST | Provider | AI quote suggestions |
| `/ai/transcribe` | POST | Any | Speech-to-text (Whisper) |
| `/ai/translate-audio` | POST | Any | Audio translation |

### Realtime (WebSocket)

```javascript
import io from 'socket.io-client';

const socket = io('wss://api.servicelink.com/ws', {
  auth: { token: 'your-jwt-token' }
});

// Join room
socket.emit('join', { room: 'job:job_abc123' });

// Send message
socket.emit('chat', {
  room: 'job:job_abc123',
  text: 'Hello!'
});

// Receive messages
socket.on('chat', (msg) => {
  console.log('New message:', msg);
});
```

---

## Rate Limits

Default limits (configurable via environment):

| Endpoint Category | Limit | Window |
|-------------------|-------|--------|
| Auth (login) | 10 requests | 1 minute |
| Auth (signup) | 5 requests | 1 minute |
| Jobs creation | 10 requests | 1 minute |
| Quotes (accept/revoke) | 5 requests | 1 minute |
| Provider search | 30 requests | 1 minute |
| WebSocket chat | 15 messages | 1 minute |

**Response on rate limit**:
```json
{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests"
}
```

**Headers**:
- `Retry-After`: Seconds to wait before retrying
- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Unix timestamp when limit resets

---

## Error Handling

### Standard Error Response

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

### Common Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Request completed |
| 201 | Created | Resource created |
| 400 | Bad Request | Check request body |
| 401 | Unauthorized | Provide valid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 429 | Too Many Requests | Wait and retry |
| 500 | Server Error | Report to support |

---

## Code Examples

### JavaScript/TypeScript

```typescript
const API_BASE = 'https://api.servicelink.com';

async function createJob(token: string, jobData: { title: string; description: string }) {
  const response = await fetch(`${API_BASE}/jobs`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(jobData),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

// Usage
const job = await createJob(token, {
  title: 'Fix leaky faucet',
  description: 'Bathroom sink faucet is dripping',
});
```

### Python

```python
import requests

API_BASE = 'https://api.servicelink.com'

def create_job(token, job_data):
    response = requests.post(
        f'{API_BASE}/jobs',
        headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json',
        },
        json=job_data
    )
    response.raise_for_status()
    return response.json()

# Usage
job = create_job(token, {
    'title': 'Fix leaky faucet',
    'description': 'Bathroom sink faucet is dripping',
})
```

---

## Best Practices

1. **Always use HTTPS in production**
2. **Store JWT tokens securely** (not in localStorage for sensitive apps)
3. **Handle rate limits gracefully** (exponential backoff)
4. **Validate input before sending** (use TypeScript types or JSON schemas)
5. **Log errors with context** (request ID, user ID, timestamp)
6. **Use environment variables** for API base URL
7. **Implement retry logic** for transient errors (500, 503)
8. **Cache responses** when appropriate (provider search, categories)

---

## Testing

### Postman Collection

Import from: https://api.servicelink.com/docs-json

### Sample Test Data

```json
{
  "testCustomer": {
    "email": "customer@example.com",
    "password": "password123"
  },
  "testProvider": {
    "email": "provider@example.com",
    "password": "password123"
  },
  "sampleJob": {
    "title": "Plumbing repair",
    "description": "Fix kitchen sink"
  }
}
```

---

## Support

- **API Status**: https://status.servicelink.com
- **Documentation**: https://docs.servicelink.com
- **Support Email**: api-support@servicelink.com
- **GitHub Issues**: https://github.com/your-org/servicelink/issues
