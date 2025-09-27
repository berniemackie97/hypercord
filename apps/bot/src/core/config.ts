import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  BOT_TOKEN: z.string().min(1),
  CLIENT_ID: z.string().min(1),
  GUILD_ID: z.string().optional(),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1)
});

export const env = envSchema.parse(process.env);
