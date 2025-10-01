import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectThrottlerStorage, ThrottlerStorage } from '@nestjs/throttler';
import type { Request } from 'express';

@Injectable()
export class ProvidersRoleLimitGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    @InjectThrottlerStorage() private readonly storage: ThrottlerStorage,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    type Req = Request & { user?: { role?: string; sub?: string } };
    const req = context.switchToHttp().getRequest<Req>();
    const role = (req?.user?.role || '').toString().toUpperCase();
    if (role === 'ADMIN') return true; // bypass
    const userKey = req?.user?.sub || req.ip || 'anonymous';

    const baseTtl = Number(this.config.get<string>('PROVIDERS_RATE_TTL') ?? 60);
    const baseLimit = Number(this.config.get<string>('PROVIDERS_RATE_LIMIT') ?? 5);
    const provTtl = Number(this.config.get<string>('PROVIDERS_RATE_TTL_PROVIDER') ?? baseTtl);
    const provLimit = Number(this.config.get<string>('PROVIDERS_RATE_LIMIT_PROVIDER') ?? baseLimit);

    // For non-providers, fall back to base
    const ttl = role === 'PROVIDER' ? provTtl : baseTtl;
    const limit = role === 'PROVIDER' ? provLimit : baseLimit;

    const key = `providers:${userKey}`;
    const ttlMs = Math.max(0, ttl) * 1000;
    type IncrementStore = {
      increment(key: string, ttl: number): Promise<{ totalHits: number; timeToExpire: number }>;
    };
    const store = this.storage as unknown as IncrementStore;
    const { totalHits, timeToExpire } = await store.increment(key, ttlMs);
    if (totalHits > limit) {
      try {
        const res = context.switchToHttp().getResponse();
        res.set('Retry-After', String(timeToExpire));
      } catch {}
      throw new HttpException('Rate limit exceeded for provider actions', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
