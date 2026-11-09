import type { ChatInputCommandInteraction } from "discord.js";
import type { CommandDefinition } from "./client.js";
import { executeMiddleware, errorHandlerMiddleware, type Middleware } from "./middleware.js";

/**
 * Enhanced command interface with middleware support
 */
export interface EnhancedCommand {
  data: CommandDefinition;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  middlewares?: Middleware[];
}

/**
 * Command builder with fluent API for adding middleware
 */
export class CommandBuilder {
  private commandData: CommandDefinition;
  private handler: (interaction: ChatInputCommandInteraction) => Promise<void>;
  private middlewares: Middleware[] = [];

  constructor(data: CommandDefinition) {
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
export function createCommand(data: CommandDefinition): CommandBuilder {
  return new CommandBuilder(data);
}
