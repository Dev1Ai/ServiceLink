import { Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { PiiModule } from '../pii/pii.module';

@Module({
  imports: [PiiModule],
  providers: [LlmService],
  exports: [LlmService],
})
export class LlmModule {}
