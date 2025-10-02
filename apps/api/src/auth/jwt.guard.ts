import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwt: JwtService, private config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const path = (req?.path || req?.url || '').split('?')[0];
    const method = (req?.method || 'GET').toUpperCase();
    const publicGetPaths = new Set([
      '/providers/search',
      '/providers/near',
      '/providers/services',
      '/providers/categories',
    ]);
    if (method === 'GET' && publicGetPaths.has(path)) {
      return true;
    }
    const auth = req.headers['authorization'] as string | undefined;
    if (!auth || !auth.startsWith('Bearer ')) throw new UnauthorizedException('Missing token');
    const token = auth.slice('Bearer '.length);
    try {
      const payload = await this.jwt.verifyAsync(token, { secret: this.config.get<string>('JWT_SECRET', 'change-me') });
      req.user = payload;
      return true;
    } catch (e) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}

// Roles decorator and guard
import { SetMetadata, ForbiddenException } from '@nestjs/common';
export const ROLES_KEY = 'roles';
// Accept both lowercase and uppercase role literals
export const Roles = (...roles: Array<'admin' | 'provider' | 'customer' | 'ADMIN' | 'PROVIDER' | 'CUSTOMER'>) =>
  SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const handler = context.getHandler();
    const classRef = context.getClass();
    const roles: string[] | undefined = Reflect.getMetadata(ROLES_KEY, handler) ?? Reflect.getMetadata(ROLES_KEY, classRef);
    if (!roles || roles.length === 0) return true;
    const role = req.user?.role as string | undefined;
    const roleNorm = role?.toString().toUpperCase();
    const allowed = new Set(roles.map((r) => r.toString().toUpperCase()));
    if (!roleNorm || !allowed.has(roleNorm)) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
