import { Test, TestingModule } from '@nestjs/testing';
import { PresenceController } from './presence.controller';
import { RealtimeService } from './realtime.service';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard, RolesGuard } from '../auth/jwt.guard';

describe('PresenceController', () => {
  let controller: PresenceController;
  let realtimeService: RealtimeService;
  let configService: ConfigService;

  const mockRealtimeService = {
    listOnline: jest.fn(),
    reconcile: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'PRESENCE_TTL') return '60';
      return null;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PresenceController],
      providers: [
        { provide: RealtimeService, useValue: mockRealtimeService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PresenceController>(PresenceController);
    realtimeService = module.get<RealtimeService>(RealtimeService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getPresence', () => {
    it('should return online users', async () => {
      const onlineUsers = ['user-1', 'user-2', 'user-3'];
      mockRealtimeService.listOnline.mockResolvedValue(onlineUsers);

      const result = await controller.getPresence();

      expect(result).toEqual({
        online: onlineUsers,
        count: 3,
      });
      expect(realtimeService.listOnline).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no users online', async () => {
      mockRealtimeService.listOnline.mockResolvedValue([]);

      const result = await controller.getPresence();

      expect(result).toEqual({
        online: [],
        count: 0,
      });
    });

    it('should include count property', async () => {
      const onlineUsers = ['user-1', 'user-2'];
      mockRealtimeService.listOnline.mockResolvedValue(onlineUsers);

      const result = await controller.getPresence();

      expect(result.count).toBe(2);
    });

    it('should call listOnline exactly once', async () => {
      mockRealtimeService.listOnline.mockResolvedValue(['user-1']);

      await controller.getPresence();

      expect(realtimeService.listOnline).toHaveBeenCalledTimes(1);
    });

    it('should handle large number of online users', async () => {
      const manyUsers = Array.from({ length: 1000 }, (_, i) => `user-${i}`);
      mockRealtimeService.listOnline.mockResolvedValue(manyUsers);

      const result = await controller.getPresence();

      expect(result.count).toBe(1000);
      expect(result.online).toHaveLength(1000);
    });
  });

  describe('getConfig', () => {
    it('should return TTL configuration', () => {
      const result = controller.getConfig();

      expect(result).toEqual({ ttlSeconds: 60 });
      expect(configService.get).toHaveBeenCalledWith('PRESENCE_TTL');
    });

    it('should use default TTL when not configured', () => {
      mockConfigService.get.mockReturnValue(null);

      const result = controller.getConfig();

      expect(result).toEqual({ ttlSeconds: 60 });
    });

    it('should parse TTL as number', () => {
      mockConfigService.get.mockReturnValue('120' as any);

      const result = controller.getConfig();

      expect(result.ttlSeconds).toBe(120);
      expect(typeof result.ttlSeconds).toBe('number');
    });

    it('should handle empty string as default', () => {
      mockConfigService.get.mockReturnValue('' as any);

      const result = controller.getConfig();

      expect(result.ttlSeconds).toBe(60);
    });

    it('should not call any services', () => {
      controller.getConfig();

      expect(realtimeService.listOnline).not.toHaveBeenCalled();
      expect(realtimeService.reconcile).not.toHaveBeenCalled();
    });
  });

  describe('reconcile', () => {
    it('should reconcile presence and return online users', async () => {
      const onlineUsers = ['user-1', 'user-2'];
      mockRealtimeService.reconcile.mockResolvedValue(undefined);
      mockRealtimeService.listOnline.mockResolvedValue(onlineUsers);

      const result = await controller.reconcile();

      expect(result).toEqual({
        ok: true,
        online: onlineUsers,
      });
      expect(realtimeService.reconcile).toHaveBeenCalledWith(60);
      expect(realtimeService.listOnline).toHaveBeenCalledTimes(1);
    });

    it('should use configured TTL for reconciliation', async () => {
      mockConfigService.get.mockReturnValue('120' as any);
      mockRealtimeService.reconcile.mockResolvedValue(undefined);
      mockRealtimeService.listOnline.mockResolvedValue([]);

      await controller.reconcile();

      expect(realtimeService.reconcile).toHaveBeenCalledWith(120);
    });

    it('should use default TTL when not configured', async () => {
      mockConfigService.get.mockReturnValue(null);
      mockRealtimeService.reconcile.mockResolvedValue(undefined);
      mockRealtimeService.listOnline.mockResolvedValue([]);

      await controller.reconcile();

      expect(realtimeService.reconcile).toHaveBeenCalledWith(60);
    });

    it('should call reconcile before listOnline', async () => {
      const callOrder: string[] = [];
      mockRealtimeService.reconcile.mockImplementation(() => {
        callOrder.push('reconcile');
        return Promise.resolve();
      });
      mockRealtimeService.listOnline.mockImplementation(() => {
        callOrder.push('listOnline');
        return Promise.resolve([]);
      });

      await controller.reconcile();

      expect(callOrder).toEqual(['reconcile', 'listOnline']);
    });

    it('should return ok:true', async () => {
      mockRealtimeService.reconcile.mockResolvedValue(undefined);
      mockRealtimeService.listOnline.mockResolvedValue([]);

      const result = await controller.reconcile();

      expect(result.ok).toBe(true);
    });

    it('should return updated online list after reconciliation', async () => {
      mockRealtimeService.reconcile.mockResolvedValue(undefined);
      mockRealtimeService.listOnline.mockResolvedValue(['user-active']);

      const result = await controller.reconcile();

      expect(result.online).toEqual(['user-active']);
    });

    it('should handle empty online list after reconcile', async () => {
      mockRealtimeService.reconcile.mockResolvedValue(undefined);
      mockRealtimeService.listOnline.mockResolvedValue([]);

      const result = await controller.reconcile();

      expect(result.online).toEqual([]);
      expect(result.ok).toBe(true);
    });
  });

  describe('Integration', () => {
    it('should handle multiple getPresence calls', async () => {
      mockRealtimeService.listOnline
        .mockResolvedValueOnce(['user-1'])
        .mockResolvedValueOnce(['user-1', 'user-2']);

      const result1 = await controller.getPresence();
      const result2 = await controller.getPresence();

      expect(result1.count).toBe(1);
      expect(result2.count).toBe(2);
      expect(realtimeService.listOnline).toHaveBeenCalledTimes(2);
    });

    it('should return consistent config across calls', () => {
      const config1 = controller.getConfig();
      const config2 = controller.getConfig();

      expect(config1).toEqual(config2);
    });
  });
});
