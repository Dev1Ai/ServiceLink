import { Test, TestingModule } from '@nestjs/testing';
import { JobsService } from './jobs.service';
import { PrismaService } from '../prisma/prisma.service';
import { PiiService } from '../pii/pii.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification.types';
import { Logger } from '@nestjs/common';

describe('JobsService', () => {
  let service: JobsService;
  let prisma: PrismaService;
  let pii: PiiService;
  let notifications: NotificationsService;

  const prismaMock = {
    job: {
      create: jest.fn().mockImplementation(args => Promise.resolve({ id: 'job-1', ...args.data })),
    },
    provider: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  const piiMock = {
    redact: jest.fn().mockImplementation((text: string) => text), // By default, no redaction
  };

  const notificationsMock = {
    sendNotification: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: PiiService, useValue: piiMock },
        { provide: NotificationsService, useValue: notificationsMock },
      ],
    }).compile();

    service = module.get<JobsService>(JobsService);
    prisma = module.get<PrismaService>(PrismaService);
    pii = module.get<PiiService>(PiiService);
    notifications = module.get<NotificationsService>(NotificationsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createJob', () => {
    it('should create a job with generated key', async () => {
      const dto = {
        title: 'Fix leaky faucet',
        description: 'The faucet in the kitchen is dripping constantly.',
      };
      const customerId = 'customer-1';

      const job = await service.createJob(dto, customerId);

      expect(pii.redact).toHaveBeenCalledWith(dto.description);
      expect(prisma.job.create).toHaveBeenCalledWith({
        data: {
          key: expect.stringMatching(/^job_/),
          title: dto.title,
          description: dto.description,
          customerId: customerId,
        },
      });

      expect(job.title).toBe('Fix leaky faucet');
      expect(job.customerId).toBe(customerId);
    });

    it('should generate unique keys for each job', async () => {
      const dto = {
        title: 'Test Job',
        description: 'Test Description',
      };
      const customerId = 'customer-1';

      await service.createJob(dto, customerId);
      await service.createJob(dto, customerId);

      const calls = (prisma.job.create as jest.Mock).mock.calls;
      const key1 = calls[0][0].data.key;
      const key2 = calls[1][0].data.key;

      expect(key1).not.toBe(key2);
    });

    it('should redact PII from job description', async () => {
      const dto = {
        title: 'Fix my toilet',
        description: 'Please call me at 555-123-4567 or email john@example.com',
      };
      const customerId = 'customer-1';

      // Mock PII service to redact email and phone
      piiMock.redact.mockReturnValueOnce('Please call me at [REDACTED_PHONE] or email [REDACTED_EMAIL]');

      const job = await service.createJob(dto, customerId);

      expect(pii.redact).toHaveBeenCalledWith(dto.description);
      expect(prisma.job.create).toHaveBeenCalledWith({
        data: {
          key: expect.stringMatching(/^job_/),
          title: dto.title,
          description: 'Please call me at [REDACTED_PHONE] or email [REDACTED_EMAIL]',
          customerId: customerId,
        },
      });

      expect(job.description).toBe('Please call me at [REDACTED_PHONE] or email [REDACTED_EMAIL]');
    });

    it('should handle descriptions with no PII', async () => {
      const dto = {
        title: 'Paint living room',
        description: 'Need two coats of white paint on all walls',
      };
      const customerId = 'customer-1';

      const job = await service.createJob(dto, customerId);

      expect(pii.redact).toHaveBeenCalledWith(dto.description);
      expect(job.description).toBe(dto.description);
    });

    it('should log job creation', async () => {
      const dto = {
        title: 'Fix leak',
        description: 'Water leak in basement',
      };
      const customerId = 'customer-1';
      const logSpy = jest.spyOn(Logger.prototype, 'log');

      await service.createJob(dto, customerId);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringMatching(/^Created job job-1 \(job_[a-z0-9_]+\) for customer customer-1$/)
      );
    });

    it('should log warning when PII is detected and redacted', async () => {
      const dto = {
        title: 'Emergency repair',
        description: 'Call me at 555-1234',
      };
      const customerId = 'customer-1';
      const warnSpy = jest.spyOn(Logger.prototype, 'warn');

      // Mock PII service to show redaction occurred
      piiMock.redact.mockReturnValueOnce('Call me at [REDACTED_PHONE]');

      await service.createJob(dto, customerId);

      expect(warnSpy).toHaveBeenCalledWith(
        'PII detected and redacted in job description for customer customer-1'
      );
    });

    it('should not log warning when no PII is detected', async () => {
      const dto = {
        title: 'Clean gutters',
        description: 'Remove leaves and debris',
      };
      const customerId = 'customer-1';
      const warnSpy = jest.spyOn(Logger.prototype, 'warn');

      await service.createJob(dto, customerId);

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('should notify all online providers about new job', async () => {
      const dto = {
        title: 'Install ceiling fan',
        description: 'Master bedroom needs new fan',
      };
      const customerId = 'customer-1';

      const onlineProviders = [
        { id: 'provider-1', userId: 'user-1', online: true, user: { id: 'user-1' } },
        { id: 'provider-2', userId: 'user-2', online: true, user: { id: 'user-2' } },
        { id: 'provider-3', userId: 'user-3', online: true, user: { id: 'user-3' } },
      ];
      prismaMock.provider.findMany.mockResolvedValueOnce(onlineProviders);

      const job = await service.createJob(dto, customerId);

      expect(prisma.provider.findMany).toHaveBeenCalledWith({
        where: { online: true },
        include: { user: true },
      });

      expect(notifications.sendNotification).toHaveBeenCalledTimes(3);
      expect(notifications.sendNotification).toHaveBeenCalledWith(
        'user-1',
        NotificationType.JOB_CREATED,
        'New Job Available',
        `${dto.title} - Check out this new job opportunity`,
        {
          jobId: job.id,
          jobKey: job.key,
          jobTitle: dto.title,
        }
      );
      expect(notifications.sendNotification).toHaveBeenCalledWith(
        'user-2',
        NotificationType.JOB_CREATED,
        'New Job Available',
        `${dto.title} - Check out this new job opportunity`,
        {
          jobId: job.id,
          jobKey: job.key,
          jobTitle: dto.title,
        }
      );
      expect(notifications.sendNotification).toHaveBeenCalledWith(
        'user-3',
        NotificationType.JOB_CREATED,
        'New Job Available',
        `${dto.title} - Check out this new job opportunity`,
        {
          jobId: job.id,
          jobKey: job.key,
          jobTitle: dto.title,
        }
      );
    });

    it('should not send notifications when no providers are online', async () => {
      const dto = {
        title: 'Replace outlet',
        description: 'Broken electrical outlet',
      };
      const customerId = 'customer-1';

      prismaMock.provider.findMany.mockResolvedValueOnce([]);

      await service.createJob(dto, customerId);

      expect(prisma.provider.findMany).toHaveBeenCalledWith({
        where: { online: true },
        include: { user: true },
      });
      expect(notifications.sendNotification).not.toHaveBeenCalled();
    });

    it('should continue creating job even if notification fails', async () => {
      const dto = {
        title: 'Repair door',
        description: 'Front door handle broken',
      };
      const customerId = 'customer-1';
      const errorSpy = jest.spyOn(Logger.prototype, 'error');

      const onlineProviders = [
        { id: 'provider-1', userId: 'user-1', online: true, user: { id: 'user-1' } },
      ];
      prismaMock.provider.findMany.mockResolvedValueOnce(onlineProviders);
      notificationsMock.sendNotification.mockRejectedValueOnce(new Error('Notification service down'));

      const job = await service.createJob(dto, customerId);

      expect(job).toBeDefined();
      expect(job.id).toBe('job-1');
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to send JOB_CREATED notification to provider provider-1:',
        expect.any(Error)
      );
    });

    it('should handle multiple notification failures gracefully', async () => {
      const dto = {
        title: 'Paint fence',
        description: 'Backyard fence needs painting',
      };
      const customerId = 'customer-1';
      const errorSpy = jest.spyOn(Logger.prototype, 'error');

      const onlineProviders = [
        { id: 'provider-1', userId: 'user-1', online: true, user: { id: 'user-1' } },
        { id: 'provider-2', userId: 'user-2', online: true, user: { id: 'user-2' } },
        { id: 'provider-3', userId: 'user-3', online: true, user: { id: 'user-3' } },
      ];
      prismaMock.provider.findMany.mockResolvedValueOnce(onlineProviders);
      notificationsMock.sendNotification
        .mockRejectedValueOnce(new Error('Failed 1'))
        .mockRejectedValueOnce(new Error('Failed 2'))
        .mockResolvedValueOnce(undefined); // Third one succeeds

      const job = await service.createJob(dto, customerId);

      expect(job).toBeDefined();
      expect(job.id).toBe('job-1');
      expect(errorSpy).toHaveBeenCalledTimes(2);
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to send JOB_CREATED notification to provider provider-1:',
        expect.any(Error)
      );
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to send JOB_CREATED notification to provider provider-2:',
        expect.any(Error)
      );
    });

    it('should send notifications with correct metadata', async () => {
      const dto = {
        title: 'Deep clean house',
        description: 'Full house cleaning service',
      };
      const customerId = 'customer-1';

      const onlineProviders = [
        { id: 'provider-1', userId: 'user-1', online: true, user: { id: 'user-1' } },
      ];
      prismaMock.provider.findMany.mockResolvedValueOnce(onlineProviders);

      const job = await service.createJob(dto, customerId);

      expect(notifications.sendNotification).toHaveBeenCalledWith(
        'user-1',
        NotificationType.JOB_CREATED,
        'New Job Available',
        'Deep clean house - Check out this new job opportunity',
        {
          jobId: 'job-1',
          jobKey: expect.stringMatching(/^job_[a-z0-9_]+$/),
          jobTitle: 'Deep clean house',
        }
      );
    });
  });
});
