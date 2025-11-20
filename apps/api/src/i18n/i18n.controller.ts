import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { I18nService } from 'nestjs-i18n';

@ApiTags('i18n')
@Controller('i18n')
export class I18nController {
  constructor(private readonly i18n: I18nService) {}

  @Get('test')
  @ApiOperation({ summary: 'Test i18n translation' })
  @ApiQuery({ name: 'lang', required: false, description: 'Language code (en, es)', example: 'en' })
  async test(@Query('lang') lang?: string) {
    const language = lang || 'en';

    return {
      language,
      translations: {
        unauthorized: await this.i18n.translate('common.errors.unauthorized', { lang: language }),
        notFound: await this.i18n.translate('common.errors.notFound', { lang: language }),
        created: await this.i18n.translate('common.success.created', { lang: language }),
        insufficientPoints: await this.i18n.translate('common.errors.insufficientPoints', {
          lang: language,
          args: { required: 500, available: 100 },
        }),
        loyaltyTiers: {
          bronze: await this.i18n.translate('loyalty.tiers.BRONZE', { lang: language }),
          silver: await this.i18n.translate('loyalty.tiers.SILVER', { lang: language }),
          gold: await this.i18n.translate('loyalty.tiers.GOLD', { lang: language }),
          platinum: await this.i18n.translate('loyalty.tiers.PLATINUM', { lang: language }),
        },
        loyaltyMessages: {
          pointsEarned: await this.i18n.translate('loyalty.messages.pointsEarned', {
            lang: language,
            args: { points: 50, tier: 'Silver' },
          }),
          tierUpgraded: await this.i18n.translate('loyalty.messages.tierUpgraded', {
            lang: language,
            args: { tier: 'Gold' },
          }),
        },
      },
    };
  }

  @Get('languages')
  @ApiOperation({ summary: 'Get supported languages' })
  getSupportedLanguages() {
    return {
      languages: [
        { code: 'en', name: 'English', nativeName: 'English' },
        { code: 'es', name: 'Spanish', nativeName: 'Español' },
      ],
      default: 'en',
    };
  }
}
