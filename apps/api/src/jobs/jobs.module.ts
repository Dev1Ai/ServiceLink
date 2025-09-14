import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { MetricsModule } from '../metrics/metrics.module';
import { QuotesService } from './quotes.service';
import { NotificationsService } from '../notifications/notifications.service';

@Module({
  imports: [PrismaModule, JwtModule, ConfigModule, MetricsModule],
  controllers: [JobsController],
  providers: [QuotesService, NotificationsService],
})
export class JobsModule {}
