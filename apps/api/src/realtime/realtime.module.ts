import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { RealtimeService } from './realtime.service';
import { PresenceController } from './presence.controller';
import { JobsController } from './jobs.controller';

@Module({
  imports: [PrismaModule, ConfigModule, JwtModule],
  controllers: [PresenceController, JobsController],
  providers: [RealtimeGateway, RealtimeService],
})
export class RealtimeModule {}
