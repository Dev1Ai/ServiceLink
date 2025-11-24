import { Test, TestingModule } from '@nestjs/testing';
import { RagService } from './rag.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

// Create mocks before module import
const mockEmbeddingsCreate = jest.fn();
const mockChatCompletionsCreate = jest.fn();

// Mock OpenAI module
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      embeddings: {
        create: mockEmbeddingsCreate,
      },
      chat: {
        completions: {
          create: mockChatCompletionsCreate,
        },
      },
    })),
  };
});

describe('RagService', () => {
  let service: RagService;
  let configService: ConfigService;
  let prismaService: PrismaService;

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockPrismaService = {
    $executeRaw: jest.fn(),
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockEmbeddingsCreate.mockClear();
    mockChatCompletionsCreate.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RagService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<RagService>(RagService);
    configService = module.get<ConfigService>(ConfigService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initialization', () => {
    it('should initialize with valid OpenAI API key', () => {
      mockConfigService.get.mockReturnValue('sk-validapikey12345');
      const module = Test.createTestingModule({
        providers: [
          RagService,
          { provide: ConfigService, useValue: mockConfigService },
          { provide: PrismaService, useValue: mockPrismaService },
        ],
      }).compile();

      expect(module).toBeDefined();
    });

    it('should not initialize OpenAI with invalid API key', () => {
      mockConfigService.get.mockReturnValue('your-api-key');
      const module = Test.createTestingModule({
        providers: [
          RagService,
          { provide: ConfigService, useValue: mockConfigService },
          { provide: PrismaService, useValue: mockPrismaService },
        ],
      }).compile();

      expect(module).toBeDefined();
    });

    it('should not initialize OpenAI with short API key', () => {
      mockConfigService.get.mockReturnValue('short');
      const module = Test.createTestingModule({
        providers: [
          RagService,
          { provide: ConfigService, useValue: mockConfigService },
          { provide: PrismaService, useValue: mockPrismaService },
        ],
      }).compile();

      expect(module).toBeDefined();
    });

    it('should not initialize OpenAI without API key', () => {
      mockConfigService.get.mockReturnValue(undefined);
      const module = Test.createTestingModule({
        providers: [
          RagService,
          { provide: ConfigService, useValue: mockConfigService },
          { provide: PrismaService, useValue: mockPrismaService },
        ],
      }).compile();

      expect(module).toBeDefined();
    });
  });

  describe('addKnowledge', () => {
    it('should return null when OpenAI is not configured', async () => {
      mockConfigService.get.mockReturnValue(undefined);
      const serviceWithoutOpenAI = new RagService(prismaService, configService);

      const result = await serviceWithoutOpenAI.addKnowledge({
        title: 'Test Article',
        content: 'Test content',
        category: 'general',
      });

      expect(result).toBeNull();
    });

    it('should add knowledge article with embedding', async () => {
      mockConfigService.get.mockReturnValue('sk-validapikey12345');
      const serviceWithOpenAI = new RagService(prismaService, configService);

      const mockEmbedding = Array(1536).fill(0.1);
      mockEmbeddingsCreate.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
      });

      mockPrismaService.$executeRaw.mockResolvedValue(1);

      const result = await serviceWithOpenAI.addKnowledge({
        title: 'How to reset password',
        content: 'To reset your password, click on forgot password link.',
        category: 'account',
      });

      expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: 'To reset your password, click on forgot password link.',
      });
      expect(mockPrismaService.$executeRaw).toHaveBeenCalled();
      expect(result).toBe(1);
    });

    it('should return null on error', async () => {
      mockConfigService.get.mockReturnValue('sk-validapikey12345');
      const serviceWithOpenAI = new RagService(prismaService, configService);

      mockEmbeddingsCreate.mockRejectedValue(new Error('API Error'));

      const result = await serviceWithOpenAI.addKnowledge({
        title: 'Test',
        content: 'Content',
        category: 'test',
      });

      expect(result).toBeNull();
    });

    it('should handle database insertion errors', async () => {
      mockConfigService.get.mockReturnValue('sk-validapikey12345');
      const serviceWithOpenAI = new RagService(prismaService, configService);

      const mockEmbedding = Array(1536).fill(0.1);
      mockEmbeddingsCreate.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
      });

      mockPrismaService.$executeRaw.mockRejectedValue(new Error('Database constraint violation'));

      const result = await serviceWithOpenAI.addKnowledge({
        title: 'Test',
        content: 'Content',
        category: 'test',
      });

      expect(result).toBeNull();
    });

    it('should format embedding as PostgreSQL vector', async () => {
      mockConfigService.get.mockReturnValue('sk-validapikey12345');
      const serviceWithOpenAI = new RagService(prismaService, configService);

      const mockEmbedding = [0.1, 0.2, 0.3];
      mockEmbeddingsCreate.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
      });

      mockPrismaService.$executeRaw.mockResolvedValue(1);

      await serviceWithOpenAI.addKnowledge({
        title: 'Test',
        content: 'Content',
        category: 'test',
      });

      expect(mockEmbeddingsCreate).toHaveBeenCalled();
      expect(mockPrismaService.$executeRaw).toHaveBeenCalled();
    });
  });

  describe('searchKnowledge', () => {
    it('should return empty array when OpenAI is not configured', async () => {
      mockConfigService.get.mockReturnValue(undefined);
      const serviceWithoutOpenAI = new RagService(prismaService, configService);

      const result = await serviceWithoutOpenAI.searchKnowledge('test query');

      expect(result).toEqual([]);
    });

    it('should search knowledge base with semantic similarity', async () => {
      mockConfigService.get.mockReturnValue('sk-validapikey12345');
      const serviceWithOpenAI = new RagService(prismaService, configService);

      const mockEmbedding = Array(1536).fill(0.1);
      mockEmbeddingsCreate.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
      });

      const mockResults = [
        {
          id: '1',
          title: 'Password Reset',
          content: 'How to reset password',
          category: 'account',
          similarity: 0.95,
        },
        {
          id: '2',
          title: 'Account Security',
          content: 'Security best practices',
          category: 'security',
          similarity: 0.87,
        },
      ];

      mockPrismaService.$queryRaw.mockResolvedValue(mockResults);

      const result = await serviceWithOpenAI.searchKnowledge('password reset', 5);

      expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: 'password reset',
      });
      expect(mockPrismaService.$queryRaw).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Password Reset');
      expect(result[0].similarity).toBe(0.95);
    });

    it('should respect limit parameter', async () => {
      mockConfigService.get.mockReturnValue('sk-validapikey12345');
      const serviceWithOpenAI = new RagService(prismaService, configService);

      const mockEmbedding = Array(1536).fill(0.1);
      mockEmbeddingsCreate.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
      });

      mockPrismaService.$queryRaw.mockResolvedValue([]);

      await serviceWithOpenAI.searchKnowledge('test', 3);

      expect(mockPrismaService.$queryRaw).toHaveBeenCalled();
    });

    it('should return empty array on error', async () => {
      mockConfigService.get.mockReturnValue('sk-validapikey12345');
      const serviceWithOpenAI = new RagService(prismaService, configService);

      mockEmbeddingsCreate.mockRejectedValue(new Error('API Error'));

      const result = await serviceWithOpenAI.searchKnowledge('test');

      expect(result).toEqual([]);
    });

    it('should use default limit of 5 when not specified', async () => {
      mockConfigService.get.mockReturnValue('sk-validapikey12345');
      const serviceWithOpenAI = new RagService(prismaService, configService);

      const mockEmbedding = Array(1536).fill(0.1);
      mockEmbeddingsCreate.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
      });

      mockPrismaService.$queryRaw.mockResolvedValue([]);

      await serviceWithOpenAI.searchKnowledge('test query');

      expect(mockPrismaService.$queryRaw).toHaveBeenCalled();
    });

    it('should parse similarity as float', async () => {
      mockConfigService.get.mockReturnValue('sk-validapikey12345');
      const serviceWithOpenAI = new RagService(prismaService, configService);

      const mockEmbedding = Array(1536).fill(0.1);
      mockEmbeddingsCreate.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
      });

      const mockResults = [
        {
          id: '1',
          title: 'Test',
          content: 'Test content',
          category: 'test',
          similarity: '0.9234567',
        },
      ];

      mockPrismaService.$queryRaw.mockResolvedValue(mockResults);

      const result = await serviceWithOpenAI.searchKnowledge('test');

      expect(result[0].similarity).toBe(0.9234567);
      expect(typeof result[0].similarity).toBe('number');
    });

    it('should handle database errors gracefully', async () => {
      mockConfigService.get.mockReturnValue('sk-validapikey12345');
      const serviceWithOpenAI = new RagService(prismaService, configService);

      const mockEmbedding = Array(1536).fill(0.1);
      mockEmbeddingsCreate.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
      });

      mockPrismaService.$queryRaw.mockRejectedValue(new Error('Database connection error'));

      const result = await serviceWithOpenAI.searchKnowledge('test');

      expect(result).toEqual([]);
    });
  });

  describe('answerQuestion', () => {
    it('should return null when OpenAI is not configured', async () => {
      mockConfigService.get.mockReturnValue(undefined);
      const serviceWithoutOpenAI = new RagService(prismaService, configService);

      const result = await serviceWithoutOpenAI.answerQuestion('How do I reset my password?');

      expect(result).toBeNull();
    });

    it('should answer question using RAG', async () => {
      mockConfigService.get.mockReturnValue('sk-validapikey12345');
      const serviceWithOpenAI = new RagService(prismaService, configService);

      const mockEmbedding = Array(1536).fill(0.1);
      mockEmbeddingsCreate.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
      });

      const mockKnowledge = [
        {
          id: '1',
          title: 'Password Reset Guide',
          content: 'Click forgot password, enter email, check inbox for reset link.',
          category: 'account',
          similarity: 0.95,
        },
      ];

      mockPrismaService.$queryRaw.mockResolvedValue(mockKnowledge);

      mockChatCompletionsCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'To reset your password, click the forgot password link and check your email.',
            },
          },
        ],
      });

      const result = await serviceWithOpenAI.answerQuestion('How do I reset my password?');

      expect(result).toBeDefined();
      expect(result?.answer).toContain('reset');
      expect(result?.sources).toContain('Password Reset Guide');
      expect(mockChatCompletionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
          temperature: 0.3,
        }),
      );
    });

    it('should return default message when no knowledge found', async () => {
      mockConfigService.get.mockReturnValue('sk-validapikey12345');
      const serviceWithOpenAI = new RagService(prismaService, configService);

      const mockEmbedding = Array(1536).fill(0.1);
      mockEmbeddingsCreate.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
      });

      mockPrismaService.$queryRaw.mockResolvedValue([]);

      const result = await serviceWithOpenAI.answerQuestion('Unknown question?');

      expect(result).toBeDefined();
      expect(result?.answer).toContain("don't have enough information");
      expect(result?.sources).toEqual([]);
    });

    it('should handle missing completion content', async () => {
      mockConfigService.get.mockReturnValue('sk-validapikey12345');
      const serviceWithOpenAI = new RagService(prismaService, configService);

      const mockEmbedding = Array(1536).fill(0.1);
      mockEmbeddingsCreate.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
      });

      mockPrismaService.$queryRaw.mockResolvedValue([
        {
          id: '1',
          title: 'Test',
          content: 'Test content',
          category: 'test',
          similarity: 0.9,
        },
      ]);

      mockChatCompletionsCreate.mockResolvedValue({
        choices: [{ message: {} }],
      });

      const result = await serviceWithOpenAI.answerQuestion('test?');

      expect(result?.answer).toBe('Unable to generate answer.');
    });

    it('should return default message when embeddings fail', async () => {
      mockConfigService.get.mockReturnValue('sk-validapikey12345');
      const serviceWithOpenAI = new RagService(prismaService, configService);

      mockEmbeddingsCreate.mockRejectedValue(new Error('API Error'));

      const result = await serviceWithOpenAI.answerQuestion('test?');

      expect(result).toBeDefined();
      expect(result?.answer).toContain("don't have enough information");
      expect(result?.sources).toEqual([]);
    });

    it('should build context from multiple knowledge articles', async () => {
      mockConfigService.get.mockReturnValue('sk-validapikey12345');
      const serviceWithOpenAI = new RagService(prismaService, configService);

      const mockEmbedding = Array(1536).fill(0.1);
      mockEmbeddingsCreate.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
      });

      const mockKnowledge = [
        {
          id: '1',
          title: 'Article 1',
          content: 'Content 1',
          category: 'cat1',
          similarity: 0.95,
        },
        {
          id: '2',
          title: 'Article 2',
          content: 'Content 2',
          category: 'cat2',
          similarity: 0.90,
        },
        {
          id: '3',
          title: 'Article 3',
          content: 'Content 3',
          category: 'cat3',
          similarity: 0.85,
        },
      ];

      mockPrismaService.$queryRaw.mockResolvedValue(mockKnowledge);

      mockChatCompletionsCreate.mockResolvedValue({
        choices: [{ message: { content: 'Answer based on multiple sources' } }],
      });

      const result = await serviceWithOpenAI.answerQuestion('question?');

      expect(result?.sources).toEqual(['Article 1', 'Article 2', 'Article 3']);
      expect(mockChatCompletionsCreate).toHaveBeenCalled();
    });

    it('should handle chat completion API errors', async () => {
      mockConfigService.get.mockReturnValue('sk-validapikey12345');
      const serviceWithOpenAI = new RagService(prismaService, configService);

      const mockEmbedding = Array(1536).fill(0.1);
      mockEmbeddingsCreate.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
      });

      mockPrismaService.$queryRaw.mockResolvedValue([
        {
          id: '1',
          title: 'Test',
          content: 'Test content',
          category: 'test',
          similarity: 0.9,
        },
      ]);

      mockChatCompletionsCreate.mockRejectedValue(new Error('Chat API rate limit'));

      const result = await serviceWithOpenAI.answerQuestion('test?');

      expect(result).toBeNull();
    });

    it('should use gpt-4o model with temperature 0.3', async () => {
      mockConfigService.get.mockReturnValue('sk-validapikey12345');
      const serviceWithOpenAI = new RagService(prismaService, configService);

      const mockEmbedding = Array(1536).fill(0.1);
      mockEmbeddingsCreate.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
      });

      mockPrismaService.$queryRaw.mockResolvedValue([
        {
          id: '1',
          title: 'Test',
          content: 'Test content',
          category: 'test',
          similarity: 0.9,
        },
      ]);

      mockChatCompletionsCreate.mockResolvedValue({
        choices: [{ message: { content: 'Test answer' } }],
      });

      await serviceWithOpenAI.answerQuestion('test?');

      expect(mockChatCompletionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
          temperature: 0.3,
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({ role: 'user' }),
          ]),
        }),
      );
    });

    it('should retrieve exactly 3 knowledge articles', async () => {
      mockConfigService.get.mockReturnValue('sk-validapikey12345');
      const serviceWithOpenAI = new RagService(prismaService, configService);

      const mockEmbedding = Array(1536).fill(0.1);
      mockEmbeddingsCreate.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
      });

      mockPrismaService.$queryRaw.mockResolvedValue([
        {
          id: '1',
          title: 'Article 1',
          content: 'Content 1',
          category: 'test',
          similarity: 0.95,
        },
        {
          id: '2',
          title: 'Article 2',
          content: 'Content 2',
          category: 'test',
          similarity: 0.90,
        },
      ]);

      mockChatCompletionsCreate.mockResolvedValue({
        choices: [{ message: { content: 'Answer' } }],
      });

      await serviceWithOpenAI.answerQuestion('test?');

      expect(mockPrismaService.$queryRaw).toHaveBeenCalled();
    });
  });
});
