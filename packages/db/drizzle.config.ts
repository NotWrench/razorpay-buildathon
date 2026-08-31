import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load from local or root .env
config({ path: "../../.env" });
config();

const databaseUrl =
  process.env.DATABASE_URL ||
  "postgres://postgres:postgres@localhost:5443/razorpay_project";

export default defineConfig({
  dbCredentials: {
    url: databaseUrl,
  },
  dialect: "postgresql",
  out: "./drizzle",
  schema: "./src/schema/index.ts",
});
