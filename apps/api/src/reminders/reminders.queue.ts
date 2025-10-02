import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { Provider } from '@nestjs/common';
import IORedis, { Redis } from 'ioredis';

export const REMINDER_QUEUE_NAME = 'assignment-reminders';
export const REMINDER_QUEUE_PROVIDER = Symbol('REMINDER_QUEUE_PROVIDER');

export type ReminderQueueResources = {
  connection: Redis;
  queue: Queue;
};

export const ReminderQueueProvider: Provider = {
  provide: REMINDER_QUEUE_PROVIDER,
  inject: [ConfigService],
  useFactory: async (config: ConfigService): Promise<ReminderQueueResources | null> => {
    const logger = new Logger('ReminderQueueProvider');
    const redisUrl = config.get<string>('REDIS_URL');
    const enabledFlag = (config.get<string>('REMINDER_WORKER_ENABLED') ?? 'true').toLowerCase() !== 'false';
    if (!enabledFlag) {
      logger.warn('REMINDER_WORKER_ENABLED set to false – reminder queue disabled.');
      return null;
    }
    if (!redisUrl) {
      logger.warn('REDIS_URL not configured – reminder queue disabled.');
      return null;
    }

    const connection = new IORedis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
    try {
      await connection.connect();
    } catch (err) {
      logger.error('Failed to connect to Redis for reminders queue', err as Error);
      await connection.quit().catch(() => undefined);
      return null;
    }

    const queue = new Queue(REMINDER_QUEUE_NAME, { connection });
    logger.log('Reminder queue initialised with BullMQ.');
    return { connection, queue };
  },
};
