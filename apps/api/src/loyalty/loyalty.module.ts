import { Module } from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';
import { LoyaltyController } from './loyalty.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [LoyaltyController],
  providers: [LoyaltyService, PrismaService],
  exports: [LoyaltyService],
})
export class LoyaltyModule {}
