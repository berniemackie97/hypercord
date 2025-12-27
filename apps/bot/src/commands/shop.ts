import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { z } from "zod";
import { createCommand } from "../core/commandBuilder.js";
import { loggingMiddleware, guildOnlyMiddleware, permissionMiddleware } from "../core/middleware.js";
import { rateLimitMiddleware } from "../core/rateLimiter.js";
import { validationMiddleware, schemas, getValidatedOptions } from "../core/validation.js";
import { db } from "../db/index.js";
import { shopItems } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { removeBalance, formatCurrency } from "../utils/economy.js";

const optionsSchema = z.object({
  action: z.enum(["view", "buy", "add", "remove"]),
  item: z.string().optional(),
  name: z.string().optional(),
  price: schemas.nonNegativeInt.optional(),
  role: schemas.snowflake.optional(),
});

const commandData = new SlashCommandBuilder()
  .setName("shop")
  .setDescription("Server shop - buy roles and items")
  .addSubcommand((sub) =>
    sub.setName("view").setDescription("View available shop items")
  )
  .addSubcommand((sub) =>
    sub
      .setName("buy")
      .setDescription("Buy an item from the shop")
      .addStringOption((o) => o.setName("item").setDescription("Item name").setRequired(true))
  )
  .addSubcommand((sub) =>
    sub
      .setName("add")
      .setDescription("Add a role to the shop")
      .addStringOption((o) => o.setName("name").setDescription("Item name").setRequired(true))
      .addIntegerOption((o) => o.setName("price").setDescription("Price").setMinValue(1).setRequired(true))
      .addRoleOption((o) => o.setName("role").setDescription("Role to give").setRequired(true))
  )
  .addSubcommand((sub) =>
    sub
      .setName("remove")
      .setDescription("Remove an item from the shop")
      .addStringOption((o) => o.setName("item").setDescription("Item name").setRequired(true))
  )
  .setDMPermission(false);

export const { data, execute } = createCommand(commandData)
  .use(loggingMiddleware())
  .use(guildOnlyMiddleware())
  .use(rateLimitMiddleware({ max: 10, window: 60000, scope: "user" }))
  .setHandler(async (interaction) => {
    const subcommand = interaction.options.getSubcommand();
    await interaction.deferReply({ ephemeral: subcommand !== "view" });

    const guild = interaction.guild!;

    if (subcommand === "view") {
      const items = await db
        .select()
        .from(shopItems)
        .where(and(eq(shopItems.guildId, guild.id), eq(shopItems.enabled, true)));

      if (items.length === 0) {
        await interaction.editReply({ content: "🛒 The shop is empty!" });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`🛒 ${guild.name} Shop`)
        .setColor(0xffd700)
        .setDescription("Use `/shop buy <item>` to purchase!")
        .setTimestamp();

      for (const item of items) {
        const emoji = item.emoji || "📦";
        const stock = item.stock ? ` (${item.stock} left)` : "";
        embed.addFields({
          name: `${emoji} ${item.name}`,
          value: `${item.description || "No description"}\n**Price:** ${formatCurrency(item.price)}${stock}`,
          inline: false,
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } else if (subcommand === "buy") {
      const itemName = interaction.options.getString("item", true);

      const item = await db.query.shopItems.findFirst({
        where: (s, { eq, and }) => and(eq(s.guildId, guild.id), eq(s.name, itemName), eq(s.enabled, true)),
      });

      if (!item) {
        await interaction.editReply({ content: "❌ Item not found!" });
        return;
      }

      if (item.stock !== null && item.stock <= 0) {
        await interaction.editReply({ content: "❌ This item is out of stock!" });
        return;
      }

      const result = await removeBalance(interaction.user.id, guild.id, item.price, `shop_${item.name}`);

      if (result === null) {
        await interaction.editReply({ content: `❌ You don't have enough currency! You need ${formatCurrency(item.price)}.` });
        return;
      }

      // Give role if it's a role item
      if (item.type === "role" && item.roleId) {
        const member = await guild.members.fetch(interaction.user.id);
        const role = await guild.roles.fetch(item.roleId);

        if (role) {
          await member.roles.add(role);
        }
      }

      // Update stock
      if (item.stock !== null) {
        await db
          .update(shopItems)
          .set({ stock: item.stock - 1 })
          .where(eq(shopItems.id, item.id));
      }

      await interaction.editReply({ content: `✅ Successfully purchased **${item.name}** for ${formatCurrency(item.price)}!` });
    } else if (subcommand === "add") {
      // Check permissions
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.editReply({ content: "❌ You need Manage Server permission!" });
        return;
      }

      const name = interaction.options.getString("name", true);
      const price = interaction.options.getInteger("price", true);
      const role = interaction.options.getRole("role", true);

      await db.insert(shopItems).values({
        id: nanoid(),
        guildId: guild.id,
        name,
        type: "role",
        price,
        roleId: role.id,
        enabled: true,
      });

      await interaction.editReply({ content: `✅ Added **${name}** to the shop for ${formatCurrency(price)}!` });
    } else if (subcommand === "remove") {
      // Check permissions
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.editReply({ content: "❌ You need Manage Server permission!" });
        return;
      }

      const itemName = interaction.options.getString("item", true);

      const result = await db
        .delete(shopItems)
        .where(and(eq(shopItems.guildId, guild.id), eq(shopItems.name, itemName)));

      await interaction.editReply({ content: `✅ Removed **${itemName}** from the shop!` });
    }
  })
  .build();
