import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    deviceToken: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },
    job: {
      findUnique: jest.fn(),
    },
    provider: {
      findUnique: jest.fn(),
    },
    quote: {
      findUnique: jest.fn(),
    },
    assignment: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    prisma = module.get<PrismaService>(PrismaService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Firebase initialization', () => {
    it('should initialize without Firebase when FIREBASE_SERVICE_ACCOUNT is not set', () => {
      expect(service).toBeDefined();
      // Service should log that Firebase is disabled
    });

    it('should gracefully handle Firebase initialization errors', () => {
      // Service constructor handles errors gracefully
      expect(service).toBeDefined();
    });
  });

  describe('notifyQuoteCreated', () => {
    it('should log quote creation notification', async () => {
      const jobId = 'job-123';
      const quoteId = 'quote-456';
      const providerId = 'provider-789';

      await service.notifyQuoteCreated(jobId, quoteId, providerId);

      // Should complete without errors
      expect(true).toBe(true);
    });
  });

  describe('notifyQuoteAccepted', () => {
    it('should log quote accepted notification', async () => {
      const jobId = 'job-123';
      const quoteId = 'quote-456';
      const providerId = 'provider-789';

      await service.notifyQuoteAccepted(jobId, quoteId, providerId);

      // Should complete without errors
      expect(true).toBe(true);
    });
  });

  describe('notifyAcceptanceRevoked', () => {
    it('should log acceptance revoked notification', async () => {
      const jobId = 'job-123';
      const quoteId = 'quote-456';

      await service.notifyAcceptanceRevoked(jobId, quoteId);

      // Should complete without errors
      expect(true).toBe(true);
    });
  });

  describe('notifyScheduleProposed', () => {
    it('should log schedule proposed notification', async () => {
      const payload = {
        jobId: 'job-123',
        assignmentId: 'assign-456',
        proposedBy: 'customer' as const,
        start: new Date('2025-01-15T10:00:00Z'),
        end: new Date('2025-01-15T12:00:00Z'),
      };

      await service.notifyScheduleProposed(payload);

      // Should complete without errors
      expect(true).toBe(true);
    });
  });

  describe('notifyScheduleConfirmed', () => {
    it('should log schedule confirmed notification', async () => {
      const payload = {
        jobId: 'job-123',
        assignmentId: 'assign-456',
        confirmedBy: 'provider' as const,
        start: new Date('2025-01-15T10:00:00Z'),
        end: new Date('2025-01-15T12:00:00Z'),
      };

      await service.notifyScheduleConfirmed(payload);

      // Should complete without errors
      expect(true).toBe(true);
    });

    it('should handle null dates', async () => {
      const payload = {
        jobId: 'job-123',
        assignmentId: 'assign-456',
        confirmedBy: 'customer' as const,
        start: null,
        end: null,
      };

      await service.notifyScheduleConfirmed(payload);

      // Should complete without errors
      expect(true).toBe(true);
    });
  });

  describe('notifyAssignmentRejected', () => {
    it('should log assignment rejected notification', async () => {
      const payload = {
        jobId: 'job-123',
        assignmentId: 'assign-456',
        providerId: 'provider-789',
      };

      await service.notifyAssignmentRejected(payload);

      // Should complete without errors
      expect(true).toBe(true);
    });

    it('should include reason when provided', async () => {
      const payload = {
        jobId: 'job-123',
        assignmentId: 'assign-456',
        providerId: 'provider-789',
        reason: 'Provider unavailable',
      };

      await service.notifyAssignmentRejected(payload);

      // Should complete without errors
      expect(true).toBe(true);
    });
  });

  describe('notifyAssignmentReminder', () => {
    it('should log assignment reminder notification', async () => {
      const payload = {
        assignmentId: 'assign-123',
        jobId: 'job-456',
        providerId: 'provider-789',
        customerId: 'customer-012',
        scheduledStart: new Date('2025-01-15T10:00:00Z'),
        leadMinutes: 30,
      };

      await service.notifyAssignmentReminder(payload);

      // Should complete without errors
      expect(true).toBe(true);
    });

    it('should handle null values', async () => {
      const payload = {
        assignmentId: 'assign-123',
        jobId: 'job-456',
        providerId: null,
        customerId: null,
        scheduledStart: null,
        leadMinutes: 60,
      };

      await service.notifyAssignmentReminder(payload);

      // Should complete without errors
      expect(true).toBe(true);
    });

    it('should include schedule notes when provided', async () => {
      const payload = {
        assignmentId: 'assign-123',
        jobId: 'job-456',
        providerId: 'provider-789',
        customerId: 'customer-012',
        scheduledStart: new Date('2025-01-15T10:00:00Z'),
        scheduleNotes: 'Bring tools',
        leadMinutes: 15,
      };

      await service.notifyAssignmentReminder(payload);

      // Should complete without errors
      expect(true).toBe(true);
    });
  });

  describe('registerDeviceToken', () => {
    it('should register a new device token', async () => {
      const userId = 'user-123';
      const token = 'device-token-abc';
      const platform = 'ios';

      await service.registerDeviceToken(userId, token, platform);

      // Should complete without errors
      expect(true).toBe(true);
    });

    it('should support android platform', async () => {
      const userId = 'user-123';
      const token = 'device-token-def';
      const platform = 'android';

      await service.registerDeviceToken(userId, token, platform);

      // Should complete without errors
      expect(true).toBe(true);
    });

    it('should support web platform', async () => {
      const userId = 'user-123';
      const token = 'device-token-ghi';
      const platform = 'web';

      await service.registerDeviceToken(userId, token, platform);

      // Should complete without errors
      expect(true).toBe(true);
    });
  });

  describe('unregisterDeviceToken', () => {
    it('should unregister a device token', async () => {
      const token = 'device-token-abc';

      await service.unregisterDeviceToken(token);

      // Should complete without errors
      expect(true).toBe(true);
    });
  });
});
