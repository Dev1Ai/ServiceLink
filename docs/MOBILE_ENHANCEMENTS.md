# Mobile Enhancements (M9 Feature)

This document outlines the push notifications and offline support infrastructure for the ServiceLink mobile application.

## Push Notifications

### Architecture

The push notification system uses **Firebase Cloud Messaging (FCM)** to deliver real-time updates to iOS and Android devices.

#### Components

1. **NotificationsService** (`apps/api/src/notifications/notifications.service.ts`)
   - Firebase Admin SDK integration
   - Template-based notification generation
   - Multi-device support
   - Topic-based broadcasting

2. **Device Token Management** (Future Implementation)
   - Prisma schema addition required:
   ```prisma
   model DeviceToken {
     id        String   @id @default(cuid())
     userId    String
     user      User     @relation(fields: [userId], references: [id])
     token     String   @unique
     platform  String   // ios, android
     active    Boolean  @default(true)
     createdAt DateTime @default(now())
     updatedAt DateTime @updatedAt

     @@index([userId])
     @@index([active])
   }
   ```

### Notification Types

| Type | Trigger | Recipients | Priority |
|------|---------|------------|----------|
| `JOB_CREATED` | New job posted | Nearby providers | Normal |
| `QUOTE_RECEIVED` | Provider submits quote | Customer | High |
| `QUOTE_ACCEPTED` | Customer accepts quote | Provider | High |
| `QUOTE_REJECTED` | Customer rejects quote | Provider | Normal |
| `JOB_ASSIGNED` | Quote accepted | Provider | High |
| `JOB_SCHEDULED` | Schedule confirmed | Both | High |
| `JOB_COMPLETED` | Provider marks complete | Customer | High |
| `PAYMENT_CAPTURED` | Payment processed | Both | Normal |
| `REVIEW_RECEIVED` | Review submitted | Ratee | Normal |
| `LOYALTY_TIER_UPGRADED` | Tier threshold reached | Customer | Normal |
| `REWARD_EARNED` | Points redeemed | Customer | Normal |

### Setup Instructions

#### 1. Firebase Project Setup

1. Create a Firebase project at [https://console.firebase.google.com](https://console.firebase.google.com)
2. Enable Cloud Messaging
3. Download service account credentials:
   - Go to Project Settings > Service Accounts
   - Click "Generate New Private Key"
   - Save as `firebase-adminsdk.json`

#### 2. API Configuration

Set environment variable:
```bash
FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/firebase-adminsdk.json
```

Or for production (using base64 encoded credentials):
```bash
FIREBASE_SERVICE_ACCOUNT_BASE64=<base64-encoded-credentials>
```

#### 3. Mobile App Setup

**iOS (React Native/Expo)**
```bash
expo install expo-notifications expo-device
```

```typescript
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

// Request permissions
const { status } = await Notifications.requestPermissionsAsync();

// Get FCM token
const token = (await Notifications.getExpoPushTokenAsync()).data;

// Register token with API
await api.post('/users/device-tokens', { token, platform: 'ios' });
```

**Android**
```bash
expo install expo-notifications
```

Add to `app.json`:
```json
{
  "expo": {
    "android": {
      "googleServicesFile": "./google-services.json"
    },
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#ffffff"
        }
      ]
    ]
  }
}
```

### Usage Examples

#### Send Notification for New Quote

```typescript
import { NotificationsService } from './notifications/notifications.service';

@Injectable()
export class QuotesService {
  constructor(
    private readonly notifications: NotificationsService,
  ) {}

  async createQuote(data: CreateQuoteDto) {
    // Create quote logic...

    // Send push notification
    const payload = this.notifications.getNotificationTemplate('QUOTE_RECEIVED', {
      amount: quote.total,
      providerName: provider.user.name,
      quoteId: quote.id,
      jobId: quote.jobId,
    });

    await this.notifications.sendToUser(job.customerId, payload);
  }
}
```

#### Broadcast System Announcement

```typescript
const payload = {
  title: 'System Maintenance',
  body: 'Scheduled maintenance on Dec 1st, 2-4 AM EST',
  data: { type: 'SYSTEM_ANNOUNCEMENT' },
};

await this.notifications.sendToTopic('all-users', payload);
```

### Testing

```bash
# Test notification endpoint (requires Firebase setup)
curl -X POST http://localhost:3001/notifications/test \
  -H "Content-Type: application/json" \
  -d '{
    "token": "DEVICE_FCM_TOKEN",
    "type": "QUOTE_RECEIVED",
    "data": {
      "amount": 5000,
      "providerName": "John Doe",
      "quoteId": "quote123",
      "jobId": "job456"
    }
  }'
```

## Offline Support

### Strategy

ServiceLink implements a **hybrid offline-first approach** using:

1. **Local Storage** - AsyncStorage for user preferences and auth tokens
2. **SQLite** - Local database for critical data caching
3. **Queue System** - Outbox pattern for pending mutations
4. **Background Sync** - Automatic sync when connection restored

### Offline-Capable Features

| Feature | Offline Mode | Sync Strategy |
|---------|--------------|---------------|
| View Jobs | ✅ Read from cache | Background refresh |
| View Quotes | ✅ Read from cache | Background refresh |
| View Profile | ✅ Read from cache | Real-time sync |
| Create Job | ⚠️ Queue for sync | Upload when online |
| Submit Quote | ⚠️ Queue for sync | Upload when online |
| Chat Messages | ⚠️ Queue for sync | Upload when online |
| View Map | ⚠️ Requires connection | N/A |

### Implementation Plan

#### 1. Data Caching Layer

```typescript
// apps/mobile/src/services/cache.service.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export class CacheService {
  async set(key: string, value: any): Promise<void> {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  }

  async invalidate(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  }
}
```

#### 2. Offline Queue

```typescript
// apps/mobile/src/services/offline-queue.service.ts
interface QueuedRequest {
  id: string;
  method: 'POST' | 'PUT' | 'DELETE';
  url: string;
  data: any;
  timestamp: number;
  retries: number;
}

export class OfflineQueueService {
  private queue: QueuedRequest[] = [];

  async enqueue(request: Omit<QueuedRequest, 'id' | 'timestamp' | 'retries'>) {
    const queuedRequest: QueuedRequest = {
      ...request,
      id: generateId(),
      timestamp: Date.now(),
      retries: 0,
    };

    this.queue.push(queuedRequest);
    await this.saveQueue();
  }

  async processQueue() {
    if (!navigator.onLine) return;

    for (const request of this.queue) {
      try {
        await api.request(request);
        this.removeFromQueue(request.id);
      } catch (error) {
        request.retries++;
        if (request.retries >= 3) {
          this.removeFromQueue(request.id);
        }
      }
    }
  }
}
```

#### 3. Network Status Monitoring

```typescript
import NetInfo from '@react-native-community/netinfo';

NetInfo.addEventListener(state => {
  if (state.isConnected) {
    offlineQueue.processQueue();
    syncService.syncAll();
  }
});
```

#### 4. Optimistic Updates

```typescript
// Update UI immediately, queue for sync
async function createJob(jobData: CreateJobDto) {
  // Optimistic update
  const tempJob = { ...jobData, id: 'temp-' + Date.now(), status: 'pending' };
  dispatch(addJobLocally(tempJob));

  try {
    if (navigator.onLine) {
      const job = await api.post('/jobs', jobData);
      dispatch(updateJob(tempJob.id, job));
    } else {
      await offlineQueue.enqueue({
        method: 'POST',
        url: '/jobs',
        data: jobData,
      });
    }
  } catch (error) {
    dispatch(removeJob(tempJob.id));
    showError('Failed to create job');
  }
}
```

### Required Dependencies

```bash
# Mobile app
expo install @react-native-async-storage/async-storage
expo install @react-native-community/netinfo
expo install expo-sqlite

# API (already installed)
# - Firebase Admin SDK
```

### Database Schema Additions

Add to `apps/api/prisma/schema.prisma`:

```prisma
model DeviceToken {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  token     String   @unique
  platform  String   // ios, android, web
  active    Boolean  @default(true)
  lastUsed  DateTime @default(now())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@index([active])
}

model Notification {
  id        String    @id @default(cuid())
  userId    String
  type      String
  title     String
  body      String
  data      Json?
  read      Boolean   @default(false)
  readAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([userId])
  @@index([read])
}
```

## Integration Points

### Events That Trigger Notifications

| Event | Location | Code Addition |
|-------|----------|---------------|
| Job Created | `JobsService.create()` | Send to nearby providers |
| Quote Submitted | `QuotesService.create()` | Send to customer |
| Quote Accepted | `QuotesService.acceptQuote()` | Send to provider |
| Job Assigned | `AssignmentsService.create()` | Send to provider |
| Job Scheduled | `AssignmentsService.updateSchedule()` | Send to both |
| Job Completed | `AssignmentsService.markComplete()` | Send to customer |
| Payment Captured | `PaymentsService.capturePayment()` | Send to both |
| Review Created | `ReviewsService.createReview()` | Send to ratee |
| Tier Upgraded | `LoyaltyService.awardPointsForJob()` | Send to customer |

### Example Integration

```typescript
// In QuotesService
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class QuotesService {
  constructor(
    private readonly notifications: NotificationsService,
    // ... other dependencies
  ) {}

  async create(providerId: string, data: CreateQuoteDto) {
    // Create quote
    const quote = await this.prisma.quote.create({ data });

    // Send notification
    const job = await this.prisma.job.findUnique({
      where: { id: data.jobId },
      include: { customer: true },
    });

    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      include: { user: true },
    });

    const payload = this.notifications.getNotificationTemplate('QUOTE_RECEIVED', {
      amount: quote.total,
      providerName: provider.user.name,
      quoteId: quote.id,
      jobId: quote.jobId,
    });

    await this.notifications.sendToUser(job.customerId, payload);

    return quote;
  }
}
```

## Performance Considerations

### Battery Life
- Use FCM high priority only for time-sensitive notifications
- Batch non-urgent notifications
- Implement quiet hours (9 PM - 8 AM)

### Data Usage
- Cache API responses with TTL
- Implement incremental sync (delta updates)
- Use compression for large payloads
- Lazy load images

### Storage Management
- Limit cache size (100 MB max)
- Implement LRU eviction policy
- Clear old data after 30 days

## Security

### Device Token Protection
- Use HTTPS for all token registration
- Validate tokens server-side
- Implement token rotation
- Deactivate tokens on logout

### Notification Content
- Never include sensitive data in notification body
- Use notification IDs for deep links
- Implement notification encryption for sensitive categories

## Testing

### Unit Tests
```bash
# Test notifications service
pnpm --filter api test notifications.service.spec

# Test offline queue
pnpm --filter mobile test offline-queue.service.spec
```

### Manual Testing
1. **Push Notifications**
   - Disable notifications, verify no delivery
   - Enable notifications, verify delivery
   - Test deep links from notifications
   - Verify badge counts update

2. **Offline Mode**
   - Toggle airplane mode
   - Create/update data offline
   - Verify queue persists across app restarts
   - Verify sync when connection restored

## Future Enhancements

1. **Rich Notifications**
   - Action buttons (Accept/Reject quote)
   - Inline reply for messages
   - Custom notification sounds

2. **Advanced Offline**
   - Conflict resolution UI
   - Partial sync status indicators
   - Manual sync triggers

3. **Analytics**
   - Notification open rates
   - Offline usage patterns
   - Sync performance metrics

## References

- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [React Native AsyncStorage](https://react-native-async-storage.github.io/async-storage/)
- [NetInfo](https://github.com/react-native-netinfo/react-native-netinfo)
