import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { raw } from 'express';
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
  app.enableCors({
    origin: origins && origins.length > 0 ? origins : true,
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('ServiceLink API')
    .setDescription('API docs for ServiceLink')
    .setVersion('0.1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
    .build();
  const doc = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, doc);

  // Ensure Prisma shutdown hooks for graceful exit
  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);

  // Use raw body for Stripe webhook verification
  app.use('/stripe/webhook', raw({ type: 'application/json' }));

  await app.listen(port);
  console.log(`API listening on http://localhost:${port}`);
  console.log(`Swagger: http://localhost:${port}/docs`);
}
bootstrap();
