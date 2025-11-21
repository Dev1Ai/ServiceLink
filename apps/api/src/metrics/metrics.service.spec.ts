import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService, sanitizeRoute, MetricsHttpHelper } from './metrics.service';
import { register } from 'prom-client';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(async () => {
    // Clear all metrics before each test
    register.clear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [MetricsService],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
  });

  afterEach(() => {
    // Clean up metrics after each test
    register.clear();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('incSignup', () => {
    it('should increment signup counter with CUSTOMER role', () => {
      expect(() => service.incSignup('customer')).not.toThrow();
      expect(() => service.incSignup('CUSTOMER')).not.toThrow();
    });

    it('should increment signup counter with PROVIDER role', () => {
      expect(() => service.incSignup('provider')).not.toThrow();
      expect(() => service.incSignup('PROVIDER')).not.toThrow();
    });

    it('should handle lowercase role and convert to uppercase', () => {
      expect(() => service.incSignup('admin')).not.toThrow();
    });

    it('should handle null role with UNKNOWN label', () => {
      expect(() => service.incSignup(null as any)).not.toThrow();
    });

    it('should handle undefined role with UNKNOWN label', () => {
      expect(() => service.incSignup(undefined as any)).not.toThrow();
    });
  });

  describe('incLogin', () => {
    it('should increment login counter with CUSTOMER role', () => {
      expect(() => service.incLogin('customer')).not.toThrow();
    });

    it('should increment login counter with PROVIDER role', () => {
      expect(() => service.incLogin('provider')).not.toThrow();
    });

    it('should handle null role with UNKNOWN label', () => {
      expect(() => service.incLogin(null as any)).not.toThrow();
    });

    it('should handle undefined role', () => {
      expect(() => service.incLogin(undefined as any)).not.toThrow();
    });
  });

  describe('incWsConnect', () => {
    it('should increment websocket connect counter with role and redis enabled', () => {
      expect(() => service.incWsConnect('customer', true)).not.toThrow();
    });

    it('should increment websocket connect counter with role and redis disabled', () => {
      expect(() => service.incWsConnect('provider', false)).not.toThrow();
    });

    it('should handle null role with UNKNOWN label', () => {
      expect(() => service.incWsConnect(null as any, true)).not.toThrow();
    });

    it('should convert redis boolean to string', () => {
      expect(() => service.incWsConnect('customer', false)).not.toThrow();
      expect(() => service.incWsConnect('customer', true)).not.toThrow();
    });
  });

  describe('incWsTyping', () => {
    it('should increment typing counter with room label', () => {
      expect(() => service.incWsTyping('job-123')).not.toThrow();
    });

    it('should handle null room with unknown label', () => {
      expect(() => service.incWsTyping(null as any)).not.toThrow();
    });

    it('should handle empty string room with unknown label', () => {
      expect(() => service.incWsTyping('')).not.toThrow();
    });
  });

  describe('incWsChat', () => {
    it('should increment chat counter with room label', () => {
      expect(() => service.incWsChat('job-456')).not.toThrow();
    });

    it('should handle null room with unknown label', () => {
      expect(() => service.incWsChat(null as any)).not.toThrow();
    });

    it('should handle empty string room', () => {
      expect(() => service.incWsChat('')).not.toThrow();
    });
  });

  describe('incPaymentInitiate', () => {
    it('should increment payment counter with default source', () => {
      expect(() => service.incPaymentInitiate()).not.toThrow();
    });

    it('should increment payment counter with custom source', () => {
      expect(() => service.incPaymentInitiate('manual_payment')).not.toThrow();
    });

    it('should increment payment counter with job_complete source', () => {
      expect(() => service.incPaymentInitiate('job_complete')).not.toThrow();
    });
  });

  describe('incReminderSent', () => {
    it('should increment reminder sent counter with status', () => {
      expect(() => service.incReminderSent('success')).not.toThrow();
    });

    it('should handle null status with UNKNOWN label', () => {
      expect(() => service.incReminderSent(null as any)).not.toThrow();
    });

    it('should convert status to uppercase', () => {
      expect(() => service.incReminderSent('sent')).not.toThrow();
      expect(() => service.incReminderSent('SENT')).not.toThrow();
    });
  });

  describe('incReminderFailed', () => {
    it('should increment reminder failed counter with reason', () => {
      expect(() => service.incReminderFailed('enqueue_error')).not.toThrow();
    });

    it('should handle null reason with unknown label', () => {
      expect(() => service.incReminderFailed(null as any)).not.toThrow();
    });

    it('should handle empty reason with unknown label', () => {
      expect(() => service.incReminderFailed('')).not.toThrow();
    });
  });

  describe('recordHttpDuration', () => {
    it('should record HTTP request duration with all labels', () => {
      expect(() => service.recordHttpDuration('GET', '/api/jobs', 200, 0.05)).not.toThrow();
    });

    it('should record POST request', () => {
      expect(() => service.recordHttpDuration('POST', '/api/auth/signup', 201, 0.12)).not.toThrow();
    });

    it('should convert method to uppercase', () => {
      expect(() => service.recordHttpDuration('get', '/api/providers', 200, 0.03)).not.toThrow();
    });

    it('should handle null method with default GET', () => {
      expect(() => service.recordHttpDuration(null as any, '/api/test', 200, 0.02)).not.toThrow();
    });

    it('should handle null route with default /', () => {
      expect(() => service.recordHttpDuration('GET', null as any, 200, 0.01)).not.toThrow();
    });

    it('should handle null status code with default 200', () => {
      expect(() => service.recordHttpDuration('GET', '/api/test', null as any, 0.01)).not.toThrow();
    });

    it('should sanitize route by removing query parameters', () => {
      expect(() => service.recordHttpDuration('GET', '/api/jobs?status=active&page=1', 200, 0.04)).not.toThrow();
    });

    it('should record 404 errors', () => {
      expect(() => service.recordHttpDuration('GET', '/api/nonexistent', 404, 0.01)).not.toThrow();
    });

    it('should record 500 errors', () => {
      expect(() => service.recordHttpDuration('POST', '/api/jobs', 500, 0.5)).not.toThrow();
    });

    it('should handle very long durations', () => {
      expect(() => service.recordHttpDuration('GET', '/api/slow', 200, 10.5)).not.toThrow();
    });

    it('should handle very short durations', () => {
      expect(() => service.recordHttpDuration('GET', '/api/fast', 200, 0.001)).not.toThrow();
    });
  });

  describe('sanitizeRoute', () => {
    it('should remove query parameters from route', () => {
      const result = sanitizeRoute('/api/jobs?status=active');
      expect(result).toBe('/api/jobs');
    });

    it('should handle route without query parameters', () => {
      const result = sanitizeRoute('/api/providers');
      expect(result).toBe('/api/providers');
    });

    it('should handle root path', () => {
      const result = sanitizeRoute('/');
      expect(result).toBe('/');
    });

    it('should handle empty string with default /', () => {
      const result = sanitizeRoute('');
      expect(result).toBe('/');
    });

    it('should handle complex query strings', () => {
      const result = sanitizeRoute('/api/search?q=test&sort=date&order=asc');
      expect(result).toBe('/api/search');
    });

    it('should handle multiple question marks', () => {
      const result = sanitizeRoute('/api/test?param1=value?extra');
      expect(result).toBe('/api/test');
    });

    it('should handle routes with fragments', () => {
      const result = sanitizeRoute('/api/page#section');
      expect(result).toBe('/api/page#section');
    });
  });

  describe('MetricsHttpHelper', () => {
    let helper: MetricsHttpHelper;

    beforeEach(() => {
      helper = new MetricsHttpHelper(service);
    });

    it('should record HTTP metrics through helper', () => {
      expect(() => helper.record('GET', '/api/jobs', 200, 0.05)).not.toThrow();
    });

    it('should handle POST request through helper', () => {
      expect(() => helper.record('POST', '/api/auth/login', 200, 0.08)).not.toThrow();
    });

    it('should sanitize route through helper', () => {
      expect(() => helper.record('GET', '/api/jobs?page=2', 200, 0.03)).not.toThrow();
    });

    it('should convert status code to string through helper', () => {
      expect(() => helper.record('GET', '/api/test', 404, 0.01)).not.toThrow();
    });

    it('should handle null values with defaults through helper', () => {
      expect(() => helper.record(null as any, null as any, null as any, 0.02)).not.toThrow();
    });

    it('should handle various HTTP methods', () => {
      expect(() => helper.record('GET', '/api/test', 200, 0.01)).not.toThrow();
      expect(() => helper.record('POST', '/api/test', 201, 0.02)).not.toThrow();
      expect(() => helper.record('PUT', '/api/test', 200, 0.03)).not.toThrow();
      expect(() => helper.record('PATCH', '/api/test', 200, 0.04)).not.toThrow();
      expect(() => helper.record('DELETE', '/api/test', 204, 0.05)).not.toThrow();
    });

    it('should handle various status codes', () => {
      expect(() => helper.record('GET', '/api/test', 200, 0.01)).not.toThrow();
      expect(() => helper.record('GET', '/api/test', 201, 0.01)).not.toThrow();
      expect(() => helper.record('GET', '/api/test', 400, 0.01)).not.toThrow();
      expect(() => helper.record('GET', '/api/test', 401, 0.01)).not.toThrow();
      expect(() => helper.record('GET', '/api/test', 403, 0.01)).not.toThrow();
      expect(() => helper.record('GET', '/api/test', 404, 0.01)).not.toThrow();
      expect(() => helper.record('GET', '/api/test', 500, 0.01)).not.toThrow();
      expect(() => helper.record('GET', '/api/test', 502, 0.01)).not.toThrow();
      expect(() => helper.record('GET', '/api/test', 503, 0.01)).not.toThrow();
    });
  });

  describe('Multiple metric increments', () => {
    it('should handle multiple signups', () => {
      expect(() => {
        service.incSignup('customer');
        service.incSignup('provider');
        service.incSignup('customer');
      }).not.toThrow();
    });

    it('should handle multiple logins', () => {
      expect(() => {
        service.incLogin('customer');
        service.incLogin('customer');
        service.incLogin('provider');
      }).not.toThrow();
    });

    it('should handle mixed metric operations', () => {
      expect(() => {
        service.incSignup('customer');
        service.incLogin('customer');
        service.incWsConnect('customer', true);
        service.incWsTyping('job-123');
        service.incWsChat('job-123');
        service.incPaymentInitiate('job_complete');
        service.incReminderSent('sent');
        service.recordHttpDuration('GET', '/api/test', 200, 0.05);
      }).not.toThrow();
    });
  });
});
