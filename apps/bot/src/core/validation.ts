import { z } from "zod";
import type { ChatInputCommandInteraction } from "discord.js";
import type { Middleware } from "./middleware.js";
import { sendPrivateError } from "./interactionError.js";

type Option = {
  name: string;
  value?: unknown;
  options?: readonly Option[];
};

const validatedOptions = new WeakMap<ChatInputCommandInteraction, unknown>();

function collectOptions(options: readonly Option[]): Record<string, unknown> {
  const result: Record<string, unknown> = Object.create(null);
  for (const option of options) {
    result[option.name] = option.options
      ? collectOptions(option.options)
      : option.value;
  }
  return result;
}

export function validateOptions<T extends z.ZodType>(
  interaction: ChatInputCommandInteraction,
  schema: T,
): z.output<T> {
  return schema.parse(collectOptions(interaction.options.data));
}

export function validationMiddleware<T extends z.ZodType>(
  schema: T,
  onError?: (interaction: ChatInputCommandInteraction, error: z.ZodError) => Promise<void>,
): Middleware {
  return async (interaction, next) => {
    const result = schema.safeParse(collectOptions(interaction.options.data));
    if (!result.success) {
      if (onError) {
        await onError(interaction, result.error);
      } else {
        const details = result.error.issues.slice(0, 3).map((issue) => {
          const path = issue.path.join(".");
          return path ? `${path}: ${issue.message}` : issue.message;
        }).join("; ");
        await sendPrivateError(interaction, `Invalid command options: ${details}`);
      }
      return;
    }

    validatedOptions.set(interaction, result.data);
    await next();
  };
}

export function getValidatedOptions<T>(interaction: ChatInputCommandInteraction): T {
  const result = validatedOptions.get(interaction);
  if (result === undefined) {
    throw new Error("Command options were not validated");
  }
  return result as T;
}

export const schemas = {
  snowflake: z.string().regex(/^\d{17,19}$/, "Invalid Discord ID"),
  duration: z.string().regex(/^\d+[smhd]$/, "Invalid duration format (use 10s, 5m, 2h, or 1d)"),
  url: z.string().url("Invalid URL"),
  hexColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color (use format: #RRGGBB)"),
  positiveInt: z.number().int().positive("Must be a positive integer"),
  nonNegativeInt: z.number().int().nonnegative("Must be a non-negative integer"),
  percentage: z.number().min(0).max(100, "Must be between 0 and 100"),
};
