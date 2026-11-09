import "dotenv/config";
import { z } from "zod";

const nonEmpty = z.string().trim().min(1);
const commaSeparatedIds = z.string().transform((value) =>
  value.split(",").map((id) => id.trim()).filter(Boolean)
);

export const envSchema = z.object({
  BOT_TOKEN: nonEmpty,
  CLIENT_ID: nonEmpty,
  GUILD_ID: z.string().trim().optional(),
  DATABASE_URL: nonEmpty,
  REDIS_URL: nonEmpty,
  OPENAI_API_KEY: z.string().trim().optional(),
  ANTHROPIC_API_KEY: z.string().trim().optional(),
  GEMINI_API_KEY: z.string().trim().optional(),
  GROK_API_KEY: z.string().trim().optional(),
  ADMIN_USER_IDS: z.preprocess(
    (value) => (typeof value === "string" ? value : ""),
    commaSeparatedIds
  ),
  ADMIN_ROLE_IDS: z.preprocess(
    (value) => (typeof value === "string" ? value : ""),
    commaSeparatedIds
  ),
});

export const env = envSchema.parse(process.env);
