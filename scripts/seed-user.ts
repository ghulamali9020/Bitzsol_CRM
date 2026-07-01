import dotenv from "dotenv";
dotenv.config();

import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL || "";
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const isLocal = connectionString.includes("localhost") || connectionString.includes("127.0.0.1");

const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = "maazhassancrm121@gmail.com";
  const password = "password123";
  const hashedPassword = await bcrypt.hash(password, 12);

  console.log(`Seeding user: ${email}...`);

  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase().trim() },
    update: {
      password: hashedPassword,
      name: "Maaz Hassan",
      role: "admin",
      status: "active",
    },
    create: {
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      name: "Maaz Hassan",
      role: "admin",
      status: "active",
    },
  });

  console.log("User successfully seeded:", {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
  });

  const pipelinesToSeed = ["LinkedIn", "Fiverr", "Upwork"];
  for (const pipelineName of pipelinesToSeed) {
    console.log(`Checking for default pipeline: "${pipelineName}"...`);
    const existingPipeline = await prisma.pipeline.findFirst({
      where: { name: pipelineName },
    });

    if (!existingPipeline) {
      const pipeline = await prisma.pipeline.create({
        data: {
          name: pipelineName,
          description: `Pipeline for leads imported from ${pipelineName}`,
          createdById: user.id,
        },
      });
      console.log(`Pipeline successfully seeded:`, pipeline);
    } else {
      console.log(`Pipeline already exists:`, existingPipeline.id);
    }
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error("Error seeding user:", err);
  process.exit(1);
});
