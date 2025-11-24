import { Test, TestingModule } from '@nestjs/testing';
import { PhotosService } from './photos.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { PhotoContextType } from '@prisma/client';
import { Readable } from 'stream';
import sharp from 'sharp';

// Mock AWS SDK
const mockSend = jest.fn();
const mockGetSignedUrl = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  PutObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: any[]) => mockGetSignedUrl(...args),
}));

// Mock sharp - needs to be a factory function
jest.mock('sharp', () => {
  return jest.fn().mockReturnValue({
    resize: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('thumbnail-data')),
  });
});

describe('PhotosService', () => {
  let service: PhotosService;
  let prisma: PrismaService;

  const mockPrismaService = {
    photo: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Set environment variables for testing
    process.env.AWS_REGION = 'us-east-1';
    process.env.AWS_S3_BUCKET = 'test-bucket';
    process.env.AWS_ACCESS_KEY_ID = 'test-key';
    process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PhotosService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<PhotosService>(PhotosService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    delete process.env.AWS_REGION;
    delete process.env.AWS_S3_BUCKET;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateUploadUrl', () => {
    const mockPhoto = {
      id: 'photo-123',
      userId: 'user-123',
      url: 'https://test-bucket.s3.us-east-1.amazonaws.com/photos/job/job-123/1234567890-abc123-test.jpg',
      filename: 'test.jpg',
      contentType: 'image/jpeg',
      size: 0,
      width: null,
      height: null,
      contextType: PhotoContextType.JOB,
      contextId: 'job-123',
      thumbnailUrl: null,
      metadata: null,
      createdAt: new Date(),
    };

    it('should generate presigned URL for valid content type', async () => {
      mockPrismaService.photo.create.mockResolvedValue(mockPhoto);
      mockGetSignedUrl.mockResolvedValue('https://presigned-url.example.com');

      const result = await service.generateUploadUrl(
        'user-123',
        'test.jpg',
        'image/jpeg',
        PhotoContextType.JOB,
        'job-123',
      );

      expect(result).toEqual({
        uploadUrl: 'https://presigned-url.example.com',
        photoId: 'photo-123',
        key: expect.stringContaining('photos/job/job-123/'),
      });
      expect(prisma.photo.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          url: expect.stringContaining('https://test-bucket.s3.us-east-1.amazonaws.com/photos/job/job-123/'),
          filename: 'test.jpg',
          contentType: 'image/jpeg',
          size: 0,
          contextType: PhotoContextType.JOB,
          contextId: 'job-123',
        },
      });
    });

    it('should reject invalid content types', async () => {
      await expect(
        service.generateUploadUrl('user-123', 'test.pdf', 'application/pdf', PhotoContextType.JOB, 'job-123'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.generateUploadUrl('user-123', 'test.pdf', 'application/pdf', PhotoContextType.JOB, 'job-123'),
      ).rejects.toThrow('Invalid content type. Allowed: image/jpeg, image/png, image/webp');
    });

    it('should accept image/png', async () => {
      mockPrismaService.photo.create.mockResolvedValue(mockPhoto);
      mockGetSignedUrl.mockResolvedValue('https://presigned-url.example.com');

      await service.generateUploadUrl('user-123', 'test.png', 'image/png', PhotoContextType.JOB, 'job-123');

      expect(prisma.photo.create).toHaveBeenCalled();
    });

    it('should accept image/webp', async () => {
      mockPrismaService.photo.create.mockResolvedValue(mockPhoto);
      mockGetSignedUrl.mockResolvedValue('https://presigned-url.example.com');

      await service.generateUploadUrl('user-123', 'test.webp', 'image/webp', PhotoContextType.JOB, 'job-123');

      expect(prisma.photo.create).toHaveBeenCalled();
    });

    it('should sanitize filename', async () => {
      mockPrismaService.photo.create.mockResolvedValue(mockPhoto);
      mockGetSignedUrl.mockResolvedValue('https://presigned-url.example.com');

      await service.generateUploadUrl('user-123', 'test file @#$.jpg', 'image/jpeg', PhotoContextType.JOB, 'job-123');

      expect(prisma.photo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            filename: 'test_file____.jpg',
          }),
        }),
      );
    });

    it('should generate unique keys with timestamp and random ID', async () => {
      mockPrismaService.photo.create.mockResolvedValue(mockPhoto);
      mockGetSignedUrl.mockResolvedValue('https://presigned-url.example.com');

      const result1 = await service.generateUploadUrl('user-123', 'test.jpg', 'image/jpeg', PhotoContextType.JOB, 'job-123');
      const result2 = await service.generateUploadUrl('user-123', 'test.jpg', 'image/jpeg', PhotoContextType.JOB, 'job-123');

      expect(result1.key).not.toBe(result2.key);
      expect(result1.key).toMatch(/^photos\/job\/job-123\/\d+-[a-z0-9]+-test\.jpg$/);
    });

    it('should handle different context types', async () => {
      mockPrismaService.photo.create.mockResolvedValue(mockPhoto);
      mockGetSignedUrl.mockResolvedValue('https://presigned-url.example.com');

      const contexts = [
        PhotoContextType.JOB,
        PhotoContextType.CHECK_IN,
        PhotoContextType.CHECK_OUT,
        PhotoContextType.CHAT,
        PhotoContextType.INVOICE,
      ];

      for (const contextType of contexts) {
        await service.generateUploadUrl('user-123', 'test.jpg', 'image/jpeg', contextType, 'context-123');

        expect(prisma.photo.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              contextType,
            }),
          }),
        );
      }
    });

    it('should set expiration to 15 minutes', async () => {
      mockPrismaService.photo.create.mockResolvedValue(mockPhoto);
      mockGetSignedUrl.mockResolvedValue('https://presigned-url.example.com');

      await service.generateUploadUrl('user-123', 'test.jpg', 'image/jpeg', PhotoContextType.JOB, 'job-123');

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ expiresIn: 15 * 60 }),
      );
    });
  });

  describe('confirmUpload', () => {
    const mockPhoto = {
      id: 'photo-123',
      userId: 'user-123',
      url: 'https://test-bucket.s3.us-east-1.amazonaws.com/photos/job/job-123/test.jpg',
      filename: 'test.jpg',
      contentType: 'image/jpeg',
      size: 0,
      width: null,
      height: null,
      contextType: PhotoContextType.JOB,
      contextId: 'job-123',
      thumbnailUrl: null,
      metadata: null,
      createdAt: new Date(),
    };

    it('should confirm upload and update metadata', async () => {
      mockPrismaService.photo.findUnique.mockResolvedValue(mockPhoto);
      mockPrismaService.photo.update.mockResolvedValue({
        ...mockPhoto,
        size: 1024,
        width: 800,
        height: 600,
      });

      const result = await service.confirmUpload('photo-123', 'user-123', {
        size: 1024,
        width: 800,
        height: 600,
      });

      expect(result.size).toBe(1024);
      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
      expect(prisma.photo.update).toHaveBeenCalledWith({
        where: { id: 'photo-123' },
        data: {
          size: 1024,
          width: 800,
          height: 600,
        },
      });
    });

    it('should throw error if photo not found', async () => {
      mockPrismaService.photo.findUnique.mockResolvedValue(null);

      await expect(
        service.confirmUpload('photo-123', 'user-123', {}),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.confirmUpload('photo-123', 'user-123', {}),
      ).rejects.toThrow('Photo not found');
    });

    it('should throw error if user not authorized', async () => {
      mockPrismaService.photo.findUnique.mockResolvedValue(mockPhoto);

      await expect(
        service.confirmUpload('photo-123', 'wrong-user', {}),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.confirmUpload('photo-123', 'wrong-user', {}),
      ).rejects.toThrow('Not authorized');
    });

    it('should trigger thumbnail generation', async () => {
      mockPrismaService.photo.findUnique.mockResolvedValue(mockPhoto);
      mockPrismaService.photo.update.mockResolvedValue(mockPhoto);
      mockSend.mockResolvedValue({ Body: Readable.from([Buffer.from('image-data')]) });

      await service.confirmUpload('photo-123', 'user-123', {});

      // Wait for async thumbnail generation
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify thumbnail generation was attempted
      expect(sharp).toHaveBeenCalled();
    });

    it('should handle missing metadata gracefully', async () => {
      mockPrismaService.photo.findUnique.mockResolvedValue(mockPhoto);
      mockPrismaService.photo.update.mockResolvedValue(mockPhoto);

      await service.confirmUpload('photo-123', 'user-123');

      expect(prisma.photo.update).toHaveBeenCalledWith({
        where: { id: 'photo-123' },
        data: {
          size: 0,
          width: undefined,
          height: undefined,
        },
      });
    });
  });

  describe('getPhotos', () => {
    const mockPhotos = [
      {
        id: 'photo-1',
        userId: 'user-123',
        url: 'https://test-bucket.s3.us-east-1.amazonaws.com/photos/job/job-123/photo1.jpg',
        contextType: PhotoContextType.JOB,
        contextId: 'job-123',
        createdAt: new Date('2025-01-02'),
      },
      {
        id: 'photo-2',
        userId: 'user-123',
        url: 'https://test-bucket.s3.us-east-1.amazonaws.com/photos/job/job-123/photo2.jpg',
        contextType: PhotoContextType.JOB,
        contextId: 'job-123',
        createdAt: new Date('2025-01-01'),
      },
    ];

    it('should get photos by context', async () => {
      mockPrismaService.photo.findMany.mockResolvedValue(mockPhotos);

      const result = await service.getPhotos(PhotoContextType.JOB, 'job-123');

      expect(result).toEqual(mockPhotos);
      expect(prisma.photo.findMany).toHaveBeenCalledWith({
        where: {
          contextType: PhotoContextType.JOB,
          contextId: 'job-123',
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter by userId when provided', async () => {
      mockPrismaService.photo.findMany.mockResolvedValue(mockPhotos);

      await service.getPhotos(PhotoContextType.JOB, 'job-123', 'user-123');

      expect(prisma.photo.findMany).toHaveBeenCalledWith({
        where: {
          contextType: PhotoContextType.JOB,
          contextId: 'job-123',
          userId: 'user-123',
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when no photos found', async () => {
      mockPrismaService.photo.findMany.mockResolvedValue([]);

      const result = await service.getPhotos(PhotoContextType.JOB, 'job-123');

      expect(result).toEqual([]);
    });

    it('should order by createdAt descending', async () => {
      mockPrismaService.photo.findMany.mockResolvedValue(mockPhotos);

      await service.getPhotos(PhotoContextType.JOB, 'job-123');

      expect(prisma.photo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  describe('deletePhoto', () => {
    const mockPhoto = {
      id: 'photo-123',
      userId: 'user-123',
      url: 'https://test-bucket.s3.us-east-1.amazonaws.com/photos/job/job-123/test.jpg',
      filename: 'test.jpg',
      contentType: 'image/jpeg',
      size: 1024,
      contextType: PhotoContextType.JOB,
      contextId: 'job-123',
      createdAt: new Date(),
    };

    it('should delete photo from S3 and database', async () => {
      mockPrismaService.photo.findUnique.mockResolvedValue(mockPhoto);
      mockPrismaService.photo.delete.mockResolvedValue(mockPhoto);
      mockSend.mockResolvedValue({});

      await service.deletePhoto('photo-123', 'user-123');

      expect(mockSend).toHaveBeenCalled();
      expect(prisma.photo.delete).toHaveBeenCalledWith({
        where: { id: 'photo-123' },
      });
    });

    it('should throw error if photo not found', async () => {
      mockPrismaService.photo.findUnique.mockResolvedValue(null);

      await expect(
        service.deletePhoto('photo-123', 'user-123'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.deletePhoto('photo-123', 'user-123'),
      ).rejects.toThrow('Photo not found');
    });

    it('should throw error if user not authorized', async () => {
      mockPrismaService.photo.findUnique.mockResolvedValue(mockPhoto);

      await expect(
        service.deletePhoto('photo-123', 'wrong-user'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.deletePhoto('photo-123', 'wrong-user'),
      ).rejects.toThrow('Not authorized');
    });

    it('should still delete from database if S3 deletion fails', async () => {
      mockPrismaService.photo.findUnique.mockResolvedValue(mockPhoto);
      mockPrismaService.photo.delete.mockResolvedValue(mockPhoto);
      mockSend.mockRejectedValue(new Error('S3 error'));

      await service.deletePhoto('photo-123', 'user-123');

      expect(prisma.photo.delete).toHaveBeenCalled();
    });

    it('should handle photo without S3 key', async () => {
      const photoWithoutKey = { ...mockPhoto, url: 'https://invalid-url' };
      mockPrismaService.photo.findUnique.mockResolvedValue(photoWithoutKey);
      mockPrismaService.photo.delete.mockResolvedValue(photoWithoutKey);

      await service.deletePhoto('photo-123', 'user-123');

      expect(prisma.photo.delete).toHaveBeenCalled();
    });
  });

  describe('Integration', () => {
    it('should handle full upload workflow', async () => {
      const mockPhoto = {
        id: 'photo-123',
        userId: 'user-123',
        url: 'https://test-bucket.s3.us-east-1.amazonaws.com/photos/job/job-123/test.jpg',
        filename: 'test.jpg',
        contentType: 'image/jpeg',
        size: 0,
        width: null,
        height: null,
        contextType: PhotoContextType.JOB,
        contextId: 'job-123',
        thumbnailUrl: null,
        metadata: null,
        createdAt: new Date(),
      };

      // Step 1: Generate upload URL
      mockPrismaService.photo.create.mockResolvedValue(mockPhoto);
      mockGetSignedUrl.mockResolvedValue('https://presigned-url.example.com');

      const uploadResult = await service.generateUploadUrl(
        'user-123',
        'test.jpg',
        'image/jpeg',
        PhotoContextType.JOB,
        'job-123',
      );

      expect(uploadResult.photoId).toBe('photo-123');

      // Step 2: Confirm upload
      mockPrismaService.photo.findUnique.mockResolvedValue(mockPhoto);
      mockPrismaService.photo.update.mockResolvedValue({ ...mockPhoto, size: 1024 });

      const confirmResult = await service.confirmUpload('photo-123', 'user-123', { size: 1024 });

      expect(confirmResult.size).toBe(1024);

      // Step 3: Get photos
      mockPrismaService.photo.findMany.mockResolvedValue([confirmResult]);

      const photos = await service.getPhotos(PhotoContextType.JOB, 'job-123');

      expect(photos).toHaveLength(1);
      expect(photos[0].id).toBe('photo-123');

      // Step 4: Delete photo
      mockPrismaService.photo.findUnique.mockResolvedValue(confirmResult);
      mockPrismaService.photo.delete.mockResolvedValue(confirmResult);
      mockSend.mockResolvedValue({});

      await service.deletePhoto('photo-123', 'user-123');

      expect(prisma.photo.delete).toHaveBeenCalled();
    });

    it('should handle multiple photos for same context', async () => {
      const photos = [
        { id: 'photo-1', contextType: PhotoContextType.JOB, contextId: 'job-123' },
        { id: 'photo-2', contextType: PhotoContextType.JOB, contextId: 'job-123' },
        { id: 'photo-3', contextType: PhotoContextType.JOB, contextId: 'job-123' },
      ];

      mockPrismaService.photo.findMany.mockResolvedValue(photos);

      const result = await service.getPhotos(PhotoContextType.JOB, 'job-123');

      expect(result).toHaveLength(3);
    });
  });
});
