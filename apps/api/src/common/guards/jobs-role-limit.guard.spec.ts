import "reflect-metadata";
import { ConfigService } from "@nestjs/config";
import { JobsRoleLimitGuard } from "./jobs-role-limit.guard";
import { ExecutionContext, HttpException } from "@nestjs/common";

class MemoryStorage {
  private store = new Map<string, { totalHits: number; expiresAt: number }>();
  async increment(
    key: string,
    ttlMs: number,
  ): Promise<{ totalHits: number; timeToExpire: number }> {
    const now = Date.now();
    const existing = this.store.get(key);
    if (!existing || existing.expiresAt <= now) {
      const expiresAt = now + ttlMs;
      this.store.set(key, { totalHits: 1, expiresAt });
      return { totalHits: 1, timeToExpire: Math.ceil(ttlMs / 1000) };
    }
    existing.totalHits += 1;
    this.store.set(key, existing);
    return {
      totalHits: existing.totalHits,
      timeToExpire: Math.max(0, Math.ceil((existing.expiresAt - now) / 1000)),
    };
  }
}

const ctxWithReq = (req: any): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => req }),
    getClass: () => ({}) as any,
    getHandler: () => ({}) as any,
    getArgs: () => [] as any,
    getArgByIndex: () => ({}) as any,
    switchToRpc: () => ({}) as any,
    switchToWs: () => ({}) as any,
    getType: () => "http",
  }) as any;

describe("JobsRoleLimitGuard", () => {
  let guard: JobsRoleLimitGuard;
  let storage: MemoryStorage;
  const cfg = new ConfigService({
    JOBS_RATE_TTL: "60",
    JOBS_RATE_LIMIT: "10",
    JOBS_RATE_TTL_CUSTOMER: "60",
    JOBS_RATE_LIMIT_CUSTOMER: "2",
    JOBS_RATE_TTL_PROVIDER: "60",
    JOBS_RATE_LIMIT_PROVIDER: "3",
  } as any);

  beforeEach(() => {
    storage = new MemoryStorage();
    guard = new JobsRoleLimitGuard(cfg, storage as any);
  });

  it("bypasses admin", async () => {
    const ctx = ctxWithReq({ user: { role: "ADMIN", sub: "a1" } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it("enforces customer limit (2/min)", async () => {
    const ctx = ctxWithReq({ user: { role: "CUSTOMER", sub: "c1" } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(HttpException);
  });

  it("enforces provider limit (3/min)", async () => {
    const ctx = ctxWithReq({ user: { role: "PROVIDER", sub: "p1" } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(HttpException);
  });
});
