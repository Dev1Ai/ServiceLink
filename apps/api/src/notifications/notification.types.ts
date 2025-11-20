export enum NotificationType {
  JOB_CREATED = 'JOB_CREATED',
  QUOTE_RECEIVED = 'QUOTE_RECEIVED',
  QUOTE_ACCEPTED = 'QUOTE_ACCEPTED',
  QUOTE_REJECTED = 'QUOTE_REJECTED',
  JOB_ASSIGNED = 'JOB_ASSIGNED',
  JOB_SCHEDULED = 'JOB_SCHEDULED',
  JOB_COMPLETED = 'JOB_COMPLETED',
  PAYMENT_CAPTURED = 'PAYMENT_CAPTURED',
  REVIEW_RECEIVED = 'REVIEW_RECEIVED',
  LOYALTY_TIER_UPGRADED = 'LOYALTY_TIER_UPGRADED',
  SCHEDULE_REMINDER = 'SCHEDULE_REMINDER',
}

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface NotificationTemplate {
  type: NotificationType;
  title: string;
  body: string;
  priority: 'high' | 'normal';
  data?: Record<string, string>;
}
