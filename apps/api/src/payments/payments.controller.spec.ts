import 'reflect-metadata';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

const paymentsService = {
  listPendingPayouts: jest.fn(),
  approvePayout: jest.fn(),
  denyPayout: jest.fn(),
} as unknown as PaymentsService;

describe('PaymentsController', () => {
  let controller: PaymentsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new PaymentsController(paymentsService);
  });

  it('returns pending payouts', async () => {
    (paymentsService.listPendingPayouts as jest.Mock).mockResolvedValueOnce([{ id: 'assign1' }]);
    const result = await controller.pending();
    expect(result).toEqual([{ id: 'assign1' }]);
    expect(paymentsService.listPendingPayouts).toHaveBeenCalled();
  });

  it('approves payout', async () => {
    (paymentsService.approvePayout as jest.Mock).mockResolvedValueOnce({ id: 'assign1', payoutStatus: 'APPROVED' });
    const result = await controller.approve('assign1', { user: { sub: 'admin1' } } as any);
    expect(result).toEqual({ id: 'assign1', payoutStatus: 'APPROVED' });
    expect(paymentsService.approvePayout).toHaveBeenCalledWith('assign1', 'admin1');
  });

  it('denies payout', async () => {
    (paymentsService.denyPayout as jest.Mock).mockResolvedValueOnce({ id: 'assign1', payoutStatus: 'BLOCKED' });
    const result = await controller.deny('assign1', { user: { sub: 'admin1' } } as any, { reason: 'fraud' });
    expect(result).toEqual({ id: 'assign1', payoutStatus: 'BLOCKED' });
    expect(paymentsService.denyPayout).toHaveBeenCalledWith('assign1', 'admin1');
  });
});
