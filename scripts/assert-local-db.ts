import "dotenv/config";
import { assertLocalDatabase } from "../prisma/local-db-guard";

// Usage: tsx scripts/assert-local-db.ts "<what is about to happen>"
assertLocalDatabase(process.env.DATABASE_URL, process.argv[2] ?? "continue");
