import { Test, TestingModule } from '@nestjs/testing';
import { I18nController } from './i18n.controller';
import { I18nService } from 'nestjs-i18n';

describe('I18nController', () => {
  let controller: I18nController;
  let i18nService: I18nService;

  const mockI18nService = {
    translate: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [I18nController],
      providers: [
        {
          provide: I18nService,
          useValue: mockI18nService,
        },
      ],
    }).compile();

    controller = module.get<I18nController>(I18nController);
    i18nService = module.get<I18nService>(I18nService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('test', () => {
    beforeEach(() => {
      mockI18nService.translate.mockImplementation((key: string, options?: any) => {
        const translations: Record<string, string> = {
          'common.errors.unauthorized': 'Unauthorized',
          'common.errors.notFound': 'Not found',
          'common.success.created': 'Created successfully',
          'common.errors.insufficientPoints': `Insufficient points. Required: ${options?.args?.required}, Available: ${options?.args?.available}`,
          'loyalty.tiers.BRONZE': 'Bronze',
          'loyalty.tiers.SILVER': 'Silver',
          'loyalty.tiers.GOLD': 'Gold',
          'loyalty.tiers.PLATINUM': 'Platinum',
          'loyalty.messages.pointsEarned': `You earned ${options?.args?.points} points! Current tier: ${options?.args?.tier}`,
          'loyalty.messages.tierUpgraded': `Congratulations! You've been upgraded to ${options?.args?.tier} tier`,
        };
        return Promise.resolve(translations[key] || key);
      });
    });

    it('should return translations for default language (en)', async () => {
      const result = await controller.test();

      expect(result).toHaveProperty('language', 'en');
      expect(result).toHaveProperty('translations');
      expect(result.translations).toHaveProperty('unauthorized');
      expect(result.translations).toHaveProperty('notFound');
      expect(result.translations).toHaveProperty('created');
      expect(result.translations).toHaveProperty('insufficientPoints');
      expect(result.translations).toHaveProperty('loyaltyTiers');
      expect(result.translations).toHaveProperty('loyaltyMessages');
    });

    it('should return translations for English when lang=en', async () => {
      const result = await controller.test('en');

      expect(result.language).toBe('en');
      expect(i18nService.translate).toHaveBeenCalledWith('common.errors.unauthorized', { lang: 'en' });
      expect(i18nService.translate).toHaveBeenCalledWith('common.errors.notFound', { lang: 'en' });
      expect(i18nService.translate).toHaveBeenCalledWith('common.success.created', { lang: 'en' });
    });

    it('should return translations for Spanish when lang=es', async () => {
      const result = await controller.test('es');

      expect(result.language).toBe('es');
      expect(i18nService.translate).toHaveBeenCalledWith('common.errors.unauthorized', { lang: 'es' });
      expect(i18nService.translate).toHaveBeenCalledWith('common.errors.notFound', { lang: 'es' });
      expect(i18nService.translate).toHaveBeenCalledWith('common.success.created', { lang: 'es' });
    });

    it('should translate error messages', async () => {
      const result = await controller.test('en');

      expect(result.translations.unauthorized).toBe('Unauthorized');
      expect(result.translations.notFound).toBe('Not found');
    });

    it('should translate success messages', async () => {
      const result = await controller.test('en');

      expect(result.translations.created).toBe('Created successfully');
    });

    it('should translate messages with arguments', async () => {
      const result = await controller.test('en');

      expect(result.translations.insufficientPoints).toContain('500');
      expect(result.translations.insufficientPoints).toContain('100');
      expect(i18nService.translate).toHaveBeenCalledWith(
        'common.errors.insufficientPoints',
        expect.objectContaining({
          lang: 'en',
          args: { required: 500, available: 100 },
        }),
      );
    });

    it('should translate all loyalty tiers', async () => {
      const result = await controller.test('en');

      expect(result.translations.loyaltyTiers).toEqual({
        bronze: 'Bronze',
        silver: 'Silver',
        gold: 'Gold',
        platinum: 'Platinum',
      });
      expect(i18nService.translate).toHaveBeenCalledWith('loyalty.tiers.BRONZE', { lang: 'en' });
      expect(i18nService.translate).toHaveBeenCalledWith('loyalty.tiers.SILVER', { lang: 'en' });
      expect(i18nService.translate).toHaveBeenCalledWith('loyalty.tiers.GOLD', { lang: 'en' });
      expect(i18nService.translate).toHaveBeenCalledWith('loyalty.tiers.PLATINUM', { lang: 'en' });
    });

    it('should translate loyalty messages with arguments', async () => {
      const result = await controller.test('en');

      expect(result.translations.loyaltyMessages.pointsEarned).toContain('50');
      expect(result.translations.loyaltyMessages.pointsEarned).toContain('Silver');
      expect(i18nService.translate).toHaveBeenCalledWith(
        'loyalty.messages.pointsEarned',
        expect.objectContaining({
          lang: 'en',
          args: { points: 50, tier: 'Silver' },
        }),
      );
    });

    it('should translate tier upgrade message with arguments', async () => {
      const result = await controller.test('en');

      expect(result.translations.loyaltyMessages.tierUpgraded).toContain('Gold');
      expect(i18nService.translate).toHaveBeenCalledWith(
        'loyalty.messages.tierUpgraded',
        expect.objectContaining({
          lang: 'en',
          args: { tier: 'Gold' },
        }),
      );
    });

    it('should make all translation calls with correct keys', async () => {
      await controller.test('en');

      const expectedCalls = [
        'common.errors.unauthorized',
        'common.errors.notFound',
        'common.success.created',
        'common.errors.insufficientPoints',
        'loyalty.tiers.BRONZE',
        'loyalty.tiers.SILVER',
        'loyalty.tiers.GOLD',
        'loyalty.tiers.PLATINUM',
        'loyalty.messages.pointsEarned',
        'loyalty.messages.tierUpgraded',
      ];

      expectedCalls.forEach((key) => {
        expect(i18nService.translate).toHaveBeenCalledWith(key, expect.any(Object));
      });
    });

    it('should call translate 10 times (once per translation key)', async () => {
      await controller.test('en');

      expect(i18nService.translate).toHaveBeenCalledTimes(10);
    });

    it('should handle custom language codes', async () => {
      const result = await controller.test('fr');

      expect(result.language).toBe('fr');
      expect(i18nService.translate).toHaveBeenCalledWith('common.errors.unauthorized', { lang: 'fr' });
    });

    it('should default to en when no language specified', async () => {
      const result = await controller.test(undefined);

      expect(result.language).toBe('en');
      expect(i18nService.translate).toHaveBeenCalledWith('common.errors.unauthorized', { lang: 'en' });
    });

    it('should default to en when empty string passed', async () => {
      const result = await controller.test('');

      expect(result.language).toBe('en');
    });

    it('should return structured response with all sections', async () => {
      const result = await controller.test('en');

      expect(result).toEqual({
        language: 'en',
        translations: {
          unauthorized: expect.any(String),
          notFound: expect.any(String),
          created: expect.any(String),
          insufficientPoints: expect.any(String),
          loyaltyTiers: {
            bronze: expect.any(String),
            silver: expect.any(String),
            gold: expect.any(String),
            platinum: expect.any(String),
          },
          loyaltyMessages: {
            pointsEarned: expect.any(String),
            tierUpgraded: expect.any(String),
          },
        },
      });
    });
  });

  describe('getSupportedLanguages', () => {
    it('should return supported languages list', () => {
      const result = controller.getSupportedLanguages();

      expect(result).toHaveProperty('languages');
      expect(result).toHaveProperty('default');
      expect(Array.isArray(result.languages)).toBe(true);
    });

    it('should return English and Spanish', () => {
      const result = controller.getSupportedLanguages();

      expect(result.languages).toHaveLength(2);
      expect(result.languages[0]).toEqual({
        code: 'en',
        name: 'English',
        nativeName: 'English',
      });
      expect(result.languages[1]).toEqual({
        code: 'es',
        name: 'Spanish',
        nativeName: 'Español',
      });
    });

    it('should return en as default language', () => {
      const result = controller.getSupportedLanguages();

      expect(result.default).toBe('en');
    });

    it('should include language codes', () => {
      const result = controller.getSupportedLanguages();

      const codes = result.languages.map((l) => l.code);
      expect(codes).toContain('en');
      expect(codes).toContain('es');
    });

    it('should include language names', () => {
      const result = controller.getSupportedLanguages();

      const names = result.languages.map((l) => l.name);
      expect(names).toContain('English');
      expect(names).toContain('Spanish');
    });

    it('should include native language names', () => {
      const result = controller.getSupportedLanguages();

      const nativeNames = result.languages.map((l) => l.nativeName);
      expect(nativeNames).toContain('English');
      expect(nativeNames).toContain('Español');
    });

    it('should return consistent data structure', () => {
      const result1 = controller.getSupportedLanguages();
      const result2 = controller.getSupportedLanguages();

      expect(result1).toEqual(result2);
    });

    it('should not call i18nService', () => {
      controller.getSupportedLanguages();

      expect(i18nService.translate).not.toHaveBeenCalled();
    });
  });

  describe('Integration', () => {
    it('should handle multiple sequential calls', async () => {
      await controller.test('en');
      await controller.test('es');
      controller.getSupportedLanguages();

      expect(i18nService.translate).toHaveBeenCalledTimes(20);
    });

    it('should maintain service isolation between calls', async () => {
      const result1 = await controller.test('en');
      jest.clearAllMocks();
      const result2 = await controller.test('es');

      expect(result1.language).toBe('en');
      expect(result2.language).toBe('es');
      expect(i18nService.translate).toHaveBeenCalledTimes(10);
    });
  });

  describe('Edge cases', () => {
    it('should handle null language gracefully', async () => {
      const result = await controller.test(null as any);

      expect(result.language).toBe('en');
    });

    it('should handle undefined language gracefully', async () => {
      const result = await controller.test(undefined);

      expect(result.language).toBe('en');
    });

    it('should handle numeric language code', async () => {
      const result = await controller.test('123' as any);

      expect(result.language).toBe('123');
      expect(i18nService.translate).toHaveBeenCalledWith('common.errors.unauthorized', { lang: '123' });
    });

    it('should handle special characters in language code', async () => {
      const result = await controller.test('en-US');

      expect(result.language).toBe('en-US');
    });
  });
});
