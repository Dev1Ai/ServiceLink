import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { JobsRoleLimitGuard } from './jobs-role-limit.guard';
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

describe('JobsRoleLimitGuard', () => {
  let guard: JobsRoleLimitGuard;
  let storage: MemoryStorage;
  const cfg = new ConfigService({
    JOBS_RATE_TTL: '60',
    JOBS_RATE_LIMIT: '10',
    JOBS_RATE_TTL_CUSTOMER: '60',
    JOBS_RATE_LIMIT_CUSTOMER: '2',
    JOBS_RATE_TTL_PROVIDER: '60',
    JOBS_RATE_LIMIT_PROVIDER: '3',
  } as any);

  beforeEach(() => {
    storage = new MemoryStorage();
    guard = new JobsRoleLimitGuard(cfg, storage as any);
  });

  it('bypasses admin', async () => {
    const ctx = ctxWithReq({ user: { role: 'ADMIN', sub: 'a1' } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('enforces customer limit (2/min)', async () => {
    const ctx = ctxWithReq({ user: { role: 'CUSTOMER', sub: 'c1' } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(HttpException);
  });

  it('enforces provider limit (3/min)', async () => {
    const ctx = ctxWithReq({ user: { role: 'PROVIDER', sub: 'p1' } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(HttpException);
  });
});
