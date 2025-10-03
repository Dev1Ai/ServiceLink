import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import OpenAI from 'openai';

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private openai: OpenAI | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (apiKey && !apiKey.includes('your-') && apiKey.length > 10) {
      this.openai = new OpenAI({ apiKey });
      this.logger.log('RAG service initialized');
    } else {
      this.logger.warn('OpenAI API key not configured - RAG disabled');
    }
  }

  /**
   * Add knowledge article to the database with embedding
   */
  async addKnowledge(data: { title: string; content: string; category: string }): Promise<any> {
    if (!this.openai) {
      this.logger.warn('Cannot add knowledge - OpenAI not configured');
      return null;
    }

    try {
      // Generate embedding for the content
      const embedding = await this.generateEmbedding(data.content);

      // Store in database
      // Note: pgvector operations require raw SQL with Prisma
      const result = await this.prisma.$executeRaw`
        INSERT INTO "KnowledgeBase" (id, title, content, category, embedding, "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid()::text,
          ${data.title},
          ${data.content},
          ${data.category},
          ${embedding}::vector,
          NOW(),
          NOW()
        )
      `;

      this.logger.log(`Added knowledge article: ${data.title}`);
      return result;
    } catch (error: any) {
      this.logger.error(`Error adding knowledge: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Search knowledge base using semantic similarity
   */
  async searchKnowledge(query: string, limit: number = 5): Promise<Array<{
    title: string;
    content: string;
    category: string;
    similarity?: number;
  }>> {
    if (!this.openai) {
      this.logger.warn('Cannot search - OpenAI not configured');
      return [];
    }

    try {
      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(query);

      // Search using cosine similarity
      const results: any[] = await this.prisma.$queryRaw`
        SELECT
          id,
          title,
          content,
          category,
          1 - (embedding <=> ${queryEmbedding}::vector) as similarity
        FROM "KnowledgeBase"
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> ${queryEmbedding}::vector
        LIMIT ${limit}
      `;

      return results.map((r) => ({
        title: r.title,
        content: r.content,
        category: r.category,
        similarity: parseFloat(r.similarity),
      }));
    } catch (error: any) {
      this.logger.error(`Error searching knowledge: ${error.message}`, error.stack);
      return [];
    }
  }

  /**
   * Answer a question using RAG (Retrieval Augmented Generation)
   */
  async answerQuestion(question: string): Promise<{ answer: string; sources: string[] } | null> {
    if (!this.openai) {
      return null;
    }

    try {
      // Step 1: Retrieve relevant knowledge
      const relevantKnowledge = await this.searchKnowledge(question, 3);

      if (relevantKnowledge.length === 0) {
        return {
          answer: "I don't have enough information to answer that question. Please contact support for assistance.",
          sources: [],
        };
      }

      // Step 2: Build context from retrieved knowledge
      const context = relevantKnowledge
        .map((k) => `Title: ${k.title}\n${k.content}`)
        .join('\n\n---\n\n');

      const sources = relevantKnowledge.map((k) => k.title);

      // Step 3: Generate answer using context
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a helpful customer support assistant. Answer questions based ONLY on the provided knowledge base content.
If the answer is not in the provided context, say so clearly.
Be concise and accurate.`,
          },
          {
            role: 'user',
            content: `Context from knowledge base:\n\n${context}\n\nQuestion: ${question}`,
          },
        ],
        temperature: 0.3,
      });

      const answer = completion.choices[0]?.message?.content || 'Unable to generate answer.';

      return { answer, sources };
    } catch (error: any) {
      this.logger.error(`Error answering question: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Generate embedding for text using OpenAI
   */
  private async generateEmbedding(text: string): Promise<string> {
    if (!this.openai) {
      throw new Error('OpenAI not configured');
    }

    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });

    // Convert embedding array to PostgreSQL vector format
    const embedding = response.data[0].embedding;
    return `[${embedding.join(',')}]`;
  }
}
