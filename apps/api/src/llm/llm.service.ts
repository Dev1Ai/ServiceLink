import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { z } from 'zod';

// Schema for structured job intake
const JobIntakeSchema = z.object({
  category: z.string().describe('Service category (e.g., plumbing, electrical, lawn care)'),
  title: z.string().describe('Short job title'),
  description: z.string().describe('Detailed job description'),
  urgency: z.enum(['immediate', 'scheduled', 'flexible']).describe('How soon service is needed'),
  estimatedDuration: z.string().optional().describe('Estimated time (e.g., "2 hours", "half day")'),
  materials: z.array(z.string()).optional().describe('Materials or equipment needed'),
  risks: z.array(z.string()).optional().describe('Safety or complexity concerns flagged'),
  location: z.object({
    type: z.enum(['indoor', 'outdoor', 'both']),
    accessibility: z.string().optional(),
  }).optional(),
});

type JobIntake = z.infer<typeof JobIntakeSchema>;

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private openai: OpenAI | null = null;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (apiKey && !apiKey.includes('your-') && apiKey.length > 10) {
      this.openai = new OpenAI({ apiKey });
      this.logger.log('OpenAI client initialized');
    } else {
      this.logger.warn('OpenAI API key not configured - AI features disabled');
    }
  }

  async structureJobIntake(userInput: string): Promise<JobIntake | null> {
    if (!this.openai) {
      this.logger.warn('OpenAI not configured, returning null');
      return null;
    }

    try {
      // Redact PII before sending to LLM
      const redactedInput = this.redactPII(userInput);

      const completion = await this.openai.beta.chat.completions.parse({
        model: 'gpt-4o-2024-08-06',
        messages: [
          {
            role: 'system',
            content: `You are a helpful assistant that structures service requests into a standard format.
Extract key information from the user's description and categorize it appropriately.
Focus on the type of service needed, urgency, scope, and any special requirements.
Flag any safety or complexity risks you identify.`,
          },
          {
            role: 'user',
            content: redactedInput,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'job_intake',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                category: { type: 'string', description: 'Service category' },
                title: { type: 'string', description: 'Short job title' },
                description: { type: 'string', description: 'Detailed description' },
                urgency: {
                  type: 'string',
                  enum: ['immediate', 'scheduled', 'flexible'],
                  description: 'How soon needed',
                },
                estimatedDuration: { type: 'string', description: 'Estimated time' },
                materials: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Materials needed',
                },
                risks: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Safety or complexity concerns',
                },
                location: {
                  type: 'object',
                  properties: {
                    type: {
                      type: 'string',
                      enum: ['indoor', 'outdoor', 'both'],
                    },
                    accessibility: { type: 'string' },
                  },
                  required: ['type'],
                  additionalProperties: false,
                },
              },
              required: ['category', 'title', 'description', 'urgency'],
              additionalProperties: false,
            },
          },
        },
      });

      const parsed = completion.choices[0]?.message?.parsed;
      if (!parsed) {
        this.logger.warn('No parsed response from OpenAI');
        return null;
      }

      return JobIntakeSchema.parse(parsed);
    } catch (error: any) {
      this.logger.error(`Error structuring job intake: ${error.message}`, error.stack);
      return null;
    }
  }

  async draftQuoteSuggestions(jobDescription: string, categoryHint?: string): Promise<{
    lineItems: Array<{ title: string; description: string; estimatedCost?: string }>;
    scope: string;
    exclusions: string[];
  } | null> {
    if (!this.openai) {
      return null;
    }

    try {
      const prompt = `As a ${categoryHint || 'service'} professional, draft a quote for this job:

${jobDescription}

Provide:
1. Line items with descriptions and estimated costs (if determinable)
2. Scope of work
3. Common exclusions or assumptions

Be realistic and professional. If you can't estimate costs without more info, say "TBD - requires assessment".`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'You are a professional service provider helping draft accurate, detailed quotes. Be thorough and realistic.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3, // More deterministic for quotes
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) return null;

      // Parse the response into structured format
      // For now, return the raw text - in production, use structured output
      return this.parseQuoteResponse(response);
    } catch (error: any) {
      this.logger.error(`Error drafting quote: ${error.message}`);
      return null;
    }
  }

  /**
   * Redact PII from user input before sending to LLM
   */
  private redactPII(input: string): string {
    let redacted = input;

    // Redact phone numbers (simple pattern)
    redacted = redacted.replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[PHONE]');

    // Redact email addresses
    redacted = redacted.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');

    // Redact street addresses (basic pattern)
    redacted = redacted.replace(/\b\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Circle|Cir|Way)\b/gi, '[ADDRESS]');

    // Redact SSN patterns
    redacted = redacted.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]');

    return redacted;
  }

  private parseQuoteResponse(response: string): {
    lineItems: Array<{ title: string; description: string; estimatedCost?: string }>;
    scope: string;
    exclusions: string[];
  } {
    // Simple parser - in production, use structured output format
    const lineItems: Array<{ title: string; description: string; estimatedCost?: string }> = [];
    const lines = response.split('\n');

    let currentSection = '';
    let scope = '';
    const exclusions: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.toLowerCase().includes('line item') || trimmed.toLowerCase().includes('cost breakdown')) {
        currentSection = 'lineItems';
      } else if (trimmed.toLowerCase().includes('scope')) {
        currentSection = 'scope';
      } else if (trimmed.toLowerCase().includes('exclusion') || trimmed.toLowerCase().includes('assumption')) {
        currentSection = 'exclusions';
      } else if (currentSection === 'lineItems' && trimmed.match(/^[\d-•*]/)) {
        // Parse line item
        const match = trimmed.match(/^[\d-•*\s]*(.+?)(?:\s*[-:]\s*\$?([\d,]+(?:\.\d{2})?|\w+))?$/);
        if (match) {
          lineItems.push({
            title: match[1].trim(),
            description: match[1].trim(),
            estimatedCost: match[2]?.trim(),
          });
        }
      } else if (currentSection === 'scope') {
        scope += trimmed + ' ';
      } else if (currentSection === 'exclusions' && trimmed.match(/^[\d-•*]/)) {
        exclusions.push(trimmed.replace(/^[\d-•*\s]+/, ''));
      }
    }

    return {
      lineItems: lineItems.length > 0 ? lineItems : [{ title: 'Service', description: response }],
      scope: scope.trim() || response,
      exclusions,
    };
  }
}
