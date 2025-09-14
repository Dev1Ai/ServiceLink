import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { SearchRoleLimitGuard } from './search-role-limit.guard';
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

describe('SearchRoleLimitGuard', () => {
  let guard: SearchRoleLimitGuard;
  let storage: MemoryStorage;
  const cfg = new ConfigService({
    SEARCH_RATE_TTL: '60',
    SEARCH_RATE_LIMIT: '30',
    SEARCH_RATE_TTL_CUSTOMER: '60',
    SEARCH_RATE_LIMIT_CUSTOMER: '3',
    SEARCH_RATE_TTL_PROVIDER: '60',
    SEARCH_RATE_LIMIT_PROVIDER: '4',
  } as any);

  beforeEach(() => {
    storage = new MemoryStorage();
    guard = new SearchRoleLimitGuard(cfg, storage as any);
  });

  it('bypasses admin', async () => {
    const ctx = ctxWithReq({ user: { role: 'ADMIN', sub: 'a1' } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('enforces customer limit (3/min)', async () => {
    const ctx = ctxWithReq({ user: { role: 'CUSTOMER', sub: 'c1' } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(HttpException);
  });

  it('enforces provider limit (4/min)', async () => {
    const ctx = ctxWithReq({ user: { role: 'PROVIDER', sub: 'p1' } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(HttpException);
  });
});
