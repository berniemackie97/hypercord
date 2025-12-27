import type { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import type { Middleware } from "./middleware.js";
import { executeMiddleware, errorHandlerMiddleware } from "./middleware.js";

/**
 * Enhanced command interface with middleware support
 */
export interface EnhancedCommand {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  middlewares?: Middleware[];
}

/**
 * Command builder with fluent API for adding middleware
 */
export class CommandBuilder {
  private commandData: SlashCommandBuilder;
  private handler: (interaction: ChatInputCommandInteraction) => Promise<void>;
  private middlewares: Middleware[] = [];

  constructor(data: SlashCommandBuilder) {
    this.commandData = data;
    this.handler = async () => {
      throw new Error("Command handler not set");
    };
  }

  /**
   * Set the command handler
   */
  setHandler(handler: (interaction: ChatInputCommandInteraction) => Promise<void>): this {
    this.handler = handler;
    return this;
  }

  /**
   * Add middleware to the command
   */
  use(middleware: Middleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Add multiple middlewares
   */
  useMany(middlewares: Middleware[]): this {
    this.middlewares.push(...middlewares);
    return this;
  }

  /**
   * Build the final command object
   */
  build(): EnhancedCommand {
    // Always add error handler as the first middleware
    const allMiddlewares = [errorHandlerMiddleware(), ...this.middlewares];

    return {
      data: this.commandData,
      execute: async (interaction: ChatInputCommandInteraction) => {
        await executeMiddleware(interaction, allMiddlewares, this.handler);
      },
      middlewares: allMiddlewares,
    };
  }
}

/**
 * Create a new command builder
 */
export function createCommand(data: SlashCommandBuilder): CommandBuilder {
  return new CommandBuilder(data);
}
