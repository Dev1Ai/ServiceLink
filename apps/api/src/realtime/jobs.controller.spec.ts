import { Test, TestingModule } from '@nestjs/testing';
import { JobsController } from './jobs.controller';
import { PrismaService } from '../prisma/prisma.service';

describe('JobsController', () => {
  let controller: JobsController;
  let prisma: PrismaService;

  const mockPrismaService = {
    job: {
      findUnique: jest.fn(),
    },
    chatMessage: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [JobsController],
      providers: [{ provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    controller = module.get<JobsController>(JobsController);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('listMessages', () => {
    const mockJob = { id: 'job-123', key: 'job-key-1' };
    const mockMessages = [
      {
        id: 'msg-1',
        userId: 'user-1',
        content: 'Hello',
        createdAt: new Date('2025-01-01T10:00:00Z'),
        user: { id: 'user-1', email: 'user1@test.com', name: 'User 1' },
      },
      {
        id: 'msg-2',
        userId: 'user-2',
        content: 'Hi there',
        createdAt: new Date('2025-01-01T10:01:00Z'),
        user: { id: 'user-2', email: 'user2@test.com', name: 'User 2' },
      },
    ];

    it('should list messages for a job', async () => {
      mockPrismaService.job.findUnique.mockResolvedValue(mockJob);
      mockPrismaService.chatMessage.findMany.mockResolvedValue(mockMessages);

      const result = await controller.listMessages('job-key-1');

      expect(prisma.job.findUnique).toHaveBeenCalledWith({ where: { key: 'job-key-1' } });
      expect(prisma.chatMessage.findMany).toHaveBeenCalledWith({
        where: { jobId: 'job-123' },
        select: {
          id: true,
          userId: true,
          content: true,
          createdAt: true,
          user: { select: { id: true, email: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 51,
      });
      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).toBeUndefined();
    });

    it('should return empty array if job not found', async () => {
      mockPrismaService.job.findUnique.mockResolvedValue(null);

      const result = await controller.listMessages('non-existent-key');

      expect(result).toEqual({ items: [], nextCursor: undefined });
      expect(prisma.chatMessage.findMany).not.toHaveBeenCalled();
    });

    it('should respect take parameter', async () => {
      mockPrismaService.job.findUnique.mockResolvedValue(mockJob);
      mockPrismaService.chatMessage.findMany.mockResolvedValue(mockMessages);

      await controller.listMessages('job-key-1', '10');

      expect(prisma.chatMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 11,
        }),
      );
    });

    it('should enforce minimum take of 1', async () => {
      mockPrismaService.job.findUnique.mockResolvedValue(mockJob);
      mockPrismaService.chatMessage.findMany.mockResolvedValue(mockMessages);

      // parseInt('0') || 50 = 50, then Math.max(1, 50) = 50
      await controller.listMessages('job-key-1', '0');

      expect(prisma.chatMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 51, // 50 + 1 (default when 0 is passed)
        }),
      );
    });

    it('should enforce maximum take of 200', async () => {
      mockPrismaService.job.findUnique.mockResolvedValue(mockJob);
      mockPrismaService.chatMessage.findMany.mockResolvedValue(mockMessages);

      await controller.listMessages('job-key-1', '500');

      expect(prisma.chatMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 201, // 200 + 1
        }),
      );
    });

    it('should default to take=50 if not provided', async () => {
      mockPrismaService.job.findUnique.mockResolvedValue(mockJob);
      mockPrismaService.chatMessage.findMany.mockResolvedValue(mockMessages);

      await controller.listMessages('job-key-1');

      expect(prisma.chatMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 51, // 50 + 1
        }),
      );
    });

    it('should handle invalid take parameter', async () => {
      mockPrismaService.job.findUnique.mockResolvedValue(mockJob);
      mockPrismaService.chatMessage.findMany.mockResolvedValue(mockMessages);

      await controller.listMessages('job-key-1', 'invalid');

      expect(prisma.chatMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 51, // default 50 + 1
        }),
      );
    });

    it('should use cursor for pagination', async () => {
      mockPrismaService.job.findUnique.mockResolvedValue(mockJob);
      mockPrismaService.chatMessage.findMany.mockResolvedValue(mockMessages);

      await controller.listMessages('job-key-1', '50', 'msg-cursor');

      expect(prisma.chatMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'msg-cursor' },
          skip: 1,
        }),
      );
    });

    it('should return nextCursor when more messages available', async () => {
      mockPrismaService.job.findUnique.mockResolvedValue(mockJob);
      const manyMessages = Array.from({ length: 51 }, (_, i) => ({
        id: `msg-${i}`,
        userId: 'user-1',
        content: `Message ${i}`,
        createdAt: new Date(),
        user: { id: 'user-1', email: 'user@test.com', name: 'User' },
      }));
      mockPrismaService.chatMessage.findMany.mockResolvedValue(manyMessages);

      const result = await controller.listMessages('job-key-1', '50');

      expect(result.items).toHaveLength(50);
      expect(result.nextCursor).toBe('msg-50');
    });

    it('should reverse message order before returning', async () => {
      mockPrismaService.job.findUnique.mockResolvedValue(mockJob);
      // Messages come from DB in desc order (newest first)
      const dbMessages = [
        { id: 'msg-3', createdAt: new Date('2025-01-01T12:00:00Z') },
        { id: 'msg-2', createdAt: new Date('2025-01-01T11:00:00Z') },
        { id: 'msg-1', createdAt: new Date('2025-01-01T10:00:00Z') },
      ] as any;
      mockPrismaService.chatMessage.findMany.mockResolvedValue(dbMessages);

      const result = await controller.listMessages('job-key-1');

      // Returned messages should be in asc order (oldest first)
      expect(result.items[0].id).toBe('msg-1');
      expect(result.items[1].id).toBe('msg-2');
      expect(result.items[2].id).toBe('msg-3');
    });

    it('should include user details in messages', async () => {
      mockPrismaService.job.findUnique.mockResolvedValue(mockJob);
      mockPrismaService.chatMessage.findMany.mockResolvedValue(mockMessages);

      const result = await controller.listMessages('job-key-1');

      expect((result.items[0] as any).user).toEqual({
        id: 'user-1',
        email: 'user1@test.com',
        name: 'User 1',
      });
    });

    it('should handle empty message list', async () => {
      mockPrismaService.job.findUnique.mockResolvedValue(mockJob);
      mockPrismaService.chatMessage.findMany.mockResolvedValue([]);

      const result = await controller.listMessages('job-key-1');

      expect(result).toEqual({ items: [], nextCursor: undefined });
    });

    it('should query messages ordered by createdAt desc', async () => {
      mockPrismaService.job.findUnique.mockResolvedValue(mockJob);
      mockPrismaService.chatMessage.findMany.mockResolvedValue(mockMessages);

      await controller.listMessages('job-key-1');

      expect(prisma.chatMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should filter messages by jobId', async () => {
      mockPrismaService.job.findUnique.mockResolvedValue(mockJob);
      mockPrismaService.chatMessage.findMany.mockResolvedValue(mockMessages);

      await controller.listMessages('job-key-1');

      expect(prisma.chatMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { jobId: 'job-123' },
        }),
      );
    });
  });
});
