import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function upsertCategory(name: string, slug: string, parentId?: string) {
  const existing = await prisma.category.findUnique({ where: { slug } });
  if (existing) return existing;
  return prisma.category.create({ data: { name, slug, parentId } });
}

async function main() {
  // seed categories
  const home = await upsertCategory('Home Services', 'home-services');
  const lawn = await upsertCategory('Lawn Care', 'lawn-care', home.id);
  const plumbing = await upsertCategory('Plumbing', 'plumbing', home.id);

  await prisma.service.createMany({
    data: [
      { name: 'Mowing', categoryId: lawn.id, basePrice: 50, unit: 'fixed' },
      { name: 'Weed Whacking', categoryId: lawn.id, basePrice: 30, unit: 'fixed' },
      { name: 'Leak Repair', categoryId: plumbing.id, basePrice: 120, unit: 'hour' },
      { name: 'Drain Unclog', categoryId: plumbing.id, basePrice: 150, unit: 'fixed' },
    ],
    skipDuplicates: true,
  });

  // users: admin, customer, provider
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: { email: 'admin@example.com', role: 'admin', profile: { create: { firstName: 'Alex', lastName: 'Admin' } } },
  });

  const customer = await prisma.user.upsert({
    where: { email: 'customer@example.com' },
    update: {},
    create: { email: 'customer@example.com', role: 'customer', profile: { create: { firstName: 'Casey', lastName: 'Customer' } } },
  });

  const providerUser = await prisma.user.upsert({
    where: { email: 'provider@example.com' },
    update: {},
    create: { email: 'provider@example.com', role: 'provider', profile: { create: { firstName: 'Pat', lastName: 'Provider' } } },
  });

  await prisma.provider.upsert({
    where: { userId: providerUser.id },
    update: {},
    create: { userId: providerUser.id, companyName: 'Pro Services LLC', online: false, serviceRadiusKm: 25, kycStatus: 'pending' },
  });

  console.log('Seed complete:', { admin: admin.email, customer: customer.email, provider: providerUser.email });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
