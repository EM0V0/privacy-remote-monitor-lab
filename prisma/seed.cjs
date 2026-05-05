/**
 * Seeds demo users (bcrypt), synthetic observations, and clears prior showcase rows.
 */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const demoPassword = process.env.SHOWCASE_DEMO_PASSWORD ?? "showcase";
  const hash = bcrypt.hashSync(demoPassword, 12);

  await prisma.auditEvent.deleteMany();
  await prisma.observation.deleteMany();
  await prisma.user.deleteMany();

  await prisma.user.createMany({
    data: [
      {
        email: "clinician@demo.local",
        passwordHash: hash,
        role: "CLINICIAN",
      },
      {
        email: "patient@demo.local",
        passwordHash: hash,
        role: "PATIENT",
      },
    ],
  });

  const now = Date.now();
  for (let i = 47; i >= 0; i--) {
    const createdAt = new Date(now - i * 3600000);
    const score = 32 + Math.sin(i / 4.2) * 14 + (Math.random() - 0.5) * 6;
    await prisma.observation.create({
      data: {
        createdAt,
        score: Math.min(100, Math.max(0, score)),
        source: "seed",
      },
    });
  }
}

main()
  .then(() => console.log("Seed complete."))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
