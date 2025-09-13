import { PrismaClient, Role, ProviderKycStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const hash = (s: string) => bcrypt.hash(s, 10);

async function main() {
  // helper: upsert user + profile (+ provider if requested)
  const upsertUser = async (email: string, role: Role, withProvider = false) => {
    const passwordHash = await hash('password123');

    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, passwordHash, role },
    });

    await prisma.profile.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, firstName: email.split('@')[0] },
    });

    if (withProvider) {
      await prisma.provider.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          kycStatus: ProviderKycStatus.PENDING,
          serviceRadiusKm: 25,
        },
      });
    }
  };

  await upsertUser('admin@example.com', Role.ADMIN);
  await upsertUser('customer@example.com', Role.CUSTOMER);
  await upsertUser('provider@example.com', Role.PROVIDER, true);

  console.log('✅ Seed complete');
}

main().finally(() => prisma.$disconnect());
