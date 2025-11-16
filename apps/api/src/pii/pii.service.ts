import { Injectable } from '@nestjs/common';

@Injectable()
export class PiiService {
  // Basic regex for email
  private readonly emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/g;
  // Basic regex for phone numbers (matches various formats)
  private readonly phoneRegex = /(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;

  /**
   * Redacts PII (emails, phone numbers) from a given text.
   * @param text The input text to redact.
   * @returns The redacted text.
   */
  redact(text: string): string {
    if (!text) return '';
    
    let redactedText = text.replace(this.emailRegex, '[REDACTED_EMAIL]');
    redactedText = redactedText.replace(this.phoneRegex, '[REDACTED_PHONE]');
    
    // A more advanced implementation could use an NER model to find names.
    // For now, we will leave names as they are.

    return redactedText;
  }
}
