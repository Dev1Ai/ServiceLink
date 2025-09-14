import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { ProvidersRoleLimitGuard } from './providers-role-limit.guard';
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

describe('ProvidersRoleLimitGuard', () => {
  let guard: ProvidersRoleLimitGuard;
  let storage: MemoryStorage;
  const cfg = new ConfigService({
    PROVIDERS_RATE_TTL: '60',
    PROVIDERS_RATE_LIMIT: '5',
    PROVIDERS_RATE_TTL_PROVIDER: '60',
    PROVIDERS_RATE_LIMIT_PROVIDER: '2',
  } as any);

  beforeEach(() => {
    storage = new MemoryStorage();
    guard = new ProvidersRoleLimitGuard(cfg, storage as any);
  });

  it('bypasses admin', async () => {
    const ctx = ctxWithReq({ user: { role: 'ADMIN', sub: 'a1' } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('limits provider actions (2/min)', async () => {
    const ctx = ctxWithReq({ user: { role: 'PROVIDER', sub: 'p1' } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(HttpException);
  });
});
