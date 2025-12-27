import { z } from "zod";
import type { ChatInputCommandInteraction, CommandInteractionOptionResolver } from "discord.js";
import type { Middleware } from "./middleware.js";

/**
 * Extract and validate command options using Zod schema
 * @param interaction - Discord interaction
 * @param schema - Zod schema for validation
 * @returns Validated options
 */
export function validateOptions<T extends z.ZodType>(
  interaction: ChatInputCommandInteraction,
  schema: T
): z.infer<T> {
  const options = interaction.options as CommandInteractionOptionResolver;

  // Extract all options into an object
  const data: Record<string, any> = {};

  // Get all option data from the interaction
  const optionsData = (options as any).data;
  if (optionsData) {
    for (const option of optionsData) {
      data[option.name] = option.value;
    }
  }

  // Validate with Zod
  return schema.parse(data);
}

/**
 * Create a validation middleware
 * @param schema - Zod schema for validation
 * @param onError - Optional custom error handler
 */
export function validationMiddleware<T extends z.ZodType>(
  schema: T,
  onError?: (interaction: ChatInputCommandInteraction, error: z.ZodError) => Promise<void>
): Middleware {
  return async (interaction, next) => {
    try {
      // Validate options
      const validated = validateOptions(interaction, schema);

      // Attach validated data to interaction
      (interaction as any).validatedOptions = validated;

      await next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        if (onError) {
          await onError(interaction, error);
        } else {
          // Default error handling
          const errors = (error.errors || [])
            .map((e) => `${e.path.join(".")}: ${e.message}`)
            .join("\n");

          await interaction.reply({
            content: `❌ **Validation Error:**\n\`\`\`\n${errors || "Invalid input"}\n\`\`\``,
            ephemeral: true,
          });
        }
        return;
      }
      throw error;
    }
  };
}

/**
 * Common Zod schemas for Discord command options
 */
export const schemas = {
  /** Discord snowflake ID (user, role, channel, etc.) */
  snowflake: z.string().regex(/^\d{17,19}$/, "Invalid Discord ID"),

  /** Duration string (e.g., "10m", "2h", "3d") */
  duration: z.string().regex(/^\d+[smhd]$/, "Invalid duration format (use 10s, 5m, 2h, or 1d)"),

  /** URL */
  url: z.string().url("Invalid URL"),

  /** Hex color code */
  hexColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color (use format: #RRGGBB)"),

  /** Positive integer */
  positiveInt: z.number().int().positive("Must be a positive integer"),

  /** Non-negative integer */
  nonNegativeInt: z.number().int().nonnegative("Must be a non-negative integer"),

  /** Percentage (0-100) */
  percentage: z.number().min(0).max(100, "Must be between 0 and 100"),
};

/**
 * Helper to get validated options from interaction
 * (Type-safe alternative to direct access)
 */
export function getValidatedOptions<T>(interaction: ChatInputCommandInteraction): T {
  return (interaction as any).validatedOptions as T;
}
