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
    describe('email redaction', () => {
      it('should redact email addresses', () => {
        const text = 'My email is test@example.com.';
        const redacted = service.redact(text);
        expect(redacted).toBe('My email is [REDACTED_EMAIL].');
      });

      it('should redact multiple email addresses', () => {
        const text = 'Emails: test@example.com, admin@company.org, support@service.net';
        const redacted = service.redact(text);
        expect(redacted).toBe('Emails: [REDACTED_EMAIL], [REDACTED_EMAIL], [REDACTED_EMAIL]');
      });

      it('should redact emails with dots in username', () => {
        const text = 'Contact john.doe@example.com';
        const redacted = service.redact(text);
        expect(redacted).toBe('Contact [REDACTED_EMAIL]');
      });

      it('should redact emails with hyphens in domain', () => {
        const text = 'Email: user@my-company.com';
        const redacted = service.redact(text);
        expect(redacted).toBe('Email: [REDACTED_EMAIL]');
      });

      it('should redact emails with subdomains', () => {
        const text = 'Contact: support@mail.example.com';
        const redacted = service.redact(text);
        expect(redacted).toBe('Contact: [REDACTED_EMAIL]');
      });

      it('should redact emails embedded in text without spaces', () => {
        const text = 'Contactuser@example.comfor';
        const redacted = service.redact(text);
        // Note: The regex matches the entire string as one email due to word characters before and after
        expect(redacted).toBe('[REDACTED_EMAIL]');
      });
    });

    describe('phone number redaction', () => {
      it('should redact phone numbers', () => {
        const text = 'Call me at 555-555-5555.';
        const redacted = service.redact(text);
        expect(redacted).toBe('Call me at [REDACTED_PHONE].');
      });

      it('should redact phone numbers with parentheses', () => {
        const text = 'Call (555) 555-5555';
        const redacted = service.redact(text);
        expect(redacted).toBe('Call [REDACTED_PHONE]');
      });

      it('should redact phone numbers with dots', () => {
        const text = 'Phone: 555.555.5555';
        const redacted = service.redact(text);
        expect(redacted).toBe('Phone: [REDACTED_PHONE]');
      });

      it('should redact phone numbers with spaces', () => {
        const text = 'Mobile: 555 555 5555';
        const redacted = service.redact(text);
        expect(redacted).toBe('Mobile: [REDACTED_PHONE]');
      });

      it('should redact phone numbers with country code +1', () => {
        const text = 'US number: +1 555-555-5555';
        const redacted = service.redact(text);
        expect(redacted).toBe('US number: [REDACTED_PHONE]');
      });

      it('should redact phone numbers without separators', () => {
        const text = 'Number: 5555555555';
        const redacted = service.redact(text);
        expect(redacted).toBe('Number: [REDACTED_PHONE]');
      });

      it('should redact multiple phone numbers', () => {
        const text = 'Call 555-555-5555 or 888-888-8888';
        const redacted = service.redact(text);
        expect(redacted).toBe('Call [REDACTED_PHONE] or [REDACTED_PHONE]');
      });
    });

    describe('combined PII redaction', () => {
      it('should handle multiple PII instances', () => {
        const text = 'Contact me at test@example.com or 555-555-5555.';
        const redacted = service.redact(text);
        expect(redacted).toBe('Contact me at [REDACTED_EMAIL] or [REDACTED_PHONE].');
      });

      it('should redact multiple emails and phone numbers', () => {
        const text = 'Reach out to john@example.com at 555-123-4567 or jane@company.org at 888-999-0000';
        const redacted = service.redact(text);
        expect(redacted).toBe('Reach out to [REDACTED_EMAIL] at [REDACTED_PHONE] or [REDACTED_EMAIL] at [REDACTED_PHONE]');
      });

      it('should redact PII in multiline text', () => {
        const text = `Contact Information:
Email: support@example.com
Phone: (555) 123-4567
Alternative: admin@company.org`;
        const redacted = service.redact(text);
        expect(redacted).toContain('[REDACTED_EMAIL]');
        expect(redacted).toContain('[REDACTED_PHONE]');
        expect(redacted).not.toContain('support@example.com');
        expect(redacted).not.toContain('admin@company.org');
        expect(redacted).not.toContain('(555) 123-4567');
      });
    });

    describe('edge cases', () => {
      it('should handle text with no PII', () => {
        const text = 'This is a safe message.';
        const redacted = service.redact(text);
        expect(redacted).toBe(text);
      });

      it('should handle empty string', () => {
        const text = '';
        const redacted = service.redact(text);
        expect(redacted).toBe('');
      });

      it('should handle null input', () => {
        const redacted = service.redact(null as any);
        expect(redacted).toBe('');
      });

      it('should handle undefined input', () => {
        const redacted = service.redact(undefined as any);
        expect(redacted).toBe('');
      });

      it('should handle text with only whitespace', () => {
        const text = '   \n\t  ';
        const redacted = service.redact(text);
        expect(redacted).toBe(text);
      });

      it('should preserve non-PII special characters', () => {
        const text = 'Special chars: !@#$%^&*() without PII';
        const redacted = service.redact(text);
        expect(redacted).toBe(text);
      });

      it('should handle text with PII-like patterns that are not valid', () => {
        const text = 'Not an email: test@, incomplete phone: 555';
        const redacted = service.redact(text);
        expect(redacted).toBe(text);
      });
    });

    describe('PII preservation of structure', () => {
      it('should preserve surrounding punctuation', () => {
        const text = 'Email: "test@example.com", Phone: [555-555-5555]';
        const redacted = service.redact(text);
        expect(redacted).toBe('Email: "[REDACTED_EMAIL]", Phone: [[REDACTED_PHONE]]');
      });

      it('should preserve line breaks and formatting', () => {
        const text = 'Line 1: test@example.com\nLine 2: 555-555-5555\nLine 3: safe text';
        const redacted = service.redact(text);
        expect(redacted).toContain('Line 1: [REDACTED_EMAIL]');
        expect(redacted).toContain('Line 2: [REDACTED_PHONE]');
        expect(redacted).toContain('Line 3: safe text');
      });

      it('should handle PII at start of text', () => {
        const text = 'test@example.com is my email';
        const redacted = service.redact(text);
        expect(redacted).toBe('[REDACTED_EMAIL] is my email');
      });

      it('should handle PII at end of text', () => {
        const text = 'My email is test@example.com';
        const redacted = service.redact(text);
        expect(redacted).toBe('My email is [REDACTED_EMAIL]');
      });
    });
  });
});
