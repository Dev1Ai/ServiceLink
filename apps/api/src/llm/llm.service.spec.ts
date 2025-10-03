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
