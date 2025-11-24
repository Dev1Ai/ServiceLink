import 'reflect-metadata';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { QuotesService } from './quotes.service';

describe('QuotesService', () => {
  let service: QuotesService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      provider: { findUnique: jest.fn() },
      job: { findUnique: jest.fn() },
      quote: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      assignment: { upsert: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
      $transaction: jest.fn().mockResolvedValue(undefined),
    };
    const notifications = {
      notifyQuoteCreated: jest.fn(),
      notifyQuoteAccepted: jest.fn(),
      notifyAcceptanceRevoked: jest.fn(),
    };
    service = new QuotesService(prisma, notifications as any);
  });

  it('createQuote: forbids when provider missing', async () => {
    prisma.provider.findUnique.mockResolvedValue(null);
    await expect(service.createQuote('job1', 'user1', { total: 100 } as any)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('createQuote: 404 when job missing', async () => {
    prisma.provider.findUnique.mockResolvedValue({ id: 'prov1' });
    prisma.job.findUnique.mockResolvedValue(null);
    await expect(service.createQuote('job-miss', 'user1', { total: 100 } as any)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('createQuote: duplicate pre-check bad request', async () => {
    prisma.provider.findUnique.mockResolvedValue({ id: 'prov1' });
    prisma.job.findUnique.mockResolvedValue({ id: 'job1' });
    prisma.quote.findFirst.mockResolvedValue({ id: 'q1' });
    await expect(service.createQuote('job1', 'user1', { total: 100 } as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('createQuote: unique violation P2002 -> bad request', async () => {
    prisma.provider.findUnique.mockResolvedValue({ id: 'prov1' });
    prisma.job.findUnique.mockResolvedValue({ id: 'job1' });
    prisma.quote.findFirst.mockResolvedValue(null);
    prisma.quote.create.mockRejectedValue({ code: 'P2002' });
    await expect(service.createQuote('job1', 'user1', { total: 100 } as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('acceptQuote: forbids when not job owner', async () => {
    prisma.job.findUnique.mockResolvedValue({ id: 'job1', customerId: 'other' });
    await expect(service.acceptQuote('job1', 'q1', 'user1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('acceptQuote: bad request when quote not in job', async () => {
    prisma.job.findUnique.mockResolvedValue({ id: 'job1', customerId: 'user1', assignment: null });
    prisma.quote.count.mockResolvedValue(0);
    prisma.quote.findUnique.mockResolvedValueOnce({ id: 'q1', jobId: 'otherJob', status: 'pending', providerId: 'prov' });
    await expect(service.acceptQuote('job1', 'q1', 'user1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('acceptQuote: success updates and returns quote', async () => {
    prisma.job.findUnique.mockResolvedValue({ id: 'job1', customerId: 'user1', assignment: null });
    prisma.quote.count = jest.fn().mockResolvedValue(0);
    prisma.quote.findUnique
      .mockResolvedValueOnce({ id: 'q1', jobId: 'job1', status: 'pending', providerId: 'prov1' })
      .mockResolvedValueOnce({ id: 'q1', jobId: 'job1', status: 'accepted' });
    prisma.quote.updateMany = jest.fn()
      .mockResolvedValueOnce({ count: 1 }) // accept target
      .mockResolvedValueOnce({ count: 1 }); // decline others
    prisma.assignment.upsert.mockResolvedValue({});

    const result = await service.acceptQuote('job1', 'q1', 'user1');
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result).toMatchObject({ id: 'q1', jobId: 'job1' });
  });

  it('acceptQuote: fails when another accepted quote exists', async () => {
    prisma.job.findUnique.mockResolvedValue({ id: 'job1', customerId: 'user1', assignment: null });
    prisma.quote.count = jest.fn().mockResolvedValue(1);
    await expect(service.acceptQuote('job1', 'q1', 'user1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('acceptQuote: fails when target quote is not pending', async () => {
    prisma.job.findUnique.mockResolvedValue({ id: 'job1', customerId: 'user1', assignment: null });
    prisma.quote.count = jest.fn().mockResolvedValue(0);
    prisma.quote.findUnique.mockResolvedValue({ id: 'q1', jobId: 'job1', status: 'declined', providerId: 'prov1' });
    await expect(service.acceptQuote('job1', 'q1', 'user1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('revokeAcceptance: returns ok when accepted + assignment exist', async () => {
    prisma.job.findUnique.mockResolvedValue({ id: 'job1', customerId: 'user1' });
    prisma.quote.findFirst.mockResolvedValue({ id: 'q1' });
    prisma.assignment.findUnique = jest.fn().mockResolvedValue({ id: 'a1', jobId: 'job1' });
    prisma.$transaction.mockImplementation(async (fn: any) => {
      await fn({ quote: prisma.quote, assignment: prisma.assignment });
    });
    const res = await service.revokeAcceptance('job1', 'user1');
    expect(res).toEqual({ ok: true });
  });

  it('revokeAcceptance: bad request when nothing to revoke', async () => {
    prisma.job.findUnique.mockResolvedValue({ id: 'job1', customerId: 'user1' });
    prisma.quote.findFirst.mockResolvedValue(null);
    prisma.assignment.findUnique = jest.fn().mockResolvedValue(null);
    await expect(service.revokeAcceptance('job1', 'user1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('acceptQuote: prevents re-accept when assignment exists', async () => {
    prisma.job.findUnique.mockResolvedValue({ id: 'job1', customerId: 'user1', assignment: { id: 'a1', status: 'active' } });
    await expect(service.acceptQuote('job1', 'q1', 'user1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('listQuotes: returns all for customer owner', async () => {
    prisma.job.findUnique.mockResolvedValue({ id: 'job1', customerId: 'user1' });
    prisma.quote.findMany.mockResolvedValue([{ id: 'q1', jobId: 'job1' }, { id: 'q2', jobId: 'job1' }]);
    const rows = await service.listQuotes('job1', 'user1');
    expect(rows).toHaveLength(2);
    expect(prisma.quote.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { jobId: 'job1' } }));
  });

  it('listQuotes: returns provider-only quotes when not owner', async () => {
    prisma.job.findUnique.mockResolvedValue({ id: 'job1', customerId: 'cust1' });
    prisma.provider.findUnique.mockResolvedValue({ id: 'prov1', userId: 'user-prov' });
    prisma.quote.findMany.mockResolvedValue([{ id: 'q1', jobId: 'job1', providerId: 'prov1' }]);
    const rows = await service.listQuotes('job1', 'user-prov');
    expect(rows).toHaveLength(1);
    expect(prisma.quote.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { jobId: 'job1', providerId: 'prov1' } }));
  });

  describe('createQuote: success path', () => {
    it('should create quote successfully and notify', async () => {
      prisma.provider.findUnique.mockResolvedValue({ id: 'prov1' });
      prisma.job.findUnique.mockResolvedValue({ id: 'job1' });
      prisma.quote.findFirst.mockResolvedValue(null);
      prisma.quote.create.mockResolvedValue({ id: 'q1', jobId: 'job1', providerId: 'prov1', total: 250 });

      const result = await service.createQuote('job1', 'user1', { total: 250, lineItems: [] } as any);

      expect(result).toMatchObject({ id: 'q1', jobId: 'job1', total: 250 });
      expect(prisma.quote.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ jobId: 'job1', providerId: 'prov1', total: 250 }),
      });
    });

    it('should create quote with all required fields', async () => {
      prisma.provider.findUnique.mockResolvedValue({ id: 'prov1' });
      prisma.job.findUnique.mockResolvedValue({ id: 'job1' });
      prisma.quote.findFirst.mockResolvedValue(null);
      prisma.quote.create.mockResolvedValue({ id: 'q2', jobId: 'job1', providerId: 'prov1', total: 150 });

      const result = await service.createQuote('job1', 'user1', { total: 150, lineItems: [] } as any);

      expect(result).toMatchObject({ id: 'q2', total: 150 });
      expect(prisma.quote.create).toHaveBeenCalledWith({
        data: { jobId: 'job1', providerId: 'prov1', total: 150 },
      });
    });

    it('should call notification after quote created', async () => {
      prisma.provider.findUnique.mockResolvedValue({ id: 'prov1' });
      prisma.job.findUnique.mockResolvedValue({ id: 'job1' });
      prisma.quote.findFirst.mockResolvedValue(null);
      prisma.quote.create.mockResolvedValue({ id: 'q3', jobId: 'job1', providerId: 'prov1', total: 300 });

      const notifications = (service as any).notifications;
      notifications.notifyQuoteCreated.mockResolvedValue(undefined);

      const result = await service.createQuote('job1', 'user1', { total: 300 } as any);

      expect(result).toMatchObject({ id: 'q3' });
      expect(notifications.notifyQuoteCreated).toHaveBeenCalledWith('job1', 'q3', 'prov1');
    });
  });

  describe('createQuote: error handling', () => {
    it('should re-throw non-P2002 database errors', async () => {
      prisma.provider.findUnique.mockResolvedValue({ id: 'prov1' });
      prisma.job.findUnique.mockResolvedValue({ id: 'job1' });
      prisma.quote.findFirst.mockResolvedValue(null);
      prisma.quote.create.mockRejectedValue(new Error('Database connection lost'));

      await expect(service.createQuote('job1', 'user1', { total: 100 } as any)).rejects.toThrow('Database connection lost');
    });

    it('should handle empty provider id gracefully', async () => {
      prisma.provider.findUnique.mockResolvedValue({ id: '' });
      prisma.job.findUnique.mockResolvedValue({ id: 'job1' });
      prisma.quote.findFirst.mockResolvedValue(null);
      prisma.quote.create.mockResolvedValue({ id: 'q1', jobId: 'job1', providerId: '', total: 100 });

      const result = await service.createQuote('job1', 'user1', { total: 100 } as any);

      expect(result.providerId).toBe('');
    });
  });

  describe('acceptQuote: notification and edge cases', () => {
    it('should call notification after quote accepted', async () => {
      prisma.job.findUnique.mockResolvedValue({ id: 'job1', customerId: 'user1', assignment: null });
      prisma.quote.count.mockResolvedValue(0);
      prisma.quote.findUnique
        .mockResolvedValueOnce({ id: 'q1', jobId: 'job1', status: 'pending', providerId: 'prov1' })
        .mockResolvedValueOnce({ id: 'q1', jobId: 'job1', status: 'accepted' });
      prisma.quote.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 1 });
      prisma.assignment.upsert.mockResolvedValue({});

      const notifications = (service as any).notifications;
      notifications.notifyQuoteAccepted.mockResolvedValue(undefined);

      const result = await service.acceptQuote('job1', 'q1', 'user1');

      expect(result).toMatchObject({ id: 'q1', status: 'accepted' });
      expect(notifications.notifyQuoteAccepted).toHaveBeenCalledWith('job1', 'q1', 'prov1');
    });

    it('should use transaction for atomic operations', async () => {
      prisma.job.findUnique.mockResolvedValue({ id: 'job1', customerId: 'user1', assignment: null });
      prisma.quote.count.mockResolvedValue(0);
      prisma.quote.findUnique
        .mockResolvedValueOnce({ id: 'q1', jobId: 'job1', status: 'pending', providerId: 'prov1' })
        .mockResolvedValueOnce({ id: 'q1', jobId: 'job1', status: 'accepted' });

      let transactionCalled = false;
      prisma.$transaction.mockImplementation(async (fn: any) => {
        transactionCalled = true;
        const tx = {
          quote: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
          assignment: { upsert: jest.fn().mockResolvedValue({}) },
        };
        await fn(tx);
      });

      await service.acceptQuote('job1', 'q1', 'user1');

      expect(transactionCalled).toBe(true);
    });

    it('should prevent acceptance when assignment has active status', async () => {
      prisma.job.findUnique.mockResolvedValue({
        id: 'job1',
        customerId: 'user1',
        assignment: { id: 'a1', status: 'SCHEDULED' },
      });

      await expect(service.acceptQuote('job1', 'q1', 'user1')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('revokeAcceptance: authorization and notifications', () => {
    it('should forbid revocation when not job owner', async () => {
      prisma.job.findUnique.mockResolvedValue({ id: 'job1', customerId: 'other-user' });

      await expect(service.revokeAcceptance('job1', 'user1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should call notification after revocation', async () => {
      prisma.job.findUnique.mockResolvedValue({ id: 'job1', customerId: 'user1' });
      prisma.quote.findFirst.mockResolvedValue({ id: 'q1', providerId: 'prov1' });
      prisma.assignment.findUnique.mockResolvedValue({ id: 'a1', jobId: 'job1' });
      prisma.$transaction.mockImplementation(async (fn: any) => {
        await fn({
          quote: {
            update: jest.fn().mockResolvedValue({}),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          assignment: {
            delete: jest.fn().mockResolvedValue({}),
          },
        });
      });

      const notifications = (service as any).notifications;
      notifications.notifyAcceptanceRevoked.mockResolvedValue(undefined);

      const result = await service.revokeAcceptance('job1', 'user1');

      expect(result).toEqual({ ok: true });
      expect(notifications.notifyAcceptanceRevoked).toHaveBeenCalledWith('job1', 'q1');
    });

    it('should reset quotes to pending and delete assignment', async () => {
      prisma.job.findUnique.mockResolvedValue({ id: 'job1', customerId: 'user1' });
      prisma.quote.findFirst.mockResolvedValue({ id: 'q1', providerId: 'prov1' });
      prisma.assignment.findUnique.mockResolvedValue({ id: 'a1', jobId: 'job1' });

      let quoteUpdateCalled = false;
      let updateManyCalled = false;
      let assignmentDeleteCalled = false;
      prisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          quote: {
            update: jest.fn().mockImplementation(() => {
              quoteUpdateCalled = true;
              return Promise.resolve({});
            }),
            updateMany: jest.fn().mockImplementation(() => {
              updateManyCalled = true;
              return Promise.resolve({ count: 2 });
            }),
          },
          assignment: {
            delete: jest.fn().mockImplementation(() => {
              assignmentDeleteCalled = true;
              return Promise.resolve({});
            }),
          },
        };
        await fn(tx);
      });

      await service.revokeAcceptance('job1', 'user1');

      expect(quoteUpdateCalled).toBe(true);
      expect(updateManyCalled).toBe(true);
      expect(assignmentDeleteCalled).toBe(true);
    });

    it('should handle partial state: quote accepted but no assignment', async () => {
      prisma.job.findUnique.mockResolvedValue({ id: 'job1', customerId: 'user1' });
      prisma.quote.findFirst.mockResolvedValue({ id: 'q1', providerId: 'prov1' });
      prisma.assignment.findUnique.mockResolvedValue(null);

      await expect(service.revokeAcceptance('job1', 'user1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should handle partial state: assignment exists but no accepted quote', async () => {
      prisma.job.findUnique.mockResolvedValue({ id: 'job1', customerId: 'user1' });
      prisma.quote.findFirst.mockResolvedValue(null);
      prisma.assignment.findUnique.mockResolvedValue({ id: 'a1', jobId: 'job1' });

      await expect(service.revokeAcceptance('job1', 'user1')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('listQuotes: edge cases and validation', () => {
    it('should return empty array when job not found', async () => {
      prisma.job.findUnique.mockResolvedValue(null);

      const rows = await service.listQuotes('missing-job', 'user1');

      expect(rows).toEqual([]);
    });

    it('should return empty array when provider has no quotes', async () => {
      prisma.job.findUnique.mockResolvedValue({ id: 'job1', customerId: 'cust1' });
      prisma.provider.findUnique.mockResolvedValue({ id: 'prov1', userId: 'user-prov' });
      prisma.quote.findMany.mockResolvedValue([]);

      const rows = await service.listQuotes('job1', 'user-prov');

      expect(rows).toEqual([]);
    });

    it('should return empty array when provider not found', async () => {
      prisma.job.findUnique.mockResolvedValue({ id: 'job1', customerId: 'cust1' });
      prisma.provider.findUnique.mockResolvedValue(null);

      const rows = await service.listQuotes('job1', 'user-non-provider');

      expect(rows).toEqual([]);
    });

    it('should select provider details in quotes for customer', async () => {
      prisma.job.findUnique.mockResolvedValue({ id: 'job1', customerId: 'user1' });
      prisma.quote.findMany.mockResolvedValue([
        { id: 'q1', jobId: 'job1', provider: { id: 'prov1', user: { name: 'John', email: 'john@example.com' } } },
      ]);

      await service.listQuotes('job1', 'user1');

      expect(prisma.quote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            provider: expect.any(Object),
          }),
        }),
      );
    });

    it('should order quotes by createdAt desc', async () => {
      prisma.job.findUnique.mockResolvedValue({ id: 'job1', customerId: 'user1' });
      prisma.quote.findMany.mockResolvedValue([]);

      await service.listQuotes('job1', 'user1');

      expect(prisma.quote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should return multiple quotes with correct filtering', async () => {
      prisma.job.findUnique.mockResolvedValue({ id: 'job1', customerId: 'user1' });
      const mockQuotes = [
        { id: 'q1', jobId: 'job1', total: 100, status: 'pending' },
        { id: 'q2', jobId: 'job1', total: 150, status: 'accepted' },
        { id: 'q3', jobId: 'job1', total: 120, status: 'declined' },
      ];
      prisma.quote.findMany.mockResolvedValue(mockQuotes);

      const rows = await service.listQuotes('job1', 'user1');

      expect(rows).toHaveLength(3);
      expect(rows).toEqual(mockQuotes);
    });
  });
});
