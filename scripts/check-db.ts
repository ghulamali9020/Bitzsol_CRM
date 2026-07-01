import dotenv from "dotenv";
dotenv.config();

import { PrismaClient } from "../src/generated/prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL || "";
const isLocal = connectionString.includes("localhost") || connectionString.includes("127.0.0.1");

const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const users = await prisma.user.findMany();
  const pipelines = await prisma.pipeline.findMany();
  const leads = await prisma.lead.findMany();

  console.log("=== DB CHECK ===");
  console.log("Users:", users.length, users.map(u => ({ email: u.email, role: u.role })));
  console.log("Pipelines:", pipelines.length, pipelines.map(p => ({ id: p.id, name: p.name })));
  console.log("Leads:", leads.length);

  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
