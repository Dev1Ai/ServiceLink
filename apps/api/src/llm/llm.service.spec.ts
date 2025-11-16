import { Test, TestingModule } from '@nestjs/testing';
import { LlmService } from './llm.service';
import { ConfigService } from '@nestjs/config';
import { PiiService } from '../pii/pii.service';

describe('LlmService', () => {
  let service: LlmService;
  let piiService: PiiService;

  const piiServiceMock = {
    redact: jest.fn(text => text),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmService,
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: PiiService, useValue: piiServiceMock },
      ],
    }).compile();

    service = module.get<LlmService>(LlmService);
    piiService = module.get<PiiService>(PiiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('structureText', () => {
    it('should redact text before sending to OpenAI', async () => {
      const text = 'My email is test@example.com';
      service['openai'] = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{ message: { content: '{}' } }],
            }),
          },
        },
      };

      await service.structureText(text, {});
      expect(piiService.redact).toHaveBeenCalledWith(text);
    });
  });

  describe('generateQuote', () => {
    it('should redact title and description before sending to OpenAI', async () => {
      const title = 'Job Title';
      const description = 'My phone is 555-555-5555';
      service['openai'] = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{ message: { content: '{"total":0,"lineItems":[]}' } }],
            }),
          },
        },
      };

      await service.generateQuote(title, description);
      expect(piiService.redact).toHaveBeenCalledWith(title);
      expect(piiService.redact).toHaveBeenCalledWith(description);
    });
  });

  describe('transcribeAudio', () => {
    it('should redact the transcribed text', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'audio',
        originalname: 'audio.mp3',
        encoding: '7bit',
        mimetype: 'audio/mpeg',
        size: 12345,
        buffer: Buffer.from('mock audio data'),
        stream: jest.fn() as any,
        destination: '',
        filename: '',
        path: '',
      };
      const transcribedText = 'My email is test@example.com';
      service['openai'] = {
        audio: {
          transcriptions: {
            create: jest.fn().mockResolvedValue({ text: transcribedText }),
          },
        },
      };

      await service.transcribeAudio(mockFile);
      expect(piiService.redact).toHaveBeenCalledWith(transcribedText);
    });
  });
});
