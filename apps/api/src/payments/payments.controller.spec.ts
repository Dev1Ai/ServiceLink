import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController, PaymentsWebhookController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard, RolesGuard } from '../auth/jwt.guard';
import type { JwtUser } from '../common/types/request';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let service: PaymentsService;

  const mockJwtUser: JwtUser = {
    sub: 'user-1',
    role: 'CUSTOMER',
    email: 'test@example.com',
  };

  const mockPaymentsService = {
    createPaymentIntent: jest.fn().mockResolvedValue({ clientSecret: 'test_secret' }),
    capturePayment: jest.fn().mockResolvedValue({ status: 'succeeded' }),
    createRefund: jest.fn().mockResolvedValue({ status: 'succeeded' }),
    // Add other methods as needed for tests
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        {
          provide: PaymentsService,
          useValue: mockPaymentsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PaymentsController>(PaymentsController);
    service = module.get<PaymentsService>(PaymentsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createIntent', () => {
    it('should create a payment intent', async () => {
      const jobId = 'job-1';
      const dto = { amount: 1000 };
      const req = { user: mockJwtUser };

      await controller.createIntent(jobId, req as any, dto);
      expect(service.createPaymentIntent).toHaveBeenCalledWith(jobId, dto.amount, mockJwtUser.sub);
    });
  });

  describe('capture', () => {
    it('should capture a payment', async () => {
      const jobId = 'job-1';
      await controller.capture(jobId);
      expect(service.capturePayment).toHaveBeenCalledWith(jobId);
    });
  });

  describe('refund', () => {
    it('should create a refund', async () => {
      const paymentId = 'payment-1';
      const dto = { amount: 500, reason: 'test reason' };
      const req = { user: mockJwtUser };

      await controller.refund(paymentId, req as any, dto);
      expect(service.createRefund).toHaveBeenCalledWith(
        paymentId,
        dto.amount,
        dto.reason,
        mockJwtUser.sub,
      );
    });
  });
});

describe('PaymentsWebhookController', () => {
  let controller: PaymentsWebhookController;
  let service: PaymentsService;

  const mockPaymentsService = {
    handleWebhook: jest.fn().mockResolvedValue({ received: true }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsWebhookController],
      providers: [
        {
          provide: PaymentsService,
          useValue: mockPaymentsService,
        },
      ],
    }).compile();

    controller = module.get<PaymentsWebhookController>(PaymentsWebhookController);
    service = module.get<PaymentsService>(PaymentsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('handleWebhook', () => {
    it('should handle a webhook', async () => {
      const req = { rawBody: Buffer.from('{}') };
      const signature = 'test_signature';
      await controller.handleWebhook(req as any, signature);
      expect(service.handleWebhook).toHaveBeenCalledWith('{}', signature);
    });
  });
});
