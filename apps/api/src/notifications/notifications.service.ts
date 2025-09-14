import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  async notifyQuoteCreated(jobId: string, quoteId: string, providerId: string) {
    this.logger.log(`Quote created: job=${jobId} quote=${quoteId} provider=${providerId}`);
  }

  async notifyQuoteAccepted(jobId: string, quoteId: string, providerId: string) {
    this.logger.log(`Quote accepted: job=${jobId} quote=${quoteId} provider=${providerId}`);
  }

  async notifyAcceptanceRevoked(jobId: string, quoteId: string) {
    this.logger.log(`Acceptance revoked: job=${jobId} quote=${quoteId}`);
  }
}

