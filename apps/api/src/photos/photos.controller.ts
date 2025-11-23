import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PhotosService } from './photos.service';
import { GenerateUploadUrlDto, ConfirmUploadDto } from './dto/photo.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import type { AuthedRequest } from '../common/types/request';
import { PhotoContextType } from '@prisma/client';

@ApiTags('photos')
@Controller('photos')
export class PhotosController {
  constructor(private readonly photos: PhotosService) {}

  @Post('upload-url')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Generate presigned URL for photo upload' })
  async generateUploadUrl(@Req() req: AuthedRequest, @Body() dto: GenerateUploadUrlDto) {
    return this.photos.generateUploadUrl(
      req.user.sub,
      dto.filename,
      dto.contentType,
      dto.contextType,
      dto.contextId,
    );
  }

  @Post(':id/confirm')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Confirm photo upload complete' })
  async confirmUpload(
    @Param('id') id: string,
    @Req() req: AuthedRequest,
    @Body() dto: ConfirmUploadDto,
  ) {
    return this.photos.confirmUpload(id, req.user.sub, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get photos for a context' })
  async getPhotos(
    @Query('contextType') contextType: PhotoContextType,
    @Query('contextId') contextId: string,
    @Req() req: AuthedRequest,
  ) {
    return this.photos.getPhotos(contextType, contextId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Delete a photo' })
  async deletePhoto(@Param('id') id: string, @Req() req: AuthedRequest) {
    await this.photos.deletePhoto(id, req.user.sub);
    return { success: true };
  }
}
