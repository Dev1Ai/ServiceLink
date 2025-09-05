import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT || 3001;

  const config = new DocumentBuilder()
    .setTitle('ServiceLink API')
    .setDescription('API docs for ServiceLink')
    .setVersion('0.1.0')
    .build();
  const doc = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, doc);

  await app.listen(port);
  console.log(`API listening on http://localhost:${port}`);
  console.log(`Swagger: http://localhost:${port}/docs`);
}
bootstrap();
