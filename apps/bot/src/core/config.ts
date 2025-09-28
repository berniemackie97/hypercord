import "dotenv/config";
import { z } from "zod";

// helper to split comma-separated IDs into string arrays
const csv = z
  .string()
  .transform((s) =>
    s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
  );

const envSchema = z.object({
  BOT_TOKEN: z.string().min(1),
  CLIENT_ID: z.string().min(1),
  GUILD_ID: z.string().optional(),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  // Optional allowlists for elevated commands
  ADMIN_USER_IDS: z.preprocess((v) => (typeof v === "string" ? v : ""), csv).optional(),
  ADMIN_ROLE_IDS: z.preprocess((v) => (typeof v === "string" ? v : ""), csv).optional(),
});

export const env = envSchema.parse(process.env);
