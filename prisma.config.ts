import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";

const resolvedUrl = databaseUrl.startsWith("file:")
  ? "file:" + path.resolve(process.cwd(), databaseUrl.slice("file:".length))
  : databaseUrl;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: resolvedUrl,
  },
});
