import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { MetricsController } from './metrics.controller';
import { PrismaService } from '../prisma/prisma.service';

describe('MetricsController', () => {
  let controller: MetricsController;
  const prisma = {
    assignment: {
      count: jest.fn(),
    },
  } as unknown as PrismaService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();

    controller = moduleRef.get(MetricsController);
  });

  it('returns fulfillment summary counts', async () => {
    (prisma.assignment.count as jest.Mock)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(4);

    const result = await controller.fulfillmentSummary();
    expect(result).toEqual({ awaitingSchedule: 3, scheduled: 5, reminderOverdue: 2, payoutPending: 4 });
    expect(prisma.assignment.count).toHaveBeenCalledTimes(4);
  });
});
