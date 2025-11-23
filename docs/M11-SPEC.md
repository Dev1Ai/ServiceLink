# M11 — Advanced Mobile Features

**Status:** In Progress
**Start Date:** 2025-11-23
**Target Completion:** TBD
**Dependencies:** M10 (Mobile Push Notifications), M9 (Mobile Enhancements Foundation)

## Overview

M11 builds upon the mobile enhancements foundation established in M9 (PR #34) and M10 (PR #58) to deliver a production-ready, offline-first mobile experience for the ServiceLink platform. This milestone focuses on advanced mobile capabilities that enable providers and customers to use the app effectively in low-connectivity environments and streamline real-world service workflows.

## Goals

1. **Offline-First Architecture** - Enable core features to function without active internet connection
2. **Provider Workflows** - GPS-based check-in/check-out, photo documentation, location tracking
3. **Enhanced Security** - Biometric authentication (Face ID, Touch ID, fingerprint)
4. **Better UX** - Optimistic UI updates, background sync, conflict resolution

## Technical Foundation

### Existing Infrastructure (M9/M10)
- Firebase Cloud Messaging integration ✅
- Device token management ✅
- Push notification system with 11 notification types ✅
- Offline strategy documented ✅
- React Native/Expo mobile app ✅

### New Requirements
- AsyncStorage for offline persistence
- Background sync queue
- GPS/location services
- Camera/photo management
- Biometric authentication SDK
- Conflict resolution logic

---

## Feature Breakdown

### 1. Offline-First Data Sync Architecture

#### 1.1 Local Data Caching
**Implementation:**
- SQLite database for structured data (jobs, quotes, messages)
- AsyncStorage for user preferences and authentication
- Cache invalidation strategy with TTL

**Cached Entities:**
| Entity | Cache Duration | Sync Strategy |
|--------|----------------|---------------|
| Jobs (active) | Until completion | Background refresh + polling |
| Quotes (pending/accepted) | Until job complete | Background refresh |
| User Profile | 24 hours | Real-time + background |
| Chat Messages | Permanent (until job complete) | Real-time + queue |
| Provider Listings | 1 hour | Background refresh |

**API:**
```typescript
// apps/mobile/src/services/cache.service.ts
export class CacheService {
  async cacheJob(job: Job): Promise<void>
  async getCachedJob(jobId: string): Promise<Job | null>
  async syncJobs(): Promise<SyncResult>
  async invalidateJob(jobId: string): Promise<void>
}
```

#### 1.2 Offline Queue System
**Implementation:**
- Outbox pattern for pending mutations
- Retry logic with exponential backoff
- Conflict detection and resolution

**Queued Operations:**
- Job creation
- Quote submission
- Chat messages
- Status updates (check-in, check-out, completion)
- Photo uploads

**API:**
```typescript
// apps/mobile/src/services/offline-queue.service.ts
interface QueuedRequest {
  id: string
  operation: 'CREATE_JOB' | 'SUBMIT_QUOTE' | 'SEND_MESSAGE' | 'CHECK_IN' | 'CHECK_OUT' | 'UPLOAD_PHOTO'
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  url: string
  data: any
  timestamp: number
  retries: number
  maxRetries: number
  status: 'pending' | 'processing' | 'failed' | 'completed'
}

export class OfflineQueueService {
  async enqueue(request: Omit<QueuedRequest, 'id' | 'timestamp' | 'retries' | 'status'>): Promise<string>
  async processQueue(): Promise<ProcessResult>
  async retry(requestId: string): Promise<void>
  async remove(requestId: string): Promise<void>
  async getQueue(): Promise<QueuedRequest[]>
}
```

#### 1.3 Background Sync
**Implementation:**
- Network status monitoring (online/offline detection)
- Automatic queue processing when connectivity restored
- Background fetch for iOS (30-second window)
- Foreground service for Android

**Sync Triggers:**
- Network reconnection
- App foreground
- User-initiated refresh
- Periodic background (iOS: 15 min, Android: configurable)

**API:**
```typescript
// apps/mobile/src/services/sync.service.ts
export class SyncService {
  async syncAll(): Promise<SyncResult>
  async syncJobs(): Promise<Job[]>
  async syncQuotes(): Promise<Quote[]>
  async syncMessages(): Promise<Message[]>
  onSyncComplete(callback: (result: SyncResult) => void): Unsubscribe
}
```

### 1.4 Optimistic Updates
**Implementation:**
- Immediate UI updates for better UX
- Rollback on conflict/error
- Visual indicators for syncing state

**Example: Create Job Offline**
```typescript
async function createJob(jobData: CreateJobDto) {
  const tempJob = {
    ...jobData,
    id: `temp_${Date.now()}`,
    status: 'pending_sync',
    createdAt: new Date().toISOString(),
  }

  // Optimistic UI update
  dispatch(addJob(tempJob))

  if (navigator.onLine) {
    try {
      const job = await api.post('/jobs', jobData)
      dispatch(updateJob(tempJob.id, job))
    } catch (error) {
      dispatch(removeJob(tempJob.id))
      showError('Failed to create job')
    }
  } else {
    await offlineQueue.enqueue({
      operation: 'CREATE_JOB',
      method: 'POST',
      url: '/jobs',
      data: jobData,
      maxRetries: 3,
    })
    showToast('Job will be created when online')
  }
}
```

---

### 2. GPS-Based Provider Features

#### 2.1 Check-In / Check-Out
**Purpose:** Track provider arrival/departure for job sites

**Features:**
- GPS coordinate capture
- Geofence validation (within 100m of job address)
- Timestamp recording
- Photo requirement (before/after)
- Offline support (queued for sync)

**API Endpoints:**
```typescript
POST /assignments/:id/check-in
{
  latitude: number
  longitude: number
  timestamp: string (ISO 8601)
  photo?: string (base64)
}

POST /assignments/:id/check-out
{
  latitude: number
  longitude: number
  timestamp: string (ISO 8601)
  photo?: string (base64)
  notes?: string
}
```

**Database Schema:**
```prisma
model AssignmentCheckpoint {
  id           String   @id @default(cuid())
  assignmentId String
  assignment   Assignment @relation(fields: [assignmentId], references: [id])
  type         CheckpointType // CHECK_IN, CHECK_OUT
  latitude     Float
  longitude    Float
  accuracy     Float? // GPS accuracy in meters
  timestamp    DateTime
  photoUrl     String?
  notes        String?
  createdAt    DateTime @default(now())

  @@index([assignmentId])
  @@index([type])
}

enum CheckpointType {
  CHECK_IN
  CHECK_OUT
}
```

#### 2.2 Real-Time Location Tracking (Optional)
**Purpose:** Allow customers to track provider en route to job site

**Features:**
- Opt-in location sharing
- Real-time coordinate updates (every 30s while in transit)
- Privacy controls (only during active assignment)
- Battery optimization

**API Endpoints:**
```typescript
POST /assignments/:id/location
{
  latitude: number
  longitude: number
  accuracy: number
  timestamp: string
}

GET /assignments/:id/location
// Returns latest provider location (customer-only)
```

---

### 3. Camera & Photo Documentation

#### 3.1 Photo Capture
**Features:**
- In-app camera with preview
- Photo library access
- Image compression (max 2MB)
- Metadata stripping (privacy)
- Offline storage with upload queue

**Use Cases:**
- Job before/after photos
- Damage documentation
- Progress updates
- Invoice attachments

**API:**
```typescript
// apps/mobile/src/services/photo.service.ts
export class PhotoService {
  async capturePhoto(options?: CameraOptions): Promise<Photo>
  async selectFromLibrary(options?: LibraryOptions): Promise<Photo[]>
  async compressPhoto(photo: Photo, maxSizeMB: number): Promise<Photo>
  async uploadPhoto(photo: Photo, context: PhotoContext): Promise<UploadResult>
  async queuePhotoUpload(photo: Photo, context: PhotoContext): Promise<string>
}

interface PhotoContext {
  type: 'JOB' | 'CHECK_IN' | 'CHECK_OUT' | 'CHAT' | 'INVOICE'
  entityId: string
  metadata?: Record<string, any>
}
```

#### 3.2 Photo Storage
**Backend:**
- S3-compatible object storage
- Presigned URLs for direct upload
- Image optimization pipeline
- CDN distribution

**API Endpoints:**
```typescript
POST /photos/upload-url
{
  filename: string
  contentType: string
  context: PhotoContext
}
// Returns: { uploadUrl: string, photoId: string }

POST /photos/:id/complete
// Confirms upload complete, triggers processing
```

**Database Schema:**
```prisma
model Photo {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  url         String
  thumbnailUrl String?
  filename    String
  contentType String
  size        Int
  width       Int?
  height      Int?
  context     PhotoContext @relation(fields: [contextId], references: [id])
  contextId   String
  createdAt   DateTime @default(now())

  @@index([userId])
  @@index([contextId])
}

model PhotoContext {
  id        String @id @default(cuid())
  type      PhotoContextType
  entityId  String
  metadata  Json?
  photos    Photo[]

  @@index([type, entityId])
}

enum PhotoContextType {
  JOB
  CHECK_IN
  CHECK_OUT
  CHAT
  INVOICE
}
```

---

### 4. Biometric Authentication

#### 4.1 Face ID / Touch ID / Fingerprint
**Purpose:** Secure, frictionless authentication

**Features:**
- Device biometric support detection
- Fallback to PIN/password
- Biometric enrollment flow
- Session management with biometric re-auth
- Support for iOS (Face ID, Touch ID) and Android (Fingerprint, Face Unlock)

**API:**
```typescript
// apps/mobile/src/services/biometric.service.ts
export class BiometricService {
  async isAvailable(): Promise<BiometricType | null>
  async enroll(): Promise<EnrollResult>
  async authenticate(reason: string): Promise<AuthResult>
  async disable(): Promise<void>
  isEnabled(): boolean
}

enum BiometricType {
  FACE_ID = 'faceId',
  TOUCH_ID = 'touchId',
  FINGERPRINT = 'fingerprint',
  FACE_UNLOCK = 'faceUnlock',
}
```

#### 4.2 Security Considerations
- Biometric credentials stored in device secure enclave only
- JWT tokens remain in secure storage (iOS Keychain, Android KeyStore)
- Biometric failure rate limiting (3 attempts, fallback to password)
- Optional timeout (require re-auth after 5 min inactivity)

**Implementation:**
```bash
# Dependencies
expo install expo-local-authentication
expo install expo-secure-store
```

**Example Usage:**
```typescript
import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'

async function loginWithBiometric() {
  const hasHardware = await LocalAuthentication.hasHardwareAsync()
  const isEnrolled = await LocalAuthentication.isEnrolledAsync()

  if (!hasHardware || !isEnrolled) {
    return showPasswordLogin()
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Authenticate to access ServiceLink',
    fallbackLabel: 'Use Password',
    disableDeviceFallback: false,
  })

  if (result.success) {
    const token = await SecureStore.getItemAsync('authToken')
    dispatch(loginSuccess(token))
  }
}
```

---

## API Changes

### New Endpoints

```typescript
// Check-in/Check-out
POST /assignments/:id/check-in
POST /assignments/:id/check-out
GET /assignments/:id/checkpoints

// Location Tracking
POST /assignments/:id/location
GET /assignments/:id/location
PATCH /assignments/:id/location-sharing

// Photo Management
POST /photos/upload-url
POST /photos/:id/complete
DELETE /photos/:id
```

### Modified Endpoints

```typescript
// Job endpoints - add offline sync support
GET /jobs?syncToken=<token>
// Returns: { jobs: Job[], nextSyncToken: string, hasMore: boolean }

// Quote endpoints - add offline sync support
GET /quotes?syncToken=<token>
// Returns: { quotes: Quote[], nextSyncToken: string, hasMore: boolean }
```

---

## Database Migrations

```prisma
// Add to schema.prisma

model AssignmentCheckpoint {
  id           String   @id @default(cuid())
  assignmentId String
  assignment   Assignment @relation(fields: [assignmentId], references: [id])
  type         CheckpointType
  latitude     Float
  longitude    Float
  accuracy     Float?
  timestamp    DateTime
  photoUrl     String?
  notes        String?
  createdAt    DateTime @default(now())

  @@index([assignmentId])
}

model LocationUpdate {
  id           String   @id @default(cuid())
  assignmentId String
  assignment   Assignment @relation(fields: [assignmentId], references: [id])
  latitude     Float
  longitude    Float
  accuracy     Float
  timestamp    DateTime
  createdAt    DateTime @default(now())

  @@index([assignmentId, timestamp])
}

model Photo {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  url         String
  thumbnailUrl String?
  filename    String
  contentType String
  size        Int
  width       Int?
  height      Int?
  contextType PhotoContextType
  contextId   String
  metadata    Json?
  createdAt   DateTime @default(now())

  @@index([userId])
  @@index([contextType, contextId])
}

enum CheckpointType {
  CHECK_IN
  CHECK_OUT
}

enum PhotoContextType {
  JOB
  CHECK_IN
  CHECK_OUT
  CHAT
  INVOICE
}
```

---

## Testing Strategy

### Unit Tests
- CacheService: cache/retrieve/invalidate operations
- OfflineQueueService: enqueue/process/retry logic
- SyncService: sync coordination and conflict resolution
- PhotoService: capture/compress/upload workflows
- BiometricService: availability checks and authentication

**Target:** 40+ new unit tests

### Integration Tests
- Offline → Online sync flow
- Queue processing with retry logic
- Photo upload with presigned URLs
- Biometric authentication flow
- GPS accuracy validation

**Target:** 15+ integration tests

### E2E Tests
- Create job while offline, verify sync on reconnect
- Submit quote offline, verify sync
- Provider check-in with GPS and photo
- Biometric login flow
- Photo upload and retrieval

**Target:** 8+ E2E tests

---

## Performance Considerations

### Mobile App
- SQLite database size limit: 100MB (with cleanup)
- Photo cache: max 50 photos, LRU eviction
- Queue size limit: 100 pending operations
- Background sync battery optimization (coalesce requests)
- Image compression: max 2MB per photo

### Backend
- Photo storage: S3 with CloudFront CDN
- Location updates: Rate limit to 1 req/30s per assignment
- Sync endpoints: Cursor-based pagination for efficiency
- Database indexing on sync_token fields

### Network
- Photo upload: Chunk uploads for large files (multipart)
- Offline queue: Batch sync when online (max 10 concurrent requests)
- Optimistic updates: Reduce perceived latency

---

## Dependencies

### Mobile (`apps/mobile`)
```bash
expo install expo-local-authentication
expo install expo-secure-store
expo install @react-native-async-storage/async-storage
expo install @react-native-community/netinfo
expo install expo-sqlite
expo install expo-camera
expo install expo-image-picker
expo install expo-location
expo install expo-background-fetch
expo install expo-task-manager
```

### Backend (`apps/api`)
```bash
pnpm add @aws-sdk/client-s3
pnpm add @aws-sdk/s3-request-presigner
pnpm add sharp  # Image processing
```

---

## Rollout Plan

### Phase 1: Offline Foundation (Week 1)
- Implement CacheService
- Implement OfflineQueueService
- Implement SyncService
- Network status monitoring
- Unit tests

### Phase 2: GPS Features (Week 2)
- Check-in/check-out endpoints
- Location tracking API
- GPS accuracy validation
- Database migrations
- Integration tests

### Phase 3: Photo Management (Week 2-3)
- Photo capture UI
- S3 presigned upload
- Image compression pipeline
- Photo context management
- E2E tests

### Phase 4: Biometric Auth (Week 3)
- Biometric enrollment flow
- Authentication integration
- Secure storage migration
- Fallback mechanisms
- E2E tests

### Phase 5: Integration & Polish (Week 3-4)
- End-to-end testing
- Performance optimization
- Documentation updates
- Beta testing feedback
- Production deployment

---

## Success Metrics

- **Offline Functionality:** 90% of core features work offline
- **Sync Success Rate:** 98% of queued operations sync successfully
- **Photo Upload Success:** 95% first-attempt success rate
- **Biometric Adoption:** 60% of users enable biometric auth within 7 days
- **GPS Accuracy:** 90% of check-ins within 100m accuracy
- **Performance:** <200ms cache response time, <3s sync time

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| SQLite performance degradation | High | Implement aggressive cache cleanup, monitor DB size |
| Photo storage costs | Medium | Implement compression, set retention policies |
| GPS accuracy in urban areas | Medium | Geofence tolerance (100m), manual override for edge cases |
| Biometric compatibility issues | Low | Comprehensive fallback to password, device testing matrix |
| Sync conflicts (offline edits) | High | Last-write-wins strategy, conflict resolution UI |

---

## Future Enhancements (Post-M11)

- Voice commands for hands-free operation (M12)
- AR for job measurements (M13)
- Wearable integration (Apple Watch, Android Wear) (M13)
- Mesh networking for peer-to-peer sync (M14)
- ML-based photo quality validation (M14)
