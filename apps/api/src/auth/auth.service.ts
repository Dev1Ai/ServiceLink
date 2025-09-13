import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async signup(email: string, password: string, name: string, role?: string) {
    const hashed = await bcrypt.hash(password, 10);
    const normalizedRole = (role ?? 'CUSTOMER').toUpperCase();
    const roleEnum: Role = (['CUSTOMER', 'PROVIDER', 'ADMIN'].includes(normalizedRole) ? normalizedRole : 'CUSTOMER') as Role;
    // Derive first/last from name when possible; fallback to empty strings to satisfy schema
    const [firstName, ...rest] = (name ?? '').trim().split(/\s+/);
    const lastName = rest.join(' ');
    return this.prisma.user.create({
      data: {
        email,
        name,
        password: hashed,
        role: roleEnum,
        profile: {
          create: {
            firstName: firstName ?? '',
            lastName: lastName ?? '',
          },
        },
      },
    });
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async me(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
        provider: {
          select: {
            id: true,
            kycStatus: true,
            stripeAccountId: true,
            online: true,
            serviceRadiusKm: true,
          },
        },
      },
    });
  }
}
