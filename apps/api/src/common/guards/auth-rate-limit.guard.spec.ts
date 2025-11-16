import "reflect-metadata";
import { ConfigService } from "@nestjs/config";
import { AuthRateLimitGuard } from "./auth-rate-limit.guard";
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

const ctxWithReq = (
  path: string,
  body?: any,
  ip = "127.0.0.1",
): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ route: { path }, method: "POST", body, ip }),
    }),
    getClass: () => ({}) as any,
    getHandler: () => ({}) as any,
    getArgs: () => [] as any,
    getArgByIndex: () => ({}) as any,
    switchToRpc: () => ({}) as any,
    switchToWs: () => ({}) as any,
    getType: () => "http",
  }) as any;

describe("AuthRateLimitGuard", () => {
  let guard: AuthRateLimitGuard;
  let storage: MemoryStorage;
  const cfg = new ConfigService({
    AUTH_SIGNUP_RATE_TTL: "60",
    AUTH_SIGNUP_RATE_LIMIT: "5",
    AUTH_SIGNUP_RATE_TTL_PROVIDER: "60",
    AUTH_SIGNUP_RATE_LIMIT_PROVIDER: "2",
    AUTH_LOGIN_RATE_TTL: "60",
    AUTH_LOGIN_RATE_LIMIT: "2",
  } as any);

  beforeEach(() => {
    storage = new MemoryStorage();
    guard = new AuthRateLimitGuard(cfg, storage as any);
  });

  it("limits signup by intended role (provider stricter)", async () => {
    const ctx = ctxWithReq("/auth/signup", { role: "PROVIDER" });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(HttpException);
  });

  it("limits login by IP", async () => {
    const ctx = ctxWithReq("/auth/login");
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(HttpException);
  });
});
