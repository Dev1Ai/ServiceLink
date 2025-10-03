import { Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { SttService } from './stt.service';
import { LlmController } from './llm.controller';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [LlmController],
  providers: [LlmService, SttService],
  exports: [LlmService, SttService],
})
export class LlmModule {}
