import { seed } from "../src/prisma/seed";

seed().catch(() => {
  process.exit(1);
});
