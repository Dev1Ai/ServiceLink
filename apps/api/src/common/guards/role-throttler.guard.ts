import { ExecutionContext, Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import type { Request } from "express";

@Injectable()
export class RoleAwareThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(
    req: Request & { user?: { sub?: string } },
  ): Promise<string> {
    // Prefer stable user id over IP when authenticated
    return Promise.resolve(req?.user?.sub || req.ip || "anonymous");
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: { role?: string } }>();
    const role = (req?.user?.role || "").toString().toUpperCase();
    if (role === "ADMIN") return true; // bypass
    return super.canActivate(context);
  }
}
