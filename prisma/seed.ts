import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // seed categories
  const home = await prisma.category.create({data: {name: 'Home Services', slug: 'home-services'}});
  const lawn = await prisma.category.create({data: {name: 'Lawn Care', slug: 'lawn-care', parentId: home.id}});
  const plumbing = await prisma.category.create({data: {name: 'Plumbing', slug: 'plumbing', parentId: home.id}});

  await prisma.service.createMany({
    data: [
      { name: 'Mowing', categoryId: lawn.id, basePrice: 50, unit: 'fixed' },
      { name: 'Weed Whacking', categoryId: lawn.id, basePrice: 30, unit: 'fixed' },
      { name: 'Leak Repair', categoryId: plumbing.id, basePrice: 120, unit: 'hour' },
      { name: 'Drain Unclog', categoryId: plumbing.id, basePrice: 150, unit: 'fixed' },
    ]
  });

  // create a demo customer and provider
  const customer = await prisma.user.create({
    data: { email: 'customer@example.com', role: 'customer', profile: { create: { firstName: 'Casey', lastName: 'Customer' } } }
  });
  const providerUser = await prisma.user.create({
    data: { email: 'provider@example.com', role: 'provider', profile: { create: { firstName: 'Pat', lastName: 'Provider' } } }
  });
  await prisma.provider.create({ data: { userId: providerUser.id, companyName: 'Pro Services LLC', online: false, serviceRadiusKm: 25 } });

  console.log('Seed complete:', { customer: customer.email, provider: providerUser.email });
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
