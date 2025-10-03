import {
  Controller,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { LlmService } from './llm.service';
import { SttService } from './stt.service';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';

@ApiTags('ai')
@Controller('ai')
export class LlmController {
  constructor(
    private readonly llmService: LlmService,
    private readonly sttService: SttService,
  ) {}

  @Post('job-intake/structure')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Structure a job description using AI' })
  async structureJobIntake(@Body() body: { input: string }) {
    if (!body.input || body.input.trim().length === 0) {
      throw new BadRequestException('Input text is required');
    }

    const result = await this.llmService.structureJobIntake(body.input);

    if (!result) {
      throw new BadRequestException('AI service not configured or failed to process input');
    }

    return result;
  }

  @Post('quote/draft')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate AI-assisted quote suggestions' })
  async draftQuote(@Body() body: { jobDescription: string; category?: string }) {
    if (!body.jobDescription || body.jobDescription.trim().length === 0) {
      throw new BadRequestException('Job description is required');
    }

    const result = await this.llmService.draftQuoteSuggestions(body.jobDescription, body.category);

    if (!result) {
      throw new BadRequestException('AI service not configured or failed to generate quote');
    }

    return result;
  }

  @Post('transcribe')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('audio', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = path.join(process.cwd(), 'uploads', 'audio');
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `audio-${uniqueSuffix}${path.extname(file.originalname)}`);
        },
      }),
      limits: {
        fileSize: 25 * 1024 * 1024, // 25MB limit (Whisper API limit)
      },
      fileFilter: (req, file, cb) => {
        const allowedMimes = [
          'audio/mpeg',
          'audio/mp3',
          'audio/mp4',
          'audio/wav',
          'audio/webm',
          'audio/m4a',
          'audio/x-m4a',
        ];
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Invalid audio format. Supported: mp3, mp4, wav, webm, m4a'), false);
        }
      },
    }),
  )
  @ApiOperation({ summary: 'Transcribe audio to text using Whisper' })
  async transcribeAudio(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { language?: string; verbose?: boolean },
  ) {
    if (!file) {
      throw new BadRequestException('Audio file is required');
    }

    try {
      let result;

      if (body.verbose === true || body.verbose === 'true' as any) {
        result = await this.sttService.transcribeAudioVerbose(file.path, body.language);
      } else {
        const text = await this.sttService.transcribeAudio(file.path, body.language);
        result = { text };
      }

      // Clean up uploaded file after processing
      fs.unlinkSync(file.path);

      if (!result) {
        throw new BadRequestException('Transcription failed - AI service not configured');
      }

      return result;
    } catch (error: any) {
      // Clean up file on error
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw error;
    }
  }

  @Post('translate-audio')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('audio', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = path.join(process.cwd(), 'uploads', 'audio');
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `audio-${uniqueSuffix}${path.extname(file.originalname)}`);
        },
      }),
      limits: {
        fileSize: 25 * 1024 * 1024,
      },
    }),
  )
  @ApiOperation({ summary: 'Translate audio to English using Whisper' })
  async translateAudio(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Audio file is required');
    }

    try {
      const text = await this.sttService.translateAudio(file.path);

      // Clean up uploaded file
      fs.unlinkSync(file.path);

      if (!text) {
        throw new BadRequestException('Translation failed - AI service not configured');
      }

      return { text };
    } catch (error: any) {
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw error;
    }
  }
}
