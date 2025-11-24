import { Test, TestingModule } from '@nestjs/testing';
import { LlmService } from './llm.service';
import { ConfigService } from '@nestjs/config';

describe('LlmService', () => {
  let service: LlmService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeAll(() => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'OPENAI_API_KEY') return 'test-key-placeholder';
      return undefined;
    });
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<LlmService>(LlmService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('OpenAI initialization', () => {
    it('should initialize OpenAI client with valid API key', () => {
      mockConfigService.get.mockReturnValue('sk-validapikey123456789012345678901234567890');
      const newService = new LlmService(configService);
      expect(newService).toBeDefined();
      expect((newService as any).openai).toBeTruthy();
    });

    it('should not initialize OpenAI with placeholder key', () => {
      mockConfigService.get.mockReturnValue('your-api-key-here');
      const newService = new LlmService(configService);
      expect((newService as any).openai).toBeNull();
    });

    it('should not initialize OpenAI with short key', () => {
      mockConfigService.get.mockReturnValue('short');
      const newService = new LlmService(configService);
      expect((newService as any).openai).toBeNull();
    });

    it('should not initialize OpenAI with null key', () => {
      mockConfigService.get.mockReturnValue(null);
      const newService = new LlmService(configService);
      expect((newService as any).openai).toBeNull();
    });

    it('should not initialize OpenAI with undefined key', () => {
      mockConfigService.get.mockReturnValue(undefined);
      const newService = new LlmService(configService);
      expect((newService as any).openai).toBeNull();
    });

    it('should not initialize OpenAI with empty string key', () => {
      mockConfigService.get.mockReturnValue('');
      const newService = new LlmService(configService);
      expect((newService as any).openai).toBeNull();
    });
  });

  describe('redactPII', () => {
    it('should redact phone numbers', () => {
      const input = 'Call me at 555-123-4567 or 5551234567';
      const redacted = (service as any).redactPII(input);
      expect(redacted).toContain('[PHONE]');
      expect(redacted).not.toContain('555-123-4567');
    });

    it('should redact email addresses', () => {
      const input = 'Contact me at john.doe@example.com';
      const redacted = (service as any).redactPII(input);
      expect(redacted).toContain('[EMAIL]');
      expect(redacted).not.toContain('john.doe@example.com');
    });

    it('should redact street addresses', () => {
      const input = 'I live at 123 Main Street';
      const redacted = (service as any).redactPII(input);
      expect(redacted).toContain('[ADDRESS]');
      expect(redacted).not.toContain('123 Main Street');
    });

    it('should redact SSN', () => {
      const input = 'My SSN is 123-45-6789';
      const redacted = (service as any).redactPII(input);
      expect(redacted).toContain('[SSN]');
      expect(redacted).not.toContain('123-45-6789');
    });

    it('should handle multiple PII types', () => {
      const input = 'Email: test@example.com, Phone: 555-123-4567, Address: 456 Oak Ave, SSN: 987-65-4321';
      const redacted = (service as any).redactPII(input);
      expect(redacted).toContain('[EMAIL]');
      expect(redacted).toContain('[PHONE]');
      expect(redacted).toContain('[ADDRESS]');
      expect(redacted).toContain('[SSN]');
    });

    it('should redact phone numbers with dots', () => {
      const input = 'Call 555.123.4567 for info';
      const redacted = (service as any).redactPII(input);
      expect(redacted).toContain('[PHONE]');
      expect(redacted).not.toContain('555.123.4567');
    });

    it('should redact phone numbers with spaces', () => {
      const input = 'Phone: 555 123 4567';
      const redacted = (service as any).redactPII(input);
      expect(redacted).toContain('[PHONE]');
      expect(redacted).not.toContain('555 123 4567');
    });

    it('should redact email addresses with plus signs', () => {
      const input = 'Email: user+tag@example.com';
      const redacted = (service as any).redactPII(input);
      expect(redacted).toContain('[EMAIL]');
      expect(redacted).not.toContain('user+tag@example.com');
    });

    it('should redact email addresses with subdomains', () => {
      const input = 'Contact: support@mail.example.co.uk';
      const redacted = (service as any).redactPII(input);
      expect(redacted).toContain('[EMAIL]');
      expect(redacted).not.toContain('support@mail.example.co.uk');
    });

    it('should redact various street address formats', () => {
      const tests = [
        { input: '123 Main St', expected: '[ADDRESS]' },
        { input: '456 Oak Avenue', expected: '[ADDRESS]' },
        { input: '789 Park Road', expected: '[ADDRESS]' },
        { input: '321 Elm Blvd', expected: '[ADDRESS]' },
        { input: '654 Pine Lane', expected: '[ADDRESS]' },
        { input: '987 Maple Dr', expected: '[ADDRESS]' },
        { input: '147 Cedar Court', expected: '[ADDRESS]' },
        { input: '258 Birch Circle', expected: '[ADDRESS]' },
        { input: '369 Willow Way', expected: '[ADDRESS]' },
      ];

      tests.forEach(({ input, expected }) => {
        const redacted = (service as any).redactPII(input);
        expect(redacted).toContain(expected);
      });
    });

    it('should handle text with no PII', () => {
      const input = 'This is a safe message with no personal information.';
      const redacted = (service as any).redactPII(input);
      expect(redacted).toBe(input);
    });

    it('should handle empty string', () => {
      const input = '';
      const redacted = (service as any).redactPII(input);
      expect(redacted).toBe('');
    });

    it('should preserve non-PII numbers', () => {
      const input = 'The job costs $500 and takes 3 hours';
      const redacted = (service as any).redactPII(input);
      expect(redacted).toBe(input);
    });

    it('should redact multiple instances of same PII type', () => {
      const input = 'Email1: user1@example.com, Email2: user2@example.com, Email3: user3@example.com';
      const redacted = (service as any).redactPII(input);
      const matches = redacted.match(/\[EMAIL\]/g);
      expect(matches).toHaveLength(3);
    });
  });

  describe('parseQuoteResponse', () => {
    it('should parse line items from response', () => {
      const response = `Line Items:
1. Labor - $500
2. Materials - $200
3. Cleanup - $50

Scope: Complete installation

Exclusions:
- Permits not included
- Weekend work extra`;

      const parsed = (service as any).parseQuoteResponse(response);
      expect(parsed.lineItems.length).toBeGreaterThan(0);
      expect(parsed.scope).toBeTruthy();
      expect(parsed.exclusions.length).toBeGreaterThan(0);
    });

    it('should handle simple responses without structure', () => {
      const response = 'Simple quote text';
      const parsed = (service as any).parseQuoteResponse(response);
      expect(parsed.lineItems.length).toBe(1);
      expect(parsed.lineItems[0].description).toBe(response);
    });

    it('should parse line items with various bullet formats', () => {
      const response = `Line Items:
- Item one - $100
• Item two - $200
* Item three - $300`;

      const parsed = (service as any).parseQuoteResponse(response);
      expect(parsed.lineItems.length).toBe(3);
      expect(parsed.lineItems[0].title).toContain('Item one');
      expect(parsed.lineItems[0].estimatedCost).toBe('100');
    });

    it('should parse line items without costs', () => {
      const response = `Line Items:
1. Labor
2. Materials
3. Cleanup`;

      const parsed = (service as any).parseQuoteResponse(response);
      expect(parsed.lineItems.length).toBe(3);
      expect(parsed.lineItems[0].title).toContain('Labor');
      expect(parsed.lineItems[0].estimatedCost).toBeUndefined();
    });

    it('should parse costs with comma formatting', () => {
      const response = `Line Items:
1. Major renovation - $1,500
2. Premium materials - $2,000.00`;

      const parsed = (service as any).parseQuoteResponse(response);
      expect(parsed.lineItems.length).toBe(2);
      expect(parsed.lineItems[0].estimatedCost).toBe('1,500');
      expect(parsed.lineItems[1].estimatedCost).toBe('2,000.00');
    });

    it('should parse TBD costs', () => {
      const response = `Line Items:
1. Inspection - TBD
2. Repair work - TBD`;

      const parsed = (service as any).parseQuoteResponse(response);
      expect(parsed.lineItems.length).toBe(2);
      expect(parsed.lineItems[0].estimatedCost).toBe('TBD');
      expect(parsed.lineItems[1].estimatedCost).toBe('TBD');
    });

    it('should handle fallback when no line items match', () => {
      const response = `This is just a plain text response without structured formatting`;

      const parsed = (service as any).parseQuoteResponse(response);
      expect(parsed.lineItems.length).toBe(1);
      expect(parsed.lineItems[0].description).toBe(response);
      expect(parsed.scope).toBe(response);
    });

    it('should handle cost breakdown section name', () => {
      const response = `Cost Breakdown:
1. Item - $100

Scope: Work description

Assumptions:
- Standard hours
- Materials provided`;

      const parsed = (service as any).parseQuoteResponse(response);
      expect(parsed.lineItems.length).toBe(1);
      expect(parsed.scope).toContain('Work description');
      expect(parsed.exclusions.length).toBe(2);
    });

    it('should parse exclusions with various prefixes', () => {
      const response = `Exclusions:
- Item one
• Item two
* Item three
1. Item four`;

      const parsed = (service as any).parseQuoteResponse(response);
      expect(parsed.exclusions.length).toBe(4);
      expect(parsed.exclusions[0]).toContain('Item one');
    });

    it('should handle empty response', () => {
      const response = '';
      const parsed = (service as any).parseQuoteResponse(response);
      expect(parsed.lineItems.length).toBe(1);
      expect(parsed.scope).toBe('');
      expect(parsed.exclusions.length).toBe(0);
    });

    it('should accumulate scope text across multiple lines', () => {
      const response = `Scope:
This is line one.
This is line two.
This is line three.

Exclusions:
- Not included`;

      const parsed = (service as any).parseQuoteResponse(response);
      expect(parsed.scope).toContain('line one');
      expect(parsed.scope).toContain('line two');
      expect(parsed.scope).toContain('line three');
    });

    it('should handle response with only line items', () => {
      const response = `Line Items:
1. Service A - $100
2. Service B - $200`;

      const parsed = (service as any).parseQuoteResponse(response);
      expect(parsed.lineItems.length).toBe(2);
      expect(parsed.scope).toBeTruthy();
      expect(parsed.exclusions.length).toBe(0);
    });
  });

  describe('structureJobIntake', () => {
    it('should return null when OpenAI not configured', async () => {
      mockConfigService.get.mockReturnValue('your-api-key-here');
      const newService = new LlmService(configService);
      const result = await newService.structureJobIntake('test input');
      expect(result).toBeNull();
    });
  });

  describe('draftQuoteSuggestions', () => {
    it('should return null when OpenAI not configured', async () => {
      mockConfigService.get.mockReturnValue('your-api-key-here');
      const newService = new LlmService(configService);
      const result = await newService.draftQuoteSuggestions('test job');
      expect(result).toBeNull();
    });
  });
});
