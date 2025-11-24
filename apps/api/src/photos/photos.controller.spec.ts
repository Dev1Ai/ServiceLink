import { Test, TestingModule } from '@nestjs/testing';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PhotoContextType } from '@prisma/client';

describe('PhotosController', () => {
  let controller: PhotosController;
  let photosService: PhotosService;

  const mockPhotosService = {
    generateUploadUrl: jest.fn(),
    confirmUpload: jest.fn(),
    getPhotos: jest.fn(),
    deletePhoto: jest.fn(),
  };

  const mockAuthRequest = {
    user: {
      sub: 'user-123',
      email: 'test@example.com',
      role: 'CUSTOMER',
    },
  };

  const mockUploadUrlResponse = {
    photoId: 'photo-123',
    uploadUrl: 'https://s3.amazonaws.com/bucket/presigned-url',
    expiresIn: 900,
  };

  const mockPhoto = {
    id: 'photo-123',
    userId: 'user-123',
    url: 'https://s3.amazonaws.com/bucket/photo.jpg',
    thumbnailUrl: 'https://s3.amazonaws.com/bucket/photo_thumb.jpg',
    filename: 'photo.jpg',
    contentType: 'image/jpeg',
    size: 1024000,
    width: 1920,
    height: 1080,
    contextType: 'JOB' as PhotoContextType,
    contextId: 'job-123',
    metadata: {},
    createdAt: new Date('2025-11-23T10:00:00Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PhotosController],
      providers: [
        {
          provide: PhotosService,
          useValue: mockPhotosService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PhotosController>(PhotosController);
    photosService = module.get<PhotosService>(PhotosService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('generateUploadUrl', () => {
    it('should generate presigned upload URL', async () => {
      const dto = {
        filename: 'test-photo.jpg',
        contentType: 'image/jpeg',
        contextType: 'JOB' as PhotoContextType,
        contextId: 'job-123',
      };
      mockPhotosService.generateUploadUrl.mockResolvedValue(mockUploadUrlResponse);

      const result = await controller.generateUploadUrl(mockAuthRequest as any, dto);

      expect(result).toEqual(mockUploadUrlResponse);
      expect(photosService.generateUploadUrl).toHaveBeenCalledWith(
        'user-123',
        'test-photo.jpg',
        'image/jpeg',
        'JOB',
        'job-123',
      );
    });

    it('should extract userId from request.user.sub', async () => {
      const customRequest = {
        user: { sub: 'custom-user-456', email: 'custom@test.com', role: 'PROVIDER' },
      };
      const dto = {
        filename: 'photo.png',
        contentType: 'image/png',
        contextType: 'CHECK_IN' as PhotoContextType,
        contextId: 'checkpoint-456',
      };
      mockPhotosService.generateUploadUrl.mockResolvedValue(mockUploadUrlResponse);

      await controller.generateUploadUrl(customRequest as any, dto);

      expect(photosService.generateUploadUrl).toHaveBeenCalledWith(
        'custom-user-456',
        'photo.png',
        'image/png',
        'CHECK_IN',
        'checkpoint-456',
      );
    });

    it('should support JOB context type', async () => {
      const dto = {
        filename: 'job-photo.jpg',
        contentType: 'image/jpeg',
        contextType: 'JOB' as PhotoContextType,
        contextId: 'job-789',
      };
      mockPhotosService.generateUploadUrl.mockResolvedValue(mockUploadUrlResponse);

      await controller.generateUploadUrl(mockAuthRequest as any, dto);

      expect(photosService.generateUploadUrl).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        'JOB',
        'job-789',
      );
    });

    it('should support CHECK_IN context type', async () => {
      const dto = {
        filename: 'checkin.jpg',
        contentType: 'image/jpeg',
        contextType: 'CHECK_IN' as PhotoContextType,
        contextId: 'checkpoint-1',
      };
      mockPhotosService.generateUploadUrl.mockResolvedValue(mockUploadUrlResponse);

      await controller.generateUploadUrl(mockAuthRequest as any, dto);

      expect(photosService.generateUploadUrl).toHaveBeenCalledWith(
        expect.any(String),
        'checkin.jpg',
        expect.any(String),
        'CHECK_IN',
        expect.any(String),
      );
    });

    it('should support CHECK_OUT context type', async () => {
      const dto = {
        filename: 'checkout.jpg',
        contentType: 'image/jpeg',
        contextType: 'CHECK_OUT' as PhotoContextType,
        contextId: 'checkpoint-2',
      };
      mockPhotosService.generateUploadUrl.mockResolvedValue(mockUploadUrlResponse);

      await controller.generateUploadUrl(mockAuthRequest as any, dto);

      expect(photosService.generateUploadUrl).toHaveBeenCalledWith(
        expect.any(String),
        'checkout.jpg',
        expect.any(String),
        'CHECK_OUT',
        expect.any(String),
      );
    });

    it('should handle different image types', async () => {
      const pngDto = {
        filename: 'image.png',
        contentType: 'image/png',
        contextType: 'JOB' as PhotoContextType,
        contextId: 'job-1',
      };
      mockPhotosService.generateUploadUrl.mockResolvedValue(mockUploadUrlResponse);

      await controller.generateUploadUrl(mockAuthRequest as any, pngDto);

      expect(photosService.generateUploadUrl).toHaveBeenCalledWith(
        expect.any(String),
        'image.png',
        'image/png',
        expect.any(String),
        expect.any(String),
      );
    });

    it('should handle WebP images', async () => {
      const webpDto = {
        filename: 'modern.webp',
        contentType: 'image/webp',
        contextType: 'JOB' as PhotoContextType,
        contextId: 'job-1',
      };
      mockPhotosService.generateUploadUrl.mockResolvedValue(mockUploadUrlResponse);

      await controller.generateUploadUrl(mockAuthRequest as any, webpDto);

      expect(photosService.generateUploadUrl).toHaveBeenCalledWith(
        expect.any(String),
        'modern.webp',
        'image/webp',
        expect.any(String),
        expect.any(String),
      );
    });

    it('should return uploadUrl and photoId', async () => {
      const dto = {
        filename: 'test.jpg',
        contentType: 'image/jpeg',
        contextType: 'JOB' as PhotoContextType,
        contextId: 'job-1',
      };
      mockPhotosService.generateUploadUrl.mockResolvedValue(mockUploadUrlResponse);

      const result = await controller.generateUploadUrl(mockAuthRequest as any, dto);

      expect(result).toHaveProperty('photoId');
      expect(result).toHaveProperty('uploadUrl');
      expect(result).toHaveProperty('expiresIn');
    });
  });

  describe('confirmUpload', () => {
    it('should confirm photo upload', async () => {
      const dto = { width: 1920, height: 1080, size: 1024000 };
      mockPhotosService.confirmUpload.mockResolvedValue(mockPhoto);

      const result = await controller.confirmUpload('photo-123', mockAuthRequest as any, dto);

      expect(result).toEqual(mockPhoto);
      expect(photosService.confirmUpload).toHaveBeenCalledWith('photo-123', 'user-123', dto);
    });

    it('should extract userId from request', async () => {
      const customRequest = {
        user: { sub: 'provider-789', email: 'provider@test.com', role: 'PROVIDER' },
      };
      const dto = { width: 800, height: 600, size: 500000 };
      mockPhotosService.confirmUpload.mockResolvedValue(mockPhoto);

      await controller.confirmUpload('photo-456', customRequest as any, dto);

      expect(photosService.confirmUpload).toHaveBeenCalledWith('photo-456', 'provider-789', dto);
    });

    it('should pass photo dimensions to service', async () => {
      const dto = { width: 3840, height: 2160, size: 5000000 };
      mockPhotosService.confirmUpload.mockResolvedValue(mockPhoto);

      await controller.confirmUpload('photo-789', mockAuthRequest as any, dto);

      expect(photosService.confirmUpload).toHaveBeenCalledWith(
        'photo-789',
        'user-123',
        expect.objectContaining({
          width: 3840,
          height: 2160,
          size: 5000000,
        }),
      );
    });

    it('should handle small images', async () => {
      const dto = { width: 100, height: 100, size: 10000 };
      mockPhotosService.confirmUpload.mockResolvedValue({
        ...mockPhoto,
        width: 100,
        height: 100,
        size: 10000,
      });

      const result = await controller.confirmUpload('photo-small', mockAuthRequest as any, dto);

      expect(result.width).toBe(100);
      expect(result.height).toBe(100);
      expect(result.size).toBe(10000);
    });

    it('should handle large images', async () => {
      const dto = { width: 8000, height: 6000, size: 20000000 };
      mockPhotosService.confirmUpload.mockResolvedValue({
        ...mockPhoto,
        width: 8000,
        height: 8000,
        size: 20000000,
      });

      const result = await controller.confirmUpload('photo-large', mockAuthRequest as any, dto);

      expect(result.width).toBe(8000);
    });

    it('should return complete photo object', async () => {
      const dto = { width: 1920, height: 1080, size: 1024000 };
      mockPhotosService.confirmUpload.mockResolvedValue(mockPhoto);

      const result = await controller.confirmUpload('photo-123', mockAuthRequest as any, dto);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('thumbnailUrl');
      expect(result).toHaveProperty('userId');
      expect(result).toHaveProperty('contextType');
      expect(result).toHaveProperty('contextId');
    });
  });

  describe('getPhotos', () => {
    it('should get photos for a context', async () => {
      const photos = [mockPhoto];
      mockPhotosService.getPhotos.mockResolvedValue(photos);

      const result = await controller.getPhotos('JOB', 'job-123', mockAuthRequest as any);

      expect(result).toEqual(photos);
      expect(photosService.getPhotos).toHaveBeenCalledWith('JOB', 'job-123');
    });

    it('should get photos for CHECK_IN context', async () => {
      const checkInPhotos = [{ ...mockPhoto, contextType: 'CHECK_IN' }];
      mockPhotosService.getPhotos.mockResolvedValue(checkInPhotos);

      const result = await controller.getPhotos('CHECK_IN', 'checkpoint-1', mockAuthRequest as any);

      expect(result).toEqual(checkInPhotos);
      expect(photosService.getPhotos).toHaveBeenCalledWith('CHECK_IN', 'checkpoint-1');
    });

    it('should get photos for CHECK_OUT context', async () => {
      const checkOutPhotos = [{ ...mockPhoto, contextType: 'CHECK_OUT' }];
      mockPhotosService.getPhotos.mockResolvedValue(checkOutPhotos);

      const result = await controller.getPhotos(
        'CHECK_OUT',
        'checkpoint-2',
        mockAuthRequest as any,
      );

      expect(result).toEqual(checkOutPhotos);
      expect(photosService.getPhotos).toHaveBeenCalledWith('CHECK_OUT', 'checkpoint-2');
    });

    it('should handle empty photo list', async () => {
      mockPhotosService.getPhotos.mockResolvedValue([]);

      const result = await controller.getPhotos('JOB', 'job-empty', mockAuthRequest as any);

      expect(result).toEqual([]);
    });

    it('should handle multiple photos', async () => {
      const multiplePhotos = [
        mockPhoto,
        { ...mockPhoto, id: 'photo-2', filename: 'photo2.jpg' },
        { ...mockPhoto, id: 'photo-3', filename: 'photo3.jpg' },
      ];
      mockPhotosService.getPhotos.mockResolvedValue(multiplePhotos);

      const result = await controller.getPhotos('JOB', 'job-multi', mockAuthRequest as any);

      expect(result).toHaveLength(3);
      expect(result).toEqual(multiplePhotos);
    });

    it('should not require userId parameter', async () => {
      mockPhotosService.getPhotos.mockResolvedValue([mockPhoto]);

      await controller.getPhotos('JOB', 'job-123', mockAuthRequest as any);

      expect(photosService.getPhotos).toHaveBeenCalledWith('JOB', 'job-123');
      expect(photosService.getPhotos).not.toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
      );
    });
  });

  describe('deletePhoto', () => {
    it('should delete a photo', async () => {
      mockPhotosService.deletePhoto.mockResolvedValue(undefined);

      const result = await controller.deletePhoto('photo-123', mockAuthRequest as any);

      expect(result).toEqual({ success: true });
      expect(photosService.deletePhoto).toHaveBeenCalledWith('photo-123', 'user-123');
    });

    it('should extract userId from request', async () => {
      const customRequest = {
        user: { sub: 'owner-456', email: 'owner@test.com', role: 'CUSTOMER' },
      };
      mockPhotosService.deletePhoto.mockResolvedValue(undefined);

      await controller.deletePhoto('photo-789', customRequest as any);

      expect(photosService.deletePhoto).toHaveBeenCalledWith('photo-789', 'owner-456');
    });

    it('should return success response', async () => {
      mockPhotosService.deletePhoto.mockResolvedValue(undefined);

      const result = await controller.deletePhoto('photo-delete', mockAuthRequest as any);

      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);
    });

    it('should handle different photo IDs', async () => {
      mockPhotosService.deletePhoto.mockResolvedValue(undefined);

      const result1 = await controller.deletePhoto('photo-1', mockAuthRequest as any);
      const result2 = await controller.deletePhoto('photo-2', mockAuthRequest as any);

      expect(result1).toEqual({ success: true });
      expect(result2).toEqual({ success: true });
      expect(photosService.deletePhoto).toHaveBeenCalledTimes(2);
    });

    it('should verify user ownership via service', async () => {
      mockPhotosService.deletePhoto.mockResolvedValue(undefined);

      await controller.deletePhoto('photo-owned', mockAuthRequest as any);

      expect(photosService.deletePhoto).toHaveBeenCalledWith('photo-owned', 'user-123');
    });
  });

  describe('Context types', () => {
    it('should handle CHAT context type', async () => {
      const dto = {
        filename: 'chat-image.jpg',
        contentType: 'image/jpeg',
        contextType: 'CHAT' as PhotoContextType,
        contextId: 'message-123',
      };
      mockPhotosService.generateUploadUrl.mockResolvedValue(mockUploadUrlResponse);

      await controller.generateUploadUrl(mockAuthRequest as any, dto);

      expect(photosService.generateUploadUrl).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        'CHAT',
        'message-123',
      );
    });

    it('should handle INVOICE context type', async () => {
      const dto = {
        filename: 'invoice-scan.jpg',
        contentType: 'image/jpeg',
        contextType: 'INVOICE' as PhotoContextType,
        contextId: 'invoice-456',
      };
      mockPhotosService.generateUploadUrl.mockResolvedValue(mockUploadUrlResponse);

      await controller.generateUploadUrl(mockAuthRequest as any, dto);

      expect(photosService.generateUploadUrl).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        'INVOICE',
        'invoice-456',
      );
    });
  });

  describe('Authentication', () => {
    it('should use authenticated user for generateUploadUrl', async () => {
      const dto = {
        filename: 'auth-test.jpg',
        contentType: 'image/jpeg',
        contextType: 'JOB' as PhotoContextType,
        contextId: 'job-1',
      };
      mockPhotosService.generateUploadUrl.mockResolvedValue(mockUploadUrlResponse);

      await controller.generateUploadUrl(mockAuthRequest as any, dto);

      expect(photosService.generateUploadUrl).toHaveBeenCalledWith(
        mockAuthRequest.user.sub,
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
      );
    });

    it('should use authenticated user for confirmUpload', async () => {
      const dto = { width: 1920, height: 1080, size: 1024000 };
      mockPhotosService.confirmUpload.mockResolvedValue(mockPhoto);

      await controller.confirmUpload('photo-123', mockAuthRequest as any, dto);

      expect(photosService.confirmUpload).toHaveBeenCalledWith(
        'photo-123',
        mockAuthRequest.user.sub,
        dto,
      );
    });

    it('should use authenticated user for deletePhoto', async () => {
      mockPhotosService.deletePhoto.mockResolvedValue(undefined);

      await controller.deletePhoto('photo-123', mockAuthRequest as any);

      expect(photosService.deletePhoto).toHaveBeenCalledWith('photo-123', mockAuthRequest.user.sub);
    });
  });

  describe('Edge cases', () => {
    it('should handle very long filenames', async () => {
      const longFilename = 'a'.repeat(255) + '.jpg';
      const dto = {
        filename: longFilename,
        contentType: 'image/jpeg',
        contextType: 'JOB' as PhotoContextType,
        contextId: 'job-1',
      };
      mockPhotosService.generateUploadUrl.mockResolvedValue(mockUploadUrlResponse);

      await controller.generateUploadUrl(mockAuthRequest as any, dto);

      expect(photosService.generateUploadUrl).toHaveBeenCalledWith(
        expect.any(String),
        longFilename,
        expect.any(String),
        expect.any(String),
        expect.any(String),
      );
    });

    it('should handle special characters in contextId', async () => {
      const dto = {
        filename: 'test.jpg',
        contentType: 'image/jpeg',
        contextType: 'JOB' as PhotoContextType,
        contextId: 'job-with-special-!@#',
      };
      mockPhotosService.generateUploadUrl.mockResolvedValue(mockUploadUrlResponse);

      await controller.generateUploadUrl(mockAuthRequest as any, dto);

      expect(photosService.generateUploadUrl).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        'job-with-special-!@#',
      );
    });

    it('should handle concurrent photo uploads', async () => {
      const dto = {
        filename: 'concurrent.jpg',
        contentType: 'image/jpeg',
        contextType: 'JOB' as PhotoContextType,
        contextId: 'job-1',
      };
      mockPhotosService.generateUploadUrl.mockResolvedValue(mockUploadUrlResponse);

      await Promise.all([
        controller.generateUploadUrl(mockAuthRequest as any, dto),
        controller.generateUploadUrl(mockAuthRequest as any, dto),
        controller.generateUploadUrl(mockAuthRequest as any, dto),
      ]);

      expect(photosService.generateUploadUrl).toHaveBeenCalledTimes(3);
    });
  });
});
