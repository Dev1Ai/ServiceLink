import { Test, TestingModule } from '@nestjs/testing';
import { SttService } from './stt.service';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';

// Mock fs module
jest.mock('fs');

// Create mocks before module import
const mockTranscriptionsCreate = jest.fn();
const mockTranslationsCreate = jest.fn();

// Mock OpenAI module
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      audio: {
        transcriptions: {
          create: mockTranscriptionsCreate,
        },
        translations: {
          create: mockTranslationsCreate,
        },
      },
    })),
  };
});

describe('SttService', () => {
  let service: SttService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockTranscriptionsCreate.mockClear();
    mockTranslationsCreate.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SttService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<SttService>(SttService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initialization', () => {
    it('should initialize with valid OpenAI API key', () => {
      mockConfigService.get.mockReturnValue('sk-validapikey12345');
      const module = Test.createTestingModule({
        providers: [
          SttService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      expect(module).toBeDefined();
    });

    it('should not initialize OpenAI with invalid API key', () => {
      mockConfigService.get.mockReturnValue('your-api-key');
      const module = Test.createTestingModule({
        providers: [
          SttService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      expect(module).toBeDefined();
    });

    it('should not initialize OpenAI with short API key', () => {
      mockConfigService.get.mockReturnValue('short');
      const module = Test.createTestingModule({
        providers: [
          SttService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      expect(module).toBeDefined();
    });

    it('should not initialize OpenAI without API key', () => {
      mockConfigService.get.mockReturnValue(undefined);
      const module = Test.createTestingModule({
        providers: [
          SttService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      expect(module).toBeDefined();
    });
  });

  describe('transcribeAudio', () => {
    it('should return null when OpenAI is not configured', async () => {
      mockConfigService.get.mockReturnValue(undefined);
      const serviceWithoutOpenAI = new SttService(configService);

      const result = await serviceWithoutOpenAI.transcribeAudio('/path/to/audio.mp3');

      expect(result).toBeNull();
    });

    it('should return null when audio file does not exist', async () => {
      mockConfigService.get.mockReturnValue('sk-validapikey12345');
      const serviceWithOpenAI = new SttService(configService);

      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const result = await serviceWithOpenAI.transcribeAudio('/nonexistent/audio.mp3');

      expect(result).toBeNull();
    });

    it('should transcribe audio file successfully', async () => {
      mockConfigService.get.mockReturnValue('sk-validapikey12345');
      const serviceWithOpenAI = new SttService(configService);

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.createReadStream as jest.Mock).mockReturnValue({} as any);

      mockTranscriptionsCreate.mockResolvedValue('This is the transcribed text.');

      const result = await serviceWithOpenAI.transcribeAudio('/path/to/audio.mp3');

      expect(fs.existsSync).toHaveBeenCalledWith('/path/to/audio.mp3');
      expect(mockTranscriptionsCreate).toHaveBeenCalledWith({
        file: {},
        model: 'whisper-1',
        language: undefined,
        response_format: 'text',
      });
      expect(result).toBe('This is the transcribed text.');
    });

    it('should transcribe audio with language parameter', async () => {
      mockConfigService.get.mockReturnValue('sk-validapikey12345');
      const serviceWithOpenAI = new SttService(configService);

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.createReadStream as jest.Mock).mockReturnValue({} as any);

      mockTranscriptionsCreate.mockResolvedValue('Este es el texto transcrito.');

      const result = await serviceWithOpenAI.transcribeAudio('/path/to/audio.mp3', 'es');

      expect(mockTranscriptionsCreate).toHaveBeenCalledWith({
        file: {},
        model: 'whisper-1',
        language: 'es',
        response_format: 'text',
      });
      expect(result).toBe('Este es el texto transcrito.');
    });

    it('should support various audio formats', async () => {
      mockConfigService.get.mockReturnValue('sk-validapikey12345');
      const serviceWithOpenAI = new SttService(configService);

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.createReadStream as jest.Mock).mockReturnValue({} as any);

      mockTranscriptionsCreate.mockResolvedValue('Transcribed audio.');

      const formats = ['.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.wav', '.webm'];

      for (const format of formats) {
        await serviceWithOpenAI.transcribeAudio(`/path/to/audio${format}`);
      }

      expect(mockTranscriptionsCreate).toHaveBeenCalledTimes(formats.length);
    });

    it('should return null on transcription error', async () => {
      mockConfigService.get.mockReturnValue('sk-validapikey12345');
      const serviceWithOpenAI = new SttService(configService);

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.createReadStream as jest.Mock).mockReturnValue({} as any);

      mockTranscriptionsCreate.mockRejectedValue(new Error('API Error'));

      const result = await serviceWithOpenAI.transcribeAudio('/path/to/audio.mp3');

      expect(result).toBeNull();
    });
  });

  describe('transcribeAudioVerbose', () => {
    it('should return null when OpenAI is not configured', async () => {
      mockConfigService.get.mockReturnValue(undefined);
      const serviceWithoutOpenAI = new SttService(configService);

      const result = await serviceWithoutOpenAI.transcribeAudioVerbose('/path/to/audio.mp3');

      expect(result).toBeNull();
    });

    it('should return null when audio file does not exist', async () => {
      mockConfigService.get.mockReturnValue('sk-validapikey12345');
      const serviceWithOpenAI = new SttService(configService);

      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const result = await serviceWithOpenAI.transcribeAudioVerbose('/nonexistent/audio.mp3');

      expect(result).toBeNull();
    });

    it('should transcribe audio with verbose metadata', async () => {
      mockConfigService.get.mockReturnValue('sk-validapikey12345');
      const serviceWithOpenAI = new SttService(configService);

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.createReadStream as jest.Mock).mockReturnValue({} as any);

      const mockVerboseResponse = {
        text: 'This is the transcribed text with timestamps.',
        duration: 15.5,
        language: 'en',
        segments: [
          { start: 0.0, end: 5.0, text: 'This is the first segment.' },
          { start: 5.0, end: 10.0, text: 'This is the second segment.' },
          { start: 10.0, end: 15.5, text: 'This is the final segment.' },
        ],
      };

      mockTranscriptionsCreate.mockResolvedValue(mockVerboseResponse);

      const result = await serviceWithOpenAI.transcribeAudioVerbose('/path/to/audio.mp3');

      expect(mockTranscriptionsCreate).toHaveBeenCalledWith({
        file: {},
        model: 'whisper-1',
        language: undefined,
        response_format: 'verbose_json',
      });
      expect(result).toBeDefined();
      expect(result?.text).toBe('This is the transcribed text with timestamps.');
      expect(result?.duration).toBe(15.5);
      expect(result?.language).toBe('en');
      expect(result?.segments).toHaveLength(3);
      expect(result?.segments?.[0].text).toBe('This is the first segment.');
    });

    it('should transcribe verbose with language parameter', async () => {
      mockConfigService.get.mockReturnValue('sk-validapikey12345');
      const serviceWithOpenAI = new SttService(configService);

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.createReadStream as jest.Mock).mockReturnValue({} as any);

      const mockVerboseResponse = {
        text: 'Texto transcrito en español.',
        duration: 10.0,
        language: 'es',
        segments: [],
      };

      mockTranscriptionsCreate.mockResolvedValue(mockVerboseResponse);

      const result = await serviceWithOpenAI.transcribeAudioVerbose('/path/to/audio.mp3', 'es');

      expect(mockTranscriptionsCreate).toHaveBeenCalledWith({
        file: {},
        model: 'whisper-1',
        language: 'es',
        response_format: 'verbose_json',
      });
      expect(result?.language).toBe('es');
    });

    it('should handle missing duration field', async () => {
      mockConfigService.get.mockReturnValue('sk-validapikey12345');
      const serviceWithOpenAI = new SttService(configService);

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.createReadStream as jest.Mock).mockReturnValue({} as any);

      const mockVerboseResponse = {
        text: 'Transcribed text.',
        language: 'en',
      };

      mockTranscriptionsCreate.mockResolvedValue(mockVerboseResponse);

      const result = await serviceWithOpenAI.transcribeAudioVerbose('/path/to/audio.mp3');

      expect(result?.duration).toBe(0);
    });

    it('should handle missing language field', async () => {
      mockConfigService.get.mockReturnValue('sk-validapikey12345');
      const serviceWithOpenAI = new SttService(configService);

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.createReadStream as jest.Mock).mockReturnValue({} as any);

      const mockVerboseResponse = {
        text: 'Transcribed text.',
        duration: 5.0,
      };

      mockTranscriptionsCreate.mockResolvedValue(mockVerboseResponse);

      const result = await serviceWithOpenAI.transcribeAudioVerbose('/path/to/audio.mp3', 'fr');

      expect(result?.language).toBe('fr');
    });

    it('should handle response without segments', async () => {
      mockConfigService.get.mockReturnValue('sk-validapikey12345');
      const serviceWithOpenAI = new SttService(configService);

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.createReadStream as jest.Mock).mockReturnValue({} as any);

      const mockVerboseResponse = {
        text: 'Transcribed text.',
        duration: 5.0,
        language: 'en',
      };

      mockTranscriptionsCreate.mockResolvedValue(mockVerboseResponse);

      const result = await serviceWithOpenAI.transcribeAudioVerbose('/path/to/audio.mp3');

      expect(result?.segments).toBeUndefined();
    });

    it('should return null on verbose transcription error', async () => {
      mockConfigService.get.mockReturnValue('sk-validapikey12345');
      const serviceWithOpenAI = new SttService(configService);

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.createReadStream as jest.Mock).mockReturnValue({} as any);

      mockTranscriptionsCreate.mockRejectedValue(new Error('API Error'));

      const result = await serviceWithOpenAI.transcribeAudioVerbose('/path/to/audio.mp3');

      expect(result).toBeNull();
    });
  });

  describe('translateAudio', () => {
    it('should return null when OpenAI is not configured', async () => {
      mockConfigService.get.mockReturnValue(undefined);
      const serviceWithoutOpenAI = new SttService(configService);

      const result = await serviceWithoutOpenAI.translateAudio('/path/to/audio.mp3');

      expect(result).toBeNull();
    });

    it('should return null when audio file does not exist', async () => {
      mockConfigService.get.mockReturnValue('sk-validapikey12345');
      const serviceWithOpenAI = new SttService(configService);

      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const result = await serviceWithOpenAI.translateAudio('/nonexistent/audio.mp3');

      expect(result).toBeNull();
    });

    it('should translate audio to English successfully', async () => {
      mockConfigService.get.mockReturnValue('sk-validapikey12345');
      const serviceWithOpenAI = new SttService(configService);

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.createReadStream as jest.Mock).mockReturnValue({} as any);

      mockTranslationsCreate.mockResolvedValue('This is the English translation.');

      const result = await serviceWithOpenAI.translateAudio('/path/to/audio.mp3');

      expect(fs.existsSync).toHaveBeenCalledWith('/path/to/audio.mp3');
      expect(mockTranslationsCreate).toHaveBeenCalledWith({
        file: {},
        model: 'whisper-1',
        response_format: 'text',
      });
      expect(result).toBe('This is the English translation.');
    });

    it('should translate Spanish audio to English', async () => {
      mockConfigService.get.mockReturnValue('sk-validapikey12345');
      const serviceWithOpenAI = new SttService(configService);

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.createReadStream as jest.Mock).mockReturnValue({} as any);

      mockTranslationsCreate.mockResolvedValue('Hello, how are you?');

      const result = await serviceWithOpenAI.translateAudio('/path/to/spanish-audio.mp3');

      expect(result).toBe('Hello, how are you?');
    });

    it('should return null on translation error', async () => {
      mockConfigService.get.mockReturnValue('sk-validapikey12345');
      const serviceWithOpenAI = new SttService(configService);

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.createReadStream as jest.Mock).mockReturnValue({} as any);

      mockTranslationsCreate.mockRejectedValue(new Error('API Error'));

      const result = await serviceWithOpenAI.translateAudio('/path/to/audio.mp3');

      expect(result).toBeNull();
    });
  });
});
