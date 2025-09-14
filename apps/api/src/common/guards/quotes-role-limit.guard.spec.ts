import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { QuotesRoleLimitGuard } from './quotes-role-limit.guard';
import { ExecutionContext, HttpException } from '@nestjs/common';

class MemoryStorage {
  private store = new Map<string, number[]>();
  async getRecord(key: string): Promise<number[]> {
    return this.store.get(key) || [];
  }
  async addRecord(key: string, _ttl: number): Promise<void> {
    const arr = this.store.get(key) || [];
    arr.push(Date.now());
    this.store.set(key, arr);
  }
}

const ctxWithReq = (req: any): ExecutionContext => ({
  switchToHttp: () => ({ getRequest: () => req }),
  getClass: () => ({} as any),
  getHandler: () => ({} as any),
  getArgs: () => [] as any,
  getArgByIndex: () => ({} as any),
  switchToRpc: () => ({} as any),
  switchToWs: () => ({} as any),
  getType: () => 'http',
}) as any;

describe('QuotesRoleLimitGuard', () => {
  let guard: QuotesRoleLimitGuard;
  let storage: MemoryStorage;
  const cfg = new ConfigService({
    QUOTES_RATE_TTL: '60',
    QUOTES_RATE_LIMIT: '5',
    QUOTES_RATE_TTL_CUSTOMER: '60',
    QUOTES_RATE_LIMIT_CUSTOMER: '2',
    QUOTES_RATE_TTL_PROVIDER: '60',
    QUOTES_RATE_LIMIT_PROVIDER: '3',
  } as any);

  beforeEach(() => {
    storage = new MemoryStorage();
    guard = new QuotesRoleLimitGuard(cfg, storage as any);
  });

  it('bypasses admin', async () => {
    const ctx = ctxWithReq({ user: { role: 'ADMIN', sub: 'admin1' } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('enforces customer limit (2/min)', async () => {
    const ctx = ctxWithReq({ user: { role: 'CUSTOMER', sub: 'cust1' } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(HttpException);
  });

  it('enforces provider limit (3/min)', async () => {
    const ctx = ctxWithReq({ user: { role: 'PROVIDER', sub: 'prov1' } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(HttpException);
  });

  it('uses IP when unauthenticated', async () => {
    const ctx = ctxWithReq({ ip: '127.0.0.1' });
    // base limit is 5
    for (let i = 0; i < 5; i++) {
      // Should pass until the 6th
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    }
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(HttpException);
  });
});
