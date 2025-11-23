import { Module } from '@nestjs/common';
import { DeviceTokensController } from './device-tokens.controller';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [DeviceTokensController],
  providers: [PrismaService],
})
export class DeviceTokensModule {}
