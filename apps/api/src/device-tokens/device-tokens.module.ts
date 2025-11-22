import { Module } from '@nestjs/common';
import { DeviceTokensController } from './device-tokens.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [DeviceTokensController],
  providers: [PrismaService],
})
export class DeviceTokensModule {}
