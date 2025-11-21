import { Test, TestingModule } from '@nestjs/testing';
import { RealtimeService } from './realtime.service';
import { ConfigService } from '@nestjs/config';

describe('RealtimeService', () => {
  let service: RealtimeService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfigService.get.mockReturnValue(undefined); // Default: no Redis

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RealtimeService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<RealtimeService>(RealtimeService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('In-memory mode (no Redis)', () => {
    beforeEach(async () => {
      mockConfigService.get.mockReturnValue(undefined);
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RealtimeService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();
      service = module.get<RealtimeService>(RealtimeService);
    });

    describe('addOnline', () => {
      it('should add user to online set', async () => {
        await service.addOnline('user-123');
        const online = await service.listOnline();

        // Note: listOnline filters by alive status, so we need to touch first
        await service.touchAlive('user-123');
        await service.addOnline('user-123');
        const onlineAfterTouch = await service.listOnline();

        expect(onlineAfterTouch).toContain('user-123');
      });

      it('should handle null userId', async () => {
        await expect(service.addOnline(null as any)).resolves.not.toThrow();
      });

      it('should handle undefined userId', async () => {
        await expect(service.addOnline(undefined as any)).resolves.not.toThrow();
      });

      it('should handle empty string userId', async () => {
        await expect(service.addOnline('')).resolves.not.toThrow();
      });

      it('should add multiple users', async () => {
        await service.touchAlive('user-1', 60);
        await service.touchAlive('user-2', 60);
        await service.addOnline('user-1');
        await service.addOnline('user-2');

        const online = await service.listOnline();
        expect(online).toContain('user-1');
        expect(online).toContain('user-2');
      });
    });

    describe('removeOnline', () => {
      it('should remove user from online set', async () => {
        await service.touchAlive('user-123', 60);
        await service.addOnline('user-123');
        await service.removeOnline('user-123');

        const online = await service.listOnline();
        expect(online).not.toContain('user-123');
      });

      it('should handle removing non-existent user', async () => {
        await expect(service.removeOnline('nonexistent')).resolves.not.toThrow();
      });

      it('should handle null userId', async () => {
        await expect(service.removeOnline(null as any)).resolves.not.toThrow();
      });

      it('should handle undefined userId', async () => {
        await expect(service.removeOnline(undefined as any)).resolves.not.toThrow();
      });

      it('should handle empty string userId', async () => {
        await expect(service.removeOnline('')).resolves.not.toThrow();
      });
    });

    describe('listOnline', () => {
      it('should return empty array when no users online', async () => {
        const online = await service.listOnline();
        expect(online).toEqual([]);
      });

      it('should return list of online users with valid alive status', async () => {
        await service.touchAlive('user-1', 60);
        await service.touchAlive('user-2', 60);
        await service.addOnline('user-1');
        await service.addOnline('user-2');

        const online = await service.listOnline();
        expect(online).toHaveLength(2);
        expect(online).toContain('user-1');
        expect(online).toContain('user-2');
      });

      it('should filter out users without alive status', async () => {
        await service.addOnline('user-without-alive');
        const online = await service.listOnline();

        expect(online).not.toContain('user-without-alive');
      });

      it('should filter out users with expired alive status', async () => {
        // Add user with 0 second TTL (already expired)
        await service.touchAlive('user-expired', 0);
        await service.addOnline('user-expired');

        // Wait a tiny bit to ensure expiration
        await new Promise(resolve => setTimeout(resolve, 10));

        const online = await service.listOnline();
        expect(online).not.toContain('user-expired');
      });
    });

    describe('count', () => {
      it('should return 0 when no users online', async () => {
        const count = await service.count();
        expect(count).toBe(0);
      });

      it('should return correct count of online users', async () => {
        await service.touchAlive('user-1', 60);
        await service.touchAlive('user-2', 60);
        await service.touchAlive('user-3', 60);
        await service.addOnline('user-1');
        await service.addOnline('user-2');
        await service.addOnline('user-3');

        const count = await service.count();
        expect(count).toBe(3);
      });

      it('should only count users with valid alive status', async () => {
        await service.touchAlive('user-alive', 60);
        await service.addOnline('user-alive');
        await service.addOnline('user-dead'); // No touchAlive

        const count = await service.count();
        expect(count).toBe(1);
      });
    });

    describe('touchAlive', () => {
      it('should set alive status for user with default TTL', async () => {
        await service.touchAlive('user-123');
        await service.addOnline('user-123');

        const online = await service.listOnline();
        expect(online).toContain('user-123');
      });

      it('should set alive status with custom TTL', async () => {
        await service.touchAlive('user-123', 120);
        await service.addOnline('user-123');

        const online = await service.listOnline();
        expect(online).toContain('user-123');
      });

      it('should handle null userId', async () => {
        await expect(service.touchAlive(null as any)).resolves.not.toThrow();
      });

      it('should handle undefined userId', async () => {
        await expect(service.touchAlive(undefined as any)).resolves.not.toThrow();
      });

      it('should handle empty string userId', async () => {
        await expect(service.touchAlive('')).resolves.not.toThrow();
      });

      it('should update expiration time on subsequent touches', async () => {
        await service.touchAlive('user-123', 1);
        await service.addOnline('user-123');

        // Touch again with longer TTL
        await service.touchAlive('user-123', 60);

        const online = await service.listOnline();
        expect(online).toContain('user-123');
      });
    });

    describe('reconcile', () => {
      it('should remove users with expired alive status', async () => {
        // Add user with short TTL
        await service.touchAlive('user-short', 0);
        await service.addOnline('user-short');

        // Wait for expiration
        await new Promise(resolve => setTimeout(resolve, 10));

        await service.reconcile(60);

        const online = await service.listOnline();
        expect(online).not.toContain('user-short');
      });

      it('should keep users with valid alive status', async () => {
        await service.touchAlive('user-valid', 60);
        await service.addOnline('user-valid');

        await service.reconcile(60);

        const online = await service.listOnline();
        expect(online).toContain('user-valid');
      });

      it('should handle empty online set', async () => {
        await expect(service.reconcile(60)).resolves.not.toThrow();
      });

      it('should remove multiple expired users', async () => {
        // Add users with short TTL
        await service.touchAlive('user-1', 0);
        await service.touchAlive('user-2', 0);
        await service.addOnline('user-1');
        await service.addOnline('user-2');

        // Add user with long TTL
        await service.touchAlive('user-alive', 60);
        await service.addOnline('user-alive');

        // Wait for expiration
        await new Promise(resolve => setTimeout(resolve, 10));

        await service.reconcile(60);

        const online = await service.listOnline();
        expect(online).toHaveLength(1);
        expect(online).toContain('user-alive');
      });
    });
  });

  describe('Integration scenarios', () => {
    beforeEach(async () => {
      mockConfigService.get.mockReturnValue(undefined);
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RealtimeService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();
      service = module.get<RealtimeService>(RealtimeService);
    });

    it('should handle complete user lifecycle', async () => {
      // User comes online
      await service.touchAlive('user-123', 60);
      await service.addOnline('user-123');

      // Verify user is online
      let online = await service.listOnline();
      expect(online).toContain('user-123');

      let count = await service.count();
      expect(count).toBe(1);

      // User disconnects
      await service.removeOnline('user-123');

      // Verify user is offline
      online = await service.listOnline();
      expect(online).not.toContain('user-123');

      count = await service.count();
      expect(count).toBe(0);
    });

    it('should handle multiple users concurrently', async () => {
      const users = ['user-1', 'user-2', 'user-3', 'user-4', 'user-5'];

      // All users come online
      for (const user of users) {
        await service.touchAlive(user, 60);
        await service.addOnline(user);
      }

      // Verify all online
      let count = await service.count();
      expect(count).toBe(5);

      // Some users disconnect
      await service.removeOnline('user-2');
      await service.removeOnline('user-4');

      // Verify correct count
      count = await service.count();
      expect(count).toBe(3);

      const online = await service.listOnline();
      expect(online).toContain('user-1');
      expect(online).toContain('user-3');
      expect(online).toContain('user-5');
      expect(online).not.toContain('user-2');
      expect(online).not.toContain('user-4');
    });

    it('should handle user reconnecting', async () => {
      // User connects
      await service.touchAlive('user-123', 60);
      await service.addOnline('user-123');

      // User disconnects
      await service.removeOnline('user-123');

      // User reconnects
      await service.touchAlive('user-123', 60);
      await service.addOnline('user-123');

      const online = await service.listOnline();
      expect(online).toContain('user-123');

      const count = await service.count();
      expect(count).toBe(1);
    });

    it('should handle duplicate addOnline calls', async () => {
      await service.touchAlive('user-123', 60);
      await service.addOnline('user-123');
      await service.addOnline('user-123');
      await service.addOnline('user-123');

      const count = await service.count();
      expect(count).toBe(1); // Should still be 1
    });

    it('should handle alive status refresh', async () => {
      await service.touchAlive('user-123', 5);
      await service.addOnline('user-123');

      // Refresh alive status
      await service.touchAlive('user-123', 60);

      const online = await service.listOnline();
      expect(online).toContain('user-123');
    });

    it('should handle reconcile cleaning up stale users', async () => {
      // Add users with different TTLs
      await service.touchAlive('user-short', 0);
      await service.addOnline('user-short');

      await service.touchAlive('user-long', 60);
      await service.addOnline('user-long');

      // Wait for short TTL to expire
      await new Promise(resolve => setTimeout(resolve, 10));

      // Reconcile should clean up expired
      await service.reconcile(60);

      const online = await service.listOnline();
      expect(online).toHaveLength(1);
      expect(online).toContain('user-long');
    });
  });
});
