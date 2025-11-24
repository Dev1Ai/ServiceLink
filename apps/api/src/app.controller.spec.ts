import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    controller = module.get<AppController>(AppController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('root', () => {
    it('should return API root information', () => {
      const result = controller.root();

      expect(result).toEqual({
        ok: true,
        service: 'api',
        docs: '/docs',
      });
    });

    it('should return ok: true', () => {
      const result = controller.root();

      expect(result.ok).toBe(true);
    });

    it('should return service: api', () => {
      const result = controller.root();

      expect(result.service).toBe('api');
    });

    it('should return docs path', () => {
      const result = controller.root();

      expect(result.docs).toBe('/docs');
    });

    it('should return object with all required properties', () => {
      const result = controller.root();

      expect(result).toHaveProperty('ok');
      expect(result).toHaveProperty('service');
      expect(result).toHaveProperty('docs');
    });

    it('should return consistent data on multiple calls', () => {
      const result1 = controller.root();
      const result2 = controller.root();

      expect(result1).toEqual(result2);
    });

    it('should return object with exactly 3 properties', () => {
      const result = controller.root();

      expect(Object.keys(result)).toHaveLength(3);
    });

    it('should return boolean for ok property', () => {
      const result = controller.root();

      expect(typeof result.ok).toBe('boolean');
    });

    it('should return string for service property', () => {
      const result = controller.root();

      expect(typeof result.service).toBe('string');
    });

    it('should return string for docs property', () => {
      const result = controller.root();

      expect(typeof result.docs).toBe('string');
    });

    it('should return docs path starting with /', () => {
      const result = controller.root();

      expect(result.docs).toMatch(/^\//);
    });

    it('should not throw any errors', () => {
      expect(() => controller.root()).not.toThrow();
    });

    it('should return immediately (synchronous)', () => {
      const result = controller.root();

      expect(result).not.toBeInstanceOf(Promise);
    });

    it('should return plain object (not instance)', () => {
      const result = controller.root();

      expect(result.constructor).toBe(Object);
    });

    it('should not modify returned object on subsequent calls', () => {
      const result1 = controller.root();
      result1.ok = false; // Try to modify

      const result2 = controller.root();

      expect(result2.ok).toBe(true); // Should still be true
    });
  });

  describe('API metadata', () => {
    it('should indicate service is operational', () => {
      const result = controller.root();

      expect(result.ok).toBe(true);
    });

    it('should identify as api service', () => {
      const result = controller.root();

      expect(result.service).toBe('api');
    });

    it('should provide documentation link', () => {
      const result = controller.root();

      expect(result.docs).toBeDefined();
      expect(result.docs.length).toBeGreaterThan(0);
    });
  });

  describe('Response structure', () => {
    it('should match expected RootDto structure', () => {
      const result = controller.root();

      expect(result).toMatchObject({
        ok: expect.any(Boolean),
        service: expect.any(String),
        docs: expect.any(String),
      });
    });

    it('should not include unexpected properties', () => {
      const result = controller.root();
      const expectedKeys = ['ok', 'service', 'docs'];

      Object.keys(result).forEach((key) => {
        expect(expectedKeys).toContain(key);
      });
    });
  });
});
