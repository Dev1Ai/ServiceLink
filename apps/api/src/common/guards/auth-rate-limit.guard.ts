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
export class AuthRateLimitGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    @InjectThrottlerStorage() private readonly storage: ThrottlerStorage,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    type Req = Request & { route?: { path?: string } };
    const req = context.switchToHttp().getRequest<Req>();
    const path: string = req?.route?.path || "";
    const method: string = (req?.method || "POST").toUpperCase();
    const ip: string = req.ip || "anonymous";
    const keyBase = `auth:${method}:${path}:${ip}`;

    let ttl = 60;
    let limit = 10;

    if (path.includes("/signup")) {
      const baseTtl = Number(
        this.config.get<string>("AUTH_SIGNUP_RATE_TTL") ?? 60,
      );
      const baseLimit = Number(
        this.config.get<string>("AUTH_SIGNUP_RATE_LIMIT") ?? 5,
      );
      const roleRaw = (req?.body?.role || "CUSTOMER").toString().toUpperCase();
      const custTtl = Number(
        this.config.get<string>("AUTH_SIGNUP_RATE_TTL_CUSTOMER") ?? baseTtl,
      );
      const custLimit = Number(
        this.config.get<string>("AUTH_SIGNUP_RATE_LIMIT_CUSTOMER") ?? baseLimit,
      );
      const provTtl = Number(
        this.config.get<string>("AUTH_SIGNUP_RATE_TTL_PROVIDER") ?? baseTtl,
      );
      const provLimit = Number(
        this.config.get<string>("AUTH_SIGNUP_RATE_LIMIT_PROVIDER") ?? baseLimit,
      );
      if (roleRaw === "PROVIDER") {
        ttl = provTtl;
        limit = provLimit;
      } else {
        ttl = custTtl;
        limit = custLimit;
      }
    } else if (path.includes("/login")) {
      ttl = Number(this.config.get<string>("AUTH_LOGIN_RATE_TTL") ?? 60);
      limit = Number(this.config.get<string>("AUTH_LOGIN_RATE_LIMIT") ?? 10);
    }

    const key = `${keyBase}`;
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
        "Too many auth attempts",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
