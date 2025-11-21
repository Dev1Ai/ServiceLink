import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { ConfigService } from '@nestjs/config';

describe('HealthController', () => {
  let controller: HealthController;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfigService.get.mockReturnValue(undefined); // Default: no Redis

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('get (without Redis)', () => {
    beforeEach(async () => {
      mockConfigService.get.mockReturnValue(undefined);
      const module: TestingModule = await Test.createTestingModule({
        controllers: [HealthController],
        providers: [{ provide: ConfigService, useValue: mockConfigService }],
      }).compile();
      controller = module.get<HealthController>(HealthController);
    });

    it('should return ok status without Redis', async () => {
      const result = await controller.get();

      expect(result).toHaveProperty('ok', true);
      expect(result).toHaveProperty('ts');
      expect(result).toHaveProperty('usingRedis', false);
      expect(result).not.toHaveProperty('hits');
    });

    it('should return ISO timestamp', async () => {
      const before = new Date();
      const result = await controller.get();
      const after = new Date();

      const ts = new Date(result.ts);
      expect(ts).toBeInstanceOf(Date);
      expect(ts.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(ts.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should return valid ISO 8601 timestamp format', async () => {
      const result = await controller.get();

      // ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
      expect(result.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should return consistent structure across multiple calls', async () => {
      const result1 = await controller.get();
      const result2 = await controller.get();

      expect(result1).toHaveProperty('ok');
      expect(result1).toHaveProperty('ts');
      expect(result1).toHaveProperty('usingRedis');
      expect(result2).toHaveProperty('ok');
      expect(result2).toHaveProperty('ts');
      expect(result2).toHaveProperty('usingRedis');
    });

    it('should return updated timestamp on each call', async () => {
      const result1 = await controller.get();
      await new Promise(resolve => setTimeout(resolve, 10));
      const result2 = await controller.get();

      const ts1 = new Date(result1.ts).getTime();
      const ts2 = new Date(result2.ts).getTime();
      expect(ts2).toBeGreaterThanOrEqual(ts1);
    });
  });

  describe('ConfigService integration', () => {
    it('should call ConfigService.get with REDIS_URL', async () => {
      expect(mockConfigService.get).toHaveBeenCalledWith('REDIS_URL');
    });

    it('should handle missing REDIS_URL config', async () => {
      mockConfigService.get.mockReturnValue(undefined);
      const module: TestingModule = await Test.createTestingModule({
        controllers: [HealthController],
        providers: [{ provide: ConfigService, useValue: mockConfigService }],
      }).compile();
      const testController = module.get<HealthController>(HealthController);

      const result = await testController.get();

      expect(result.usingRedis).toBe(false);
    });

    it('should handle null REDIS_URL config', async () => {
      mockConfigService.get.mockReturnValue(null);
      const module: TestingModule = await Test.createTestingModule({
        controllers: [HealthController],
        providers: [{ provide: ConfigService, useValue: mockConfigService }],
      }).compile();
      const testController = module.get<HealthController>(HealthController);

      const result = await testController.get();

      expect(result.usingRedis).toBe(false);
    });

    it('should handle empty string REDIS_URL config', async () => {
      mockConfigService.get.mockReturnValue('');
      const module: TestingModule = await Test.createTestingModule({
        controllers: [HealthController],
        providers: [{ provide: ConfigService, useValue: mockConfigService }],
      }).compile();
      const testController = module.get<HealthController>(HealthController);

      const result = await testController.get();

      expect(result.usingRedis).toBe(false);
    });
  });

  describe('Health check response structure', () => {
    it('should always return ok: true', async () => {
      const result = await controller.get();
      expect(result.ok).toBe(true);
    });

    it('should always return a timestamp', async () => {
      const result = await controller.get();
      expect(result.ts).toBeDefined();
      expect(typeof result.ts).toBe('string');
    });

    it('should always return usingRedis field', async () => {
      const result = await controller.get();
      expect(result).toHaveProperty('usingRedis');
      expect(typeof result.usingRedis).toBe('boolean');
    });

    it('should not include hits when Redis is not available', async () => {
      const result = await controller.get();
      expect(result.hits).toBeUndefined();
    });
  });

  describe('Multiple health check calls', () => {
    it('should handle rapid successive calls', async () => {
      const results = await Promise.all([
        controller.get(),
        controller.get(),
        controller.get(),
        controller.get(),
        controller.get(),
      ]);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.ok).toBe(true);
        expect(result.ts).toBeDefined();
        expect(result.usingRedis).toBe(false);
      });
    });

    it('should return different timestamps for sequential calls', async () => {
      const results: Array<{ ok: boolean; ts: string; usingRedis: boolean }> = [];
      for (let i = 0; i < 5; i++) {
        results.push(await controller.get());
        await new Promise(resolve => setTimeout(resolve, 5));
      }

      const timestamps = results.map(r => new Date(r.ts).getTime());
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
      }
    });
  });

  describe('Endpoint behavior', () => {
    it('should never throw errors when Redis is unavailable', async () => {
      await expect(controller.get()).resolves.toBeDefined();
    });

    it('should return valid response even when ConfigService returns undefined', async () => {
      mockConfigService.get.mockReturnValue(undefined);
      const module: TestingModule = await Test.createTestingModule({
        controllers: [HealthController],
        providers: [{ provide: ConfigService, useValue: mockConfigService }],
      }).compile();
      const testController = module.get<HealthController>(HealthController);

      const result = await testController.get();

      expect(result).toBeDefined();
      expect(result.ok).toBe(true);
    });
  });
});
