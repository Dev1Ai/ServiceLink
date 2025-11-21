import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';
import { INestApplication } from '@nestjs/common';

describe('PrismaService', () => {
  let service: PrismaService;
  let connectSpy: jest.SpyInstance;
  let disconnectSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    service = module.get<PrismaService>(PrismaService);

    // Mock the database connection methods to avoid actual database calls
    connectSpy = jest.spyOn(service, '$connect').mockResolvedValue(undefined);
    disconnectSpy = jest.spyOn(service, '$disconnect').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should connect to the database', async () => {
      await service.onModuleInit();

      expect(connectSpy).toHaveBeenCalled();
      expect(connectSpy).toHaveBeenCalledTimes(1);
    });

    it('should not throw on connection', async () => {
      await expect(service.onModuleInit()).resolves.not.toThrow();
    });

    it('should handle connection errors gracefully', async () => {
      connectSpy.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(service.onModuleInit()).rejects.toThrow('Connection failed');
    });
  });

  describe('onModuleDestroy', () => {
    it('should disconnect from the database', async () => {
      await service.onModuleDestroy();

      expect(disconnectSpy).toHaveBeenCalled();
      expect(disconnectSpy).toHaveBeenCalledTimes(1);
    });

    it('should not throw on disconnection', async () => {
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });

    it('should handle disconnection errors gracefully', async () => {
      disconnectSpy.mockRejectedValueOnce(new Error('Disconnection failed'));

      await expect(service.onModuleDestroy()).rejects.toThrow('Disconnection failed');
    });
  });

  describe('enableShutdownHooks', () => {
    let mockApp: INestApplication;
    let mockAppClose: jest.Mock;
    let processOnSpy: jest.SpyInstance;

    beforeEach(() => {
      mockAppClose = jest.fn().mockResolvedValue(undefined);
      mockApp = {
        close: mockAppClose,
      } as any;

      // Spy on process.on to capture the listener
      processOnSpy = jest.spyOn(process, 'on').mockImplementation(() => process);
    });

    afterEach(() => {
      processOnSpy.mockRestore();
    });

    it('should register beforeExit hook', async () => {
      await service.enableShutdownHooks(mockApp);

      expect(processOnSpy).toHaveBeenCalledWith('beforeExit', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledTimes(1);
    });

    it('should call app.close() when beforeExit is triggered', async () => {
      await service.enableShutdownHooks(mockApp);

      // Get the registered callback
      const callback = processOnSpy.mock.calls[0][1];

      // Execute the callback
      await callback();

      expect(mockAppClose).toHaveBeenCalled();
      expect(mockAppClose).toHaveBeenCalledTimes(1);
    });

    it('should not throw when registering hooks', async () => {
      await expect(service.enableShutdownHooks(mockApp)).resolves.not.toThrow();
    });

    it('should handle app.close() errors', async () => {
      mockAppClose.mockRejectedValueOnce(new Error('Close failed'));

      await service.enableShutdownHooks(mockApp);

      const callback = processOnSpy.mock.calls[0][1];

      // The callback should propagate the error
      await expect(callback()).rejects.toThrow('Close failed');
    });

    it('should register hook even if app is null', async () => {
      await expect(service.enableShutdownHooks(null as any)).resolves.not.toThrow();

      expect(processOnSpy).toHaveBeenCalledWith('beforeExit', expect.any(Function));
    });
  });

  describe('Lifecycle', () => {
    it('should handle full lifecycle: init -> destroy', async () => {
      // Initialize
      await service.onModuleInit();
      expect(connectSpy).toHaveBeenCalled();
      expect(connectSpy).toHaveBeenCalledTimes(1);

      // Destroy
      await service.onModuleDestroy();
      expect(disconnectSpy).toHaveBeenCalled();
      expect(disconnectSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple init calls', async () => {
      await service.onModuleInit();
      await service.onModuleInit();
      await service.onModuleInit();

      expect(connectSpy).toHaveBeenCalledTimes(3);
    });

    it('should handle multiple destroy calls', async () => {
      await service.onModuleDestroy();
      await service.onModuleDestroy();
      await service.onModuleDestroy();

      expect(disconnectSpy).toHaveBeenCalledTimes(3);
    });

    it('should handle init after destroy', async () => {
      await service.onModuleInit();
      await service.onModuleDestroy();
      await service.onModuleInit();

      expect(connectSpy).toHaveBeenCalledTimes(2);
      expect(disconnectSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle destroy without init', async () => {
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
      expect(disconnectSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle concurrent init calls', async () => {
      await Promise.all([
        service.onModuleInit(),
        service.onModuleInit(),
        service.onModuleInit(),
      ]);

      expect(connectSpy).toHaveBeenCalledTimes(3);
    });

    it('should handle concurrent destroy calls', async () => {
      await Promise.all([
        service.onModuleDestroy(),
        service.onModuleDestroy(),
        service.onModuleDestroy(),
      ]);

      expect(disconnectSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('PrismaClient inheritance', () => {
    it('should extend PrismaClient', () => {
      expect(service).toBeInstanceOf(PrismaService);
    });

    it('should have $connect method', () => {
      expect(service.$connect).toBeDefined();
      expect(typeof service.$connect).toBe('function');
    });

    it('should have $disconnect method', () => {
      expect(service.$disconnect).toBeDefined();
      expect(typeof service.$disconnect).toBe('function');
    });

    it('should have onModuleInit method', () => {
      expect(service.onModuleInit).toBeDefined();
      expect(typeof service.onModuleInit).toBe('function');
    });

    it('should have onModuleDestroy method', () => {
      expect(service.onModuleDestroy).toBeDefined();
      expect(typeof service.onModuleDestroy).toBe('function');
    });

    it('should have enableShutdownHooks method', () => {
      expect(service.enableShutdownHooks).toBeDefined();
      expect(typeof service.enableShutdownHooks).toBe('function');
    });
  });

  describe('Integration with NestJS', () => {
    it('should be injectable as a provider', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [PrismaService],
      }).compile();

      const injectedService = module.get<PrismaService>(PrismaService);

      expect(injectedService).toBeDefined();
      expect(injectedService).toBeInstanceOf(PrismaService);
    });

    it('should initialize and cleanup correctly in module lifecycle', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [PrismaService],
      }).compile();

      const moduleService = module.get<PrismaService>(PrismaService);
      const initSpy = jest.spyOn(moduleService, '$connect').mockResolvedValue(undefined);
      const destroySpy = jest.spyOn(moduleService, '$disconnect').mockResolvedValue(undefined);

      // Simulate module initialization
      await module.init();
      expect(initSpy).toHaveBeenCalled();

      // Simulate module cleanup
      await module.close();
      expect(destroySpy).toHaveBeenCalled();
    });
  });
});
