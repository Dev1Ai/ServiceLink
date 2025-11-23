import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PrismaService } from '../prisma/prisma.service';
import { PhotoContextType } from '@prisma/client';
import * as sharp from 'sharp';

/**
 * PhotosService - Manages photo uploads and storage
 * Part of M11 Phase 3: Photo Management
 */
@Injectable()
export class PhotosService {
  private readonly logger = new Logger(PhotosService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly region: string;
  private readonly maxFileSize = 10 * 1024 * 1024; // 10MB
  private readonly allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

  constructor(private readonly prisma: PrismaService) {
    // Initialize S3 client
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.bucketName = process.env.AWS_S3_BUCKET || 'servicelink-photos';

    this.s3Client = new S3Client({
      region: this.region,
      credentials: process.env.AWS_ACCESS_KEY_ID
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
          }
        : undefined,
    });

    this.logger.log(`PhotosService initialized with bucket: ${this.bucketName}`);
  }

  /**
   * Generate presigned URL for direct upload
   */
  async generateUploadUrl(
    userId: string,
    filename: string,
    contentType: string,
    contextType: PhotoContextType,
    contextId: string,
  ): Promise<{ uploadUrl: string; photoId: string; key: string }> {
    // Validate content type
    if (!this.allowedMimeTypes.includes(contentType)) {
      throw new BadRequestException(
        `Invalid content type. Allowed: ${this.allowedMimeTypes.join(', ')}`,
      );
    }

    // Generate unique key
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `photos/${contextType.toLowerCase()}/${contextId}/${timestamp}-${randomId}-${sanitizedFilename}`;

    // Create photo record
    const photo = await this.prisma.photo.create({
      data: {
        userId,
        url: `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`,
        filename: sanitizedFilename,
        contentType,
        size: 0, // Will be updated after upload
        contextType,
        contextId,
      },
    });

    // Generate presigned URL (valid for 15 minutes)
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 15 * 60, // 15 minutes
    });

    this.logger.log(`Generated upload URL for photo ${photo.id}`);

    return {
      uploadUrl,
      photoId: photo.id,
      key,
    };
  }

  /**
   * Confirm photo upload and update metadata
   */
  async confirmUpload(
    photoId: string,
    userId: string,
    metadata?: {
      size?: number;
      width?: number;
      height?: number;
    },
  ): Promise<any> {
    const photo = await this.prisma.photo.findUnique({
      where: { id: photoId },
    });

    if (!photo) {
      throw new BadRequestException('Photo not found');
    }

    if (photo.userId !== userId) {
      throw new BadRequestException('Not authorized');
    }

    // Update photo metadata
    const updated = await this.prisma.photo.update({
      where: { id: photoId },
      data: {
        size: metadata?.size || 0,
        width: metadata?.width,
        height: metadata?.height,
      },
    });

    this.logger.log(`Photo upload confirmed: ${photoId}`);

    // TODO: Trigger thumbnail generation
    // this.generateThumbnail(photoId).catch(err => {
    //   this.logger.error(`Failed to generate thumbnail for ${photoId}:`, err);
    // });

    return updated;
  }

  /**
   * Get photos for a context
   */
  async getPhotos(
    contextType: PhotoContextType,
    contextId: string,
    userId?: string,
  ): Promise<any[]> {
    return this.prisma.photo.findMany({
      where: {
        contextType,
        contextId,
        ...(userId && { userId }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Delete a photo
   */
  async deletePhoto(photoId: string, userId: string): Promise<void> {
    const photo = await this.prisma.photo.findUnique({
      where: { id: photoId },
    });

    if (!photo) {
      throw new BadRequestException('Photo not found');
    }

    if (photo.userId !== userId) {
      throw new BadRequestException('Not authorized');
    }

    // Extract key from URL
    const key = photo.url.split('.amazonaws.com/')[1];

    if (key) {
      // Delete from S3
      try {
        const command = new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        });

        await this.s3Client.send(command);
        this.logger.log(`Deleted photo from S3: ${key}`);
      } catch (error) {
        this.logger.error(`Failed to delete photo from S3:`, error);
      }
    }

    // Delete from database
    await this.prisma.photo.delete({
      where: { id: photoId },
    });

    this.logger.log(`Deleted photo: ${photoId}`);
  }

  /**
   * Generate thumbnail (future implementation)
   */
  private async generateThumbnail(photoId: string): Promise<void> {
    // TODO: Implement thumbnail generation with sharp
    // 1. Download original from S3
    // 2. Resize to thumbnail (e.g., 200x200)
    // 3. Upload thumbnail to S3
    // 4. Update photo record with thumbnail URL
    this.logger.debug(`Thumbnail generation not yet implemented for ${photoId}`);
  }
}
