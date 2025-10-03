import { Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { SttService } from './stt.service';
import { LlmController } from './llm.controller';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  controllers: [LlmController],
  providers: [LlmService, SttService],
  exports: [LlmService, SttService],
})
export class LlmModule {}
