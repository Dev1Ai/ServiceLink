/**
 * API Bootstrap
 * - Loads env, optional Sentry, sets up Swagger, global validation, and metrics
 * - Enables CORS (CORS_ORIGIN env or all origins in dev)
 * - Provides raw body for Stripe webhook verification
 */
import 'dotenv/config';
// Optional Sentry init
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Sentry = require('@sentry/node');
  if (process.env.SENTRY_DSN) {
    Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.0 });
    console.log('Sentry initialized');
  }
} catch {}
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { MetricsHttpHelper, MetricsService } from './metrics/metrics.service';
import { raw } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT || 3001;

  // Enable CORS (allow specific origins via CORS_ORIGIN env, fallback to all in dev)
  const origins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined;

  // In production, require explicit CORS_ORIGIN configuration
  const corsOrigin = origins && origins.length > 0
    ? origins
    : process.env.NODE_ENV === 'production'
      ? false  // Reject all origins if CORS_ORIGIN not set in production
      : true;  // Allow all in development

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  if (process.env.NODE_ENV === 'production' && !origins) {
    console.warn('⚠️  WARNING: CORS_ORIGIN not set in production - all origins rejected');
  }

  const config = new DocumentBuilder()
    .setTitle('ServiceLink API')
    .setDescription('API docs for ServiceLink')
    .setVersion('0.1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
    .build();
  const doc = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, doc);

  // Global validation
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());

  // HTTP request duration metrics
  try {
    const metrics = app.get(MetricsService);
    const helper = new MetricsHttpHelper(metrics);
    app.use((req: Request & { route?: { path?: string } }, res: Response, next: NextFunction) => {
      const start = process.hrtime.bigint();
      res.on('finish', () => {
        const delta = Number(process.hrtime.bigint() - start) / 1e9;
        const route = req?.route?.path || req?.originalUrl || req?.url || '/';
        helper.record(req.method, route, res.statusCode, delta);
      });
      next();
    });
  } catch {}

  // Ensure Prisma shutdown hooks for graceful exit
  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);

  // Use raw body for Stripe webhook verification
  app.use('/webhooks/stripe', raw({ type: 'application/json' }));

  await app.listen(port);
  console.log(`API listening on http://localhost:${port}`);
  console.log(`Swagger: http://localhost:${port}/docs`);
}
bootstrap();
