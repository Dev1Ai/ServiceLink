import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectThrottlerStorage, ThrottlerStorage } from "@nestjs/throttler";
import type { Request } from "express";

@Injectable()
export class QuotesRoleLimitGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    @InjectThrottlerStorage() private readonly storage: ThrottlerStorage,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    type Req = Request & { user?: { role?: string; sub?: string } };
    const req = context.switchToHttp().getRequest<Req>();
    const role = (req?.user?.role || "").toString().toUpperCase();
    if (role === "ADMIN") return true; // bypass
    const userKey = req?.user?.sub || req.ip || "anonymous";

    // Resolve per-role limits with fallbacks
    const baseTtl = Number(this.config.get<string>("QUOTES_RATE_TTL") ?? 60);
    const baseLimit = Number(this.config.get<string>("QUOTES_RATE_LIMIT") ?? 5);
    const custTtl = Number(
      this.config.get<string>("QUOTES_RATE_TTL_CUSTOMER") ?? baseTtl,
    );
    const custLimit = Number(
      this.config.get<string>("QUOTES_RATE_LIMIT_CUSTOMER") ?? baseLimit,
    );
    const provTtl = Number(
      this.config.get<string>("QUOTES_RATE_TTL_PROVIDER") ?? baseTtl,
    );
    const provLimit = Number(
      this.config.get<string>("QUOTES_RATE_LIMIT_PROVIDER") ?? baseLimit,
    );

    let ttl = baseTtl;
    let limit = baseLimit;
    if (role === "CUSTOMER") {
      ttl = custTtl;
      limit = custLimit;
    } else if (role === "PROVIDER") {
      ttl = provTtl;
      limit = provLimit;
    }

    const key = `quotes:${userKey}`;
    const ttlMs = Math.max(0, ttl) * 1000;
    type IncrementStore = {
      increment(
        key: string,
        ttl: number,
      ): Promise<{ totalHits: number; timeToExpire: number }>;
    };
    const store = this.storage as unknown as IncrementStore;
    const { totalHits, timeToExpire } = await store.increment(key, ttlMs);
    if (totalHits > limit) {
      try {
        const res = context.switchToHttp().getResponse();
        res.set("Retry-After", String(timeToExpire));
      } catch {}
      throw new HttpException(
        "Rate limit exceeded for quotes operations",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
