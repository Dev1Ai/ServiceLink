import { CreateQuoteDto } from '../jobs/dto/job.dto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import { PiiService } from '../pii/pii.service';

// Using dynamic import for OpenAI since it's an ES module
let OpenAI: any;

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private openai: any;

  constructor(
    private readonly config: ConfigService,
    private readonly pii: PiiService,
  ) {
    this.initializeOpenAI();
  }

  private async initializeOpenAI() {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      try {
        if (!OpenAI) {
          OpenAI = (await import('openai')).default;
        }
        this.openai = new OpenAI({ apiKey });
        this.logger.log('OpenAI client initialized successfully.');
      } catch (error) {
        this.logger.error('Failed to initialize OpenAI client.', error);
      }
    } else {
      this.logger.warn('OPENAI_API_KEY not found. LLMService will not be available.');
    }
  }

  /**
   * Transcribes an audio file using the OpenAI Whisper API.
   * @param file The audio file to transcribe.
   * @returns The transcribed text.
   */
  async transcribeAudio(file: Express.Multer.File): Promise<string> {
    if (!this.openai) {
      this.logger.warn('OpenAI client not available. Cannot transcribe audio.');
      return '';
    }

    try {
      const transcription = await this.openai.audio.transcriptions.create({
        file: {
          name: file.originalname,
          data: file.buffer,
        },
        model: 'whisper-1',
      });

      return this.pii.redact(transcription.text);
    } catch (error) {
      this.logger.error('Error transcribing audio with OpenAI', error);
      throw new Error('Failed to transcribe audio.');
    }
  }

  /**
   * Takes raw text and structures it into a JSON object based on a specified schema.
   * @param text The raw input text (e.g., from STT).
   * @param schema The Zod schema or a JSON schema object describing the desired output.
   * @returns A structured JSON object.
   */
  async structureText(text: string, schema: any): Promise<any> {
    if (!this.openai) {
      this.logger.warn('OpenAI client not available. Cannot structure text.');
      return null;
    }

    const redactedText = this.pii.redact(text);

    const prompt = `
      Please analyze the following text and extract the information into a structured JSON object.
      The JSON object must conform to the following schema:
      ${JSON.stringify(schema, null, 2)}

      Input text:
      "${redactedText}"

      Return only the JSON object.
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });

      const result = response.choices[0].message.content;
      return JSON.parse(result);
    } catch (error) {
      this.logger.error('Error structuring text with OpenAI', error);
      throw new Error('Failed to structure text.');
    }
  }

  async generateQuote(title: string, description: string): Promise<CreateQuoteDto | null> {
    if (!this.openai) {
      this.logger.warn('OpenAI client not available. Cannot generate quote.');
      return null;
    }

    const redactedTitle = this.pii.redact(title);
    const redactedDescription = this.pii.redact(description);

    const schema = {
      type: 'object',
      properties: {
        lineItems: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              quantity: { type: 'number' },
              price: { type: 'number' },
            },
            required: ['name', 'quantity', 'price'],
          },
        },
        total: { type: 'number' },
      },
      required: ['lineItems', 'total'],
    };

    const prompt = `
      Based on the following job details, create a draft quote with line items and a total.
      The JSON object must conform to the following schema:
      ${JSON.stringify(schema, null, 2)}

      Job Title: "${redactedTitle}"
      Job Description: "${redactedDescription}"

      Return only the JSON object.
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });

      const result = response.choices[0].message.content;
      return JSON.parse(result) as CreateQuoteDto;
    } catch (error) {
      this.logger.error('Error generating quote with OpenAI', error);
      throw new Error('Failed to generate quote.');
    }
  }
}
