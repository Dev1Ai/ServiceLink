import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ProvidersController } from './providers.controller';
import { ProvidersService } from './providers.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard, RolesGuard } from '../auth/jwt.guard';
import { ProvidersRoleLimitGuard } from '../common/guards/providers-role-limit.guard';
import { SearchRoleLimitGuard } from '../common/guards/search-role-limit.guard';

describe('Providers HTTP (E2E-lite)', () => {
  let app: INestApplication;
  const prisma: any = {
    provider: { findMany: jest.fn(), count: jest.fn() },
    service: { groupBy: jest.fn() },
    category: { findMany: jest.fn() },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProvidersController],
      providers: [ProvidersService, { provide: PrismaService, useValue: prisma }, { provide: ConfigService, useValue: {} }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ProvidersRoleLimitGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(SearchRoleLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => jest.clearAllMocks());

  it('GET /providers/search returns items', async () => {
    prisma.provider.count.mockResolvedValue(1);
    prisma.provider.findMany.mockResolvedValue([
      {
        id: 'p1', userId: 'u1', serviceRadiusKm: 10, online: true, lat: 1, lng: 1,
        user: { email: 'a@example.com', name: 'A' },
        services: [{ id: 's1', name: 'Lawn', price: 3000, description: 'x', category: { name: 'Home', slug: 'home' } }],
      },
    ]);
    await request(app.getHttpServer())
      .get('/providers/search?q=Lawn&page=1&take=10&sort=price&order=asc')
      .expect(200)
      .expect(({ body }) => {
        expect(Array.isArray(body.items)).toBe(true);
        expect(body.total).toBe(1);
      });
  });

  it('GET /providers/near requires coords', async () => {
    await request(app.getHttpServer()).get('/providers/near?radiusKm=10').expect(400);
  });
});
