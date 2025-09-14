import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectThrottlerStorage, ThrottlerStorage } from '@nestjs/throttler';
import type { Request } from 'express';

@Injectable()
export class QuotesRoleLimitGuard implements CanActivate {
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

    // Resolve per-role limits with fallbacks
    const baseTtl = Number(this.config.get<string>('QUOTES_RATE_TTL') ?? 60);
    const baseLimit = Number(this.config.get<string>('QUOTES_RATE_LIMIT') ?? 5);
    const custTtl = Number(this.config.get<string>('QUOTES_RATE_TTL_CUSTOMER') ?? baseTtl);
    const custLimit = Number(this.config.get<string>('QUOTES_RATE_LIMIT_CUSTOMER') ?? baseLimit);
    const provTtl = Number(this.config.get<string>('QUOTES_RATE_TTL_PROVIDER') ?? baseTtl);
    const provLimit = Number(this.config.get<string>('QUOTES_RATE_LIMIT_PROVIDER') ?? baseLimit);

    let ttl = baseTtl;
    let limit = baseLimit;
    if (role === 'CUSTOMER') {
      ttl = custTtl;
      limit = custLimit;
    } else if (role === 'PROVIDER') {
      ttl = provTtl;
      limit = provLimit;
    }

    const key = `quotes:${userKey}`;
    const now = Date.now();
    type RateStore = { getRecord(key: string): Promise<number[]>; addRecord(key: string, ttl: number): Promise<void> };
    const store = this.storage as unknown as RateStore;
    const records: number[] = (await store.getRecord(key)) || [];
    const windowStart = now - ttl * 1000;
    const recent = records.filter((ts) => ts > windowStart);
    if (recent.length >= limit) {
      try {
        const res = context.switchToHttp().getResponse();
        res.set('Retry-After', String(ttl));
      } catch {}
      throw new HttpException('Rate limit exceeded for quotes operations', HttpStatus.TOO_MANY_REQUESTS);
    }
    await store.addRecord(key, ttl);
    return true;
  }
}
