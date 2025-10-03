import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import * as fs from 'fs';

@Injectable()
export class SttService {
  private readonly logger = new Logger(SttService.name);
  private openai: OpenAI | null = null;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (apiKey && !apiKey.includes('your-') && apiKey.length > 10) {
      this.openai = new OpenAI({ apiKey });
      this.logger.log('Speech-to-text (Whisper) initialized');
    } else {
      this.logger.warn('OpenAI API key not configured - STT disabled');
    }
  }

  /**
   * Transcribe audio file to text using OpenAI Whisper
   * @param audioPath Path to audio file (supports mp3, mp4, mpeg, mpga, m4a, wav, webm)
   * @param language Optional language code (e.g., 'en', 'es') for better accuracy
   * @returns Transcribed text
   */
  async transcribeAudio(audioPath: string, language?: string): Promise<string | null> {
    if (!this.openai) {
      this.logger.warn('Whisper not configured');
      return null;
    }

    try {
      if (!fs.existsSync(audioPath)) {
        throw new Error(`Audio file not found: ${audioPath}`);
      }

      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: 'whisper-1',
        language: language,
        response_format: 'text',
      });

      this.logger.log(`Transcribed audio: ${audioPath.substring(audioPath.lastIndexOf('/') + 1)}`);
      return transcription as unknown as string;
    } catch (error: any) {
      this.logger.error(`Error transcribing audio: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Transcribe audio with detailed metadata (timestamps, confidence, etc.)
   * @param audioPath Path to audio file
   * @param language Optional language code
   * @returns Transcription with verbose metadata
   */
  async transcribeAudioVerbose(
    audioPath: string,
    language?: string,
  ): Promise<{
    text: string;
    duration: number;
    language: string;
    segments?: Array<{
      start: number;
      end: number;
      text: string;
    }>;
  } | null> {
    if (!this.openai) {
      this.logger.warn('Whisper not configured');
      return null;
    }

    try {
      if (!fs.existsSync(audioPath)) {
        throw new Error(`Audio file not found: ${audioPath}`);
      }

      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: 'whisper-1',
        language: language,
        response_format: 'verbose_json',
      });

      return {
        text: transcription.text,
        duration: transcription.duration || 0,
        language: transcription.language || language || 'unknown',
        segments: (transcription as any).segments?.map((seg: any) => ({
          start: seg.start,
          end: seg.end,
          text: seg.text,
        })),
      };
    } catch (error: any) {
      this.logger.error(`Error transcribing audio (verbose): ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Translate audio to English using Whisper
   * @param audioPath Path to audio file
   * @returns English translation of audio
   */
  async translateAudio(audioPath: string): Promise<string | null> {
    if (!this.openai) {
      this.logger.warn('Whisper not configured');
      return null;
    }

    try {
      if (!fs.existsSync(audioPath)) {
        throw new Error(`Audio file not found: ${audioPath}`);
      }

      const translation = await this.openai.audio.translations.create({
        file: fs.createReadStream(audioPath),
        model: 'whisper-1',
        response_format: 'text',
      });

      this.logger.log(`Translated audio: ${audioPath.substring(audioPath.lastIndexOf('/') + 1)}`);
      return translation as unknown as string;
    } catch (error: any) {
      this.logger.error(`Error translating audio: ${error.message}`, error.stack);
      return null;
    }
  }
}
