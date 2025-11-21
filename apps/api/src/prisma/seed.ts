import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

export async function seed() {
  try {
    const hashedPassword = await bcrypt.hash('password123', 10);

    await prisma.user.upsert({
      where: { email: 'admin@example.com' },
      update: {},
      create: {
        email: 'admin@example.com',
        password: hashedPassword,
        name: 'Admin User',
        role: 'ADMIN',
      },
    });

    await prisma.user.upsert({
      where: { email: 'provider@example.com' },
      update: {},
      create: {
        email: 'provider@example.com',
        password: hashedPassword,
        name: 'Provider User',
        role: 'PROVIDER',
      },
    });

    await prisma.user.upsert({
      where: { email: 'customer@example.com' },
      update: {},
      create: {
        email: 'customer@example.com',
        password: hashedPassword,
        name: 'Customer User',
        role: 'CUSTOMER',
      },
    });

    const upsertCategory = async (name: string, slug: string, parentId?: string) => {
      const category = await prisma.category.upsert({
        where: { slug },
        update: { name, parentId: parentId || null },
        create: { name, slug, parentId: parentId || null },
        select: { id: true },
      });
      return category as { id: string };
    };

    const home = await upsertCategory('Home Services', 'home');
    const lawn = await upsertCategory('Lawn Care', 'lawn-care', home.id);
    const plumbing = await upsertCategory('Plumbing', 'plumbing', home.id);

    const providerUser = await prisma.user.findUnique({ where: { email: 'provider@example.com' }, select: { id: true } });
    const customerUser = await prisma.user.findUnique({ where: { email: 'customer@example.com' }, select: { id: true } });
    if (providerUser) {
      const provider = await prisma.provider.upsert({
        where: { userId: providerUser.id },
        update: { online: true, serviceRadiusKm: 25, lat: 37.7749, lng: -122.4194 },
        create: { userId: providerUser.id, online: true, serviceRadiusKm: 25, lat: 37.7749, lng: -122.4194 },
      });

      const existing = await prisma.service.findMany({ where: { providerId: provider.id }, select: { name: true } });
      const have = new Set(existing.map((service) => service.name));

      if (!have.has('Lawn mowing')) {
        await prisma.service.create({
          data: {
            providerId: provider.id,
            name: 'Lawn mowing',
            description: 'Basic lawn mowing up to 1/4 acre',
            price: 4000,
            categoryId: lawn.id,
          },
        });
      }
      if (!have.has('Weed removal')) {
        await prisma.service.create({
          data: {
            providerId: provider.id,
            name: 'Weed removal',
            description: 'Manual weed removal for garden beds',
            price: 3000,
            categoryId: lawn.id,
          },
        });
      }
      if (!have.has('Leak fix (basic)')) {
        await prisma.service.create({
          data: {
            providerId: provider.id,
            name: 'Leak fix (basic)',
            description: 'Fix minor leaks (parts not included)',
            price: 8000,
            categoryId: plumbing.id,
          },
        });
      }

      // Create demo job for E2E testing
      if (customerUser) {
        await prisma.job.upsert({
          where: { key: 'demo' },
          update: {},
          create: {
            key: 'demo',
            customerId: customerUser.id,
            title: 'Demo Job for E2E Testing',
            description: 'Test job for realtime chat E2E tests',
            assignment: {
              create: {
                provider: {
                  connect: { id: provider.id },
                },
                status: 'scheduled',
              },
            },
          },
        });
      }
    }

    console.log('✅ Seed data inserted successfully');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  seed().catch(() => {
    process.exit(1);
  });
}
