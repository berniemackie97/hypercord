import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { createCommand } from "../core/commandBuilder.js";
import { loggingMiddleware, permissionMiddleware, guildOnlyMiddleware } from "../core/middleware.js";
import { rateLimitMiddleware } from "../core/rateLimiter.js";
import { db } from "../db/index.js";
import { aiUserAccess } from "../db/schema.js";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import { ensureUser } from "../db/utils.js";

const commandData = new SlashCommandBuilder()
  .setName("ai-grant")
  .setDescription("Grant AI access to a user")
  .addUserOption((o) => o.setName("user").setDescription("User to grant access").setRequired(true))
  .addStringOption((o) =>
    o
      .setName("provider")
      .setDescription("AI provider")
      .setRequired(true)
      .addChoices(
        { name: "Gemini (FREE)", value: "gemini" },
        { name: "OpenAI GPT", value: "openai" },
        { name: "Anthropic Claude", value: "anthropic" },
        { name: "Grok", value: "grok" }
      )
  )
  .addStringOption((o) =>
    o
      .setName("model")
      .setDescription("AI model")
      .setRequired(true)
      .addChoices(
        { name: "Gemini 1.5 Flash (FREE)", value: "gemini-1.5-flash" },
        { name: "Gemini 1.5 Pro", value: "gemini-1.5-pro" },
        { name: "GPT-4o", value: "gpt-4o" },
        { name: "GPT-4o Mini", value: "gpt-4o-mini" },
        { name: "Claude 3.5 Sonnet", value: "claude-3-5-sonnet-20241022" },
        { name: "Claude 3.5 Haiku", value: "claude-3-5-haiku-20241022" }
      )
  )
  .addIntegerOption((o) => o.setName("monthly-limit").setDescription("Monthly message limit (leave empty for unlimited)").setMinValue(1).setRequired(false))
  .addIntegerOption((o) => o.setName("expires-days").setDescription("Expires in X days (leave empty for never)").setMinValue(1).setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false);

export const { data, execute } = createCommand(commandData)
  .use(loggingMiddleware())
  .use(guildOnlyMiddleware())
  .use(permissionMiddleware([PermissionFlagsBits.ManageGuild]))
  .use(rateLimitMiddleware({ max: 10, window: 60000, scope: "user" }))
  .setHandler(async (interaction) => {
    await interaction.deferReply({ ephemeral: true });

    const user = interaction.options.getUser("user", true);
    const provider = interaction.options.getString("provider", true);
    const model = interaction.options.getString("model", true);
    const monthlyLimit = interaction.options.getInteger("monthly-limit");
    const expiresDays = interaction.options.getInteger("expires-days");

    // Ensure user exists in database
    await ensureUser(user);

    // Calculate expiration
    const expiresAt = expiresDays ? new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000) : null;

    // Check if user already has access
    const existing = await db.query.aiUserAccess.findFirst({
      where: (a, { eq, and }) => and(eq(a.userId, user.id), eq(a.guildId, interaction.guild!.id)),
    });

    if (existing) {
      // Update existing access
      await db
        .update(aiUserAccess)
        .set({
          provider: provider as any,
          model,
          monthlyLimit: monthlyLimit || null,
          expiresAt,
          usedThisMonth: 0, // Reset usage
        })
        .where(eq(aiUserAccess.id, existing.id));

      await interaction.editReply({
        content: `✅ Updated AI access for ${user}!\n**Provider:** ${provider}\n**Model:** ${model}${monthlyLimit ? `\n**Monthly Limit:** ${monthlyLimit} messages` : "\n**Monthly Limit:** Unlimited"}${expiresAt ? `\n**Expires:** <t:${Math.floor(expiresAt.getTime() / 1000)}:R>` : "\n**Expires:** Never"}`,
      });
    } else {
      // Grant new access
      await db.insert(aiUserAccess).values({
        id: nanoid(),
        userId: user.id,
        guildId: interaction.guild!.id,
        provider: provider as any,
        model,
        monthlyLimit: monthlyLimit || null,
        usedThisMonth: 0,
        expiresAt,
        grantedBy: interaction.user.id,
      });

      await interaction.editReply({
        content: `✅ Granted AI access to ${user}!\n**Provider:** ${provider}\n**Model:** ${model}${monthlyLimit ? `\n**Monthly Limit:** ${monthlyLimit} messages` : "\n**Monthly Limit:** Unlimited"}${expiresAt ? `\n**Expires:** <t:${Math.floor(expiresAt.getTime() / 1000)}:R>` : "\n**Expires:** Never"}`,
      });
    }
  })
  .build();
