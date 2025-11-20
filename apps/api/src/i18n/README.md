# Internationalization (i18n) Configuration

This directory contains the internationalization setup for the ServiceLink API using `nestjs-i18n`.

## Supported Languages

- **English (en)** - Default/fallback language
- **Spanish (es)** - Secondary language

## Directory Structure

```
i18n/
├── en/
│   ├── common.json    # Common translations (errors, validation, success messages)
│   └── loyalty.json   # Loyalty program specific translations
├── es/
│   ├── common.json    # Spanish translations for common messages
│   └── loyalty.json   # Spanish translations for loyalty program
├── i18n.module.ts     # i18n module configuration
├── i18n.controller.ts # Test endpoint for i18n
└── README.md          # This file
```

## Language Resolution

The API resolves the language in the following order:

1. **Query Parameter**: `?lang=es`
2. **Accept-Language Header**: `Accept-Language: es`
3. **Custom Header**: `X-Lang: es`
4. **Fallback**: `en` (English)

## Usage Examples

### In Controllers/Services

```typescript
import { I18nService } from 'nestjs-i18n';

export class MyService {
  constructor(private readonly i18n: I18nService) {}

  async doSomething() {
    // Simple translation
    const message = await this.i18n.translate('common.errors.notFound', {
      lang: 'es' // Optional, uses resolver if not provided
    });

    // Translation with arguments
    const error = await this.i18n.translate('common.errors.insufficientPoints', {
      lang: 'en',
      args: { required: 500, available: 100 }
    });
    // Result: "Insufficient points. Required: 500, Available: 100"
  }
}
```

### Testing Translations

Visit the test endpoint:

```bash
# Test English translations
curl http://localhost:3001/i18n/test?lang=en

# Test Spanish translations
curl http://localhost:3001/i18n/test?lang=es

# Get supported languages
curl http://localhost:3001/i18n/languages
```

### Using HTTP Headers

```bash
# Using Accept-Language header
curl -H "Accept-Language: es" http://localhost:3001/api/endpoint

# Using custom X-Lang header
curl -H "X-Lang: es" http://localhost:3001/api/endpoint
```

## Translation File Format

Translation files are JSON with nested structure:

```json
{
  "category": {
    "subcategory": "Translation text",
    "withArgs": "Text with {argument} placeholder"
  }
}
```

### Common Translations (common.json)

- `errors.*` - Error messages
- `success.*` - Success messages
- `validation.*` - Validation error messages

### Loyalty Translations (loyalty.json)

- `tiers.*` - Loyalty tier names
- `messages.*` - Loyalty-specific messages
- `rewards.*` - Reward descriptions
- `account.*` - Account field labels

## Adding New Languages

1. Create a new directory under `i18n/` (e.g., `fr/` for French)
2. Copy the structure from `en/` or `es/`
3. Translate all keys to the new language
4. Update the `getSupportedLanguages()` method in `i18n.controller.ts`

## Adding New Translation Keys

1. Add the key to all language files (en/, es/, etc.)
2. Use dot notation for nested keys: `category.subcategory.key`
3. Use curly braces for arguments: `{argName}`
4. Keep keys organized by feature/domain

## Best Practices

1. **Always provide fallback**: English should always be complete
2. **Consistent naming**: Use clear, hierarchical keys
3. **Avoid hardcoding**: Use translation keys instead of hardcoded strings
4. **Test both languages**: Verify translations work in all supported languages
5. **Use arguments**: For dynamic content, use argument placeholders instead of string concatenation

## Future Enhancements

- Add more languages (French, Portuguese, etc.)
- Implement pluralization rules
- Add date/time formatting per locale
- Add currency formatting per locale
- Create translation management UI
