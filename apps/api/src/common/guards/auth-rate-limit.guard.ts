import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectThrottlerStorage, ThrottlerStorage } from '@nestjs/throttler';
import type { Request } from 'express';

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    @InjectThrottlerStorage() private readonly storage: ThrottlerStorage,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    type Req = Request & { route?: { path?: string } };
    const req = context.switchToHttp().getRequest<Req>();
    const path: string = req?.route?.path || '';
    const method: string = (req?.method || 'POST').toUpperCase();
    const ip: string = req.ip || 'anonymous';
    const keyBase = `auth:${method}:${path}:${ip}`;

    let ttl = 60;
    let limit = 10;

    if (path.includes('/signup')) {
      const baseTtl = Number(this.config.get<string>('AUTH_SIGNUP_RATE_TTL') ?? 60);
      const baseLimit = Number(this.config.get<string>('AUTH_SIGNUP_RATE_LIMIT') ?? 5);
      const roleRaw = (req?.body?.role || 'CUSTOMER').toString().toUpperCase();
      const custTtl = Number(this.config.get<string>('AUTH_SIGNUP_RATE_TTL_CUSTOMER') ?? baseTtl);
      const custLimit = Number(this.config.get<string>('AUTH_SIGNUP_RATE_LIMIT_CUSTOMER') ?? baseLimit);
      const provTtl = Number(this.config.get<string>('AUTH_SIGNUP_RATE_TTL_PROVIDER') ?? baseTtl);
      const provLimit = Number(this.config.get<string>('AUTH_SIGNUP_RATE_LIMIT_PROVIDER') ?? baseLimit);
      if (roleRaw === 'PROVIDER') {
        ttl = provTtl;
        limit = provLimit;
      } else {
        ttl = custTtl;
        limit = custLimit;
      }
    } else if (path.includes('/login')) {
      ttl = Number(this.config.get<string>('AUTH_LOGIN_RATE_TTL') ?? 60);
      limit = Number(this.config.get<string>('AUTH_LOGIN_RATE_LIMIT') ?? 10);
    }

    const key = `${keyBase}`;
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
      throw new HttpException('Too many auth attempts', HttpStatus.TOO_MANY_REQUESTS);
    }
    await store.addRecord(key, ttl);
    return true;
  }
}
