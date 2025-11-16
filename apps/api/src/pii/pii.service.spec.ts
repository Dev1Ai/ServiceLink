import { Test, TestingModule } from '@nestjs/testing';
import { PiiService } from './pii.service';

describe('PiiService', () => {
  let service: PiiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PiiService],
    }).compile();

    service = module.get<PiiService>(PiiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('redact', () => {
    it('should redact email addresses', () => {
      const text = 'My email is test@example.com.';
      const redacted = service.redact(text);
      expect(redacted).toBe('My email is [REDACTED_EMAIL].');
    });

    it('should redact phone numbers', () => {
      const text = 'Call me at 555-555-5555.';
      const redacted = service.redact(text);
      expect(redacted).toBe('Call me at [REDACTED_PHONE].');
    });

    it('should handle text with no PII', () => {
      const text = 'This is a safe message.';
      const redacted = service.redact(text);
      expect(redacted).toBe(text);
    });

    it('should handle multiple PII instances', () => {
      const text = 'Contact me at test@example.com or 555-555-5555.';
      const redacted = service.redact(text);
      expect(redacted).toBe('Contact me at [REDACTED_EMAIL] or [REDACTED_PHONE].');
    });
  });
});
