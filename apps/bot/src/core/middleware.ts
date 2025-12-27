import type { ChatInputCommandInteraction } from "discord.js";
import { log } from "./logger.js";

/**
 * Middleware function type
 */
export type Middleware = (
  interaction: ChatInputCommandInteraction,
  next: () => Promise<void>
) => Promise<void>;

/**
 * Middleware context for storing data between middleware
 */
export interface MiddlewareContext {
  [key: string]: any;
}

/**
 * Execute middleware chain
 * @param interaction - Discord interaction
 * @param middlewares - Array of middleware functions
 * @param handler - Final command handler
 */
export async function executeMiddleware(
  interaction: ChatInputCommandInteraction,
  middlewares: Middleware[],
  handler: (interaction: ChatInputCommandInteraction) => Promise<void>
): Promise<void> {
  let index = 0;

  const next = async (): Promise<void> => {
    if (index < middlewares.length) {
      const middleware = middlewares[index++];
      await middleware(interaction, next);
    } else {
      // All middleware passed, execute the handler
      await handler(interaction);
    }
  };

  try {
    await next();
  } catch (error) {
    log.error(
      {
        error,
        command: interaction.commandName,
        user: interaction.user.id,
        guild: interaction.guildId,
      },
      "middleware execution failed"
    );
    throw error;
  }
}

/**
 * Create a middleware that logs command execution
 */
export function loggingMiddleware(): Middleware {
  return async (interaction, next) => {
    const start = Date.now();

    log.info(
      {
        command: interaction.commandName,
        user: interaction.user.tag,
        userId: interaction.user.id,
        guild: interaction.guild?.name,
        guildId: interaction.guildId,
      },
      "command executed"
    );

    await next();

    const duration = Date.now() - start;
    log.debug({ command: interaction.commandName, duration }, "command completed");
  };
}

/**
 * Create a middleware that validates user permissions
 * @param permissions - Required Discord permissions
 */
export function permissionMiddleware(permissions: bigint[]): Middleware {
  return async (interaction, next) => {
    if (!interaction.guild || !interaction.member) {
      await interaction.reply({
        content: "❌ This command can only be used in a server.",
        ephemeral: true,
      });
      return;
    }

    const member = interaction.member as any;
    const hasPermission = permissions.every((perm) => member.permissions.has(perm));

    if (!hasPermission) {
      await interaction.reply({
        content: "❌ You don't have permission to use this command.",
        ephemeral: true,
      });
      return;
    }

    await next();
  };
}

/**
 * Create a middleware that checks if command is guild-only
 */
export function guildOnlyMiddleware(): Middleware {
  return async (interaction, next) => {
    if (!interaction.guild) {
      await interaction.reply({
        content: "❌ This command can only be used in a server.",
        ephemeral: true,
      });
      return;
    }

    await next();
  };
}

/**
 * Create a middleware that checks if user is bot owner
 * @param ownerIds - Array of bot owner user IDs
 */
export function ownerOnlyMiddleware(ownerIds: string[]): Middleware {
  return async (interaction, next) => {
    if (!ownerIds.includes(interaction.user.id)) {
      await interaction.reply({
        content: "❌ This command is restricted to bot owners only.",
        ephemeral: true,
      });
      return;
    }

    await next();
  };
}

/**
 * Create a middleware that defers the reply (for long-running commands)
 * @param ephemeral - Whether to defer ephemerally
 */
export function deferMiddleware(ephemeral = false): Middleware {
  return async (interaction, next) => {
    await interaction.deferReply({ ephemeral });
    await next();
  };
}

/**
 * Create a middleware that catches and handles errors
 */
export function errorHandlerMiddleware(): Middleware {
  return async (interaction, next) => {
    try {
      await next();
    } catch (error) {
      log.error(
        {
          error,
          command: interaction.commandName,
          user: interaction.user.id,
        },
        "command error"
      );

      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";

      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({
            content: `❌ Error: ${errorMessage}`,
          });
        } else {
          await interaction.reply({
            content: `❌ Error: ${errorMessage}`,
            ephemeral: true,
          });
        }
      } catch (replyError) {
        log.error({ error: replyError }, "failed to send error message");
      }
    }
  };
}
