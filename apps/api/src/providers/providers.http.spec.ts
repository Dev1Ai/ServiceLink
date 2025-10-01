import 'reflect-metadata';
import { BadRequestException, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ProvidersController } from './providers.controller';
import { ProvidersService } from './providers.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard, RolesGuard } from '../auth/jwt.guard';
import { ProvidersRoleLimitGuard } from '../common/guards/providers-role-limit.guard';
import { SearchRoleLimitGuard } from '../common/guards/search-role-limit.guard';
import { SearchProvidersQueryDto, NearProvidersQueryDto } from './dto/search.dto';
import { AssignmentsService } from '../jobs/assignments.service';

describe('Providers HTTP (E2E-lite)', () => {
  let app: INestApplication;
  let controller: ProvidersController;
  let pipe: ValidationPipe;
  const prisma: any = {
    provider: { findMany: jest.fn(), count: jest.fn() },
    service: { groupBy: jest.fn() },
    category: { findMany: jest.fn() },
  };
  const assignments = {
    completeAssignmentAsProvider: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProvidersController],
      providers: [
        ProvidersService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: {} },
        { provide: AssignmentsService, useValue: assignments },
      ],
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
    pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
    app.useGlobalPipes(pipe);
    await app.init();
    controller = app.get(ProvidersController);
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
    const query = await pipe.transform(
      { q: 'Lawn', page: 1, take: 10, sort: 'price', order: 'asc' },
      { type: 'query', metatype: SearchProvidersQueryDto },
    );
    const result = await controller.search(query);
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.total).toBe(1);
  });

  it('GET /providers/near requires coords', async () => {
    await expect(
      pipe.transform({ radiusKm: 10 }, { type: 'query', metatype: NearProvidersQueryDto }),
    ).rejects.toThrow(BadRequestException);
  });

  it('GET /providers/near returns providers within radius sorted by distance', async () => {
    prisma.provider.findMany.mockResolvedValue([
      {
        id: 'nearby',
        userId: 'u1',
        lat: 0,
        lng: 0,
        serviceRadiusKm: null,
        online: true,
        services: [
          { id: 's1', name: 'Electrical', price: 2500, category: { name: 'Home', slug: 'home' } },
          { id: 's2', name: 'Plumbing', price: 4000, category: { name: 'Home', slug: 'home' } },
        ],
        user: { name: 'Nearby Provider', email: 'near@example.com' },
      },
      {
        id: 'mid',
        userId: 'u2',
        lat: 0.12,
        lng: 0.05,
        serviceRadiusKm: 30,
        online: false,
        services: [
          { id: 's3', name: 'Electrical', price: 6000, category: { name: 'Home', slug: 'home' } },
        ],
        user: { name: 'Mid Provider', email: 'mid@example.com' },
      },
      {
        id: 'far',
        userId: 'u3',
        lat: 1,
        lng: 1,
        serviceRadiusKm: 50,
        online: true,
        services: [
          { id: 's4', name: 'Electrical', price: 2000, category: { name: 'Home', slug: 'home' } },
        ],
        user: { name: 'Far Provider', email: 'far@example.com' },
      },
    ]);

    const query = await pipe.transform(
      { lat: 0, lng: 0, radiusKm: 25, take: 10, page: 1 },
      { type: 'query', metatype: NearProvidersQueryDto },
    );
    const result = await controller.near(query);
    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].id).toBe('nearby');
    expect(result.items[0].distanceKm).toBeCloseTo(0, 5);
    expect(result.items[0].minServicePrice).toBe(2500);
    expect(result.items[1].id).toBe('mid');
    expect(result.items[1].distanceKm).toBeGreaterThan(10);
    expect(result.items[1].distanceKm).toBeLessThan(20);
    expect(result.hasNext).toBe(false);
  });

  it('GET /providers/near excludes providers outside their service radius', async () => {
    prisma.provider.findMany.mockResolvedValue([
      {
        id: 'limited',
        userId: 'u1',
        lat: 0.2,
        lng: 0.2,
        serviceRadiusKm: 5,
        online: true,
        services: [
          { id: 's1', name: 'Electrical', price: 2000, category: { name: 'Home', slug: 'home' } },
        ],
        user: { name: 'Limited Provider', email: 'limited@example.com' },
      },
    ]);

    const query = await pipe.transform(
      { lat: 0, lng: 0, radiusKm: 50 },
      { type: 'query', metatype: NearProvidersQueryDto },
    );
    const result = await controller.near(query);
    expect(result.total).toBe(0);
    expect(result.items).toHaveLength(0);
  });
});
