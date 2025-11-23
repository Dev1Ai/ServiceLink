import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, JwtModule],
  controllers: [PhotosController],
  providers: [PhotosService],
  exports: [PhotosService],
})
export class PhotosModule {}
