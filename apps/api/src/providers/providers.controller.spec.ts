import 'reflect-metadata';
import { ProvidersController } from './providers.controller';
import { ProvidersService } from './providers.service';

describe('ProvidersController (unit)', () => {
  let controller: ProvidersController;
  const prisma: any = {
    provider: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    service: { groupBy: jest.fn() },
    category: { findMany: jest.fn() },
  };

  beforeEach(() => {
    controller = new ProvidersController({} as any as ProvidersService, prisma);
    jest.clearAllMocks();
  });

  it('search: returns paginated providers with minServicePrice (no radius)', async () => {
    prisma.provider.count.mockResolvedValue(2);
    prisma.provider.findMany.mockResolvedValue([
      {
        id: 'p1', userId: 'u1', serviceRadiusKm: 10, online: true, lat: 1, lng: 1,
        user: { email: 'a@example.com', name: 'A' },
        services: [
          { id: 's1', name: 'Lawn', price: 3000, description: 'x', category: { name: 'Home', slug: 'home' } },
          { id: 's2', name: 'Weed', price: 2000, description: 'y', category: { name: 'Home', slug: 'home' } },
        ],
      },
      {
        id: 'p2', userId: 'u2', serviceRadiusKm: null, online: false, lat: 2, lng: 2,
        user: { email: 'b@example.com', name: 'B' },
        services: [
          { id: 's3', name: 'Lawn', price: 5000, description: 'z', category: { name: 'Home', slug: 'home' } },
        ],
      },
    ]);

    const res = await controller.search({ q: 'Lawn', page: 1, take: 50, sort: 'price', order: 'asc' } as any);
    expect(res.total).toBe(2);
    expect(res.items[0].minServicePrice).toBe(2000);
    expect(res.items[1].minServicePrice).toBe(5000);
  });

  it('near: filters by radius and computes distanceKm', async () => {
    // two providers, only one within 25km of origin 0,0 (use nearby and far coords)
    prisma.provider.findMany.mockResolvedValue([
      { id: 'near', userId: 'u1', lat: 0.1, lng: 0.1, serviceRadiusKm: 100, online: true, services: [{ id: 's', name: 'X', price: 1000, category: { name: 'C', slug: 'c' } }], user: { name: 'N', email: 'n@example.com' } },
      { id: 'far', userId: 'u2', lat: 10, lng: 10, serviceRadiusKm: 1000, online: false, services: [{ id: 's2', name: 'Y', price: 2000, category: { name: 'C', slug: 'c' } }], user: { name: 'F', email: 'f@example.com' } },
    ]);
    const res = await controller.near({ lat: 0, lng: 0, radiusKm: 25, page: 1, take: 50, sort: 'distance', order: 'asc' } as any);
    expect(res.total).toBe(1);
    expect(res.items[0].id).toBe('near');
    expect(typeof res.items[0].distanceKm).toBe('number');
  });

  it('services: returns name/count pairs', async () => {
    prisma.service.groupBy.mockResolvedValue([
      { name: 'Lawn', _count: { _all: 3 } },
      { name: 'Plumbing', _count: { _all: 2 } },
    ]);
    const rows = await controller.listServices();
    expect(rows).toEqual([
      { name: 'Lawn', count: 3 },
      { name: 'Plumbing', count: 2 },
    ]);
  });

  it('categories: returns a tree', async () => {
    prisma.category.findMany.mockResolvedValue([
      { id: 'root', name: 'Home', slug: 'home', parentId: null },
      { id: 'child1', name: 'Lawn', slug: 'lawn', parentId: 'root' },
      { id: 'child2', name: 'Plumbing', slug: 'plumbing', parentId: 'root' },
    ]);
    const tree = await controller.listCategories();
    expect(tree.length).toBe(1);
    expect(tree[0].name).toBe('Home');
    expect(tree[0].children.map((c: any) => c.name).sort()).toEqual(['Lawn', 'Plumbing']);
  });
});
