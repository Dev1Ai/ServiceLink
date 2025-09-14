import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { collectDefaultMetrics, register } from 'prom-client';

let registered = false;

@ApiExcludeController()
@Controller('metrics')
export class MetricsController {
  constructor() {
    if (!registered) {
      collectDefaultMetrics();
      registered = true;
    }
  }

  @Get()
  @Header('Content-Type', register.contentType)
  async metrics() {
    return register.metrics();
  }
}

