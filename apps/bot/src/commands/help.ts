import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { createCommand } from "../core/commandBuilder.js";
import { loggingMiddleware } from "../core/middleware.js";
import { rateLimitMiddleware } from "../core/rateLimiter.js";

/**
 * Help command - Display bot commands and features
 *
 * Features:
 * - Categorized command list
 * - Usage examples
 * - Links to documentation
 */

const commandData = new SlashCommandBuilder()
  .setName("help")
  .setDescription("View all available commands and their usage")
  .setDMPermission(true);

export const { data, execute } = createCommand(commandData)
  .use(loggingMiddleware())
  .use(
    rateLimitMiddleware({
      max: 3,
      window: 10000, // 3 uses per 10 seconds
      scope: "user",
    })
  )
  .setHandler(async (interaction) => {
    const embed = new EmbedBuilder()
      .setTitle("📚 Hypercord Help")
      .setDescription("Welcome to Hypercord! Here are all available commands.")
      .setColor(0x5865f2)
      .addFields(
        {
          name: "🛠️ Utility",
          value:
            "• `/ping` - Check bot latency\n" +
            "• `/userinfo [user]` - Get detailed user information\n" +
            "• `/remind <when> <what>` - Schedule a reminder",
        },
        {
          name: "🔨 Moderation",
          value:
            "• `/ban <user> [reason]` - Ban a member\n" +
            "• `/kick <user> [reason]` - Kick a member\n" +
            "• `/audit-perms` - Audit server permissions",
        },
        {
          name: "⚙️ Administration",
          value: "• `/diagnose` - System health diagnostics",
        },
        {
          name: "💡 Tips",
          value:
            "• All moderation commands are logged\n" +
            "• Rate limits prevent command spam\n" +
            "• Use `/command` to see detailed options",
        }
      )
      .setFooter({
        text: `Bot v${process.env.npm_package_version ?? "dev"} • Made with ❤️`,
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  })
  .build();
