import { Test, TestingModule } from '@nestjs/testing';
import { LlmController } from './llm.controller';
import { LlmService } from './llm.service';
import { SttService } from './stt.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';

jest.mock('fs');

describe('LlmController', () => {
  let controller: LlmController;
  let llmService: LlmService;
  let sttService: SttService;

  const mockLlmService = {
    structureJobIntake: jest.fn(),
    draftQuoteSuggestions: jest.fn(),
  };

  const mockSttService = {
    transcribeAudio: jest.fn(),
    transcribeAudioVerbose: jest.fn(),
    translateAudio: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LlmController],
      providers: [
        { provide: LlmService, useValue: mockLlmService },
        { provide: SttService, useValue: mockSttService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<LlmController>(LlmController);
    llmService = module.get<LlmService>(LlmService);
    sttService = module.get<SttService>(SttService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('structureJobIntake', () => {
    it('should structure job intake text', async () => {
      const input = 'I need a plumber to fix my sink';
      const expectedResult = { category: 'Plumbing', description: 'Sink repair' };
      mockLlmService.structureJobIntake.mockResolvedValue(expectedResult);

      const result = await controller.structureJobIntake({ input });

      expect(result).toEqual(expectedResult);
      expect(llmService.structureJobIntake).toHaveBeenCalledWith(input);
    });

    it('should throw BadRequestException if input is empty', async () => {
      await expect(controller.structureJobIntake({ input: '' })).rejects.toThrow(BadRequestException);
      await expect(controller.structureJobIntake({ input: '' })).rejects.toThrow(
        'Input text is required',
      );
    });

    it('should throw BadRequestException if input is whitespace only', async () => {
      await expect(controller.structureJobIntake({ input: '   ' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if AI service returns null', async () => {
      mockLlmService.structureJobIntake.mockResolvedValue(null);

      await expect(controller.structureJobIntake({ input: 'test' })).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.structureJobIntake({ input: 'test' })).rejects.toThrow(
        'AI service not configured or failed to process input',
      );
    });

    it('should handle long job descriptions', async () => {
      const longInput = 'I need a plumber to fix my sink. '.repeat(100);
      const expectedResult = { category: 'Plumbing', description: 'Complex sink repair' };
      mockLlmService.structureJobIntake.mockResolvedValue(expectedResult);

      const result = await controller.structureJobIntake({ input: longInput });

      expect(result).toEqual(expectedResult);
      expect(llmService.structureJobIntake).toHaveBeenCalledWith(longInput);
    });

    it('should trim input before validation', async () => {
      const input = '  Need plumber  ';
      const expectedResult = { category: 'Plumbing' };
      mockLlmService.structureJobIntake.mockResolvedValue(expectedResult);

      const result = await controller.structureJobIntake({ input });

      expect(result).toEqual(expectedResult);
      expect(llmService.structureJobIntake).toHaveBeenCalledWith(input);
    });

    it('should call service exactly once', async () => {
      mockLlmService.structureJobIntake.mockResolvedValue({ category: 'Test' });

      await controller.structureJobIntake({ input: 'test' });

      expect(llmService.structureJobIntake).toHaveBeenCalledTimes(1);
    });
  });

  describe('draftQuote', () => {
    it('should draft quote suggestions', async () => {
      const jobDescription = 'Fix leaking sink';
      const expectedResult = {
        suggestedPrice: 150,
        priceRange: { min: 100, max: 200 },
        estimatedDuration: '2-3 hours',
      };
      mockLlmService.draftQuoteSuggestions.mockResolvedValue(expectedResult);

      const result = await controller.draftQuote({ jobDescription });

      expect(result).toEqual(expectedResult);
      expect(llmService.draftQuoteSuggestions).toHaveBeenCalledWith(jobDescription, undefined);
    });

    it('should draft quote with category', async () => {
      const jobDescription = 'Fix leaking sink';
      const category = 'Plumbing';
      const expectedResult = { suggestedPrice: 150 };
      mockLlmService.draftQuoteSuggestions.mockResolvedValue(expectedResult);

      const result = await controller.draftQuote({ jobDescription, category });

      expect(result).toEqual(expectedResult);
      expect(llmService.draftQuoteSuggestions).toHaveBeenCalledWith(jobDescription, category);
    });

    it('should throw BadRequestException if jobDescription is empty', async () => {
      await expect(controller.draftQuote({ jobDescription: '' })).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.draftQuote({ jobDescription: '' })).rejects.toThrow(
        'Job description is required',
      );
    });

    it('should throw BadRequestException if jobDescription is whitespace', async () => {
      await expect(controller.draftQuote({ jobDescription: '   ' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if AI service returns null', async () => {
      mockLlmService.draftQuoteSuggestions.mockResolvedValue(null);

      await expect(controller.draftQuote({ jobDescription: 'test' })).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.draftQuote({ jobDescription: 'test' })).rejects.toThrow(
        'AI service not configured or failed to generate quote',
      );
    });

    it('should handle optional category parameter', async () => {
      mockLlmService.draftQuoteSuggestions.mockResolvedValue({ price: 100 });

      await controller.draftQuote({ jobDescription: 'test' });

      expect(llmService.draftQuoteSuggestions).toHaveBeenCalledWith('test', undefined);
    });

    it('should pass category to service when provided', async () => {
      mockLlmService.draftQuoteSuggestions.mockResolvedValue({ price: 100 });

      await controller.draftQuote({ jobDescription: 'test', category: 'Electrical' });

      expect(llmService.draftQuoteSuggestions).toHaveBeenCalledWith('test', 'Electrical');
    });

    it('should call service exactly once', async () => {
      mockLlmService.draftQuoteSuggestions.mockResolvedValue({ price: 100 });

      await controller.draftQuote({ jobDescription: 'test' });

      expect(llmService.draftQuoteSuggestions).toHaveBeenCalledTimes(1);
    });
  });

  describe('transcribeAudio', () => {
    const mockFile = {
      path: '/uploads/audio/test.mp3',
      originalname: 'test.mp3',
      mimetype: 'audio/mpeg',
    } as Express.Multer.File;

    beforeEach(() => {
      (fs.unlinkSync as jest.Mock).mockImplementation(() => {});
      (fs.existsSync as jest.Mock).mockReturnValue(true);
    });

    it('should transcribe audio file', async () => {
      const expectedText = 'This is transcribed text';
      mockSttService.transcribeAudio.mockResolvedValue(expectedText);

      const result = await controller.transcribeAudio(mockFile, {});

      expect(result).toEqual({ text: expectedText });
      expect(sttService.transcribeAudio).toHaveBeenCalledWith(mockFile.path, undefined);
      expect(fs.unlinkSync).toHaveBeenCalledWith(mockFile.path);
    });

    it('should transcribe audio with language parameter', async () => {
      const expectedText = 'Transcribed in Spanish';
      mockSttService.transcribeAudio.mockResolvedValue(expectedText);

      const result = await controller.transcribeAudio(mockFile, { language: 'es' });

      expect(result).toEqual({ text: expectedText });
      expect(sttService.transcribeAudio).toHaveBeenCalledWith(mockFile.path, 'es');
    });

    it('should return verbose transcription when verbose is true', async () => {
      const verboseResult = {
        text: 'Test transcription',
        segments: [{ start: 0, end: 1, text: 'Test' }],
        language: 'en',
      };
      mockSttService.transcribeAudioVerbose.mockResolvedValue(verboseResult);

      const result = await controller.transcribeAudio(mockFile, { verbose: true });

      expect(result).toEqual(verboseResult);
      expect(sttService.transcribeAudioVerbose).toHaveBeenCalledWith(mockFile.path, undefined);
    });

    it('should return verbose transcription when verbose is "true" string', async () => {
      const verboseResult = { text: 'Test', segments: [] };
      mockSttService.transcribeAudioVerbose.mockResolvedValue(verboseResult);

      const result = await controller.transcribeAudio(mockFile, { verbose: 'true' as any });

      expect(result).toEqual(verboseResult);
      expect(sttService.transcribeAudioVerbose).toHaveBeenCalledWith(mockFile.path, undefined);
    });

    it('should pass language to verbose transcription', async () => {
      const verboseResult = { text: 'Test', language: 'fr' };
      mockSttService.transcribeAudioVerbose.mockResolvedValue(verboseResult);

      await controller.transcribeAudio(mockFile, { language: 'fr', verbose: true });

      expect(sttService.transcribeAudioVerbose).toHaveBeenCalledWith(mockFile.path, 'fr');
    });

    it('should throw BadRequestException if no file provided', async () => {
      await expect(controller.transcribeAudio(null as any, {})).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.transcribeAudio(null as any, {})).rejects.toThrow(
        'Audio file is required',
      );
    });

    it('should throw BadRequestException if transcription returns null in verbose mode', async () => {
      mockSttService.transcribeAudioVerbose.mockResolvedValue(null);

      await expect(controller.transcribeAudio(mockFile, { verbose: true })).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.transcribeAudio(mockFile, { verbose: true })).rejects.toThrow(
        'Transcription failed - AI service not configured',
      );
    });

    it('should clean up file after successful transcription', async () => {
      mockSttService.transcribeAudio.mockResolvedValue('Test');

      await controller.transcribeAudio(mockFile, {});

      expect(fs.unlinkSync).toHaveBeenCalledWith(mockFile.path);
    });

    it('should clean up file on error', async () => {
      mockSttService.transcribeAudio.mockRejectedValue(new Error('Service error'));

      await expect(controller.transcribeAudio(mockFile, {})).rejects.toThrow('Service error');
      expect(fs.unlinkSync).toHaveBeenCalledWith(mockFile.path);
    });

    it('should check file exists before cleanup on error', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      mockSttService.transcribeAudio.mockRejectedValue(new Error('Service error'));

      await expect(controller.transcribeAudio(mockFile, {})).rejects.toThrow();
      expect(fs.existsSync).toHaveBeenCalledWith(mockFile.path);
    });

    it('should handle verbose false explicitly', async () => {
      mockSttService.transcribeAudio.mockResolvedValue('Test');

      await controller.transcribeAudio(mockFile, { verbose: false });

      expect(sttService.transcribeAudio).toHaveBeenCalled();
      expect(sttService.transcribeAudioVerbose).not.toHaveBeenCalled();
    });

    it('should default to non-verbose mode', async () => {
      mockSttService.transcribeAudio.mockResolvedValue('Test');

      await controller.transcribeAudio(mockFile, {});

      expect(sttService.transcribeAudio).toHaveBeenCalled();
      expect(sttService.transcribeAudioVerbose).not.toHaveBeenCalled();
    });
  });

  describe('translateAudio', () => {
    const mockFile = {
      path: '/uploads/audio/spanish.mp3',
      originalname: 'spanish.mp3',
      mimetype: 'audio/mpeg',
    } as Express.Multer.File;

    beforeEach(() => {
      (fs.unlinkSync as jest.Mock).mockImplementation(() => {});
      (fs.existsSync as jest.Mock).mockReturnValue(true);
    });

    it('should translate audio to English', async () => {
      const expectedText = 'Translated to English';
      mockSttService.translateAudio.mockResolvedValue(expectedText);

      const result = await controller.translateAudio(mockFile);

      expect(result).toEqual({ text: expectedText });
      expect(sttService.translateAudio).toHaveBeenCalledWith(mockFile.path);
      expect(fs.unlinkSync).toHaveBeenCalledWith(mockFile.path);
    });

    it('should throw BadRequestException if no file provided', async () => {
      await expect(controller.translateAudio(null as any)).rejects.toThrow(BadRequestException);
      await expect(controller.translateAudio(null as any)).rejects.toThrow(
        'Audio file is required',
      );
    });

    it('should throw BadRequestException if translation fails', async () => {
      mockSttService.translateAudio.mockResolvedValue(null);

      await expect(controller.translateAudio(mockFile)).rejects.toThrow(BadRequestException);
      await expect(controller.translateAudio(mockFile)).rejects.toThrow(
        'Translation failed - AI service not configured',
      );
    });

    it('should clean up file after successful translation', async () => {
      mockSttService.translateAudio.mockResolvedValue('Translated text');

      await controller.translateAudio(mockFile);

      expect(fs.unlinkSync).toHaveBeenCalledWith(mockFile.path);
    });

    it('should clean up file on error', async () => {
      mockSttService.translateAudio.mockRejectedValue(new Error('Translation error'));

      await expect(controller.translateAudio(mockFile)).rejects.toThrow('Translation error');
      expect(fs.unlinkSync).toHaveBeenCalledWith(mockFile.path);
    });

    it('should check file exists before cleanup on error', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      mockSttService.translateAudio.mockRejectedValue(new Error('Error'));

      await expect(controller.translateAudio(mockFile)).rejects.toThrow();
      expect(fs.existsSync).toHaveBeenCalledWith(mockFile.path);
    });

    it('should not cleanup non-existent file on error', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      mockSttService.translateAudio.mockRejectedValue(new Error('Error'));

      await expect(controller.translateAudio(mockFile)).rejects.toThrow();
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it('should call translate service exactly once', async () => {
      mockSttService.translateAudio.mockResolvedValue('Test');

      await controller.translateAudio(mockFile);

      expect(sttService.translateAudio).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error handling', () => {
    it('should preserve error messages from LLM service', async () => {
      mockLlmService.structureJobIntake.mockRejectedValue(new Error('LLM API error'));

      await expect(controller.structureJobIntake({ input: 'test' })).rejects.toThrow('LLM API error');
    });

    it('should preserve error messages from STT service', async () => {
      const mockFile = { path: '/test.mp3' } as Express.Multer.File;
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      mockSttService.transcribeAudio.mockRejectedValue(new Error('STT API error'));

      await expect(controller.transcribeAudio(mockFile, {})).rejects.toThrow('STT API error');
    });
  });

  describe('Integration', () => {
    it('should handle multiple transcription requests', async () => {
      const file1 = { path: '/file1.mp3' } as Express.Multer.File;
      const file2 = { path: '/file2.mp3' } as Express.Multer.File;
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      mockSttService.transcribeAudio.mockResolvedValue('Text 1');

      await controller.transcribeAudio(file1, {});

      mockSttService.transcribeAudio.mockResolvedValue('Text 2');
      await controller.transcribeAudio(file2, {});

      expect(sttService.transcribeAudio).toHaveBeenCalledTimes(2);
      expect(fs.unlinkSync).toHaveBeenCalledWith('/file1.mp3');
      expect(fs.unlinkSync).toHaveBeenCalledWith('/file2.mp3');
    });

    it('should handle mixed job intake and quote requests', async () => {
      mockLlmService.structureJobIntake.mockResolvedValue({ category: 'Test' });
      mockLlmService.draftQuoteSuggestions.mockResolvedValue({ price: 100 });

      await controller.structureJobIntake({ input: 'test job' });
      await controller.draftQuote({ jobDescription: 'test description' });

      expect(llmService.structureJobIntake).toHaveBeenCalledTimes(1);
      expect(llmService.draftQuoteSuggestions).toHaveBeenCalledTimes(1);
    });
  });
});
