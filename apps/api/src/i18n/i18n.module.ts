import { Module } from '@nestjs/common';
import { I18nModule as NestI18nModule, AcceptLanguageResolver, QueryResolver, HeaderResolver } from 'nestjs-i18n';
import * as path from 'path';
import { I18nController } from './i18n.controller';

@Module({
  imports: [
    NestI18nModule.forRoot({
      fallbackLanguage: 'en',
      loaderOptions: {
        path: path.join(__dirname, '/'),
        watch: true,
      },
      resolvers: [
        { use: QueryResolver, options: ['lang'] }, // ?lang=es
        AcceptLanguageResolver, // Accept-Language header
        new HeaderResolver(['x-lang']), // X-Lang header
      ],
    }),
  ],
  controllers: [I18nController],
})
export class I18nConfigModule {}
